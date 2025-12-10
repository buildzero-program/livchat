import type { Env, ApiKeyData } from "./types";
import { validateApiKey } from "./auth";
import { checkRateLimit, RateLimiter } from "./rate-limit";
import { routeRequest } from "./router";

// Export Durable Object class
export { RateLimiter };

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    // ============ CORS Preflight ============
    if (request.method === "OPTIONS") {
      return handleCORS();
    }

    // ============ Health Check ============
    if (url.pathname === "/health" || url.pathname === "/") {
      return new Response(
        JSON.stringify({
          status: "ok",
          service: "livchat-api-gateway",
          version: "1.0.0",
          docs: "https://docs.livchat.ai",
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // ============ Extract API Key ============
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse(401, "Missing or invalid Authorization header", {
        hint: 'Use "Authorization: Bearer lc_live_xxx" header',
      });
    }

    const apiKey = authHeader.slice(7); // Remove "Bearer "

    // ============ Validate API Key ============
    let keyData: ApiKeyData | null;
    try {
      keyData = await validateApiKey(apiKey, env);
    } catch (error) {
      console.error("Auth error:", error);
      return errorResponse(500, "Authentication service error");
    }

    if (!keyData) {
      return errorResponse(401, "Invalid API key");
    }

    if (!keyData.isActive) {
      return errorResponse(401, "API key has been revoked");
    }

    // ============ Rate Limiting ============
    const rateLimitResult = await checkRateLimit(
      keyData.id,
      keyData.rateLimitRequests,
      keyData.rateLimitWindowSeconds,
      env
    );

    if (!rateLimitResult.allowed) {
      return errorResponse(
        429,
        "Rate limit exceeded",
        {
          limit: String(keyData.rateLimitRequests),
          window: `${keyData.rateLimitWindowSeconds}s`,
        },
        {
          "X-RateLimit-Limit": String(keyData.rateLimitRequests),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(rateLimitResult.resetAt),
          "Retry-After": String(
            Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)
          ),
        }
      );
    }

    // ============ Route Request ============
    try {
      const response = await routeRequest(request, keyData, env);

      // Clone response to add headers
      const newHeaders = new Headers(response.headers);

      // Add rate limit headers
      newHeaders.set("X-RateLimit-Limit", String(keyData.rateLimitRequests));
      newHeaders.set(
        "X-RateLimit-Remaining",
        String(rateLimitResult.remaining)
      );
      newHeaders.set("X-RateLimit-Reset", String(rateLimitResult.resetAt));

      // Add CORS headers
      newHeaders.set("Access-Control-Allow-Origin", "*");

      // Log usage asynchronously
      ctx.waitUntil(
        logUsage(keyData, url.pathname, request.method, response.status, env)
      );

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    } catch (error) {
      console.error("Proxy error:", error);
      return errorResponse(502, "Upstream service error");
    }
  },
};

// ============ Helper Functions ============

function handleCORS(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

function errorResponse(
  status: number,
  message: string,
  extra?: Record<string, string>,
  headers: Record<string, string> = {}
): Response {
  return new Response(
    JSON.stringify({
      error: {
        code: status,
        message,
        ...extra,
      },
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        ...headers,
      },
    }
  );
}

async function logUsage(
  keyData: ApiKeyData,
  endpoint: string,
  method: string,
  statusCode: number,
  env: Env
): Promise<void> {
  // Log to console for now (Cloudflare observability will capture this)
  console.log(
    JSON.stringify({
      type: "api_usage",
      apiKeyId: keyData.id,
      organizationId: keyData.organizationId,
      endpoint,
      method,
      statusCode,
      timestamp: new Date().toISOString(),
    })
  );

  // TODO: Send to Vercel endpoint for persistent storage
  // await fetch(`${env.VERCEL_URL}/api/internal/log-usage`, {
  //   method: "POST",
  //   headers: {
  //     "Content-Type": "application/json",
  //     "X-Internal-Secret": env.INTERNAL_SECRET,
  //   },
  //   body: JSON.stringify({
  //     apiKeyId: keyData.id,
  //     endpoint,
  //     method,
  //     statusCode,
  //   }),
  // });
}
