import { Redis } from "@upstash/redis";

/**
 * Upstash Redis client for message quota management.
 *
 * Used for:
 * - Message quota tracking (INCR-first approach)
 * - TTL-based daily reset (expires at midnight São Paulo)
 *
 * Falls back gracefully if Redis is not configured.
 */

let _redis: Redis | null = null;
let _initialized = false;

function initRedis(): Redis | null {
  if (_initialized) return _redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    _redis = new Redis({ url, token });
  }

  _initialized = true;
  return _redis;
}

/**
 * Get Redis client (lazy initialization)
 */
export function getRedis(): Redis | null {
  return initRedis();
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return getRedis() !== null;
}

// For backward compatibility
export const redis = {
  incr: async (key: string): Promise<number> => {
    const client = getRedis();
    if (!client) throw new Error("Redis not available");
    return client.incr(key);
  },
  get: async <T>(key: string): Promise<T | null> => {
    const client = getRedis();
    if (!client) throw new Error("Redis not available");
    return client.get<T>(key);
  },
  set: async (key: string, value: string): Promise<string | null> => {
    const client = getRedis();
    if (!client) throw new Error("Redis not available");
    return client.set(key, value);
  },
  del: async (key: string): Promise<number> => {
    const client = getRedis();
    if (!client) throw new Error("Redis not available");
    return client.del(key);
  },
  exists: async (key: string): Promise<number> => {
    const client = getRedis();
    if (!client) throw new Error("Redis not available");
    return client.exists(key);
  },
  expireat: async (key: string, timestamp: number): Promise<number> => {
    const client = getRedis();
    if (!client) throw new Error("Redis not available");
    return client.expireat(key, timestamp);
  },
};
