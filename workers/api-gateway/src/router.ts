import type { Env, ApiKeyData, RouteConfig, RequestWithFrom } from "./types";
import { toCamelCase, toPascalCase } from "./transformers";
import { resolveInstanceByFrom } from "./instance-resolver";

// Re-export RouteConfig for tests
export type { RouteConfig } from "./types";

/**
 * Route mapping from public API to backends
 */
const ROUTES: Record<string, RouteConfig> = {
  // ============ Messages ============
  "/v1/messages/send": {
    backend: "wuzapi",
    path: "/chat/send/text",
    methods: ["POST"],
  },
  "/v1/messages/send/image": {
    backend: "wuzapi",
    path: "/chat/send/image",
    methods: ["POST"],
  },
  "/v1/messages/send/document": {
    backend: "wuzapi",
    path: "/chat/send/document",
    methods: ["POST"],
  },
  "/v1/messages/send/audio": {
    backend: "wuzapi",
    path: "/chat/send/audio",
    methods: ["POST"],
  },
  "/v1/messages/send/video": {
    backend: "wuzapi",
    path: "/chat/send/video",
    methods: ["POST"],
  },
  "/v1/messages/send/location": {
    backend: "wuzapi",
    path: "/chat/send/location",
    methods: ["POST"],
  },
  "/v1/messages/send/contact": {
    backend: "wuzapi",
    path: "/chat/send/contact",
    methods: ["POST"],
  },
  "/v1/messages/send/sticker": {
    backend: "wuzapi",
    path: "/chat/send/sticker",
    methods: ["POST"],
  },
  "/v1/messages/react": {
    backend: "wuzapi",
    path: "/chat/react",
    methods: ["POST"],
  },
  "/v1/messages/read": {
    backend: "wuzapi",
    path: "/chat/markread",
    methods: ["POST"],
  },

  // ============ Contacts ============
  "/v1/contacts/check": {
    backend: "wuzapi",
    path: "/user/check",
    methods: ["POST"],
  },
  "/v1/contacts/info": {
    backend: "wuzapi",
    path: "/user/info",
    methods: ["POST"],
  },
  "/v1/contacts/avatar": {
    backend: "wuzapi",
    path: "/user/avatar",
    methods: ["GET"],
  },
  "/v1/contacts/list": {
    backend: "wuzapi",
    path: "/user/contacts",
    methods: ["GET"],
  },

  // ============ Session ============
  "/v1/session/status": {
    backend: "wuzapi",
    path: "/session/status",
    methods: ["GET"],
  },
  "/v1/session/qr": {
    backend: "wuzapi",
    path: "/session/qr",
    methods: ["GET"],
  },
  "/v1/session/connect": {
    backend: "wuzapi",
    path: "/session/connect",
    methods: ["POST"],
  },
  "/v1/session/disconnect": {
    backend: "wuzapi",
    path: "/session/disconnect",
    methods: ["POST"],
  },
  "/v1/session/logout": {
    backend: "wuzapi",
    path: "/session/logout",
    methods: ["POST"],
  },

  // ============ Webhook ============
  "/v1/webhook": {
    backend: "wuzapi",
    path: "/webhook",
    methods: ["GET", "POST"],
  },

  // ============ Groups ============
  "/v1/groups/list": {
    backend: "wuzapi",
    path: "/group/list",
    methods: ["GET"],
  },
  "/v1/groups/info": {
    backend: "wuzapi",
    path: "/group/info",
    methods: ["GET"],
  },
  "/v1/groups/create": {
    backend: "wuzapi",
    path: "/group/create",
    methods: ["POST"],
  },
  "/v1/groups/invite-link": {
    backend: "wuzapi",
    path: "/group/invitelink",
    methods: ["GET"],
  },

  // ============ Webhooks (bypass auth) ============
  "/webhooks/wuzapi": {
    backend: "vercel",
    path: "/api/webhooks/wuzapi",
    methods: ["POST", "GET"],
    auth: "bypass",
    skipTransform: true,
  },
  "/webhooks/clerk": {
    backend: "vercel",
    path: "/api/webhooks/clerk",
    methods: ["POST", "GET"],
    auth: "bypass",
    skipTransform: true,
  },
  "/webhooks/abacate": {
    backend: "vercel",
    path: "/api/webhooks/abacate",
    methods: ["POST", "GET"],
    auth: "bypass",
    skipTransform: true,
  },

  // ============ Internal APIs (X-Internal-Secret) ============
  "/internal/validate-key": {
    backend: "vercel",
    path: "/api/internal/validate-key",
    methods: ["POST"],
    auth: "internal-secret",
    skipTransform: true,
  },
};

/**
 * Paths that don't require Bearer token authentication
 */
const UNAUTHENTICATED_PREFIXES = ["/webhooks/", "/health"];

/**
 * Check if a path requires Bearer token authentication
 */
export function requiresAuth(pathname: string): boolean {
  // Root and health check don't require auth
  if (pathname === "/" || pathname === "/health") {
    return false;
  }

  // Check if path starts with any unauthenticated prefix
  if (UNAUTHENTICATED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return false;
  }

  // All other routes require authentication
  return true;
}

/**
 * Get route configuration for a given pathname
 */
export function getRoute(pathname: string): RouteConfig | null {
  return ROUTES[pathname] ?? null;
}

/**
 * CORS headers for all responses
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Internal-Secret",
};

/**
 * Route unauthenticated request (webhooks, internal with X-Internal-Secret)
 * Pass-through without transformation
 */
