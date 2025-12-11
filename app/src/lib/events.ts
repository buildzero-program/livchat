// ═══════════════════════════════════════════════════════════════════════════
// Event Types - Sistema de Event Log para tracking de uso
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tipos de eventos registrados no sistema
 * Convenção: {categoria}.{ação} usando dot notation
 */
export const EventTypes = {
  // Mensagens (contam para billing)
  MESSAGE_SENT: "message.sent",
  MESSAGE_RECEIVED: "message.received",

  // API (contam para rate limit)
  API_CALL: "api.call",
  API_VALIDATION: "api.validation",

  // Conexão (não contam, apenas auditoria)
  CONNECTION_CONNECTED: "connection.connected",
  CONNECTION_DISCONNECTED: "connection.disconnected",
  CONNECTION_QR_SCANNED: "connection.qr_scanned",
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];

/**
 * Eventos que contam para limite de mensagens diárias
 * Usados para billing e controle de quota
 */
export const BILLABLE_MESSAGE_EVENTS = [
  EventTypes.MESSAGE_SENT,
  EventTypes.MESSAGE_RECEIVED,
] as const;

/**
 * Eventos que contam para rate limit de API
 * Usados para controle de taxa de requisições
 */
export const RATE_LIMITED_EVENTS = [
  EventTypes.API_CALL,
  EventTypes.API_VALIDATION,
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// WuzAPI Event Mapping
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mapeia tipos de eventos do WuzAPI para nossos tipos internos
 * null = evento ignorado (não registramos)
 */
export const WUZAPI_EVENT_MAP: Record<string, EventType | null> = {
  // Eventos que registramos
  Message: EventTypes.MESSAGE_RECEIVED,
  Connected: EventTypes.CONNECTION_CONNECTED,
  Disconnected: EventTypes.CONNECTION_DISCONNECTED,
  LoggedOut: EventTypes.CONNECTION_DISCONNECTED,

  // Eventos ignorados (muito frequentes ou não relevantes)
  ReadReceipt: null,
  ChatPresence: null,
  HistorySync: null,
  OfflineSyncPreview: null,
  OfflineSyncCompleted: null,
  IdentityChange: null,
  QR: null,
};

/**
 * Verifica se um evento WuzAPI deve ser registrado
 */
export function shouldLogWuzAPIEvent(wuzapiEventType: string): boolean {
  return WUZAPI_EVENT_MAP[wuzapiEventType] !== null &&
    WUZAPI_EVENT_MAP[wuzapiEventType] !== undefined;
}

/**
 * Converte um tipo de evento WuzAPI para nosso tipo interno
 * Retorna null se o evento não deve ser registrado
 */
export function mapWuzAPIEvent(wuzapiEventType: string): EventType | null {
  return WUZAPI_EVENT_MAP[wuzapiEventType] ?? null;
}
