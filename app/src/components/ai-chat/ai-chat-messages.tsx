"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause } from "lucide-react";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Button } from "~/components/ui/button";
import { useAiChat, type Message } from "./ai-chat-provider";
import { cn } from "~/lib/utils";

/** Ivy AI image size - usar tamanho real para qualidade */
const IVY_IMAGE_SIZE = 1920;

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  skipAnimation?: boolean;
}

/**
 * Componente para exibir player de áudio customizado
 */
function MessageAudio({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const togglePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-2 rounded-lg bg-background/20 px-2 py-1.5">
      <audio
        ref={audioRef}
        src={src}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 shrink-0 rounded-full"
        onClick={togglePlayPause}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : (
          <Play className="h-4 w-4 fill-current" />
        )}
      </Button>

      {/* Progress bar */}
      <div className="relative h-1.5 flex-1 rounded-full bg-background/30">
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-current transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Duration */}
      <span className="min-w-[40px] text-xs tabular-nums opacity-70">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
    </div>
  );
}

/**
 * Componente para exibir imagem com lightbox
 */
function MessageImage({ src, alt }: { src: string; alt: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  return (
    <>
      {/* Thumbnail */}
      <div
        className="relative cursor-pointer overflow-hidden rounded-lg"
        onClick={() => setIsOpen(true)}
      >
        <Image
          src={src}
          alt={alt}
          width={200}
          height={200}
          className={cn(
            "max-h-[200px] w-auto rounded-lg object-cover transition-opacity",
            isLoading ? "opacity-0" : "opacity-100"
          )}
          onLoad={() => setIsLoading(false)}
          unoptimized // URLs externas do Vercel Blob
        />
        {isLoading && (
          <div className="absolute inset-0 animate-pulse rounded-lg bg-muted" />
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative max-h-[90vh] max-w-[90vw]"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={src}
                alt={alt}
                width={1200}
                height={1200}
                className="max-h-[90vh] w-auto rounded-lg object-contain"
                unoptimized
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function MessageBubble({
  message,
  isStreaming = false,
  skipAnimation = false,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const hasImages = message.images && message.images.length > 0;
  const hasAudio = !!message.audio;

  return (
    <motion.div
      initial={skipAnimation ? false : { opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn("flex", isUser ? "justify-end" : "justify-start")}
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
        {/* Images (render before text for user messages) */}
        {hasImages && (
          <div className="mb-2 flex flex-wrap gap-2">
            {message.images!.map((url, index) => (
              <MessageImage key={url} src={url} alt={`Imagem ${index + 1}`} />
            ))}
          </div>
        )}

        {/* Audio (render before text) */}
        {hasAudio && (
          <div className="mb-2">
            <MessageAudio src={message.audio!} />
          </div>
        )}

        {/* Text content */}
        {message.content && (
          <span className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
            {/* Streaming cursor - appears when receiving tokens */}
            {isStreaming && (
              <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-current align-middle" />
            )}
          </span>
        )}

        {/* Show cursor for media-only messages while streaming */}
        {isStreaming && !message.content && (hasImages || hasAudio) && (
          <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-current align-middle" />
        )}
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
  const { messages, isLoading, streamingContent, streamingMessageId } =
    useAiChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Check if we're actively streaming
  const isStreaming = isLoading && streamingContent !== null;

  // Auto-scroll to bottom when new messages arrive or streaming updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, streamingContent]);

  if (messages.length === 0 && !streamingContent) {
    return <EmptyState />;
  }

  return (
    <ScrollArea className="h-full" ref={scrollRef}>
      <div className="flex flex-col gap-4 p-4">
        <AnimatePresence mode="popLayout">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              // Skip animation for messages that just finished streaming
              // (their ID starts with "streaming_")
              skipAnimation={message.id.startsWith("streaming_")}
            />
          ))}
          {/* Show streaming message with the SAME ID that will be used for final message */}
          {isStreaming && streamingMessageId && (
            <MessageBubble
              key={streamingMessageId}
              message={{
                id: streamingMessageId,
                role: "assistant",
                content: streamingContent,
                timestamp: new Date(),
              }}
              isStreaming
              skipAnimation
            />
          )}
          {/* Show typing indicator only when loading but not yet streaming */}
          {isLoading && !streamingContent && <TypingIndicator key="typing" />}
        </AnimatePresence>
      </div>
    </ScrollArea>
  );
}