export async function routeUnauthenticated(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const route = getRoute(url.pathname);

  if (!route) {
    return errorResponse(404, `Endpoint not found: ${url.pathname}`, {
      docs: "https://docs.livchat.ai",
    });
  }

  if (!route.methods.includes(request.method)) {
    return errorResponse(
      405,
      `Method ${request.method} not allowed for ${url.pathname}`
    );
  }

  // Check internal-secret authentication
  if (route.auth === "internal-secret") {
    const internalSecret = request.headers.get("X-Internal-Secret");
    if (!internalSecret || internalSecret !== env.INTERNAL_SECRET) {
      return errorResponse(401, "Invalid or missing internal secret");
    }
  }

  // Construct backend URL
  const backendUrl = route.backend === "wuzapi" ? env.WUZAPI_URL : env.VERCEL_URL;
  const targetUrl = `${backendUrl}${route.path}${url.search}`;

  // Clone headers, remove Host
  const headers = new Headers(request.headers);
  headers.delete("Host");

  try {
    // Proxy pass-through (no transformation for webhooks)
    const backendResponse = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method !== "GET" && request.method !== "HEAD"
        ? await request.clone().text()
        : undefined,
    });

    // Return response with CORS headers
    const responseHeaders = new Headers(backendResponse.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });

    return new Response(backendResponse.body, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`[proxy] Error proxying to ${targetUrl}:`, error);
    return errorResponse(502, "Bad Gateway");
  }
}

/**
 * Route request to appropriate backend
 */
export async function routeRequest(
  request: Request,
  keyData: ApiKeyData,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const route = ROUTES[url.pathname];

  if (!route) {
    return errorResponse(404, `Endpoint not found: ${url.pathname}`, {
      docs: "https://docs.livchat.ai",
    });
  }

  if (!route.methods.includes(request.method)) {
    return errorResponse(
      405,
      `Method ${request.method} not allowed for ${url.pathname}`
    );
  }

  // Check scope
  const requiredScope = `whatsapp:${url.pathname.split("/")[2]}`; // e.g., whatsapp:messages
  if (!hasScope(keyData.scopes, requiredScope)) {
    return errorResponse(
      403,
      `API key does not have required scope: ${requiredScope}`
    );
  }

  // Determine backend URL
  const backendUrl =
    route.backend === "wuzapi" ? env.WUZAPI_URL : env.VERCEL_URL;
  const targetUrl = `${backendUrl}${route.path}${url.search}`;

  // Create new request with modified headers
  const headers = new Headers(request.headers);

  // ═══════════════════════════════════════════════════════════════
  // RESOLVE INSTANCE: Handle `from` parameter for multi-instance
  // ═══════════════════════════════════════════════════════════════
  let resolvedProviderToken = keyData.providerToken;
  let resolvedInstanceId = keyData.instanceId;

  // ═══════════════════════════════════════════════════════════════
  // TRANSFORM REQUEST: camelCase → PascalCase (for WuzAPI)
  // ═══════════════════════════════════════════════════════════════
  let body: string | null = null;

  if (request.method !== "GET" && request.method !== "HEAD") {
    try {
      const jsonBody = (await request.json()) as RequestWithFrom;

      // If `from` is specified and we have allowed instances, resolve
      if (jsonBody.from && keyData.allowedInstances?.length) {
        const resolved = resolveInstanceByFrom(
          jsonBody.from,
          keyData.allowedInstances
        );

        if (resolved) {
          resolvedProviderToken = resolved.providerToken;
          resolvedInstanceId = resolved.id;
        } else {
          // Instance not found or not authorized
          return errorResponse(
            403,
            `Instance not found or not authorized: ${jsonBody.from}`,
            { hint: "Use a valid phone number or instance ID from your organization" }
          );
        }
      }

      // Remove `from` from body before sending to WuzAPI (it doesn't understand it)
      const { from: _from, ...bodyWithoutFrom } = jsonBody;
      const transformedBody = toPascalCase(bodyWithoutFrom);
      body = JSON.stringify(transformedBody);
      headers.set("Content-Type", "application/json");
    } catch {
      // Empty body or non-JSON, pass through unchanged
      body = await request.text();
    }
  }

  // Remove original Authorization, add WuzAPI token
  headers.delete("Authorization");
  if (route.backend === "wuzapi") {
    headers.set("Token", resolvedProviderToken);
  }

  // Add metadata headers
  headers.set("X-API-Key-ID", keyData.id);
  headers.set("X-Organization-ID", keyData.organizationId);
  if (resolvedInstanceId) {
    headers.set("X-Instance-ID", resolvedInstanceId);
  }

  // Proxy request to backend
  const backendResponse = await fetch(targetUrl, {
    method: request.method,
    headers,
    body,
  });

  // ═══════════════════════════════════════════════════════════════
  // TRANSFORM RESPONSE: PascalCase → camelCase (for client)
  // ═══════════════════════════════════════════════════════════════
  const contentType = backendResponse.headers.get("Content-Type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const jsonResponse = await backendResponse.json();
      const transformedResponse = toCamelCase(jsonResponse);

      return new Response(JSON.stringify(transformedResponse), {
        status: backendResponse.status,
        statusText: backendResponse.statusText,
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch {
      // JSON parse failed, return original response
      return backendResponse;
    }
  }

  // Non-JSON response (e.g., QR code image), pass through unchanged
  return backendResponse;
}

/**
 * Check if scopes include required scope
 */
function hasScope(scopes: string[], required: string): boolean {
  // Wildcard: whatsapp:* allows everything
  if (scopes.includes("whatsapp:*") || scopes.includes("*")) {
    return true;
  }
  return scopes.includes(required);
}

/**
 * Create error response
 */
function errorResponse(
  status: number,
  message: string,
  extra?: Record<string, string>
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
      headers: { "Content-Type": "application/json" },
    }
  );
}
