import { db } from "~/server/db";
import { events } from "~/server/db/schema";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import type { EventType } from "~/lib/events";
import { BILLABLE_MESSAGE_EVENTS } from "~/lib/events";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface LogEventParams {
  name: EventType;
  organizationId?: string | null;
  instanceId?: string | null;
  apiKeyId?: string | null;
  deviceId?: string | null;
  value?: number;
  metadata?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Core Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Registra um evento no Event Log
 * Operação fire-and-forget para não bloquear o request
 */
export async function logEvent(params: LogEventParams): Promise<void> {
  try {
    await db.insert(events).values({
      name: params.name,
      organizationId: params.organizationId ?? null,
      instanceId: params.instanceId ?? null,
      apiKeyId: params.apiKeyId ?? null,
      deviceId: params.deviceId ?? null,
      value: params.value ?? 1,
      metadata: params.metadata ?? null,
    });
  } catch (error) {
    // Log error but don't throw - event logging should never break the request
    console.error("[events] Failed to log event:", error);
  }
}

/**
 * Conta eventos por organização e tipo desde uma data
 * Usado para verificar limites de uso
 */
export async function countEvents(
  organizationId: string,
  eventName: EventType,
  since: Date
): Promise<number> {
  const result = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(events)
    .where(
      and(
        eq(events.organizationId, organizationId),
        eq(events.name, eventName),
        gte(events.createdAt, since)
      )
    );

  return result[0]?.count ?? 0;
}

/**
 * Conta eventos de mensagens (billable) desde uma data
 * Soma MESSAGE_SENT + MESSAGE_RECEIVED
 */
export async function countBillableMessages(
  organizationId: string,
  since: Date
): Promise<number> {
  const result = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(events)
    .where(
      and(
        eq(events.organizationId, organizationId),
        inArray(events.name, [...BILLABLE_MESSAGE_EVENTS]),
        gte(events.createdAt, since)
      )
    );

  return result[0]?.count ?? 0;
}

/**
 * Conta eventos por instance desde uma data
 * Útil para métricas por instance
 */
export async function countInstanceEvents(
  instanceId: string,
  eventName: EventType,
  since: Date
): Promise<number> {
  const result = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(events)
    .where(
      and(
        eq(events.instanceId, instanceId),
        eq(events.name, eventName),
        gte(events.createdAt, since)
      )
    );

  return result[0]?.count ?? 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// Global Stats (para landing page - Fase 2)
// ═══════════════════════════════════════════════════════════════════════════

export interface GlobalStats {
  totalMessages: number;
  ratePerSecond: number;
}

/**
 * Retorna estatísticas globais para exibição na landing page
 * Calcula total de mensagens e taxa de mensagens por segundo
 */
export async function getGlobalStats(): Promise<GlobalStats> {
  // Total de mensagens (sent + received) de todos os tempos
  const [totalResult] = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(events)
    .where(inArray(events.name, [...BILLABLE_MESSAGE_EVENTS]));

  // Taxa dos últimos 5 minutos
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const [recentResult] = await db
    .select({ recent: sql<number>`COUNT(*)::int` })
    .from(events)
    .where(
      and(
        inArray(events.name, [...BILLABLE_MESSAGE_EVENTS]),
        gte(events.createdAt, fiveMinAgo)
      )
    );

  const total = totalResult?.total ?? 0;
  const recent = recentResult?.recent ?? 0;

  return {
    totalMessages: total,
    ratePerSecond: recent / 300, // 5 min = 300 segundos
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Retorna o início do dia atual (meia-noite) no timezone local
 * Usado para lazy reset diário
 */
export function getStartOfDay(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}
