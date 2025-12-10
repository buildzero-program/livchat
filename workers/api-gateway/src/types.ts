/**
 * Environment bindings for the Worker
 */
export interface Env {
  // KV Namespace for API keys cache
  API_KEYS_CACHE: KVNamespace;

  // Durable Object for rate limiting
  RATE_LIMITER: DurableObjectNamespace;

  // Environment variables
  VERCEL_URL: string;
  WUZAPI_URL: string;

  // Secrets (set via wrangler secret put)
  INTERNAL_SECRET: string;
}

/**
 * API Key data returned from validation
 */
export interface ApiKeyData {
  id: string;
  organizationId: string;
  instanceId: string | null;
  providerToken: string; // WuzAPI token
  scopes: string[];
  rateLimitRequests: number;
  rateLimitWindowSeconds: number;
  isActive: boolean;
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Route configuration
 */
export interface RouteConfig {
  backend: "wuzapi" | "vercel";
  path: string;
  methods: string[];
}
