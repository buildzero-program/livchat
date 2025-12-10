import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import {
  listApiKeys,
  revokeApiKey,
  deleteApiKey,
} from "~/server/lib/api-key";
import { LogActions } from "~/server/lib/logger";

export const apiKeysRouter = createTRPCRouter({
  /**
   * apiKeys.list
   * Lists all API keys for the organization (with masked tokens)
   *
   * NOTE: API keys are created automatically when WhatsApp connects.
   * There is no manual create endpoint - keys follow the instance lifecycle.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const { user, log } = ctx;

    try {
      const keys = await listApiKeys(user.organizationId);

      log.debug(LogActions.API_KEY_USE, "Listed API keys", {
        count: keys.length,
      });

      return keys.map((key) => ({
        id: key.id,
        name: key.name,
        maskedToken: key.maskedToken,
        scopes: key.scopes,
        instanceId: key.instanceId,
        isActive: key.isActive,
        lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
        expiresAt: key.expiresAt?.toISOString() ?? null,
        createdAt: key.createdAt.toISOString(),
      }));
    } catch (error) {
      log.error(LogActions.API_KEY_USE, "Failed to list API keys", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to list API keys",
      });
    }
  }),

  /**
   * apiKeys.revoke
   * Deactivates an API key (soft delete)
   */
  revoke: protectedProcedure
    .input(z.object({ keyId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { user, log } = ctx;

      // First verify the key belongs to this organization
      const keys = await listApiKeys(user.organizationId);
      const targetKey = keys.find((k) => k.id === input.keyId);

      if (!targetKey) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "API key not found",
        });
      }

      try {
        const revoked = await revokeApiKey(input.keyId);

        if (!revoked) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "API key not found",
          });
        }

        log.info(LogActions.API_KEY_REVOKE, "API key revoked via tRPC", {
          keyId: input.keyId,
        });

        return { success: true, keyId: revoked.id };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        log.error(LogActions.API_KEY_REVOKE, "Failed to revoke API key", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to revoke API key",
        });
      }
    }),

  /**
   * apiKeys.delete
   * Permanently deletes an API key
   */
  delete: protectedProcedure
    .input(z.object({ keyId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { user, log } = ctx;

      // First verify the key belongs to this organization
      const keys = await listApiKeys(user.organizationId);
      const targetKey = keys.find((k) => k.id === input.keyId);

      if (!targetKey) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "API key not found",
        });
      }

      try {
        const deleted = await deleteApiKey(input.keyId);

        if (!deleted) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "API key not found",
          });
        }

        log.info(LogActions.API_KEY_DELETE, "API key deleted via tRPC", {
          keyId: input.keyId,
        });

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        log.error(LogActions.API_KEY_DELETE, "Failed to delete API key", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete API key",
        });
      }
    }),
});
