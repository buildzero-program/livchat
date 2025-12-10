import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure, hybridProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import {
  getDeviceInstance,
  getConnectedDeviceInstance,
  getOrReuseVirginOrphan,
  createInstanceForDevice,
  syncInstanceStatus,
  incrementMessageCount,
  canSendMessage,
  cleanupAbusedOrphans,
  getOrganizationInstances,
  getConnectedOrganizationInstance,
} from "~/server/lib/instance";
import { getApiKeyForInstance } from "~/server/lib/api-key";
import { DEMO_MESSAGE_LIMIT } from "~/lib/constants";
import { LogActions } from "~/server/lib/logger";
import { WuzAPIClient } from "~/server/lib/wuzapi";
import { withRetry, isTransientError } from "~/server/lib/retry";
import { deriveInstanceStatus } from "~/server/lib/instance-helpers";
import { db } from "~/server/db";
import { organizations, instances } from "~/server/db/schema";
import { eq, and } from "drizzle-orm";
import { uploadProfilePicture } from "~/server/lib/blob-storage";
import { env } from "~/env";

// ============================================
// CONSTANTS
// ============================================

const AVATAR_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ============================================
// VALIDATION TYPES & HELPERS
// ============================================

export type ValidationStatus =
  | "valid_unique"
  | "valid_variant"
  | "valid_ambiguous"
  | "invalid";

export interface ValidationResult {
  status: ValidationStatus;
  normalizedNumber: string | null;
  verifiedName: string | null;
  originalNumber?: string;
  variants?: {
    with9: { exists: boolean; name: string | null };
    without9: { exists: boolean; name: string | null };
  };
}

// Phone validation schema
const phoneSchema = z
  .string()
  .min(10)
  .max(15)
  .regex(/^\d+$/, "Phone must contain only digits");

// Helper: Check if number is Brazilian
function isBrazilianNumber(phone: string): boolean {
  return phone.startsWith("55") && (phone.length === 12 || phone.length === 13);
}

// Helper: Extract clean phone number from JID
function extractPhoneFromJID(jid: string | undefined): string | undefined {
  if (!jid) return undefined;
  const withoutDomain = jid.split("@")[0];
  if (!withoutDomain) return undefined;
  const match = withoutDomain.match(/^(\d+)/);
  return match?.[1];
}

// Helper: Generate alternative BR variant (with/without 9th digit)
function getAlternativeVariant(phone: string): string {
  const hasNine = phone.length === 13 && phone[4] === "9";

  if (hasNine) {
    return phone.slice(0, 4) + phone.slice(5);
  } else {
    return phone.slice(0, 4) + "9" + phone.slice(4);
  }
}

// Helper: Get connected instance for hybrid context
// Priority: org instance (if user logged in) → device instance (anonymous)
interface HybridInstanceContext {
  device?: { id: string } | null;
  user?: { id: string; organizationId: string } | null;
}

async function getConnectedInstanceForContext(ctx: HybridInstanceContext) {
  // PRIORITY 1: If user is logged in, get org instance first
  if (ctx.user) {
    const orgInstance = await getConnectedOrganizationInstance(ctx.user.organizationId);
    if (orgInstance) {
      return orgInstance;
    }
  }

  // PRIORITY 2: Fall back to device instance (anonymous or logged user without org instance)
  if (ctx.device) {
    return await getConnectedDeviceInstance(ctx.device.id);
  }

  return null;
}

// ============================================
// WHATSAPP ROUTER
// ============================================

