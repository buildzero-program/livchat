import { z } from "zod";
import { createTRPCRouter, hybridProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { events } from "~/server/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { ROADMAP_ITEMS } from "~/lib/roadmap-data";
import { logEvent } from "~/server/lib/events";
import { EventTypes } from "~/lib/events";
import { getRedis } from "~/server/lib/redis";

// ═══════════════════════════════════════════════════════════════════════════
// Roadmap Router
// Sistema de votos para roadmap público
// ═══════════════════════════════════════════════════════════════════════════

export const roadmapRouter = createTRPCRouter({
  /**
   * roadmap.list
   * Lista todos os items do roadmap com contagem de votos agregada
   * Também retorna se o usuário atual já votou em cada item
   */
  list: hybridProcedure.query(async ({ ctx }) => {
    const { device, log } = ctx;

    try {
      // Maps para contagem e estado de voto
      const voteCountMap = new Map<string, number>();
      const userVoteState = new Map<string, boolean>();

      // Só faz queries de votos se tiver device
      if (device) {
        // 1. Buscar todos os eventos de voto
        const allVotes = await db
          .select({
            itemId: sql<string>`metadata->>'itemId'`,
            action: sql<string>`metadata->>'action'`,
            deviceId: events.deviceId,
          })
          .from(events)
          .where(eq(events.name, EventTypes.ROADMAP_VOTE));

        // Processar votos
        const upvoteCount = new Map<string, number>();
        const removeCount = new Map<string, number>();

        for (const vote of allVotes) {
          if (!vote.itemId) continue;

          if (vote.action === "upvote") {
            upvoteCount.set(vote.itemId, (upvoteCount.get(vote.itemId) ?? 0) + 1);
          } else if (vote.action === "remove") {
            removeCount.set(vote.itemId, (removeCount.get(vote.itemId) ?? 0) + 1);
          }
        }

        // Calcular contagem líquida
        for (const [itemId, count] of upvoteCount) {
          const removes = removeCount.get(itemId) ?? 0;
          voteCountMap.set(itemId, Math.max(0, count - removes));
        }

        // 2. Buscar último voto do device atual por item
        const userVotes = await db
          .select({
            itemId: sql<string>`metadata->>'itemId'`,
            action: sql<string>`metadata->>'action'`,
            createdAt: events.createdAt,
          })
          .from(events)
          .where(
            and(
              eq(events.name, EventTypes.ROADMAP_VOTE),
              eq(events.deviceId, device.id)
            )
          )
          .orderBy(sql`created_at DESC`);

        // Determinar estado atual (último voto por item)
        for (const vote of userVotes) {
          if (!vote.itemId) continue;
          if (!userVoteState.has(vote.itemId)) {
            userVoteState.set(vote.itemId, vote.action === "upvote");
          }
        }
      }

      // 3. Merge com items hardcoded
      const result = ROADMAP_ITEMS.map((item) => ({
        ...item,
        votes: voteCountMap.get(item.id) ?? 0,
        hasVoted: userVoteState.get(item.id) ?? false,
      }));

      log.debug("roadmap.list", "Listed roadmap items", {
        totalItems: result.length,
        deviceId: device?.id,
      });

      return result;
    } catch (error) {
      log.error("roadmap.list", "Failed to list roadmap items", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Erro ao listar roadmap",
      });
    }
  }),

  /**
   * roadmap.vote
   * Registra um voto (upvote) em um item do roadmap
   * Deduplicação: 1 voto por device por item
   */
  vote: hybridProcedure
    .input(z.object({ itemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { device, user, log } = ctx;
      const { itemId } = input;

      if (!device) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Device não identificado",
        });
      }

      // Validar que o item existe
      const item = ROADMAP_ITEMS.find((i) => i.id === itemId);
      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Item não encontrado",
        });
      }

      try {
        // Check se já votou (Redis primeiro, fallback DB)
        const redis = getRedis();
        const voteKey = `vote:${device.id}:${itemId}`;
        let hasVoted = false;

        if (redis) {
          try {
            hasVoted = (await redis.exists(voteKey)) === 1;
          } catch {
            // Redis falhou, usar fallback
          }
        }

        if (!hasVoted) {
          // Fallback: verificar último voto no banco
          const lastVote = await db
            .select({
              action: sql<string>`metadata->>'action'`,
            })
            .from(events)
            .where(
              and(
                eq(events.name, EventTypes.ROADMAP_VOTE),
                eq(events.deviceId, device.id),
                sql`metadata->>'itemId' = ${itemId}`
              )
            )
            .orderBy(sql`created_at DESC`)
            .limit(1);

          hasVoted = lastVote[0]?.action === "upvote";
        }

        if (hasVoted) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Você já votou neste item",
          });
        }

        // Registrar voto
        await logEvent({
          name: EventTypes.ROADMAP_VOTE,
          deviceId: device.id,
          metadata: {
            itemId,
            action: "upvote",
            userId: user?.id,
            source: "web",
          },
        });

        // Marcar no Redis (sem TTL = permanente)
        if (redis) {
          try {
            await redis.set(voteKey, "1");
          } catch {
            // Redis falhou, ok - DB é source of truth
          }
        }

        // Calcular nova contagem
        const newCount = await getVoteCount(itemId);

        log.info("roadmap.vote", "Vote registered", {
          itemId,
          deviceId: device.id,
          userId: user?.id,
          newCount,
        });

        return { success: true, votes: newCount };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        log.error("roadmap.vote", "Failed to register vote", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao registrar voto",
        });
      }
    }),

  /**
   * roadmap.unvote
   * Remove um voto de um item do roadmap
   */
  unvote: hybridProcedure
    .input(z.object({ itemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { device, user, log } = ctx;
      const { itemId } = input;

      if (!device) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Device não identificado",
        });
      }

      // Validar que o item existe
      const item = ROADMAP_ITEMS.find((i) => i.id === itemId);
      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Item não encontrado",
        });
      }

      try {
        // Registrar remoção do voto
        await logEvent({
          name: EventTypes.ROADMAP_VOTE,
          deviceId: device.id,
          metadata: {
            itemId,
            action: "remove",
            userId: user?.id,
            source: "web",
          },
        });

        // Remover do Redis
        const redis = getRedis();
        if (redis) {
          try {
            await redis.del(`vote:${device.id}:${itemId}`);
          } catch {
            // Redis falhou, ok
          }
        }

        // Calcular nova contagem
        const newCount = await getVoteCount(itemId);

        log.info("roadmap.unvote", "Vote removed", {
          itemId,
          deviceId: device.id,
          userId: user?.id,
          newCount,
        });

        return { success: true, votes: newCount };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        log.error("roadmap.unvote", "Failed to remove vote", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao remover voto",
        });
      }
    }),
});

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calcula contagem líquida de votos para um item
 * (upvotes - removes)
 */
async function getVoteCount(itemId: string): Promise<number> {
  const votes = await db
    .select({
      action: sql<string>`metadata->>'action'`,
    })
    .from(events)
    .where(
      and(
        eq(events.name, EventTypes.ROADMAP_VOTE),
        sql`metadata->>'itemId' = ${itemId}`
      )
    );

  let upvotes = 0;
  let removes = 0;

  for (const vote of votes) {
    if (vote.action === "upvote") upvotes++;
    else if (vote.action === "remove") removes++;
  }

  return Math.max(0, upvotes - removes);
}
