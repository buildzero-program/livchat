import type { Env, RateLimitResult } from "./types";

/**
 * Check rate limit for an API key using Durable Objects
 */
export async function checkRateLimit(
  keyId: string,
  maxRequests: number,
  windowSeconds: number,
  env: Env
): Promise<RateLimitResult> {
  // Get Durable Object for this key
  const id = env.RATE_LIMITER.idFromName(keyId);
  const limiter = env.RATE_LIMITER.get(id);

  // Call the Durable Object
  const response = await limiter.fetch("http://internal/check", {
    method: "POST",
    body: JSON.stringify({ maxRequests, windowSeconds }),
  });

  return response.json();
}

/**
 * Durable Object for rate limiting
 * Uses sliding window algorithm with SQLite storage
 */
export class RateLimiter implements DurableObject {
  private sql: SqlStorage;
  private initialized = false;

  constructor(private ctx: DurableObjectState, private env: Env) {
    this.sql = ctx.storage.sql;
  }

  private ensureTable() {
    if (this.initialized) return;

    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL
      )
    `);
    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_timestamp ON requests(timestamp)
    `);

    this.initialized = true;
  }

  async fetch(request: Request): Promise<Response> {
    const { maxRequests, windowSeconds } = (await request.json()) as {
      maxRequests: number;
      windowSeconds: number;
    };

    this.ensureTable();

    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const windowStart = now - windowMs;

    // Clean old requests
    this.sql.exec(`DELETE FROM requests WHERE timestamp < ?`, windowStart);

    // Count current requests in window
    const countResult = this.sql
      .exec(`SELECT COUNT(*) as count FROM requests`)
      .toArray();
    const currentCount = Number(countResult[0]?.count ?? 0);

    // Check limit
    if (currentCount >= maxRequests) {
      // Get oldest request timestamp for reset time
      const oldestResult = this.sql
        .exec(`SELECT MIN(timestamp) as oldest FROM requests`)
        .toArray();
      const oldest = Number(oldestResult[0]?.oldest ?? now);
      const resetAt = oldest + windowMs;

      return Response.json({
        allowed: false,
        remaining: 0,
        resetAt,
      } satisfies RateLimitResult);
    }

    // Add current request
    this.sql.exec(`INSERT INTO requests (timestamp) VALUES (?)`, now);

    return Response.json({
      allowed: true,
      remaining: maxRequests - currentCount - 1,
      resetAt: now + windowMs,
    } satisfies RateLimitResult);
  }
}
