"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type ReactNode,
} from "react";
import { api } from "~/trpc/react";
import { useIvyChat, type ChatMessage } from "~/hooks/use-ivy-chat";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

// Converte ChatMessage do PartyKit para Message do provider
function toMessage(msg: ChatMessage): Message {
  return {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    timestamp: new Date(msg.timestamp),
  };
}

interface AiChatContextType {
  // Estado
  isOpen: boolean;
  messages: Message[];
  isLoading: boolean;
  streamingContent: string | null;
  streamingMessageId: string | null;
  isReady: boolean;
  isConnected: boolean;

  // Actions
  toggle: () => void;
  open: () => void;
  close: () => void;
  sendMessage: (content: string) => void;
  clearMessages: () => void;
}

const AiChatContext = createContext<AiChatContextType | null>(null);

const THREAD_KEY = "livchat-ai-thread";

export function AiChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);

  // Refs para evitar loops
  const isInitializingRef = useRef(false);
  const hasInitializedRef = useRef(false);

  // Query para buscar thread ativo (não cria automaticamente)
  const { data: threadData, isLoading: isLoadingThread } =
    api.ivy.getActiveThread.useQuery(undefined, {
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      staleTime: Infinity,
    });

  // Mutation para criar nova conversa
  const newConversationMutation = api.ivy.newConversation.useMutation({
    onSuccess: (data) => {
      setThreadId(data.thread.id);
      localStorage.setItem(THREAD_KEY, data.thread.id);
      isInitializingRef.current = false;
    },
    onError: (error) => {
      console.error("Failed to create thread:", error);
      isInitializingRef.current = false;
    },
  });

  // Hook do PartyKit para streaming
  const ivyChat = useIvyChat({
    threadId,
    enabled: !!threadId,
  });

  // Inicializa thread quando dados chegam (executa uma vez)
  useEffect(() => {
    // Previne múltiplas inicializações
    if (hasInitializedRef.current || isInitializingRef.current) return;
    if (isLoadingThread) return;

    hasInitializedRef.current = true;

    if (threadData?.thread) {
      // Thread existente encontrado
      setThreadId(threadData.thread.id);
      localStorage.setItem(THREAD_KEY, threadData.thread.id);
    } else {
      // Nenhum thread encontrado, cria um novo
      isInitializingRef.current = true;
      newConversationMutation.mutate({ title: "Nova conversa" });
    }
  }, [threadData, isLoadingThread]);

  // Actions com useCallback estável
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const sendMessage = useCallback(
    (content: string) => {
      if (!content.trim()) return;

      if (!threadId) {
        console.error("No thread available - waiting for initialization");
        return;
      }

      // Envia via PartyKit (streaming)
      ivyChat.sendMessage(content.trim());
    },
    [ivyChat, threadId]
  );

  const clearMessages = useCallback(() => {
    // Previne chamadas múltiplas
    if (isInitializingRef.current) return;

    // Limpa no PartyKit
    ivyChat.clearMessages();

    // Cria nova thread
    isInitializingRef.current = true;
    hasInitializedRef.current = false;
    setThreadId(null);
    newConversationMutation.mutate({ title: "Nova conversa" });
  }, [ivyChat, newConversationMutation]);

  // Converte mensagens do PartyKit para o formato do provider
  const messages = useMemo(
    () => ivyChat.messages.map(toMessage),
    [ivyChat.messages]
  );

  // isReady = tem threadId
  const isReady = !!threadId;

  // Valor do contexto memoizado
  const value = useMemo(
    () => ({
      isOpen,
      messages,
      isLoading: ivyChat.isStreaming,
      streamingContent: ivyChat.streamingContent || null,
      streamingMessageId: ivyChat.streamingMessageId,
      isReady,
      isConnected: ivyChat.isConnected,
      toggle,
      open,
      close,
      sendMessage,
      clearMessages,
    }),
    [
      isOpen,
      messages,
      ivyChat.isStreaming,
      ivyChat.streamingContent,
      ivyChat.streamingMessageId,
      isReady,
      ivyChat.isConnected,
      toggle,
      open,
      close,
      sendMessage,
      clearMessages,
    ]
  );

  return (
    <AiChatContext.Provider value={value}>{children}</AiChatContext.Provider>
  );
}

export function useAiChat() {
  const context = useContext(AiChatContext);
  if (!context) {
    throw new Error("useAiChat must be used within an AiChatProvider");
  }
  return context;
}
