// ═══════════════════════════════════════════════════════════════════════════
// Webhook Forwarder - Encaminha eventos para webhooks configurados pelo usuário
// ═══════════════════════════════════════════════════════════════════════════

import { eq, and } from "drizzle-orm";
import { db } from "~/server/db";
import { webhooks } from "~/server/db/schema";
import { logEvent } from "~/server/lib/events";
import { EventTypes } from "~/lib/events";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface WebhookFilters {
  instanceIds: string[] | null;
  subscriptions: string[] | null;
}

export interface WebhookPayload {
  event: string;
  timestamp: string;
  webhookId: string;
  instance: {
    id: string;
    phone: string;
    name: string;
  };
  data: unknown;
}

export interface BuildPayloadParams {
  webhookId: string;
  eventType: string;
  instanceId: string;
  instancePhone: string;
  instanceName: string;
  eventData: unknown;
}

export interface ForwardParams {
  organizationId: string;
  instanceId: string;
  instancePhone: string;
  instanceName: string;
  eventType: string;
  eventData: unknown;
  sourceEventId?: string;
}

// Timeout para chamadas de webhook (5 segundos)
const WEBHOOK_TIMEOUT_MS = 5000;

// ═══════════════════════════════════════════════════════════════════════════
// FILTER LOGIC
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Verifica se um webhook deve receber um evento baseado nos filtros configurados
 * - instanceIds null = todas instâncias
 * - subscriptions null = todos eventos
 */
export function shouldDeliverToWebhook(
  filters: WebhookFilters,
  instanceId: string,
  eventType: string
): boolean {
  // Check instance filter
  const instanceMatches =
    filters.instanceIds === null || filters.instanceIds.includes(instanceId);

  // Check event type filter
  const eventMatches =
    filters.subscriptions === null || filters.subscriptions.includes(eventType);

  return instanceMatches && eventMatches;
}

// ═══════════════════════════════════════════════════════════════════════════
// PAYLOAD BUILDER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Constrói o payload que será enviado ao webhook do usuário
 */
export function buildWebhookPayload(params: BuildPayloadParams): WebhookPayload {
  return {
    event: params.eventType,
    timestamp: new Date().toISOString(),
    webhookId: params.webhookId,
    instance: {
      id: params.instanceId,
      phone: params.instancePhone,
      name: params.instanceName,
    },
    data: params.eventData,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HMAC SIGNATURE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Gera assinatura HMAC-SHA256 para validação do payload
 * Formato: sha256=<hex_digest>
 */
export async function generateHmacSignature(
  payload: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const payloadData = encoder.encode(payload);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, payloadData);
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return `sha256=${hashHex}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN FORWARDER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Encaminha um evento para todos os webhooks ativos da organização
 * - Busca webhooks ativos
 * - Filtra por instanceIds e subscriptions
 * - Envia POST com timeout
 * - Loga sucesso/falha
 *
 * Esta função NUNCA deve lançar exceção - é fire-and-forget
 */
export async function forwardToUserWebhooks(
  params: ForwardParams
): Promise<void> {
  try {
    // Query webhooks ativos da organização
    const activeWebhooks = await db.query.webhooks.findMany({
      where: and(
        eq(webhooks.organizationId, params.organizationId),
        eq(webhooks.isActive, true)
      ),
    });

    if (activeWebhooks.length === 0) {
      return;
    }

    // Forward para cada webhook que match os filtros
    const deliveryPromises = activeWebhooks.map((webhook) =>
      deliverToWebhook(webhook, params)
    );

    // Aguarda todas as entregas (mas não falha se alguma falhar)
    await Promise.allSettled(deliveryPromises);
  } catch (error) {
    // Log error mas não propaga - forwarding não deve quebrar o fluxo principal
    console.error("[webhook-forwarder] Error fetching webhooks:", error);
  }
}

/**
 * Entrega um evento para um webhook específico
 */
async function deliverToWebhook(
  webhook: {
    id: string;
    organizationId: string;
    name: string;
    url: string;
    signingSecret: string | null;
    headers: Record<string, string> | null;
    instanceIds: string[] | null;
    subscriptions: string[] | null;
    isActive: boolean;
  },
  params: ForwardParams
): Promise<void> {
  // Check filters
  if (
    !shouldDeliverToWebhook(
      {
        instanceIds: webhook.instanceIds,
        subscriptions: webhook.subscriptions,
      },
      params.instanceId,
      params.eventType
    )
  ) {
    return;
  }

  // Build payload
  const payload = buildWebhookPayload({
    webhookId: webhook.id,
    eventType: params.eventType,
    instanceId: params.instanceId,
    instancePhone: params.instancePhone,
    instanceName: params.instanceName,
    eventData: params.eventData,
  });

  const payloadString = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();

  // Build headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(webhook.headers ?? {}),
  };

  // Add HMAC signature if secret is configured
  if (webhook.signingSecret) {
    const signature = await generateHmacSignature(
      payloadString,
      webhook.signingSecret
    );
    headers["x-livchat-signature"] = signature;
    headers["x-livchat-timestamp"] = timestamp;
  }

  // Track timing
  const startTime = performance.now();
  let statusCode: number | null = null;
  let error: string | null = null;
  let responseBody: string | null = null;

  try {
    // Make request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    const response = await fetch(webhook.url, {
      method: "POST",
      headers,
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    statusCode = response.status;
    responseBody = await response.text();

    // Truncate response body to 1KB
    if (responseBody.length > 1024) {
      responseBody = responseBody.slice(0, 1024) + "...[truncated]";
    }

    if (!response.ok) {
      error = `HTTP ${response.status}: ${responseBody.slice(0, 200)}`;
    }
  } catch (err) {
    if (err instanceof Error) {
      if (err.name === "AbortError") {
        error = `Timeout after ${WEBHOOK_TIMEOUT_MS}ms`;
      } else {
        error = err.message;
      }
    } else {
      error = "Unknown error";
    }
  }

  const latencyMs = Math.round(performance.now() - startTime);

  // Log delivery result
  const eventName = error
    ? EventTypes.WEBHOOK_FAILED
    : EventTypes.WEBHOOK_DELIVERED;

  await logEvent({
    name: eventName,
    organizationId: params.organizationId,
    instanceId: params.instanceId,
    metadata: {
      webhookId: webhook.id,
      webhookName: webhook.name,
      webhookUrl: webhook.url,
      sourceEventType: params.eventType,
      sourceEventId: params.sourceEventId ?? null,
      statusCode,
      latencyMs,
      attempt: 1,
      error,
      responseBody,
      requestPayload: payload, // Payload enviado para o webhook
    },
  });
}
