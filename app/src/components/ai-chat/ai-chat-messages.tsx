"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "~/components/ui/scroll-area";
import { useAiChat, type Message } from "./ai-chat-provider";
import { cn } from "~/lib/utils";

/** Ivy AI image size - usar tamanho real para qualidade */
const IVY_IMAGE_SIZE = 1920;

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
}

function MessageBubble({ message, isStreaming = false }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "flex",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {/* Message content */}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted text-foreground rounded-bl-md"
        )}
      >
        <span className="text-sm leading-relaxed whitespace-pre-wrap">
          {message.content}
          {/* Streaming cursor - appears when receiving tokens */}
          {isStreaming && (
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-current align-middle" />
          )}
        </span>
      </div>
    </motion.div>
  );
}

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex justify-start"
    >
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-muted px-4 py-3">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="h-2 w-2 rounded-full bg-muted-foreground/50"
            animate={{
              y: [0, -4, 0],
            }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.15,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center"
    >
      <Image
        src="/ivy-ai.jpg"
        alt="Ivy AI"
        width={IVY_IMAGE_SIZE}
        height={IVY_IMAGE_SIZE}
        className="h-16 w-16 rounded-2xl object-cover"
      />
      <div className="space-y-2">
        <h3 className="font-semibold text-lg">Como posso ajudar?</h3>
        <p className="text-sm text-muted-foreground max-w-[240px]">
          Pergunte sobre a API, configuração de instâncias, webhooks ou qualquer
          dúvida sobre o LivChat.
        </p>
      </div>

      {/* Suggestions */}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {[
          "Como envio uma mensagem?",
          "Configurar webhook",
          "Ver minha quota",
        ].map((suggestion) => (
          <button
            key={suggestion}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

export function AiChatMessages() {
  const { messages, isLoading, streamingContent } = useAiChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive or streaming updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, streamingContent]);

  if (messages.length === 0 && !streamingContent) {
    return <EmptyState />;
  }

  // Check if we're streaming (has partial content)
  const isStreaming = isLoading && streamingContent !== null;

  return (
    <ScrollArea className="h-full" ref={scrollRef}>
      <div className="flex flex-col gap-4 p-4">
        <AnimatePresence mode="popLayout">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {/* Show streaming message with cursor */}
          {isStreaming && (
            <MessageBubble
              key="streaming"
              message={{
                id: "streaming",
                role: "assistant",
                content: streamingContent,
                timestamp: new Date(),
              }}
              isStreaming
            />
          )}
          {/* Show typing indicator only when loading but not yet streaming */}
          {isLoading && !streamingContent && <TypingIndicator key="typing" />}
        </AnimatePresence>
      </div>
    </ScrollArea>
  );
}
