/**
 * Share Code Management
 *
 * Gera e valida códigos de compartilhamento para conexão remota de WhatsApp.
 * Usa Redis (Upstash) com TTL automático de 24 horas.
 */

import { redis, isRedisAvailable } from "~/server/lib/redis";
import { nanoid } from "nanoid";

const SHARE_PREFIX = "share:";
const SHARE_CODE_LENGTH = 16;
const TTL_SECONDS = 86400; // 24 horas

export interface ShareCodeData {
  instanceId: string;
  organizationId: string;
  createdByUserId: string;
  createdAt: number;
}

/**
 * Gera um código de compartilhamento e armazena em Redis com TTL de 24h.
 *
 * @param instanceId - UUID da instância WhatsApp
 * @param organizationId - UUID da organização proprietária
 * @param createdByUserId - UUID do usuário que criou o link
 * @returns Código gerado e data de expiração
 */
export async function generateShareCode(
  instanceId: string,
  organizationId: string,
  createdByUserId: string
): Promise<{ code: string; expiresAt: Date }> {
  if (!isRedisAvailable()) {
    throw new Error("Redis not available - share links require Redis");
  }

  const code = nanoid(SHARE_CODE_LENGTH);

  const data: ShareCodeData = {
    instanceId,
    organizationId,
    createdByUserId,
    createdAt: Date.now(),
  };

  await redis.setex(
    `${SHARE_PREFIX}${code}`,
    TTL_SECONDS,
    JSON.stringify(data)
  );

  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000);
  return { code, expiresAt };
}

/**
 * Verifica se um código de compartilhamento é válido e retorna os dados associados.
 *
 * @param code - Código de 16 caracteres
 * @returns Dados do share ou null se inválido/expirado
 */
export async function verifyShareCode(
  code: string
): Promise<ShareCodeData | null> {
  if (!isRedisAvailable()) {
    return null;
  }

  const raw = await redis.get<ShareCodeData | string>(`${SHARE_PREFIX}${code}`);

  if (!raw) return null;

  // Redis pode retornar string ou objeto já parseado (depende do client)
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as ShareCodeData;
    } catch {
      return null;
    }
  }

  return raw;
}

/**
 * Revoga um código de compartilhamento antes da expiração.
 *
 * @param code - Código a revogar
 * @returns true se existia e foi deletado, false se não existia
 */
export async function revokeShareCode(code: string): Promise<boolean> {
  if (!isRedisAvailable()) {
    return false;
  }

  const result = await redis.del(`${SHARE_PREFIX}${code}`);
  return result > 0;
}
