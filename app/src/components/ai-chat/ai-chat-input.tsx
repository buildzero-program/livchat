"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { useAiChat } from "./ai-chat-provider";
import { cn } from "~/lib/utils";

interface AiChatInputProps {
  autoFocus?: boolean;
}

export function AiChatInput({ autoFocus = true }: AiChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage, isLoading, isOpen } = useAiChat();

  // Auto-focus when chat opens
  useEffect(() => {
    if (autoFocus && isOpen && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen, autoFocus]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [value]);

  const handleSubmit = async () => {
    if (!value.trim() || isLoading) return;

    const message = value;
    setValue("");
    await sendMessage(message);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter to send (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canSend = value.trim().length > 0 && !isLoading;

  return (
    <div className="border-t border-border bg-background p-3">
      <div className="relative flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pergunte algo..."
          disabled={isLoading}
          rows={1}
          className={cn(
            "min-h-[40px] max-h-[120px] resize-none pr-12",
            "rounded-2xl border-muted-foreground/20",
            "focus-visible:ring-1 focus-visible:ring-primary/50",
            "placeholder:text-muted-foreground/60"
          )}
        />

        {/* Send button */}
        <motion.div
          className="absolute right-2 bottom-1.5"
          initial={false}
          animate={{
            scale: canSend ? 1 : 0.9,
            opacity: canSend ? 1 : 0.5,
          }}
        >
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={!canSend}
            className={cn(
              "h-8 w-8 rounded-full transition-all",
              canSend
                ? "bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 hover:opacity-90"
                : "bg-muted"
            )}
          >
            <Send className="h-4 w-4 text-white" />
          </Button>
        </motion.div>
      </div>

      <p className="mt-2 text-center text-[10px] text-muted-foreground">
        <kbd className="rounded bg-muted px-1">Enter</kbd> para enviar,{" "}
        <kbd className="rounded bg-muted px-1">Shift+Enter</kbd> nova linha
      </p>
    </div>
  );
}
