import { NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";
import { instances } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { logEvent } from "~/server/lib/events";
import { mapWuzAPIEvent, shouldLogWuzAPIEvent, EventTypes } from "~/lib/events";
import { incrementMessageCount } from "~/server/lib/instance";
import { validateHmacSignature } from "~/server/lib/hmac";
import { env } from "~/env";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

// Form format payload (WEBHOOK_FORMAT=form)
interface WuzAPIFormPayload {
  instanceName?: string;
  userID?: string;
  jsonData?: string;
}

// JSON format payload (WEBHOOK_FORMAT=json) - event data is at root level
interface WuzAPIJsonPayload {
  type: string;
  userID?: string;
  instanceName?: string;
  event?: WuzAPIEventInfo;
}

interface WuzAPIEventInfo {
  Info?: {
    ID?: string;
    Sender?: string;
    Chat?: string;
    Timestamp?: string;
    IsFromMe?: boolean;
    IsGroup?: boolean;
    Type?: string;
  };
  Message?: {
    conversation?: string;
    extendedTextMessage?: {
      text?: string;
    };
  };
}

interface WuzAPIEventData {
  type: string;
  event?: WuzAPIEventInfo;
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════

function parseWuzAPIPayload(jsonData: string): WuzAPIEventData | null {
  try {
    return JSON.parse(jsonData) as WuzAPIEventData;
  } catch {
    return null;
  }
}

/**
 * Detecta se o payload é formato JSON (dados no root) ou Form (dados em jsonData)
 */
function isJsonFormat(payload: unknown): payload is WuzAPIJsonPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "type" in payload &&
    typeof (payload as WuzAPIJsonPayload).type === "string" &&
    "event" in payload
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// POST Handler - Receive WuzAPI webhooks
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    // ═══════════════════════════════════════════════════════════════════════════
    // 1. VALIDATE HMAC SIGNATURE (if configured)
    // ═══════════════════════════════════════════════════════════════════════════
    const hmacSignature = request.headers.get("x-hmac-signature");
    const contentType = request.headers.get("content-type") ?? "";

    // Read raw body first (needed for HMAC validation)
    const rawBody = await request.text();

    // If HMAC secret is configured, validate the signature
    if (env.WUZAPI_WEBHOOK_SECRET) {
      if (!validateHmacSignature(rawBody, env.WUZAPI_WEBHOOK_SECRET, hmacSignature)) {
        console.warn("[webhook/wuzapi] Invalid or missing HMAC signature", {
          hasSignature: !!hmacSignature,
        });
        return NextResponse.json(
          { success: false, error: "Invalid signature" },
          { status: 401 }
        );
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. PARSE BODY (using raw body we already read)
    // ═══════════════════════════════════════════════════════════════════════════
    let userID: string | undefined;
    let eventData: WuzAPIEventData | null = null;

    if (contentType.includes("application/json")) {
      const rawPayload = JSON.parse(rawBody);

      // Check if it's JSON format (WEBHOOK_FORMAT=json) or Form format
      if (isJsonFormat(rawPayload)) {
        // JSON format: event data is at root level
        userID = rawPayload.userID;
        eventData = {
          type: rawPayload.type,
          event: rawPayload.event,
        };
      } else {
        // Form-like JSON format: event data is in jsonData string
        const formPayload = rawPayload as WuzAPIFormPayload;
        userID = formPayload.userID;
        if (formPayload.jsonData) {
          eventData = parseWuzAPIPayload(formPayload.jsonData);
        }
      }
    } else if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      // Form data format - parse from raw body using URLSearchParams
      const params = new URLSearchParams(rawBody);
      const jsonData = params.get("jsonData");
      userID = params.get("userID") ?? undefined;
      if (jsonData) {
        eventData = parseWuzAPIPayload(jsonData);
      }
    } else {
      // Try JSON as default (using raw body we already read)
      try {
        const rawPayload = JSON.parse(rawBody);
        if (isJsonFormat(rawPayload)) {
          userID = rawPayload.userID;
          eventData = {
            type: rawPayload.type,
            event: rawPayload.event,
          };
        } else {
          const formPayload = rawPayload as WuzAPIFormPayload;
          userID = formPayload.userID;
          if (formPayload.jsonData) {
            eventData = parseWuzAPIPayload(formPayload.jsonData);
          }
        }
      } catch {
        console.warn("[webhook/wuzapi] Failed to parse body as JSON");
      }
    }

    // Validate payload
    if (!userID) {
      console.warn("[webhook/wuzapi] Missing userID in payload");
      return NextResponse.json({ success: false, error: "Missing userID" }, { status: 400 });
    }

    if (!eventData) {
      console.warn("[webhook/wuzapi] Missing or invalid event data in payload");
      return NextResponse.json({ success: false, error: "Missing event data" }, { status: 400 });
    }

    // Get event type
    const wuzapiEventType = eventData.type;
    if (!wuzapiEventType) {
      console.warn("[webhook/wuzapi] Missing event type");
      return NextResponse.json({ success: true, eventsLogged: 0 });
    }

    // Check if we should log this event
    if (!shouldLogWuzAPIEvent(wuzapiEventType)) {
      // Silently ignore events we don't track
      return NextResponse.json({ success: true, eventsLogged: 0 });
    }

    // Find instance by providerId (WuzAPI userID)
    const instance = await db.query.instances.findFirst({
      where: eq(instances.providerId, userID),
      with: { organization: true },
    });

    if (!instance) {
      console.warn(`[webhook/wuzapi] Instance not found for userID: ${userID}`);
      // Return success to prevent WuzAPI from retrying
      return NextResponse.json({ success: true, error: "Instance not found", eventsLogged: 0 });
    }

    // Map WuzAPI event to our internal event type
    const internalEventType = mapWuzAPIEvent(wuzapiEventType);
    if (!internalEventType) {
      return NextResponse.json({ success: true, eventsLogged: 0 });
    }

    // Extract metadata from event
    const metadata: Record<string, unknown> = {
      wuzapiType: wuzapiEventType,
    };

    if (eventData.event?.Info) {
      metadata.messageId = eventData.event.Info.ID;
      metadata.sender = eventData.event.Info.Sender;
      metadata.chat = eventData.event.Info.Chat;
      metadata.isFromMe = eventData.event.Info.IsFromMe;
      metadata.isGroup = eventData.event.Info.IsGroup;
      metadata.messageType = eventData.event.Info.Type;
    }

    // Log the event
    await logEvent({
      name: internalEventType,
      organizationId: instance.organizationId,
      instanceId: instance.id,
      metadata,
    });

    // If it's a received message, also increment the message counter
    if (internalEventType === EventTypes.MESSAGE_RECEIVED) {
      await incrementMessageCount(instance.id);
    }

    console.info(`[webhook/wuzapi] Logged event: ${internalEventType} for instance ${instance.id}`);

    return NextResponse.json({ success: true, eventsLogged: 1 });
  } catch (error) {
    console.error("[webhook/wuzapi] Error processing webhook:", error);
    // Return success to prevent WuzAPI from retrying
    return NextResponse.json({ success: true, error: "Internal error", eventsLogged: 0 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET Handler - Health check
// ═══════════════════════════════════════════════════════════════════════════

export async function GET() {
  return NextResponse.json({ status: "ok", endpoint: "wuzapi-webhook" });
}
