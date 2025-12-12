import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { webhooks, events } from "~/server/db/schema";
import { EventTypes } from "~/lib/events";
import { forwardToUserWebhooks, buildWebhookPayload } from "~/server/lib/webhook-forwarder";

// ═══════════════════════════════════════════════════════════════════════════
// Schemas
// ═══════════════════════════════════════════════════════════════════════════

const createWebhookSchema = z.object({
  url: z.string().url().refine(
    (url) => url.startsWith("https://") || process.env.NODE_ENV === "development",
    "URL must use HTTPS in production"
  ),
  signingSecret: z
    .string()
    .min(32, "Signing secret must be at least 32 characters")
    .optional()
    .nullable(),
  headers: z.record(z.string(), z.string()).optional().nullable(),
  instanceIds: z.array(z.string().uuid()).optional().nullable(),
  subscriptions: z.array(z.string()).optional().nullable(),
});

const updateWebhookSchema = z.object({
  webhookId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().refine(
    (url) => url.startsWith("https://") || process.env.NODE_ENV === "development",
    "URL must use HTTPS in production"
  ).optional(),
  signingSecret: z
    .string()
    .min(32, "Signing secret must be at least 32 characters")
    .optional()
    .nullable(),
  headers: z.record(z.string(), z.string()).optional().nullable(),
  instanceIds: z.array(z.string().uuid()).optional().nullable(),
  subscriptions: z.array(z.string()).optional().nullable(),
});

// ═══════════════════════════════════════════════════════════════════════════
// Router
// ═══════════════════════════════════════════════════════════════════════════

