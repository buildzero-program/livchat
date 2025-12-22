import { db } from "~/server/db";
import { apiKeys, instances } from "~/server/db/schema";
import { eq, and, or, isNull, gt } from "drizzle-orm";
import { logger, LogActions } from "./logger";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ApiKeyData {
  id: string;
  organizationId: string | null;
  instanceId: string;
  name: string;
  scopes: string[];
  rateLimitRequests: number;
  rateLimitWindowSeconds: number;
  isActive: boolean;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  claimedAt: Date | null;
  createdAt: Date;
}

export interface ApiKeyListItem {
  id: string;
  name: string;
  maskedToken: string;
  scopes: string[];
  instanceId: string;
  isActive: boolean;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface ValidatedApiKey {
  keyId: string;
  organizationId: string | null;
  instanceId: string;
  providerToken: string;
  whatsappJid: string | null; // For multi-instance resolution
  scopes: string[];
  rateLimitRequests: number;
  rateLimitWindowSeconds: number;
}

export interface AllowedInstance {
  id: string;
  whatsappJid: string | null;
  providerToken: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// PURE FUNCTIONS (No DB)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a secure API key token
 * Format: lc_{env}_{32 random alphanumeric chars}
 * Total length: 40 characters
 */
export function generateApiKeyToken(env: "live" | "test" = "live"): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let random = "";

  // Generate 32 random characters
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);

  for (let i = 0; i < 32; i++) {
    random += chars[array[i]! % chars.length];
  }

  return `lc_${env}_${random}`;
}

/**
 * Mask API key token for display
 * Shows prefix + first 4 chars + masked middle + last 4 chars
 * Example: lc_live_c27K************************NdQJ
 */
export function maskApiKeyToken(token: string): string {
  if (token.length <= 4) {
    return "*".repeat(token.length - 1) + token.slice(-1);
  }

  // Find the prefix (lc_xxx_)
  const prefixMatch = token.match(/^(lc_\w+_)/);
  const prefix = prefixMatch?.[1] ?? "";

  // Get content after prefix
  const withoutPrefix = token.slice(prefix.length);

  // Need at least 8 chars to show 4+4
  if (withoutPrefix.length < 8) {
    const suffix = token.slice(-4);
    return prefix + "*".repeat(Math.max(0, token.length - prefix.length - 4)) + suffix;
  }

  const first4 = withoutPrefix.slice(0, 4);
  const last4 = withoutPrefix.slice(-4);
  const maskedLength = Math.max(0, withoutPrefix.length - 8);

  return prefix + first4 + "*".repeat(maskedLength) + last4;
}

/**
 * Validates token format before DB lookup
 * Returns true if token has valid format for validation
 */
export function isValidTokenFormat(token: string): boolean {
  return token.startsWith("lc_") && token.length >= 20;
}

// ═══════════════════════════════════════════════════════════════════════════
// CRIAÇÃO AUTOMÁTICA (chamada quando instance conecta)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Cria API Key automaticamente quando instance conecta ao WhatsApp
 * Chamada em syncInstanceStatus() quando loggedIn passa a true
 *
 * IMPORTANTE: Se a instance já pertence a uma organização, a key herda
 * automaticamente o organizationId. Isso evita keys órfãs para instances
 * criadas via dashboard (que não passam pelo fluxo de claiming por device).
 *
 * @param instanceId - ID da instance que conectou
 * @param deviceId - ID do device que criou (para claim posterior, se anônimo)
 * @returns API key criada (ou existente se já houver)
 */
export async function createApiKeyForInstance(
  instanceId: string,
  deviceId: string | null
): Promise<{ id: string; token: string }> {
  // Verificar se já existe key para esta instance
  const existing = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.instanceId, instanceId),
  });

  if (existing) {
    logger.debug(LogActions.API_KEY_CREATE, "API key already exists for instance", {
      keyId: existing.id,
      instanceId,
    });
    return { id: existing.id, token: existing.token };
  }

  // Buscar a instance para herdar organizationId (se já foi claimed)
  const instance = await db.query.instances.findFirst({
    where: eq(instances.id, instanceId),
    columns: { organizationId: true },
  });

  // Gerar nova key
  const token = generateApiKeyToken("live");

  // Se a instance já tem org, a key nasce "claimed" (herda o orgId)
  // Se não tem org, a key nasce órfã (será claimed via claimDeviceApiKeys)
  const inheritedOrgId = instance?.organizationId ?? null;

  const [created] = await db
    .insert(apiKeys)
    .values({
      instanceId,
      createdByDeviceId: deviceId,
      organizationId: inheritedOrgId,
      claimedAt: inheritedOrgId ? new Date() : null,
      token,
      name: "Default",
      scopes: ["whatsapp:*"],
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create API key");
  }

  logger.info(LogActions.API_KEY_CREATE, "API key created for instance", {
    keyId: created.id,
    instanceId,
    deviceId,
    organizationId: inheritedOrgId,
    inherited: !!inheritedOrgId,
  });

  return { id: created.id, token: created.token };
}

