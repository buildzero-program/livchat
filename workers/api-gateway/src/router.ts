import type { Env, ApiKeyData, RouteConfig } from "./types";
import { toCamelCase, toPascalCase } from "./transformers";

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
};

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

  // Remove original Authorization, add WuzAPI token
  headers.delete("Authorization");
  if (route.backend === "wuzapi") {
    headers.set("Token", keyData.providerToken);
  }

  // Add metadata headers
  headers.set("X-API-Key-ID", keyData.id);
  headers.set("X-Organization-ID", keyData.organizationId);
  if (keyData.instanceId) {
    headers.set("X-Instance-ID", keyData.instanceId);
  }

  // ═══════════════════════════════════════════════════════════════
  // TRANSFORM REQUEST: camelCase → PascalCase (for WuzAPI)
  // ═══════════════════════════════════════════════════════════════
  let body: string | null = null;

  if (request.method !== "GET" && request.method !== "HEAD") {
    try {
      const jsonBody = await request.json();
      const transformedBody = toPascalCase(jsonBody);
      body = JSON.stringify(transformedBody);
      headers.set("Content-Type", "application/json");
    } catch {
      // Empty body or non-JSON, pass through unchanged
      body = await request.text();
    }
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
