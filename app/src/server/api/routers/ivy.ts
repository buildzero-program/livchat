/**
 * Ivy Router
 * Gerencia conversas com a assistente virtual Ivy via AST
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, hybridProcedure } from "~/server/api/trpc";
import { createASTClient, type ASTInvokeResponse } from "~/server/lib/ast";
import {
  createThread,
  getThread,
  getThreadWithWorkflow,
  getActiveThreadByUser,
  getActiveThreadByDevice,
  listThreadsByUser,
  listThreadsByDevice,
  archiveThread,
  incrementMessageCount,
  getIvyWorkflow,
} from "~/server/lib/thread";
import { env } from "~/env";

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Cria cliente AST com configuração do ambiente
 */
function getASTClient() {
  return createASTClient({
    baseUrl: env.AST_URL,
    apiKey: env.AST_API_KEY,
  });
}

// =============================================================================
// ROUTER
// =============================================================================

export const ivyRouter = createTRPCRouter({
  /**
   * Busca o thread ativo do usuário/device para a Ivy
   */
  getActiveThread: hybridProcedure.query(async ({ ctx }) => {
    const { user, device, log } = ctx;

    // Busca o workflow da Ivy
    const ivyWorkflow = await getIvyWorkflow();
    if (!ivyWorkflow) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Ivy workflow not configured",
      });
    }

    // Busca thread ativo
    let thread = null;

    if (user) {
      thread = await getActiveThreadByUser(user.id, ivyWorkflow.id);
      log.debug("ivy.getActiveThread", "Searching by user", {
        userId: user.id,
        found: !!thread,
      });
    } else if (device) {
      thread = await getActiveThreadByDevice(device.id, ivyWorkflow.id);
      log.debug("ivy.getActiveThread", "Searching by device", {
        deviceId: device.id,
        found: !!thread,
      });
    }

    return {
      thread,
      workflow: {
        id: ivyWorkflow.id,
        name: ivyWorkflow.name,
        description: ivyWorkflow.description,
      },
    };
  }),

  /**
   * Lista threads do usuário/device
   */
  listThreads: hybridProcedure
    .input(
      z
        .object({
          status: z.enum(["active", "archived"]).optional(),
          limit: z.number().min(1).max(100).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const { user, device, log } = ctx;

      if (user) {
        const threads = await listThreadsByUser(user.id, {
          status: input?.status,
          limit: input?.limit,
        });
        log.debug("ivy.listThreads", "Listed by user", {
          userId: user.id,
          count: threads.length,
        });
        return { threads };
      }

      if (device) {
        const threads = await listThreadsByDevice(device.id, {
          status: input?.status,
          limit: input?.limit,
        });
        log.debug("ivy.listThreads", "Listed by device", {
          deviceId: device.id,
          count: threads.length,
        });
        return { threads };
      }

      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "No user or device context available",
      });
    }),

  /**
   * Cria uma nova conversa com a Ivy
   */
  newConversation: hybridProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { user, device, log } = ctx;

      // Busca o workflow da Ivy
      const ivyWorkflow = await getIvyWorkflow();
      if (!ivyWorkflow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ivy workflow not configured",
        });
      }

      // Cria novo thread
      const thread = await createThread({
        workflowId: ivyWorkflow.id,
        organizationId: user?.organizationId ?? undefined,
        userId: user?.id ?? undefined,
        deviceId: device?.id ?? undefined,
        title: input.title,
      });

      log.info("ivy.newConversation", "New conversation created", {
        threadId: thread.id,
        workflowId: ivyWorkflow.id,
      });

      return {
        thread,
        workflow: {
          id: ivyWorkflow.id,
          name: ivyWorkflow.name,
          description: ivyWorkflow.description,
        },
      };
    }),

  /**
   * Envia uma mensagem para a Ivy (síncrono)
   */
  send: hybridProcedure
    .input(
      z.object({
        threadId: z.string().uuid(),
        message: z.string().min(1).max(4096),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { log } = ctx;

      // Busca thread com workflow
      const threadWithWorkflow = await getThreadWithWorkflow(input.threadId);
      if (!threadWithWorkflow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Thread not found",
        });
      }

      if (threadWithWorkflow.status === "archived") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot send message to archived thread",
        });
      }

      const { workflow } = threadWithWorkflow;

      // Invoca o AST
      const ast = getASTClient();
      let response: ASTInvokeResponse;

      try {
        response = await ast.invoke(workflow.providerId, {
          message: input.message,
          threadId: threadWithWorkflow.providerThreadId,
        });
      } catch (error) {
        log.error("ivy.send", "AST invoke failed", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Failed to send message",
        });
      }

      // Incrementa contador de mensagens (+2: user + assistant)
      await incrementMessageCount(input.threadId);
      await incrementMessageCount(input.threadId);

      log.info("ivy.send", "Message sent", {
        threadId: input.threadId,
        messageLength: input.message.length,
        responseLength: response.message.content.length,
      });

      return {
        response: response.message.content,
        threadId: input.threadId,
        messageCount: threadWithWorkflow.messageCount + 2,
      };
    }),

  /**
   * Arquiva um thread
   */
  archiveThread: hybridProcedure
    .input(
      z.object({
        threadId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { log } = ctx;

      const thread = await getThread(input.threadId);
      if (!thread) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Thread not found",
        });
      }

      const archived = await archiveThread(input.threadId);

      log.info("ivy.archiveThread", "Thread archived", {
        threadId: input.threadId,
      });

      return { thread: archived };
    }),
});
