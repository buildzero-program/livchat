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

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AiChatContextType {
  // Estado
  isOpen: boolean;
  messages: Message[];
  isLoading: boolean;
  streamingContent: string | null;
  isReady: boolean;

  // Actions
  toggle: () => void;
  open: () => void;
  close: () => void;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
}

const AiChatContext = createContext<AiChatContextType | null>(null);

const STORAGE_KEY = "livchat-ai-messages";
const THREAD_KEY = "livchat-ai-thread";

function generateId() {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function AiChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Refs para evitar re-renders e loops
  const threadIdRef = useRef<string | null>(null);
  const isInitializingRef = useRef(false);
  const hasInitializedRef = useRef(false);

  // tRPC hooks
  const utils = api.useUtils();

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
      threadIdRef.current = data.thread.id;
      localStorage.setItem(THREAD_KEY, data.thread.id);
      localStorage.removeItem(STORAGE_KEY);
      setMessages([]);
      setIsReady(true);
      isInitializingRef.current = false;
    },
    onError: (error) => {
      console.error("Failed to create thread:", error);
      setIsReady(true); // Permite fallback
      isInitializingRef.current = false;
    },
  });

  // Mutation para enviar mensagem
  const sendMutation = api.ivy.send.useMutation();

  // Inicializa thread quando dados chegam (executa uma vez)
  useEffect(() => {
    // Previne múltiplas inicializações
    if (hasInitializedRef.current || isInitializingRef.current) return;
    if (isLoadingThread) return;

    hasInitializedRef.current = true;

    if (threadData?.thread) {
      // Thread existente encontrado
      threadIdRef.current = threadData.thread.id;

      // Carrega mensagens do localStorage se for o mesmo thread
      const storedThreadId = localStorage.getItem(THREAD_KEY);
      if (storedThreadId === threadData.thread.id) {
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored) as Message[];
            setMessages(
              parsed.map((msg) => ({
                ...msg,
                timestamp: new Date(msg.timestamp),
              }))
            );
          }
        } catch (e) {
          console.error("Failed to load AI chat messages:", e);
        }
      } else {
        // Thread diferente, limpa mensagens locais
        localStorage.setItem(THREAD_KEY, threadData.thread.id);
        localStorage.removeItem(STORAGE_KEY);
      }
      setIsReady(true);
    } else {
      // Nenhum thread encontrado, cria um novo
      isInitializingRef.current = true;
      newConversationMutation.mutate({ title: "Nova conversa" });
    }
  }, [threadData, isLoadingThread]); // Removido newConversationMutation das deps

  // Salva mensagens no localStorage quando mudam
  useEffect(() => {
    if (messages.length > 0 && threadIdRef.current) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      } catch (e) {
        console.error("Failed to save AI chat messages:", e);
      }
    }
  }, [messages]);

  // Actions com useCallback estável
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      const threadId = threadIdRef.current;
      if (!threadId) {
        console.error("No thread available - waiting for initialization");
        return;
      }

      // Adiciona mensagem do usuário imediatamente
      const userMessage: Message = {
        id: generateId(),
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        const result = await sendMutation.mutateAsync({
          threadId,
          message: content.trim(),
        });

        // Adiciona resposta da IA
        const aiMessage: Message = {
          id: generateId(),
          role: "assistant",
          content: result.response,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMessage]);
      } catch (error) {
        console.error("Send error:", error);
        const errorMessage: Message = {
          id: generateId(),
          role: "assistant",
          content:
            "Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [sendMutation]
  );

  const clearMessages = useCallback(() => {
    // Previne chamadas múltiplas
    if (isInitializingRef.current) return;

    isInitializingRef.current = true;
    newConversationMutation.mutate({ title: "Nova conversa" });
  }, [newConversationMutation]);

  // Valor do contexto memoizado
  const value = useMemo(
    () => ({
      isOpen,
      messages,
      isLoading,
      streamingContent,
      isReady,
      toggle,
      open,
      close,
      sendMessage,
      clearMessages,
    }),
    [
      isOpen,
      messages,
      isLoading,
      streamingContent,
      isReady,
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
