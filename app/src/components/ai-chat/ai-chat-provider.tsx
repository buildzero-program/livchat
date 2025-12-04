"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

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
  /** Content being streamed (partial response) - null when not streaming */
  streamingContent: string | null;

  // Actions
  toggle: () => void;
  open: () => void;
  close: () => void;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
}

const AiChatContext = createContext<AiChatContextType | null>(null);

const STORAGE_KEY = "livchat-ai-messages";

// Mock responses for the AI
const mockResponses = [
  "Olá! Sou o assistente AI do LivChat. Posso ajudar você a configurar sua instância WhatsApp, entender a API, ou resolver problemas técnicos. Como posso ajudar?",
  "Boa pergunta! Para enviar uma mensagem via API, você precisa fazer um POST para `/api/send` com o número de destino e o conteúdo da mensagem. Quer ver um exemplo de código?",
  "Claro! Para conectar uma nova instância, vá em 'Instâncias' no menu lateral e clique em 'Nova Instância'. Depois é só escanear o QR Code com seu WhatsApp.",
  "O webhook é chamado sempre que você recebe uma mensagem. Configure a URL do seu servidor em 'Webhooks' e nós enviaremos um POST com os dados da mensagem recebida.",
  "Sua quota atual é de 1.500 mensagens/mês no plano Starter. Você já usou 83% do limite. Quer fazer upgrade para o plano Scale?",
];

function generateId() {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function AiChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);

  // Load messages from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Message[];
        // Convert timestamp strings back to Date objects
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
  }, []);

  // Save messages to localStorage when they change
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      } catch (e) {
        console.error("Failed to save AI chat messages:", e);
      }
    }
  }, [messages]);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Simulate AI response with delay (1-2s)
    await new Promise((resolve) =>
      setTimeout(resolve, 1000 + Math.random() * 1000)
    );

    // Pick a random mock response
    const aiResponse: Message = {
      id: generateId(),
      role: "assistant",
      content: mockResponses[Math.floor(Math.random() * mockResponses.length)]!,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, aiResponse]);
    setIsLoading(false);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <AiChatContext.Provider
      value={{
        isOpen,
        messages,
        isLoading,
        streamingContent,
        toggle,
        open,
        close,
        sendMessage,
        clearMessages,
      }}
    >
      {children}
    </AiChatContext.Provider>
  );
}

export function useAiChat() {
  const context = useContext(AiChatContext);
  if (!context) {
    throw new Error("useAiChat must be used within an AiChatProvider");
  }
  return context;
}