export const webhooksRouter = createTRPCRouter({
  /**
   * webhooks.list
   * Lists all webhooks for the organization
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const { user, log } = ctx;

    try {
      const result = await db.query.webhooks.findMany({
        where: eq(webhooks.organizationId, user.organizationId),
        orderBy: [desc(webhooks.createdAt)],
      });

      log.debug("webhook.list", "Listed webhooks", {
        count: result.length,
      });

      return result.map((webhook) => ({
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        isActive: webhook.isActive,
        instanceIds: webhook.instanceIds,
        subscriptions: webhook.subscriptions,
        // Mask signing secret (show only if configured)
        hasSigningSecret: !!webhook.signingSecret,
        headers: webhook.headers,
        createdAt: webhook.createdAt.toISOString(),
        updatedAt: webhook.updatedAt.toISOString(),
      }));
    } catch (error) {
      log.error("webhook.list", "Failed to list webhooks", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to list webhooks",
      });
    }
  }),

  /**
   * webhooks.create
   * Creates a new webhook
   */
  create: protectedProcedure
    .input(createWebhookSchema)
    .mutation(async ({ ctx, input }) => {
      const { user, log } = ctx;

      try {
        const [webhook] = await db
          .insert(webhooks)
          .values({
            organizationId: user.organizationId,
            url: input.url,
            signingSecret: input.signingSecret ?? null,
            headers: input.headers ?? null,
            instanceIds: input.instanceIds ?? null,
            subscriptions: input.subscriptions ?? null,
          })
          .returning();

        if (!webhook) {
          throw new Error("Failed to create webhook");
        }

        log.info("webhook.create", "Webhook created", {
          webhookId: webhook.id,
          url: webhook.url,
        });

        return {
          id: webhook.id,
          name: webhook.name,
          url: webhook.url,
          isActive: webhook.isActive,
          instanceIds: webhook.instanceIds,
          subscriptions: webhook.subscriptions,
          hasSigningSecret: !!webhook.signingSecret,
          headers: webhook.headers,
          createdAt: webhook.createdAt.toISOString(),
          updatedAt: webhook.updatedAt.toISOString(),
        };
      } catch (error) {
        log.error("webhook.create", "Failed to create webhook", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create webhook",
        });
      }
    }),

  /**
   * webhooks.update
   * Updates an existing webhook
   */
  update: protectedProcedure
    .input(updateWebhookSchema)
    .mutation(async ({ ctx, input }) => {
      const { user, log } = ctx;

      // Verify ownership
      const existing = await db.query.webhooks.findFirst({
        where: and(
          eq(webhooks.id, input.webhookId),
          eq(webhooks.organizationId, user.organizationId)
        ),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Webhook not found",
        });
      }

      try {
        const updateData: Record<string, unknown> = {
          updatedAt: new Date(),
        };

        if (input.name !== undefined) updateData.name = input.name;
        if (input.url !== undefined) updateData.url = input.url;
        if (input.signingSecret !== undefined) updateData.signingSecret = input.signingSecret;
        if (input.headers !== undefined) updateData.headers = input.headers;
        if (input.instanceIds !== undefined) updateData.instanceIds = input.instanceIds;
        if (input.subscriptions !== undefined) updateData.subscriptions = input.subscriptions;

        const [webhook] = await db
          .update(webhooks)
          .set(updateData)
          .where(eq(webhooks.id, input.webhookId))
          .returning();

        if (!webhook) {
          throw new Error("Failed to update webhook");
        }

        log.info("webhook.update", "Webhook updated", {
          webhookId: webhook.id,
        });

        return {
          id: webhook.id,
          name: webhook.name,
          url: webhook.url,
          isActive: webhook.isActive,
          instanceIds: webhook.instanceIds,
          subscriptions: webhook.subscriptions,
          hasSigningSecret: !!webhook.signingSecret,
          headers: webhook.headers,
          createdAt: webhook.createdAt.toISOString(),
          updatedAt: webhook.updatedAt.toISOString(),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        log.error("webhook.update", "Failed to update webhook", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update webhook",
        });
      }
    }),

  /**
   * webhooks.delete
   * Permanently deletes a webhook
   */
  delete: protectedProcedure
    .input(z.object({ webhookId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { user, log } = ctx;

      // Verify ownership
      const existing = await db.query.webhooks.findFirst({
        where: and(
          eq(webhooks.id, input.webhookId),
          eq(webhooks.organizationId, user.organizationId)
        ),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Webhook not found",
        });
      }

      try {
        await db.delete(webhooks).where(eq(webhooks.id, input.webhookId));

        log.info("webhook.delete", "Webhook deleted", {
          webhookId: input.webhookId,
        });

        return { success: true };
      } catch (error) {
        log.error("webhook.delete", "Failed to delete webhook", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete webhook",
        });
      }
    }),

  /**
   * webhooks.toggle
   * Toggle webhook active/inactive status
   */
  toggle: protectedProcedure
    .input(z.object({
      webhookId: z.string().uuid(),
      isActive: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { user, log } = ctx;

      // Verify ownership
      const existing = await db.query.webhooks.findFirst({
        where: and(
          eq(webhooks.id, input.webhookId),
          eq(webhooks.organizationId, user.organizationId)
        ),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Webhook not found",
        });
      }

      try {
        const [webhook] = await db
          .update(webhooks)
          .set({
            isActive: input.isActive,
            updatedAt: new Date(),
          })
          .where(eq(webhooks.id, input.webhookId))
          .returning();

        log.info("webhook.toggle", "Webhook toggled", {
          webhookId: input.webhookId,
          isActive: input.isActive,
        });

        return {
          id: webhook!.id,
          isActive: webhook!.isActive,
        };
      } catch (error) {
        log.error("webhook.toggle", "Failed to toggle webhook", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to toggle webhook",
        });
      }
    }),

  /**
   * webhooks.test
   * Send a test event to a webhook
   */
  test: protectedProcedure
    .input(z.object({ webhookId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { user, log } = ctx;

      // Get webhook with all data
      const webhook = await db.query.webhooks.findFirst({
        where: and(
          eq(webhooks.id, input.webhookId),
          eq(webhooks.organizationId, user.organizationId)
        ),
      });

      if (!webhook) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Webhook not found",
        });
      }

      try {
        // Build test payload
        const testPayload = buildWebhookPayload({
          webhookId: webhook.id,
          eventType: "test.ping",
          instanceId: "test-instance",
          instancePhone: "5500000000000",
          instanceName: "Test Instance",
          eventData: {
            message: "This is a test event from LivChat",
            timestamp: new Date().toISOString(),
          },
        });

        // Send directly to this webhook
        const startTime = performance.now();
        let statusCode: number | null = null;
        let error: string | null = null;

        try {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...(webhook.headers ?? {}),
          };

          // Add HMAC if configured
          if (webhook.signingSecret) {
            const { generateHmacSignature } = await import("~/server/lib/webhook-forwarder");
            const payloadString = JSON.stringify(testPayload);
            const signature = await generateHmacSignature(payloadString, webhook.signingSecret);
            headers["x-livchat-signature"] = signature;
            headers["x-livchat-timestamp"] = Math.floor(Date.now() / 1000).toString();
          }

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          const response = await fetch(webhook.url, {
            method: "POST",
            headers,
            body: JSON.stringify(testPayload),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          statusCode = response.status;

          if (!response.ok) {
            error = `HTTP ${response.status}`;
          }
        } catch (err) {
          if (err instanceof Error) {
            if (err.name === "AbortError") {
              error = "Timeout after 5000ms";
            } else {
              error = err.message;
            }
          } else {
            error = "Unknown error";
          }
        }

        const latencyMs = Math.round(performance.now() - startTime);

        log.info("webhook.test", "Test event sent", {
          webhookId: webhook.id,
          statusCode,
          latencyMs,
          error,
        });

        return {
          success: !error,
          statusCode,
          latencyMs,
          error,
        };
      } catch (error) {
        log.error("webhook.test", "Failed to send test event", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to send test event",
        });
      }
    }),

  /**
   * webhooks.logs
   * Get delivery logs for a webhook
   */
  logs: protectedProcedure
    .input(z.object({
      webhookId: z.string().uuid(),
      status: z.enum(["all", "success", "failed"]).default("all"),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      const { user, log } = ctx;

      // Verify ownership
      const webhook = await db.query.webhooks.findFirst({
        where: and(
          eq(webhooks.id, input.webhookId),
          eq(webhooks.organizationId, user.organizationId)
        ),
      });

      if (!webhook) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Webhook not found",
        });
      }

      try {
        // Query events where metadata contains this webhookId
        // and event type is webhook.delivered or webhook.failed
        const eventTypes =
          input.status === "success"
            ? [EventTypes.WEBHOOK_DELIVERED]
            : input.status === "failed"
              ? [EventTypes.WEBHOOK_FAILED]
              : [EventTypes.WEBHOOK_DELIVERED, EventTypes.WEBHOOK_FAILED];

        const result = await db.query.events.findMany({
          where: and(
            eq(events.organizationId, user.organizationId),
            // Note: In production, you'd want to use a JSON query here
            // For now we filter in memory
          ),
          orderBy: [desc(events.createdAt)],
          limit: input.limit * 2, // Get extra to filter
        });

        // Filter by webhookId in metadata
        const filtered = result
          .filter((event) => {
            const metadata = event.metadata as Record<string, unknown> | null;
            return (
              metadata?.webhookId === input.webhookId &&
              eventTypes.includes(event.name as typeof EventTypes.WEBHOOK_DELIVERED)
            );
          })
          .slice(0, input.limit);

        log.debug("webhook.logs", "Retrieved webhook logs", {
          webhookId: input.webhookId,
          count: filtered.length,
        });

        return filtered.map((event) => {
          const metadata = event.metadata as Record<string, unknown>;
          return {
            id: event.id,
            eventType: (metadata?.sourceEventType as string) ?? "unknown",
            status: event.name === EventTypes.WEBHOOK_DELIVERED ? "success" : "failed",
            statusCode: (metadata?.statusCode as number) ?? null,
            latencyMs: (metadata?.latencyMs as number) ?? null,
            attempt: (metadata?.attempt as number) ?? 1,
            error: (metadata?.error as string) ?? null,
            payload: metadata?.requestPayload ?? {},
            timestamp: event.createdAt,
          };
        });
      } catch (error) {
        log.error("webhook.logs", "Failed to get webhook logs", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get webhook logs",
        });
      }
    }),

  /**
   * webhooks.resend
   * Resend a specific event
   */
  resend: protectedProcedure
    .input(z.object({ eventId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { user, log } = ctx;

      // Get the original event
      const event = await db.query.events.findFirst({
        where: and(
          eq(events.id, input.eventId),
          eq(events.organizationId, user.organizationId)
        ),
      });

      if (!event) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Event not found",
        });
      }

      const metadata = event.metadata as Record<string, unknown> | null;
      if (!metadata?.webhookId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Event has no associated webhook",
        });
      }

      // Get the webhook
      const webhook = await db.query.webhooks.findFirst({
        where: and(
          eq(webhooks.id, metadata.webhookId as string),
          eq(webhooks.organizationId, user.organizationId)
        ),
      });

      if (!webhook) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Webhook not found",
        });
      }

      try {
        // Resend the event using the original payload
        const payload = metadata.requestPayload ?? {};

        const startTime = performance.now();
        let statusCode: number | null = null;
        let error: string | null = null;

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...(webhook.headers ?? {}),
        };

        // Add HMAC if configured
        if (webhook.signingSecret) {
          const { generateHmacSignature } = await import("~/server/lib/webhook-forwarder");
          const payloadString = JSON.stringify(payload);
          const signature = await generateHmacSignature(payloadString, webhook.signingSecret);
          headers["x-livchat-signature"] = signature;
          headers["x-livchat-timestamp"] = Math.floor(Date.now() / 1000).toString();
        }

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          const response = await fetch(webhook.url, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          statusCode = response.status;

          if (!response.ok) {
            error = `HTTP ${response.status}`;
          }
        } catch (err) {
          if (err instanceof Error) {
            error = err.name === "AbortError" ? "Timeout after 5000ms" : err.message;
          } else {
            error = "Unknown error";
          }
        }

        const latencyMs = Math.round(performance.now() - startTime);

        // Log the retry
        const { logEvent } = await import("~/server/lib/events");
        await logEvent({
          name: error ? EventTypes.WEBHOOK_FAILED : EventTypes.WEBHOOK_DELIVERED,
          organizationId: user.organizationId,
          instanceId: event.instanceId,
          metadata: {
            webhookId: webhook.id,
            sourceEventId: metadata.sourceEventId,
            sourceEventType: metadata.sourceEventType,
            statusCode,
            latencyMs,
            attempt: ((metadata.attempt as number) ?? 1) + 1,
            error,
            requestPayload: payload,
          },
        });

        log.info("webhook.resend", "Event resent", {
          eventId: input.eventId,
          webhookId: webhook.id,
          statusCode,
          latencyMs,
          error,
        });

        return {
          success: !error,
          statusCode,
          latencyMs,
          error,
        };
      } catch (error) {
        log.error("webhook.resend", "Failed to resend event", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to resend event",
        });
      }
    }),
});
