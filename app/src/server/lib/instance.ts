import { db } from "~/server/db";
import { instances } from "~/server/db/schema";
import { eq, and, isNull, isNotNull, lt, ne, or, asc, sql } from "drizzle-orm";
import { WuzAPIClient, createWuzAPIInstance } from "./wuzapi";
import { env } from "~/env";
import { DEMO_MESSAGE_LIMIT } from "~/lib/constants";

const WUZAPI_BASE_URL = env.WUZAPI_URL;
const WUZAPI_ADMIN_TOKEN = env.WUZAPI_ADMIN_TOKEN;

// Threshold para considerar instance órfã (em horas)
const ORPHAN_THRESHOLD_HOURS = 8;

export interface InstanceWithClient {
  instance: typeof instances.$inferSelect;
  client: WuzAPIClient;
}

/**
 * Gera token único para WuzAPI
 */
function generateProviderToken(): string {
  return `lc_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

/**
 * Gera ID único para user no WuzAPI
 */
function generateProviderId(): string {
  return `livchat_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

/**
 * Busca instance VIRGEM do device (não claimed E nunca conectou).
 *
 * IMPORTANTE: Só retorna se whatsappJid IS NULL.
 * Se já conectou antes, ignora (token pode ter vazado).
 */
export async function getDeviceInstance(
  deviceId: string
): Promise<InstanceWithClient | null> {
  const instance = await db.query.instances.findFirst({
    where: and(
      eq(instances.createdByDeviceId, deviceId),
      isNull(instances.organizationId), // Não claimed
      isNull(instances.whatsappJid) // CRÍTICO: só virgem!
    ),
  });

  if (!instance) return null;

  // Atualizar lastActivityAt para evitar que seja considerada órfã
  await db
    .update(instances)
    .set({ lastActivityAt: new Date() })
    .where(eq(instances.id, instance.id));

  const client = new WuzAPIClient({
    baseUrl: WUZAPI_BASE_URL,
    token: instance.providerToken,
  });

  return { instance, client };
}

/**
 * Busca instance CONECTADA do device (já logou no WhatsApp).
 * Usada para devices que já completaram o fluxo de login.
 */
export async function getConnectedDeviceInstance(
  deviceId: string
): Promise<InstanceWithClient | null> {
  const instance = await db.query.instances.findFirst({
    where: and(
      eq(instances.createdByDeviceId, deviceId),
      isNull(instances.organizationId), // Não claimed
      isNotNull(instances.whatsappJid) // Já conectou
    ),
  });

  if (!instance) return null;

  // Atualizar lastActivityAt
  await db
    .update(instances)
    .set({ lastActivityAt: new Date() })
    .where(eq(instances.id, instance.id));

  const client = new WuzAPIClient({
    baseUrl: WUZAPI_BASE_URL,
    token: instance.providerToken,
  });

  return { instance, client };
}

/**
 * Busca instance por ID com verificação de acesso
 */
export async function getInstanceWithAccess(
  instanceId: string,
  context: { deviceId?: string; organizationId?: string }
): Promise<InstanceWithClient | null> {
  const instance = await db.query.instances.findFirst({
    where: eq(instances.id, instanceId),
  });

  if (!instance) return null;

  // Verificar acesso
  const hasAccess =
    // Anônimo: device que criou + não claimed
    (instance.organizationId === null &&
      instance.createdByDeviceId === context.deviceId) ||
    // Logado: pertence à org do user
    (instance.organizationId !== null &&
      instance.organizationId === context.organizationId);

  if (!hasAccess) return null;

  const client = new WuzAPIClient({
    baseUrl: WUZAPI_BASE_URL,
    token: instance.providerToken,
  });

  return { instance, client };
}

/**
 * Cria nova instance para device (anônima)
 */
export async function createInstanceForDevice(
  deviceId: string
): Promise<InstanceWithClient> {
  if (!WUZAPI_ADMIN_TOKEN) {
    throw new Error("WUZAPI_ADMIN_TOKEN not configured");
  }

  const providerId = generateProviderId();
  const providerToken = generateProviderToken();

  // Criar user no WuzAPI
  try {
    await createWuzAPIInstance(
      WUZAPI_BASE_URL,
      WUZAPI_ADMIN_TOKEN,
      providerId, // name no WuzAPI
      providerToken, // token no WuzAPI
      "Message" // events
    );
  } catch (error) {
    console.error("Failed to create WuzAPI instance:", error);
    throw new Error("Failed to create WhatsApp instance");
  }

  // Criar instance no nosso banco
  const [instance] = await db
    .insert(instances)
    .values({
      createdByDeviceId: deviceId,
      organizationId: null, // Anônima
      name: "WhatsApp Demo",
      providerId,
      providerToken,
      providerType: "wuzapi",
      status: "disconnected",
    })
    .returning();

  if (!instance) {
    throw new Error("Failed to create instance in database");
  }

  const client = new WuzAPIClient({
    baseUrl: WUZAPI_BASE_URL,
    token: providerToken,
  });

  return { instance, client };
}

/**
 * Atualiza status da instance baseado no WuzAPI
 */
export async function syncInstanceStatus(
  instanceId: string,
  status: {
    connected?: boolean;
    loggedIn?: boolean;
    jid?: string;
    name?: string;
  }
): Promise<void> {
  const updates: Partial<typeof instances.$inferInsert> = {
    updatedAt: new Date(),
    lastActivityAt: new Date(), // Sempre atualiza atividade no sync
  };

  if (status.loggedIn !== undefined) {
    updates.status = status.loggedIn ? "connected" : "disconnected";
    if (status.loggedIn) {
      updates.lastConnectedAt = new Date();
    }
  }

  if (status.jid) {
    updates.whatsappJid = status.jid;
  }

  if (status.name) {
    updates.whatsappName = status.name;
  }

  await db.update(instances).set(updates).where(eq(instances.id, instanceId));
}

/**
 * Verifica e reseta contador de mensagens se necessário (lazy reset)
 */
function checkAndResetMessageCount(instance: typeof instances.$inferSelect): {
  currentCount: number;
  needsReset: boolean;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastReset = instance.lastMessageResetAt;
  const needsReset = !lastReset || lastReset < today;
  const currentCount = needsReset ? 0 : instance.messagesUsedToday;

  return { currentCount, needsReset };
}

/**
 * Verifica se instance pode enviar mensagens
 */
export async function canSendMessage(
  instanceId: string
): Promise<{ canSend: boolean; used: number; limit: number; remaining: number }> {
  const instance = await db.query.instances.findFirst({
    where: eq(instances.id, instanceId),
    with: { organization: true },
  });

  if (!instance) {
    return { canSend: false, used: 0, limit: 0, remaining: 0 };
  }

  const { currentCount } = checkAndResetMessageCount(instance);
  const limit = instance.organization?.maxMessagesPerDay ?? DEMO_MESSAGE_LIMIT;

  return {
    canSend: currentCount < limit,
    used: currentCount,
    limit,
    remaining: Math.max(0, limit - currentCount),
  };
}

/**
 * Incrementa contador de mensagens (com lazy reset)
 */
export async function incrementMessageCount(instanceId: string): Promise<{
  used: number;
  limit: number;
  remaining: number;
}> {
  const instance = await db.query.instances.findFirst({
    where: eq(instances.id, instanceId),
    with: { organization: true },
  });

  if (!instance) throw new Error("Instance not found");

  const { currentCount, needsReset } = checkAndResetMessageCount(instance);
  const newCount = currentCount + 1;

  // Limite: org (se claimed) ou default (50)
  const limit = instance.organization?.maxMessagesPerDay ?? DEMO_MESSAGE_LIMIT;

  await db
    .update(instances)
    .set({
      messagesUsedToday: newCount,
      lastMessageAt: new Date(),
      lastMessageResetAt: needsReset ? new Date() : instance.lastMessageResetAt,
      lastActivityAt: new Date(), // Atualiza atividade ao enviar mensagem
      updatedAt: new Date(),
    })
    .where(eq(instances.id, instanceId));

  return {
    used: newCount,
    limit,
    remaining: Math.max(0, limit - newCount),
  };
}

/**
 * Claim instances de um device para uma organization
 */
export async function claimDeviceInstances(
  deviceId: string,
  organizationId: string
): Promise<number> {
  const result = await db
    .update(instances)
    .set({
      organizationId,
      claimedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(instances.createdByDeviceId, deviceId),
        isNull(instances.organizationId)
      )
    )
    .returning();

  return result.length;
}

/**
 * Busca todas instances de uma organization
 */
export async function getOrganizationInstances(organizationId: string) {
  return db.query.instances.findMany({
    where: eq(instances.organizationId, organizationId),
  });
}

/**
 * Busca instance por ID (sem verificação de acesso)
 */
export async function getInstanceById(instanceId: string) {
  return db.query.instances.findFirst({
    where: eq(instances.id, instanceId),
  });
}

/**
 * Busca instance órfã VIRGEM (nunca conectou) e a adota.
 *
 * Critérios:
 * - organizationId IS NULL (não claimed)
 * - whatsappJid IS NULL (NUNCA conectou - token não vazou)
 * - createdAt < NOW() - 8h (abandonada)
 * - status = 'disconnected'
 *
 * NÃO reutiliza instances que já conectaram (token vazado).
 */
export async function getOrReuseVirginOrphan(
  deviceId: string
): Promise<InstanceWithClient | null> {
  const thresholdDate = new Date();
  thresholdDate.setHours(thresholdDate.getHours() - ORPHAN_THRESHOLD_HOURS);

  return db.transaction(async (tx) => {
    // Buscar órfã VIRGEM mais antiga
    const orphan = await tx.query.instances.findFirst({
      where: and(
        isNull(instances.organizationId), // Não claimed
        isNull(instances.whatsappJid), // NUNCA conectou (crítico!)
        eq(instances.status, "disconnected"),
        lt(instances.createdAt, thresholdDate), // Criada há 8h+
        // Não pegar a do próprio device
        or(
          isNull(instances.createdByDeviceId),
          ne(instances.createdByDeviceId, deviceId)
        )
      ),
      orderBy: [asc(instances.createdAt)], // Mais antiga primeiro (FIFO)
    });

    if (!orphan) {
      return null;
    }

    // Fazer logout no WuzAPI (limpa QR pendente)
    try {
      const client = new WuzAPIClient({
        baseUrl: WUZAPI_BASE_URL,
        token: orphan.providerToken,
      });
      await client.logout();
    } catch (error) {
      // Ignorar erro (pode já estar desconectada)
      console.warn(`[orphan-reuse] Logout failed for ${orphan.id}:`, error);
    }

    // Adotar a órfã
    const [adopted] = await tx
      .update(instances)
      .set({
        createdByDeviceId: deviceId,
        status: "disconnected",
        lastConnectedAt: null,
        messagesUsedToday: 0,
        lastMessageAt: null,
        lastMessageResetAt: new Date(),
        reuseCount: sql`${instances.reuseCount} + 1`,
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(instances.id, orphan.id))
      .returning();

    if (!adopted) {
      return null; // Race condition - outra transação pegou
    }

    console.log(
      `[orphan-reuse] Device ${deviceId.slice(0, 8)}... adopted virgin orphan ${adopted.id} (reuse #${adopted.reuseCount})`
    );

    const client = new WuzAPIClient({
      baseUrl: WUZAPI_BASE_URL,
      token: adopted.providerToken,
    });

    return { instance: adopted, client };
  });
}

/**
 * Deleta órfãs "abusadas" (que já conectaram - token vazou).
 * Roda em BACKGROUND após retornar response ao cliente.
 *
 * Critérios para deletar:
 * - organizationId IS NULL (não claimed)
 * - whatsappJid IS NOT NULL (já conectou - token vazado!)
 * - lastActivityAt < NOW() - 8h (abandonada)
 */
export async function cleanupAbusedOrphans(): Promise<number> {
  const thresholdDate = new Date();
  thresholdDate.setHours(thresholdDate.getHours() - ORPHAN_THRESHOLD_HOURS);

  try {
    // Buscar órfãs abusadas
    const abused = await db.query.instances.findMany({
      where: and(
        isNull(instances.organizationId),
        isNotNull(instances.whatsappJid), // JÁ CONECTOU (token vazou)
        lt(instances.lastActivityAt, thresholdDate)
      ),
      limit: 10, // Processar em batches pequenos
    });

    if (abused.length === 0) {
      return 0;
    }

    let deletedCount = 0;

    for (const orphan of abused) {
      try {
        // Fazer logout no WuzAPI
        const client = new WuzAPIClient({
          baseUrl: WUZAPI_BASE_URL,
          token: orphan.providerToken,
        });

        try {
          await client.logout();
        } catch {
          // Ignorar erro de logout
        }

        // Deletar user no WuzAPI (via admin API)
        if (WUZAPI_ADMIN_TOKEN) {
          try {
            await fetch(`${WUZAPI_BASE_URL}/admin/users/${orphan.providerId}`, {
              method: "DELETE",
              headers: { Authorization: WUZAPI_ADMIN_TOKEN },
            });
          } catch {
            // Ignorar erro de delete no WuzAPI
          }
        }

        // Deletar do banco
        await db.delete(instances).where(eq(instances.id, orphan.id));
        deletedCount++;

        console.log(
          `[cleanup] Deleted abused orphan ${orphan.id} (token was leaked)`
        );
      } catch (error) {
        console.error(`[cleanup] Failed to delete ${orphan.id}:`, error);
      }
    }

    return deletedCount;
  } catch (error) {
    console.error("[cleanup] Error in cleanupAbusedOrphans:", error);
    return 0;
  }
}
