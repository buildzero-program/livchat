/**
 * Cliente PartyKit para chat da Ivy
 *
 * Wrapper do PartySocket com tipagem e callbacks.
 */

import PartySocket from "partysocket";

// =============================================================================
// TYPES (espelhando partykit/src/types.ts)
// =============================================================================

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  /** URLs de imagens (Vercel Blob) */
  images?: string[];
  /** URL do áudio (Vercel Blob) */
  audio?: string;
}

type ClientMessage =
  | { type: "message"; content: string; images?: string[]; audio?: string }
  | { type: "history" }
  | { type: "clear" };

type ServerMessage =
  | {
      type: "message";
      id: string;
      role: "user" | "assistant";
      content: string;
      timestamp: string;
      images?: string[];
      audio?: string;
    }
  | { type: "token"; content: string }
  | { type: "done"; messageId: string; fullContent: string }
  | { type: "error"; message: string }
  | { type: "history"; messages: ChatMessage[] }
  | { type: "streaming"; isStreaming: boolean };

// =============================================================================
// CLIENT OPTIONS
// =============================================================================

export interface IvyClientOptions {
  threadId: string;
  onMessage?: (message: ChatMessage) => void;
  onToken?: (token: string) => void;
  onDone?: (messageId: string, fullContent: string) => void;
  onError?: (error: string) => void;
  onHistory?: (messages: ChatMessage[]) => void;
  onStreamingChange?: (isStreaming: boolean) => void;
  onConnectionChange?: (connected: boolean) => void;
}

// =============================================================================
// CLIENT CLASS
// =============================================================================

export class IvyClient {
  private socket: PartySocket | null = null;
  private options: IvyClientOptions;

  constructor(options: IvyClientOptions) {
    this.options = options;
  }

  connect() {
    const host =
      process.env.NEXT_PUBLIC_PARTYKIT_HOST || "127.0.0.1:1999";

    this.socket = new PartySocket({
      host,
      room: `ivy_${this.options.threadId}`,
    });

    this.socket.addEventListener("open", () => {
      this.options.onConnectionChange?.(true);
    });

    this.socket.addEventListener("close", () => {
      this.options.onConnectionChange?.(false);
    });

    this.socket.addEventListener("error", () => {
      this.options.onError?.("Connection error");
    });

    this.socket.addEventListener("message", (event) => {
      this.handleMessage(event.data as string);
    });
  }

  disconnect() {
    this.socket?.close();
    this.socket = null;
  }

  sendMessage(content: string, images?: string[], audio?: string) {
    this.send({ type: "message", content, images, audio });
  }

  requestHistory() {
    this.send({ type: "history" });
  }

  clearMessages() {
    this.send({ type: "clear" });
  }

  private send(message: ClientMessage) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  private handleMessage(data: string) {
    try {
      const message = JSON.parse(data) as ServerMessage;

      switch (message.type) {
        case "message":
          this.options.onMessage?.({
            id: message.id,
            role: message.role,
            content: message.content,
            timestamp: message.timestamp,
            images: message.images,
            audio: message.audio,
          });
          break;

        case "token":
          this.options.onToken?.(message.content);
          break;

        case "done":
          this.options.onDone?.(message.messageId, message.fullContent);
          break;

        case "error":
          this.options.onError?.(message.message);
          break;

        case "history":
          this.options.onHistory?.(message.messages);
          break;

        case "streaming":
          this.options.onStreamingChange?.(message.isStreaming);
          break;
      }
    } catch (error) {
      console.error("Failed to parse message:", error);
    }
  }
}