// ═══════════════════════════════════════════════════════════════════════════
// CLAIM (chamada junto com claimDeviceInstances)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Claim API Keys órfãs do device para a organização
 * Espelha o comportamento de claimDeviceInstances()
 *
 * @param deviceId - ID do device cujas keys serão claimed
 * @param organizationId - ID da org que vai receber as keys
 * @returns Quantidade de keys claimed
 */
export async function claimDeviceApiKeys(
  deviceId: string,
  organizationId: string
): Promise<number> {
  const result = await db
    .update(apiKeys)
    .set({
      organizationId,
      claimedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(apiKeys.createdByDeviceId, deviceId),
        isNull(apiKeys.organizationId)
      )
    )
    .returning();

  if (result.length > 0) {
    logger.info(LogActions.API_KEY_USE, "API keys claimed", {
      deviceId,
      organizationId,
      count: result.length,
    });
  }

  return result.length;
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDAÇÃO E RESOLUÇÃO DE INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Valida API Key e resolve qual instance usar
 *
 * REGRAS (Opção B - Mesmo Nível):
 * - Key órfã (org = NULL): só pode usar sua instance específica
 * - Key claimed (org = SET): pode usar QUALQUER instance da org
 *
 * @param token - Token da API key
 * @returns Dados validados ou null se inválido
 */
export async function validateAndResolveInstance(
  token: string
): Promise<ValidatedApiKey | null> {
  // Verificar formato
  if (!isValidTokenFormat(token)) {
    return null;
  }

  const now = new Date();

  // Buscar key
  const key = await db.query.apiKeys.findFirst({
    where: and(
      eq(apiKeys.token, token),
      eq(apiKeys.isActive, true),
      or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, now))
    ),
  });

  if (!key) {
    return null;
  }

  // Resolver instance
  let instance;

  if (key.organizationId) {
    // ═══ KEY CLAIMED: pode usar qualquer instance da org ═══
    // Prioridade: primeira conectada
    instance = await db.query.instances.findFirst({
      where: and(
        eq(instances.organizationId, key.organizationId),
        eq(instances.status, "connected")
      ),
      orderBy: (i, { desc }) => [desc(i.lastConnectedAt)],
    });

    // Fallback: qualquer instance da org
    if (!instance) {
      instance = await db.query.instances.findFirst({
        where: eq(instances.organizationId, key.organizationId),
      });
    }
  } else {
    // ═══ KEY ÓRFÃ: só pode usar sua instance específica ═══
    instance = await db.query.instances.findFirst({
      where: eq(instances.id, key.instanceId),
    });
  }

  if (!instance) {
    logger.warn(LogActions.API_KEY_USE, "No instance available for key", {
      keyId: key.id,
      organizationId: key.organizationId,
    });
    return null;
  }

  // Atualizar lastUsedAt (fire-and-forget)
  db.update(apiKeys)
    .set({ lastUsedAt: now })
    .where(eq(apiKeys.id, key.id))
    .catch((err) => {
      logger.error(LogActions.API_KEY_USE, "Failed to update lastUsedAt", {
        keyId: key.id,
        error: err,
      });
    });

  return {
    keyId: key.id,
    organizationId: key.organizationId,
    instanceId: instance.id,
    providerToken: instance.providerToken,
    whatsappJid: instance.whatsappJid,
    scopes: key.scopes,
    rateLimitRequests: key.rateLimitRequests,
    rateLimitWindowSeconds: key.rateLimitWindowSeconds,
  };
}

/**
 * Get all instances for an organization (for multi-instance support)
 * Only returns connected instances for API usage
 */
export async function getOrganizationInstances(
  organizationId: string
): Promise<AllowedInstance[]> {
  const orgInstances = await db.query.instances.findMany({
    where: and(
      eq(instances.organizationId, organizationId),
      eq(instances.status, "connected")
    ),
    columns: {
      id: true,
      whatsappJid: true,
      providerToken: true,
    },
  });

  return orgInstances;
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNÇÕES AUXILIARES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Busca API Key de uma instance (para exibir na LP)
 */
export async function getApiKeyForInstance(
  instanceId: string
): Promise<{ id: string; token: string } | null> {
  const key = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.instanceId, instanceId),
  });

  if (!key) {
    return null;
  }

  return { id: key.id, token: key.token };
}

