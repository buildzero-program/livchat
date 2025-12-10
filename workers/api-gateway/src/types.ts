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
 * Allowed instance for multi-instance organizations
 */
export interface AllowedInstance {
  id: string;
  whatsappJid: string | null;
  providerToken: string;
}

/**
 * API Key data returned from validation
 */
export interface ApiKeyData {
  id: string;
  organizationId: string;
  instanceId: string | null;
  providerToken: string; // WuzAPI token (default instance)
  scopes: string[];
  rateLimitRequests: number;
  rateLimitWindowSeconds: number;
  isActive: boolean;
  // Multi-instance support: list of instances this key can access
  allowedInstances?: AllowedInstance[];
}

/**
 * Request body with optional `from` parameter for instance selection
 */
export interface RequestWithFrom {
  from?: string; // Phone number or Instance ID
  [key: string]: unknown;
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
