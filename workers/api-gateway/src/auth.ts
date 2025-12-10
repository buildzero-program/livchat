import type { Env, ApiKeyData } from "./types";

const CACHE_TTL_SECONDS = 300; // 5 minutes

/**
 * Validates an API key
 * 1. Check cache (KV)
 * 2. If not found, fetch from Vercel
 * 3. Store in cache
 */
export async function validateApiKey(
  key: string,
  env: Env
): Promise<ApiKeyData | null> {
  // Basic format check
  if (!key.startsWith("lc_") || key.length < 20) {
    return null;
  }

  // Try cache first (use key prefix as cache key to avoid exposing full key)
  const cacheKey = `apikey:${key.slice(0, 16)}:${await hashKey(key)}`;
  const cached = await env.API_KEYS_CACHE.get(cacheKey, "json");

  if (cached) {
    return cached as ApiKeyData;
  }

  // Fetch from Vercel API
  const response = await fetch(`${env.VERCEL_URL}/api/internal/validate-key`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": env.INTERNAL_SECRET,
    },
    body: JSON.stringify({ key }),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 404) {
      return null; // Invalid key
    }
    throw new Error(`Validation failed: ${response.status}`);
  }

  const data = (await response.json()) as ApiKeyData;

  // Store in cache
  await env.API_KEYS_CACHE.put(cacheKey, JSON.stringify(data), {
    expirationTtl: CACHE_TTL_SECONDS,
  });

  return data;
}

/**
 * Hash API key for cache key (using Web Crypto API)
 */
async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Invalidate cached API key (call when key is revoked)
 */
export async function invalidateApiKeyCache(
  keyPrefix: string,
  env: Env
): Promise<void> {
  // Note: KV doesn't support prefix deletion, so we rely on TTL
  // For immediate invalidation, the Vercel endpoint should return isActive: false
  console.log(`Cache invalidation requested for prefix: ${keyPrefix}`);
}
