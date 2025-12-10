import { NextResponse, type NextRequest } from "next/server";
import {
  validateAndResolveInstance,
  getOrganizationInstances,
  type AllowedInstance,
} from "~/server/lib/api-key";
import { env } from "~/env";
import { logger, LogActions } from "~/server/lib/logger";

interface ValidateKeyRequest {
  key: string;
}

export async function POST(request: NextRequest) {
  // Verify internal secret
  const internalSecret = request.headers.get("X-Internal-Secret");

  if (!env.INTERNAL_SECRET) {
    logger.error(LogActions.AUTH_ERROR, "INTERNAL_SECRET not configured");
    return NextResponse.json(
      { error: "Internal configuration error" },
      { status: 500 }
    );
  }

  if (internalSecret !== env.INTERNAL_SECRET) {
    logger.warn(LogActions.AUTH_ERROR, "Invalid internal secret", {
      hasSecret: !!internalSecret,
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse request body
  let body: ValidateKeyRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.key || typeof body.key !== "string") {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }

  // Validate key and resolve instance (unified logic)
  const result = await validateAndResolveInstance(body.key);

  if (!result) {
    logger.debug(LogActions.API_KEY_USE, "API key validation failed", {
      tokenPrefix: body.key.slice(0, 16),
    });
    return NextResponse.json({ error: "Invalid API key" }, { status: 404 });
  }

  // Get all allowed instances for multi-instance support
  let allowedInstances: AllowedInstance[] = [];

  if (result.organizationId) {
    // Claimed key: can use any instance from the org
    allowedInstances = await getOrganizationInstances(result.organizationId);
  } else {
    // Orphan key: can only use its specific instance
    allowedInstances = [
      {
        id: result.instanceId,
        whatsappJid: result.whatsappJid,
        providerToken: result.providerToken,
      },
    ];
  }

  logger.debug(LogActions.API_KEY_USE, "API key validated", {
    keyId: result.keyId,
    organizationId: result.organizationId,
    instanceId: result.instanceId,
    allowedInstancesCount: allowedInstances.length,
  });

  return NextResponse.json({
    id: result.keyId,
    organizationId: result.organizationId,
    instanceId: result.instanceId,
    providerToken: result.providerToken,
    scopes: result.scopes,
    rateLimitRequests: result.rateLimitRequests,
    rateLimitWindowSeconds: result.rateLimitWindowSeconds,
    isActive: true,
    // Multi-instance support
    allowedInstances,
  });
}
