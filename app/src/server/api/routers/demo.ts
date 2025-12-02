import { z } from "zod";
import { randomUUID } from "crypto";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { WuzAPIClient, createWuzAPIInstance, listWuzAPIInstances } from "~/server/lib/wuzapi";
import { TRPCError } from "@trpc/server";

// ============================================
// DYNAMIC TOKEN MANAGEMENT
// Token is ALWAYS generated dynamically when instance is created
// Prepares for multi-tenant in plan-03
// ============================================

// Current instance token (generated dynamically, stored in memory)
let currentInstanceToken: string | null = null;
let instanceClient: WuzAPIClient | null = null;
let internalClient: WuzAPIClient | null = null;

// Generate a new instance token (always unique)
function generateInstanceToken(): string {
  return `lc_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

// Get or create instance token (ALWAYS generates if not exists)
function getInstanceToken(): string {
  if (!currentInstanceToken) {
    currentInstanceToken = generateInstanceToken();
    console.log(`[instance] Generated token: ${currentInstanceToken.slice(0, 12)}...`);
  }
  return currentInstanceToken;
}

// Reset instance token (called when instance is deleted/recreated)
function resetInstanceToken(): void {
  currentInstanceToken = null;
  instanceClient = null;
  console.log("[instance] Token reset, will generate new on next access");
}

function getInstanceClient(): WuzAPIClient {
  if (!instanceClient) {
    const baseUrl = process.env.WUZAPI_URL ?? "http://localhost:8080";
    const token = getInstanceToken();
    instanceClient = new WuzAPIClient({ baseUrl, token });
  }
  return instanceClient;
}

function getInternalClient(): WuzAPIClient {
  if (!internalClient) {
    const baseUrl = process.env.WUZAPI_URL ?? "http://localhost:8080";
    const token = process.env.WUZAPI_INTERNAL_TOKEN;
    if (!token) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "WUZAPI_INTERNAL_TOKEN not configured",
      });
    }
    internalClient = new WuzAPIClient({ baseUrl, token });
  }
  return internalClient;
}

// Helper: Get API key for display (token IS the API key)
function getApiKey(): string {
  return getInstanceToken();
}

// Flag para evitar múltiplas tentativas de criação simultâneas
let instanceCreationInProgress = false;

/**
 * Garante que existe uma instância "shared" no WuzAPI
 * Se já existir, reutiliza o token dela
 * Se não existir, cria nova com token dinâmico
 */
async function ensureInstanceExists(): Promise<void> {
  if (instanceCreationInProgress) {
    return; // Already creating, wait
  }

  const baseUrl = process.env.WUZAPI_URL ?? "http://localhost:8080";
  const adminToken = process.env.WUZAPI_ADMIN_TOKEN;

  if (!adminToken) {
    console.warn("[instance] Missing WUZAPI_ADMIN_TOKEN");
    return;
  }

  instanceCreationInProgress = true;

  try {
    // 1. Verificar se já existe instância "shared"
    const instances = await listWuzAPIInstances(baseUrl, adminToken);
    const existingShared = instances.data.find((i) => i.name === "shared");

    if (existingShared) {
      // Reutilizar instância existente
      console.log(`[instance] Found existing shared instance, reusing token: ${existingShared.token.slice(0, 12)}...`);
      currentInstanceToken = existingShared.token;
      instanceClient = null; // Força recriar cliente com novo token

      // Se não estiver conectada, conectar
      if (!existingShared.connected) {
        const client = getInstanceClient();
        await client.connect(["Message"]);
        console.log("[instance] Reconnected existing instance");
      }
      return;
    }

    // 2. Não existe, criar nova com token dinâmico
    resetInstanceToken();
    const newToken = getInstanceToken();

    console.log(`[instance] Creating with token: ${newToken.slice(0, 12)}...`);

    await createWuzAPIInstance(baseUrl, adminToken, "shared", newToken, "Message");
    console.log("[instance] Created with dynamic token");

    // 3. Conectar instância
    const client = getInstanceClient();
    await client.connect(["Message"]);
    console.log("[instance] Connected, waiting for QR scan");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[instance] Failed:", errorMessage);
    resetInstanceToken();
  } finally {
    instanceCreationInProgress = false;
  }
}

// Validation result types
export type ValidationStatus = "valid_unique" | "valid_variant" | "valid_ambiguous" | "invalid";

export interface ValidationResult {
  status: ValidationStatus;
  normalizedNumber: string | null;
  verifiedName: string | null;
  originalNumber?: string; // Presente quando status = valid_variant
  variants?: {
    with9: { exists: boolean; name: string | null };
    without9: { exists: boolean; name: string | null };
  };
}

// Phone validation schema
const phoneSchema = z.string().min(10).max(15).regex(/^\d+$/, "Phone must contain only digits");

// Helper: Check if number is Brazilian
function isBrazilianNumber(phone: string): boolean {
  return phone.startsWith("55") && (phone.length === 12 || phone.length === 13);
}

// Helper: Extract clean phone number from JID
// JID format: "558588644401.0:87@s.whatsapp.net" → "558588644401"
function extractPhoneFromJID(jid: string | undefined): string | undefined {
  if (!jid) return undefined;
  // Remove @domain first, then split by . to remove instance:device
  const withoutDomain = jid.split("@")[0];
  if (!withoutDomain) return undefined;
  // Extract only the digits (phone number is always at the start)
  const match = withoutDomain.match(/^(\d+)/);
  return match?.[1];
}

// Helper: Generate alternative BR variant (with/without 9th digit)
function getAlternativeVariant(phone: string): string {
  const hasNine = phone.length === 13 && phone[4] === "9";

  if (hasNine) {
    // Tem 9 → variante sem 9
    return phone.slice(0, 4) + phone.slice(5);
  } else {
    // Não tem 9 → variante com 9
    return phone.slice(0, 4) + "9" + phone.slice(4);
  }
}

export const demoRouter = createTRPCRouter({
  /**
   * demo.status
   * Retorna o status da conexão + QR code se não conectado
   * Se instância não existir, cria automaticamente
   */
  status: publicProcedure.query(async () => {
    // Helper para buscar status e QR
    // IMPORTANTE: obtém client dentro do helper para pegar token atualizado
    const fetchStatus = async () => {
      const client = getInstanceClient();
      const statusRes = await client.getStatus();

      // Se não está logado E não está conectado, precisa reconectar
      // Isso acontece após um logout - a sessão existe mas não está ativa
      if (!statusRes.data.loggedIn && !statusRes.data.connected) {
        console.log("[demo.status] Session disconnected, reconnecting...");
        try {
          await client.connect(["Message"]);
          // Aguarda um pouco para a sessão iniciar
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.warn("[demo.status] Failed to reconnect:", msg);
        }
      }

      // Se não está logado, pega o QR code do status (já vem incluído)
      // O campo qrcode vem no response do /session/status quando não está logado
      let qrCode: string | undefined;
      if (!statusRes.data.loggedIn && statusRes.data.qrcode) {
        qrCode = statusRes.data.qrcode;
      }

      return {
        connected: statusRes.data.connected,
        loggedIn: statusRes.data.loggedIn,
        qrCode,
        // Extract clean phone number from JID (removes device ID and domain)
        jid: extractPhoneFromJID(statusRes.data.jid),
        // API key for user to use in automations
        apiKey: getApiKey(),
      };
    };

    try {
      return await fetchStatus();
    } catch (error) {
      // Se erro 401 (instância não existe), tenta criar
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("401") || errorMessage.includes("Unauthorized")) {
        console.log("[demo.status] Instance not found, creating...");
        await ensureInstanceExists();

        // Aguarda a instância estar pronta
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Tenta novamente após criar
        try {
          return await fetchStatus();
        } catch (retryError) {
          console.error("[demo.status] Still failed after creation:", retryError);
        }
      }

      // Se não conseguir conectar, retorna estado desconectado
      return {
        connected: false,
        loggedIn: false,
        qrCode: undefined,
        jid: undefined,
        apiKey: getApiKey(),
      };
    }
  }),

  /**
   * demo.pairing
   * Gera pairing code para um número de telefone
   */
  pairing: publicProcedure
    .input(z.object({ phone: phoneSchema }))
    .mutation(async ({ input }) => {
      const client = getInstanceClient();

      try {
        const res = await client.getPairingCode(input.phone);

        return {
          success: true,
          pairingCode: res.data.LinkingCode,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to generate pairing code",
        });
      }
    }),

  /**
   * demo.validate
   * Valida se um número está no WhatsApp (com lógica BR para 9º dígito)
   *
   * IMPORTANTE: Sempre verifica o número EXATO primeiro!
   * Só tenta variante BR se o exato não existir.
   */
  validate: publicProcedure
    .input(z.object({ phone: phoneSchema }))
    .mutation(async ({ input }): Promise<ValidationResult> => {
      const client = getInternalClient();
      const phone = input.phone;

      try {
        // PASSO 1: Verificar o número EXATAMENTE como digitado
        const exactRes = await client.checkNumbers([phone]);
        const exactResult = exactRes.data.Users?.[0];

        if (exactResult?.IsInWhatsapp) {
          // Número existe como digitado - NÃO MODIFICAR
          return {
            status: "valid_unique",
            normalizedNumber: phone,
            verifiedName: exactResult.VerifiedName || null,
          };
        }

        // PASSO 2: Número exato não existe - se BR, tentar variante
        if (isBrazilianNumber(phone)) {
          const variant = getAlternativeVariant(phone);
          const variantRes = await client.checkNumbers([variant]);
          const variantResult = variantRes.data.Users?.[0];

          if (variantResult?.IsInWhatsapp) {
            // Variante existe - retornar com status especial
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
          message: error instanceof Error ? error.message : "Failed to validate number",
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
    .mutation(async ({ input }) => {
      const client = getInstanceClient();

      // Verifica se está conectado
      const status = await client.getStatus();
      if (!status.data.loggedIn) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "WhatsApp not connected. Please scan QR code first.",
        });
      }

      try {
        const res = await client.sendText(input.phone, input.message);

        return {
          success: true,
          messageId: res.data.Id,
          timestamp: res.data.Timestamp,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to send message",
        });
      }
    }),

  /**
   * demo.disconnect
   * Desconecta (logout) do WhatsApp
   */
  disconnect: publicProcedure.mutation(async () => {
    const client = getInstanceClient();

    try {
      await client.logout();
      return { success: true };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Failed to disconnect",
      });
    }
  }),
});