/**
 * Lista API Keys da organização (para dashboard)
 * Returns masked tokens only (never expose full token after creation)
 */
export async function listApiKeys(organizationId: string): Promise<ApiKeyListItem[]> {
  const keys = await db.query.apiKeys.findMany({
    where: eq(apiKeys.organizationId, organizationId),
    orderBy: (keys, { desc }) => [desc(keys.createdAt)],
  });

  return keys.map((key) => ({
    id: key.id,
    name: key.name,
    maskedToken: maskApiKeyToken(key.token),
    scopes: key.scopes,
    instanceId: key.instanceId,
    isActive: key.isActive,
    lastUsedAt: key.lastUsedAt,
    expiresAt: key.expiresAt,
    createdAt: key.createdAt,
  }));
}

/**
 * Revoke (deactivate) an API key
 */
export async function revokeApiKey(keyId: string): Promise<ApiKeyData | null> {
  const [revoked] = await db
    .update(apiKeys)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(apiKeys.id, keyId))
    .returning();

  if (!revoked) {
    return null;
  }

  logger.info(LogActions.API_KEY_REVOKE, "API key revoked", {
    keyId: revoked.id,
    organizationId: revoked.organizationId,
  });

  return {
    id: revoked.id,
    organizationId: revoked.organizationId,
    instanceId: revoked.instanceId,
    name: revoked.name,
    scopes: revoked.scopes,
    rateLimitRequests: revoked.rateLimitRequests,
    rateLimitWindowSeconds: revoked.rateLimitWindowSeconds,
    isActive: revoked.isActive,
    lastUsedAt: revoked.lastUsedAt,
    expiresAt: revoked.expiresAt,
    claimedAt: revoked.claimedAt,
    createdAt: revoked.createdAt,
  };
}

/**
 * Delete API key permanently
 */
export async function deleteApiKey(keyId: string): Promise<boolean> {
  const result = await db.delete(apiKeys).where(eq(apiKeys.id, keyId)).returning();

  if (result.length > 0) {
    logger.info(LogActions.API_KEY_DELETE, "API key deleted", {
      keyId,
    });
    return true;
  }

  return false;
}

/**
 * Get API key by ID (for internal use)
 */
export async function getApiKeyById(keyId: string): Promise<ApiKeyData | null> {
  const key = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.id, keyId),
  });

  if (!key) {
    return null;
  }

  return {
    id: key.id,
    organizationId: key.organizationId,
    instanceId: key.instanceId,
    name: key.name,
    scopes: key.scopes,
    rateLimitRequests: key.rateLimitRequests,
    rateLimitWindowSeconds: key.rateLimitWindowSeconds,
    isActive: key.isActive,
    lastUsedAt: key.lastUsedAt,
    expiresAt: key.expiresAt,
    claimedAt: key.claimedAt,
    createdAt: key.createdAt,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// REVEAL & REGENERATE (Dashboard functions)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get full API key token (for reveal in dashboard)
 * Only returns token if key belongs to the organization
 */
export async function getApiKeyToken(
  keyId: string,
  organizationId: string
): Promise<string | null> {
  const key = await db.query.apiKeys.findFirst({
    where: and(
      eq(apiKeys.id, keyId),
      eq(apiKeys.organizationId, organizationId)
    ),
    columns: { token: true },
  });

  if (key) {
    logger.info(LogActions.API_KEY_USE, "API key token revealed", {
      keyId,
      organizationId,
    });
  }

  return key?.token ?? null;
}

/**
 * Regenerate API key token
 * Updates the token for an existing key (invalidates the old one)
 * Returns the new token (only time it's visible)
 */
export async function regenerateApiKey(
  keyId: string,
  organizationId: string
): Promise<{ id: string; token: string; maskedToken: string } | null> {
  // Verify ownership
  const existingKey = await db.query.apiKeys.findFirst({
    where: and(
      eq(apiKeys.id, keyId),
      eq(apiKeys.organizationId, organizationId)
    ),
  });

  if (!existingKey) {
    return null;
  }

  // Generate new token
  const newToken = generateApiKeyToken("live");

  // Update key with new token
  const [updated] = await db
    .update(apiKeys)
    .set({
      token: newToken,
      updatedAt: new Date(),
      lastUsedAt: null, // Reset usage tracking
    })
    .where(eq(apiKeys.id, keyId))
    .returning();

  if (!updated) {
    return null;
  }

  logger.info(LogActions.API_KEY_USE, "API key regenerated", {
    keyId,
    organizationId,
  });

  return {
    id: updated.id,
    token: newToken,
    maskedToken: maskApiKeyToken(newToken),
  };
}
