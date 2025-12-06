import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
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
} from "~/server/lib/instance";
import { DEMO_MESSAGE_LIMIT } from "~/lib/constants";

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

// ============================================
// DEMO ROUTER
// ============================================

export const demoRouter = createTRPCRouter({
  /**
   * demo.status
   * Retorna o status da conexão + QR code se não conectado
   * Cria instance automaticamente se não existir
   */
  status: publicProcedure.query(async ({ ctx }) => {
    const { device } = ctx;

    if (!device) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Device não identificado. Habilite cookies.",
      });
    }

    // FLUXO: conectada → virgem própria → órfã virgem → criar nova

    // 1. Buscar instance CONECTADA do device (já logou antes)
    let instanceData = await getConnectedDeviceInstance(device.id);

    // 2. Se não tem conectada, buscar VIRGEM do device
    if (!instanceData) {
      instanceData = await getDeviceInstance(device.id);
    }

    // 3. Se não tem virgem própria, tentar adotar órfã virgem
    if (!instanceData) {
      instanceData = await getOrReuseVirginOrphan(device.id);

      if (instanceData) {
        console.log(
          `[demo.status] Reused virgin orphan for device ${device.id.slice(0, 8)}...`
        );
      }
    }

    // 4. Último recurso: criar nova
    if (!instanceData) {
      try {
        instanceData = await createInstanceForDevice(device.id);
        console.log(
          `[demo.status] Created NEW instance for device ${device.id.slice(0, 8)}...`
        );
      } catch (error) {
        console.error("[demo.status] Failed to create instance:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Falha ao criar instância WhatsApp",
        });
      }
    }

    const { instance, client } = instanceData;

    try {
      // 5. Buscar status no WuzAPI (com conexão se necessário)
      let statusRes = await client.getStatus();

      if (!statusRes.data.connected) {
        try {
          await client.connect(["Message"]);
          await new Promise((resolve) => setTimeout(resolve, 2000));
          statusRes = await client.getStatus();
        } catch (connectError) {
          console.warn("[demo.status] Failed to connect:", connectError);
        }
      }

      // Sync status no banco
      await syncInstanceStatus(instance.id, {
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

      // 6. RESPOSTA AO CLIENTE (UX primeiro!)
      const response = {
        connected: statusRes.data.connected,
        loggedIn: statusRes.data.loggedIn,
        qrCode,
        jid: extractPhoneFromJID(statusRes.data.jid),
        instanceId: instance.id,
        // CRÍTICO: apiKey SÓ após conectar!
        apiKey: statusRes.data.loggedIn ? instance.providerToken : undefined,
        messagesUsed: usage.used,
        messagesLimit: usage.limit,
        messagesRemaining: usage.remaining,
      };

      // 7. BACKGROUND: Cleanup de órfãs abusadas (não bloqueia response)
      setImmediate(() => {
        cleanupAbusedOrphans()
          .then((deleted) => {
            if (deleted > 0) {
              console.log(
                `[demo.status] Cleaned up ${deleted} abused orphans in background`
              );
            }
          })
          .catch((err) => {
            console.error("[demo.status] Background cleanup error:", err);
          });
      });

      return response;
    } catch (error) {
      console.error("[demo.status] Error fetching status:", error);

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
      };
    }
  }),

  /**
   * demo.pairing
   * Gera pairing code para um número de telefone
   */
  pairing: publicProcedure
    .input(z.object({ phone: phoneSchema }))
    .mutation(async ({ ctx, input }) => {
      const { device } = ctx;

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

      const { client } = instanceData;

      try {
        const res = await client.getPairingCode(input.phone);

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
   * demo.validate
   * Valida se um número está no WhatsApp (com lógica BR para 9º dígito)
   */
  validate: publicProcedure
    .input(z.object({ phone: phoneSchema }))
    .mutation(async ({ ctx, input }): Promise<ValidationResult> => {
      const { device } = ctx;

      if (!device) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Device não identificado",
        });
      }

      // Validate requer instance conectada (ou virgin se ainda não conectou)
      let instanceData = await getConnectedDeviceInstance(device.id);
      if (!instanceData) {
        instanceData = await getDeviceInstance(device.id);
      }

      if (!instanceData) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Instância não encontrada",
        });
      }

      const { client } = instanceData;
      const phone = input.phone;

      try {
        // PASSO 1: Verificar o número EXATAMENTE como digitado
        const exactRes = await client.checkNumbers([phone]);
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
          const variantRes = await client.checkNumbers([variant]);
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
   * demo.send
   * Envia uma mensagem de texto
   */
  send: publicProcedure
    .input(
      z.object({
        phone: phoneSchema,
        message: z.string().min(1).max(4096),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { device } = ctx;

      if (!device) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Device não identificado",
        });
      }

      // Send requer instance conectada (precisa estar logado)
      const instanceData = await getConnectedDeviceInstance(device.id);

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
      const status = await client.getStatus();
      if (!status.data.loggedIn) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "WhatsApp não conectado. Escaneie o QR code primeiro.",
        });
      }

      try {
        const res = await client.sendText(input.phone, input.message);

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
   * demo.disconnect
   * Desconecta (logout) do WhatsApp
   */
  disconnect: publicProcedure.mutation(async ({ ctx }) => {
    const { device } = ctx;

    if (!device) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Device não identificado",
      });
    }

    // Disconnect requer instance conectada
    const instanceData = await getConnectedDeviceInstance(device.id);

    if (!instanceData) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Instância não encontrada ou não conectada",
      });
    }

    const { instance, client } = instanceData;

    try {
      await client.logout();

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
});
