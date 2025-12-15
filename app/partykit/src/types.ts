/**
 * Tipos compartilhados entre servidor PartyKit e cliente React
 */

// =============================================================================
// MENSAGENS
// =============================================================================

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

// =============================================================================
// CLIENTE → SERVIDOR
// =============================================================================

export type ClientMessage =
  | { type: "message"; content: string }
  | { type: "history" }
  | { type: "clear" };

// =============================================================================
// SERVIDOR → CLIENTE
// =============================================================================

export type ServerMessage =
  | {
      type: "message";
      id: string;
      role: "user" | "assistant";
      content: string;
      timestamp: string;
    }
  | { type: "token"; content: string }
  | { type: "done"; messageId: string; fullContent: string }
  | { type: "error"; message: string }
  | { type: "history"; messages: ChatMessage[] }
  | { type: "streaming"; isStreaming: boolean };

// =============================================================================
// ESTADO DO ROOM
// =============================================================================

export interface RoomState {
  messages: ChatMessage[];
  threadId: string | null;
  isStreaming: boolean;
}