export const whatsappRouter = createTRPCRouter({
  /**
   * whatsapp.status
   * Retorna o status da conexão + QR code se não conectado
   * Cria instance automaticamente se não existir
   *
   * HÍBRIDO: Se usuário está logado, mostra instância da organização.
   *          Se anônimo, usa fluxo de device cookie.
   */
  status: hybridProcedure.query(async ({ ctx }) => {
    const { device, user, log } = ctx;

    // DEBUG: Log do estado de autenticação
    log.info("hybrid.status", "Status called", {
      hasUser: !!user,
      userId: user?.id,
      organizationId: user?.organizationId,
      hasDevice: !!device,
      deviceId: device?.id?.slice(0, 8),
    });

    // Variável para controlar se estamos mostrando instância do user logado
    let isAuthenticatedInstance = false;

    // PRIORIDADE 1: Se usuário está LOGADO, buscar instância da organização
    let instanceData = null;
    if (user) {
      log.info("hybrid.status", "User authenticated, searching org instance", {
        organizationId: user.organizationId,
      });

      instanceData = await getConnectedOrganizationInstance(user.organizationId);

      log.info("hybrid.status", "Org instance search result", {
        found: !!instanceData,
        instanceId: instanceData?.instance.id,
        whatsappJid: instanceData?.instance.whatsappJid,
      });

      if (instanceData) {
        isAuthenticatedInstance = true;
        log.info(LogActions.INSTANCE_RESOLVE, "Using authenticated user instance", {
          strategy: "organization_instance",
          instanceId: instanceData.instance.id,
          organizationId: user.organizationId,
        });
      }
    } else {
      log.info("hybrid.status", "No user, using anonymous flow");
    }

    // PRIORIDADE 2: Fluxo anônimo (ou user logado sem instância conectada)
    if (!instanceData) {
      if (!device) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Device não identificado. Habilite cookies.",
        });
      }

      // FLUXO: conectada → virgem própria → órfã virgem → criar nova

      // 2a. Buscar instance CONECTADA do device (já logou antes)
      instanceData = await getConnectedDeviceInstance(device.id);

      // 2b. Se não tem conectada, buscar VIRGEM do device
      if (!instanceData) {
        instanceData = await getDeviceInstance(device.id);
      }

      // 2c. Se não tem virgem própria, tentar adotar órfã virgem
      if (!instanceData) {
        instanceData = await getOrReuseVirginOrphan(device.id);

        if (instanceData) {
          log.info(LogActions.INSTANCE_RESOLVE, "Reused virgin orphan", {
            strategy: "orphan_reuse",
            instanceId: instanceData.instance.id,
          });
        }
      }

      // 2d. Último recurso: criar nova
      if (!instanceData) {
        try {
          instanceData = await createInstanceForDevice(device.id);
          log.info(LogActions.INSTANCE_CREATE, "Created new instance", {
            instanceId: instanceData.instance.id,
          });
        } catch (error) {
          log.error(LogActions.INSTANCE_CREATE, "Failed to create instance", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Falha ao criar instância WhatsApp",
          });
        }
      }
    }

    const { instance, client } = instanceData;

    try {
      // 5. Buscar status no WuzAPI (com conexão se necessário)
      // Using timeSmart: logs on state change (connected/loggedIn) or heartbeat every 10 checks
      let statusRes = await log.timeSmart(
        LogActions.WUZAPI_STATUS,
        "Status OK",
        () => client.getStatus(),
        (res) => ({ connected: res.data.connected, loggedIn: res.data.loggedIn }),
        { instanceId: instance.id }
      );

      if (!statusRes.data.connected) {
        try {
          await log.time(
            LogActions.WUZAPI_CONNECT,
            "Connected to WuzAPI",
            () => client.connect(["Message"]),
            { instanceId: instance.id }
          );
          await new Promise((resolve) => setTimeout(resolve, 2000));
          statusRes = await log.time(
            LogActions.WUZAPI_STATUS,
            "Fetched WuzAPI status after connect",
            () => client.getStatus(),
            { instanceId: instance.id }
          );
        } catch (connectError) {
          log.warn(LogActions.WUZAPI_CONNECT, "Failed to connect", {
            instanceId: instance.id,
            error: connectError instanceof Error ? connectError.message : String(connectError),
          });
        }
      }

      // Sync status no banco (também cria API key se primeira conexão)
      const syncResult = await syncInstanceStatus(instance.id, {
        connected: statusRes.data.connected,
        loggedIn: statusRes.data.loggedIn,
        jid: statusRes.data.jid,
        name: statusRes.data.name,
      });

      // QR code quando não logado
      const qrCode = !statusRes.data.loggedIn
        ? statusRes.data.qrcode
        : undefined;

      const usage = await canSendMessage(instance.id);

      // Buscar API key (pode ser a recém-criada ou uma existente)
      let apiKeyToken: string | undefined;
      if (statusRes.data.loggedIn) {
        if (syncResult.apiKeyCreated) {
          // Key acabou de ser criada neste sync
          apiKeyToken = syncResult.apiKeyCreated.token;
        } else {
          // Buscar key existente
          const existingKey = await getApiKeyForInstance(instance.id);
          apiKeyToken = existingKey?.token;
        }
      }

      // 6. RESPOSTA AO CLIENTE (UX primeiro!)
      const response = {
        connected: statusRes.data.connected,
        loggedIn: statusRes.data.loggedIn,
        qrCode,
        jid: extractPhoneFromJID(statusRes.data.jid),
        instanceId: instance.id,
        // CRÍTICO: apiKey real (não mais providerToken) SÓ após conectar!
        apiKey: apiKeyToken,
        messagesUsed: usage.used,
        messagesLimit: usage.limit,
        messagesRemaining: usage.remaining,
        // Task #16: Campos extras para dashboard
        connectedSince: instance.lastConnectedAt?.toISOString() ?? null,
        deviceName: instance.whatsappName ?? statusRes.data.name ?? null,
        pictureUrl: instance.whatsappPictureUrl ?? null,
        // HÍBRIDO: indica se é instância de usuário autenticado
        isAuthenticatedInstance,
      };

      // 7. BACKGROUND: Auto-sync avatar quando conecta pela primeira vez
      if (statusRes.data.loggedIn && !instance.whatsappPictureUrl && statusRes.data.jid) {
        setImmediate(async () => {
          try {
            const avatarResponse = await client.getAvatar(statusRes.data.jid!);
            if (avatarResponse.data.url) {
              const blobUrl = await uploadProfilePicture(
                avatarResponse.data.url,
                instance.id
              );
              await db
                .update(instances)
                .set({
                  whatsappPictureUrl: blobUrl,
                  updatedAt: new Date(),
                })
                .where(eq(instances.id, instance.id));
              log.info("avatar.sync", "Auto-synced avatar on connect", {
                instanceId: instance.id,
              });
            }
          } catch (err) {
            log.warn("avatar.sync", "Failed to auto-sync avatar", {
              instanceId: instance.id,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        });
      }

      // 8. BACKGROUND: Cleanup de órfãs abusadas (não bloqueia response)
      setImmediate(() => {
        cleanupAbusedOrphans()
          .then((deleted) => {
            if (deleted > 0) {
              log.info(LogActions.ORPHAN_CLEANUP, "Background cleanup completed", {
                deleted,
              });
            }
          })
          .catch((err) => {
            log.error(LogActions.ORPHAN_CLEANUP, "Background cleanup error", err);
          });
      });

      return response;
    } catch (error) {
      log.error(LogActions.WHATSAPP_STATUS, "Error fetching status", error);

      // Retorna estado desconectado em caso de erro
      return {
        connected: false,
        loggedIn: false,
        qrCode: undefined,
        jid: undefined,
        instanceId: instance.id,
        apiKey: undefined, // NUNCA expor em erro
        messagesUsed: instance.messagesUsedToday,
        messagesLimit: DEMO_MESSAGE_LIMIT,
        messagesRemaining: Math.max(
          0,
          DEMO_MESSAGE_LIMIT - instance.messagesUsedToday
        ),
        // Task #16: Campos extras (fallback)
        connectedSince: null,
        deviceName: null,
        pictureUrl: null,
        // HÍBRIDO: mantém o flag mesmo em erro
        isAuthenticatedInstance,
      };
    }
  }),

  /**
   * whatsapp.pairing
   * Gera pairing code para um número de telefone
   */
  pairing: publicProcedure
    .input(z.object({ phone: phoneSchema }))
    .mutation(async ({ ctx, input }) => {
      const { device, log } = ctx;

      if (!device) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Device não identificado",
        });
      }

      // Pairing funciona com connected (re-pairing) ou virgin (novo)
      let instanceData = await getConnectedDeviceInstance(device.id);
      if (!instanceData) {
        instanceData = await getDeviceInstance(device.id);
      }

      if (!instanceData) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Instância não encontrada. Recarregue a página.",
        });
      }

      const { instance, client } = instanceData;

      try {
        const res = await log.time(
          LogActions.WUZAPI_PAIRING,
          "Generated pairing code",
          () => client.getPairingCode(input.phone),
          { instanceId: instance.id }
        );

        return {
          success: true,
          pairingCode: res.data.LinkingCode,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to generate pairing code",
        });
      }
    }),

  /**
   * whatsapp.validate
   * Valida se um número está no WhatsApp (com lógica BR para 9º dígito)
   * HÍBRIDO: Funciona para users anônimos (device) E logados (org)
   */
  validate: hybridProcedure
    .input(z.object({ phone: phoneSchema }))
    .mutation(async ({ ctx, input }): Promise<ValidationResult> => {
      const { device, user, log } = ctx;

      if (!device && !user) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Device ou usuário não identificado",
        });
      }

      // Validate requer instance - busca híbrida (org primeiro, device depois)
      const instanceData = await getConnectedInstanceForContext({ device, user });

      if (!instanceData) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Instância não encontrada",
        });
      }

      const { instance, client } = instanceData;
      const phone = input.phone;

      try {
        // PASSO 1: Verificar o número EXATAMENTE como digitado
        const exactRes = await log.time(
          LogActions.WUZAPI_CHECK,
          "Checked number on WhatsApp",
          () => client.checkNumbers([phone]),
          { instanceId: instance.id }
        );
        const exactResult = exactRes.data.Users?.[0];

        if (exactResult?.IsInWhatsapp) {
          return {
            status: "valid_unique",
            normalizedNumber: phone,
            verifiedName: exactResult.VerifiedName || null,
          };
        }

        // PASSO 2: Se BR, tentar variante
        if (isBrazilianNumber(phone)) {
          const variant = getAlternativeVariant(phone);
          const variantRes = await log.time(
            LogActions.WUZAPI_CHECK,
            "Checked variant number on WhatsApp",
            () => client.checkNumbers([variant]),
            { instanceId: instance.id }
          );
          const variantResult = variantRes.data.Users?.[0];

          if (variantResult?.IsInWhatsapp) {
            return {
              status: "valid_variant",
              normalizedNumber: variant,
              originalNumber: phone,
              verifiedName: variantResult.VerifiedName || null,
            };
          }
        }

        // PASSO 3: Nenhum existe
        return {
          status: "invalid",
          normalizedNumber: null,
          verifiedName: null,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to validate number",
        });
      }
    }),

  /**
   * whatsapp.send
   * Envia uma mensagem de texto
   * HÍBRIDO: Funciona para users anônimos (device) E logados (org)
   */
  send: hybridProcedure
    .input(
      z.object({
        phone: phoneSchema,
        message: z.string().min(1).max(4096),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { device, user, log } = ctx;

      if (!device && !user) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Device ou usuário não identificado",
        });
      }

      // Send requer instance conectada - busca híbrida (org primeiro, device depois)
      const instanceData = await getConnectedInstanceForContext({ device, user });

      if (!instanceData) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Instância não encontrada. Conecte o WhatsApp primeiro.",
        });
      }

      const { instance, client } = instanceData;

      // Verificar limite de mensagens ANTES de enviar
      const usage = await canSendMessage(instance.id);
      if (!usage.canSend) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Limite de ${usage.limit} mensagens/dia atingido. Crie uma conta para continuar!`,
        });
      }

      // Verificar se está logado
      const status = await log.time(
        LogActions.WUZAPI_STATUS,
        "Checked login status before send",
        () => client.getStatus(),
        { instanceId: instance.id }
      );
      if (!status.data.loggedIn) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "WhatsApp não conectado. Escaneie o QR code primeiro.",
        });
      }

      try {
        // Use retry with exponential backoff for transient errors
        // (e.g., connection not fully ready after login)
        const res = await withRetry(
          () => log.time(
            LogActions.WUZAPI_SEND,
            "Message sent",
            () => client.sendText(input.phone, input.message),
            { instanceId: instance.id, phone: input.phone }
          ),
          {
            maxAttempts: 3,
            initialDelayMs: 1500, // Wait 1.5s before first retry
            maxDelayMs: 5000,
            isRetryable: isTransientError,
            onRetry: (attempt, error) => {
              const errorMsg = error instanceof Error ? error.message : String(error);
              log.warn(LogActions.WUZAPI_SEND, `Retry attempt ${attempt}`, {
                instanceId: instance.id,
                phone: input.phone,
                error: errorMsg,
              });
            },
          }
        );

        // Incrementar contador
        const newUsage = await incrementMessageCount(instance.id);

        return {
          success: true,
          messageId: res.data.Id,
          timestamp: res.data.Timestamp,
          usage: newUsage,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Failed to send message",
        });
      }
    }),

  /**
   * whatsapp.disconnect
   * Desconecta (logout) do WhatsApp
   */
  // HÍBRIDO: Funciona para users anônimos (device) E logados (org)
  disconnect: hybridProcedure.mutation(async ({ ctx }) => {
    const { device, user, log } = ctx;

    if (!device && !user) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Device ou usuário não identificado",
      });
    }

    // Disconnect requer instance conectada - busca híbrida
    const instanceData = await getConnectedInstanceForContext({ device, user });

    if (!instanceData) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Instância não encontrada ou não conectada",
      });
    }

    const { instance, client } = instanceData;

    try {
      await log.time(
        LogActions.WUZAPI_LOGOUT,
        "Logged out from WuzAPI",
        () => client.logout(),
        { instanceId: instance.id }
      );

      // Atualizar status no banco
      await syncInstanceStatus(instance.id, {
        connected: false,
        loggedIn: false,
      });

      return { success: true };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error ? error.message : "Failed to disconnect",
      });
    }
  }),

  /**
   * whatsapp.list
   * Lista todas instances da organização do usuário (dashboard)
   * Requer autenticação (Clerk)
   *
   * @param syncAvatars - Se true, tenta sincronizar avatares (rate-limited).
   *                      Usar true apenas em ações do usuário (page load/refresh),
   *                      não em polling automático.
   */
  list: protectedProcedure
    .input(z.object({ syncAvatars: z.boolean().default(false) }).optional())
    .query(async ({ ctx, input }) => {
      const { user, log } = ctx;
      const syncAvatars = input?.syncAvatars ?? false;

      // 1. Buscar instances da organização
      const orgInstances = await getOrganizationInstances(user.organizationId);

      if (orgInstances.length === 0) {
        return {
          instances: [],
          total: 0,
          maxInstances: 1,
          messagesLimit: DEMO_MESSAGE_LIMIT,
        };
      }

      // Helper: Check if avatar sync is needed (rate-limited to 5 min)
      const needsAvatarSync = (instance: typeof orgInstances[0]) => {
        if (!instance.avatarSyncedAt) return true;
        const elapsed = Date.now() - instance.avatarSyncedAt.getTime();
        return elapsed > AVATAR_SYNC_INTERVAL_MS;
      };

      // Helper: Sync avatar in background (fire-and-forget)
      const syncAvatarInBackground = (
        instance: typeof orgInstances[0],
        client: WuzAPIClient,
        jid: string
      ) => {
        setImmediate(async () => {
          try {
            const avatarResponse = await client.getAvatar(jid);
            const now = new Date();

            if (avatarResponse.data.url) {
              const blobUrl = await uploadProfilePicture(
                avatarResponse.data.url,
                instance.id
              );
              await db
                .update(instances)
                .set({
                  whatsappPictureUrl: blobUrl,
                  avatarSyncedAt: now,
                  updatedAt: now,
                })
                .where(eq(instances.id, instance.id));
              log.info("avatar.sync", "Avatar synced", { instanceId: instance.id });
            } else {
              // No avatar available, just update sync timestamp
              await db
                .update(instances)
                .set({ avatarSyncedAt: now, updatedAt: now })
                .where(eq(instances.id, instance.id));
            }
          } catch (err) {
            log.warn("avatar.sync", "Failed to sync avatar", {
              instanceId: instance.id,
              error: err instanceof Error ? err.message : String(err),
            });
            // Still update avatarSyncedAt to avoid retrying too soon
            await db
              .update(instances)
              .set({ avatarSyncedAt: new Date() })
              .where(eq(instances.id, instance.id));
          }
        });
      };

      // 2. Para cada instance, buscar status no WuzAPI
      const instancesWithStatus = await Promise.all(
        orgInstances.map(async (instance) => {
          const client = new WuzAPIClient({
            baseUrl: env.WUZAPI_URL,
            token: instance.providerToken,
          });

          try {
            const status = await client.getStatus();
            const isOnline = status.data.connected && status.data.loggedIn;

            // Trigger avatar sync only if requested AND rate-limit allows
            if (syncAvatars && isOnline && status.data.jid && needsAvatarSync(instance)) {
              syncAvatarInBackground(instance, client, status.data.jid);
            }

            return {
              id: instance.id,
              name: instance.name,
              phoneNumber: extractPhoneFromJID(instance.whatsappJid ?? undefined),
              whatsappName: instance.whatsappName ?? status.data.name ?? null,
              pictureUrl: instance.whatsappPictureUrl,
              status: deriveInstanceStatus(status.data.connected, status.data.loggedIn),
              connectedSince: instance.lastConnectedAt?.toISOString() ?? null,
              messagesUsed: instance.messagesUsedToday,
            };
          } catch {
            // Offline/erro - retorna estado desconectado
            return {
              id: instance.id,
              name: instance.name,
              phoneNumber: extractPhoneFromJID(instance.whatsappJid ?? undefined),
              whatsappName: instance.whatsappName ?? null,
              pictureUrl: instance.whatsappPictureUrl,
              status: "offline" as const,
              connectedSince: null,
              messagesUsed: instance.messagesUsedToday,
            };
          }
        })
      );

      // 3. Buscar limites da organização
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, user.organizationId),
      });

      log.info(LogActions.WHATSAPP_STATUS, "Listed instances for dashboard", {
        total: orgInstances.length,
        organizationId: user.organizationId,
        syncAvatars,
      });

      return {
        instances: instancesWithStatus,
        total: instancesWithStatus.length,
        maxInstances: org?.maxInstances ?? 1,
        messagesLimit: org?.maxMessagesPerDay ?? DEMO_MESSAGE_LIMIT,
      };
    }),

  /**
   * whatsapp.updateAvatar
   * Busca a foto de perfil do WhatsApp e salva no Vercel Blob
   * Requer autenticação (Clerk)
   */
  updateAvatar: protectedProcedure
    .input(z.object({ instanceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { user, log } = ctx;

      // 1. Buscar instância da organização do usuário
      const instance = await db.query.instances.findFirst({
        where: and(
          eq(instances.id, input.instanceId),
          eq(instances.organizationId, user.organizationId)
        ),
      });

      if (!instance) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Instance not found",
        });
      }

      if (!instance.whatsappJid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Instance not connected to WhatsApp",
        });
      }

      // 2. Buscar avatar do WuzAPI
      const client = new WuzAPIClient({
        baseUrl: env.WUZAPI_URL,
        token: instance.providerToken,
      });

      try {
        const avatarResponse = await client.getAvatar(instance.whatsappJid);

        if (!avatarResponse.data.url) {
          log.info(LogActions.WUZAPI_STATUS, "No avatar available", {
            instanceId: instance.id,
          });
          return { pictureUrl: null };
        }

        // 3. Upload para Vercel Blob
        const blobUrl = await uploadProfilePicture(
          avatarResponse.data.url,
          instance.id
        );

        // 4. Atualizar banco
        await db
          .update(instances)
          .set({
            whatsappPictureUrl: blobUrl,
            updatedAt: new Date(),
          })
          .where(eq(instances.id, instance.id));

        log.info(LogActions.WUZAPI_STATUS, "Avatar updated", {
          instanceId: instance.id,
        });

        return { pictureUrl: blobUrl };
      } catch (error) {
        log.error(LogActions.WUZAPI_STATUS, "Failed to update avatar", error, {
          instanceId: instance.id,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update avatar",
        });
      }
    }),

  /**
   * whatsapp.rename
   * Renomeia uma instância (nome editável pelo usuário)
   * Requer autenticação (Clerk)
   */
  rename: protectedProcedure
    .input(
      z.object({
        instanceId: z.string().uuid(),
        name: z.string().min(1).max(50),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { user, log } = ctx;

      const result = await db
        .update(instances)
        .set({
          name: input.name,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(instances.id, input.instanceId),
            eq(instances.organizationId, user.organizationId)
          )
        )
        .returning({ id: instances.id, name: instances.name });

      if (result.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Instance not found",
        });
      }

      log.info("instance.rename", "Instance renamed", {
        instanceId: input.instanceId,
        newName: input.name,
      });

      return result[0];
    }),

  /**
   * whatsapp.delete
   * Deleta uma instância (WuzAPI + banco)
   * Requer autenticação (Clerk)
   */
  delete: protectedProcedure
    .input(z.object({ instanceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { user, log } = ctx;

      // 1. Buscar instância
      const instance = await db.query.instances.findFirst({
        where: and(
          eq(instances.id, input.instanceId),
          eq(instances.organizationId, user.organizationId)
        ),
      });

      if (!instance) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Instance not found",
        });
      }

      // 2. Deletar no WuzAPI (admin endpoint)
      if (env.WUZAPI_ADMIN_TOKEN) {
        try {
          await fetch(`${env.WUZAPI_URL}/admin/users/${instance.providerId}`, {
            method: "DELETE",
            headers: { Authorization: env.WUZAPI_ADMIN_TOKEN },
          });
        } catch (error) {
          log.warn("wuzapi.delete", "Failed to delete WuzAPI user", {
            providerId: instance.providerId,
            error: error instanceof Error ? error.message : String(error),
          });
          // Continua mesmo se falhar - instância pode já não existir
        }
      } else {
        log.warn("wuzapi.delete", "No admin token configured, skipping WuzAPI cleanup");
      }

      // 3. Deletar do banco
      await db.delete(instances).where(eq(instances.id, input.instanceId));

      log.info("instance.delete", "Instance deleted", {
        instanceId: input.instanceId,
      });

      return { success: true };
    }),

  /**
   * whatsapp.reconnect
   * Reconecta uma instância desconectada
   * Requer autenticação (Clerk)
   */
  reconnect: protectedProcedure
    .input(z.object({ instanceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { user, log } = ctx;

      const instance = await db.query.instances.findFirst({
        where: and(
          eq(instances.id, input.instanceId),
          eq(instances.organizationId, user.organizationId)
        ),
      });

      if (!instance) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Instance not found",
        });
      }

      const client = new WuzAPIClient({
        baseUrl: env.WUZAPI_URL,
        token: instance.providerToken,
      });

      try {
        await log.time(
          LogActions.WUZAPI_CONNECT,
          "Reconnecting instance",
          async () => {
            await client.connect(["Message"]);
          }
        );

        return { success: true };
      } catch (error) {
        log.error(LogActions.WUZAPI_CONNECT, "Failed to reconnect", error, {
          instanceId: instance.id,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to reconnect",
        });
      }
    }),
});
