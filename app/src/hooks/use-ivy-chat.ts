/**
 * Hook React para chat da Ivy com streaming via PartyKit
 *
 * Gerencia conexão WebSocket, acumulação de tokens e estado de mensagens.
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { IvyClient, type ChatMessage } from "~/lib/partykit/ivy-client";

// =============================================================================
// TYPES
// =============================================================================

interface UseIvyChatOptions {
  /** Thread ID do banco de dados */
  threadId: string | null;
  /** Habilita/desabilita conexão */
  enabled?: boolean;
}

interface UseIvyChatReturn {
  /** Lista de mensagens */
  messages: ChatMessage[];
  /** Se está recebendo tokens */
  isStreaming: boolean;
  /** Se está conectado ao PartyKit */
  isConnected: boolean;
  /** Conteúdo parcial sendo streamado */
  streamingContent: string;
  /** ID da mensagem sendo streamada (para unificar chaves) */
  streamingMessageId: string | null;
  /** Erro de conexão ou streaming */
  error: string | null;
  /** Envia mensagem para a Ivy */
  sendMessage: (content: string, images?: string[]) => void;
  /** Limpa todas as mensagens */
  clearMessages: () => void;
}

// =============================================================================
// HOOK
// =============================================================================

// Gera ID temporário para mensagem de streaming
function generateTempId(): string {
  return `streaming_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function useIvyChat({
  threadId,
  enabled = true,
}: UseIvyChatOptions): UseIvyChatReturn {
  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs para performance (evita re-render por token)
  const clientRef = useRef<IvyClient | null>(null);
  const streamingContentRef = useRef("");
  const streamingMessageIdRef = useRef<string | null>(null);

  // Conecta ao PartyKit quando threadId está disponível
  useEffect(() => {
    if (!enabled || !threadId) {
      return;
    }

    // Limpa cliente anterior se existir
    if (clientRef.current) {
      clientRef.current.disconnect();
    }

    const client = new IvyClient({
      threadId,

      onMessage: (msg) => {
        setMessages((prev) => {
          // Evita duplicatas
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      },

      onToken: (token) => {
        // Acumula em ref (rápido) e atualiza state
        streamingContentRef.current += token;
        setStreamingContent(streamingContentRef.current);
      },

      onDone: (messageId, fullContent) => {
        // Usa o ID do streaming se existir, senão usa o do servidor
        const finalId = streamingMessageIdRef.current || messageId;

        // Adiciona mensagem final com o MESMO ID usado no streaming
        setMessages((prev) => {
          if (prev.some((m) => m.id === finalId)) return prev;
          return [
            ...prev,
            {
              id: finalId,
              role: "assistant" as const,
              content: fullContent,
              timestamp: new Date().toISOString(),
            },
          ];
        });

        // Limpa streaming
        streamingContentRef.current = "";
        streamingMessageIdRef.current = null;
        setStreamingContent("");
        setStreamingMessageId(null);
      },

      onError: (err) => {
        setError(err);
        // Limpa após 5s
        setTimeout(() => setError(null), 5000);
      },

      onHistory: (history) => {
        setMessages(history);
      },

      onStreamingChange: (streaming) => {
        setIsStreaming(streaming);
        if (streaming) {
          // Gera ID único para esta mensagem de streaming
          const newId = generateTempId();
          streamingMessageIdRef.current = newId;
          setStreamingMessageId(newId);
          // Reset streaming content
          streamingContentRef.current = "";
          setStreamingContent("");
        }
      },

      onConnectionChange: (connected) => {
        setIsConnected(connected);
        if (!connected) {
          setError("Desconectado do servidor");
        } else {
          setError(null);
        }
      },
    });

    clientRef.current = client;
    client.connect();

    // Cleanup
    return () => {
      client.disconnect();
      clientRef.current = null;
    };
  }, [threadId, enabled]);

  // Actions
  const sendMessage = useCallback((content: string, images?: string[]) => {
    if (!content.trim() && (!images || images.length === 0)) return;
    clientRef.current?.sendMessage(content.trim(), images);
  }, []);

  const clearMessages = useCallback(() => {
    clientRef.current?.clearMessages();
    setMessages([]);
    streamingContentRef.current = "";
    setStreamingContent("");
  }, []);

  return {
    messages,
    isStreaming,
    isConnected,
    streamingContent,
    streamingMessageId,
    error,
    sendMessage,
    clearMessages,
  };
}

// Re-export types
export type { ChatMessage };
