import { redis, isRedisAvailable } from "~/server/lib/redis";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface QuotaResult {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// INCR-first Quota System
// ═══════════════════════════════════════════════════════════════════════════

/**
 * INCR-first: Incrementa E verifica em uma operação
 *
 * Mais performático (1 operação vs 2 com GET+INCR)
 * Aceita pequeno overage (1-2 msgs) - UX melhor
 * Usado por: Stripe, Twilio, AWS
 *
 * @param instanceId - ID da instância
 * @param limit - Limite de mensagens por dia
 * @returns QuotaResult com allowed, used, limit, remaining
 */
export async function useQuota(
  instanceId: string,
  limit: number
): Promise<QuotaResult> {
  // Fallback: se Redis não disponível, permite (fail open)
  if (!isRedisAvailable() || !redis) {
    return {
      allowed: true,
      used: 0,
      limit,
      remaining: limit,
    };
  }

  const key = `quota:${instanceId}:${today()}`;

  // INCR atômico - retorna novo valor
  const used = await redis.incr(key);

  // Seta TTL na primeira msg do dia
  if (used === 1) {
    await redis.expireat(key, getMidnightSaoPaulo());
  }

  return {
    allowed: used <= limit, // 50 ou menos = OK
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}

/**
 * Busca uso atual (para dashboard, sem incrementar)
 *
 * @param instanceId - ID da instância
 * @returns Número de mensagens usadas hoje
 */
export async function getQuotaUsage(instanceId: string): Promise<number> {
  // Fallback: se Redis não disponível, retorna 0
  if (!isRedisAvailable() || !redis) {
    return 0;
  }

  const key = `quota:${instanceId}:${today()}`;
  const value = await redis.get<number>(key);
  return value ?? 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Retorna a data atual no formato YYYY-MM-DD no timezone de São Paulo
 */
function today(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
}

/**
 * Retorna o timestamp Unix da próxima meia-noite em São Paulo (+ 1h margem)
 */
function getMidnightSaoPaulo(): number {
  const now = new Date();
  // Próxima meia-noite em São Paulo
  const sp = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );
  sp.setDate(sp.getDate() + 1);
  sp.setHours(1, 0, 0, 0); // 1am para margem de segurança
  return Math.floor(sp.getTime() / 1000);
}
