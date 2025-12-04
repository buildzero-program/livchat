"use client";

import Image from "next/image";
import { X, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useAiChat } from "./ai-chat-provider";
import { AiChatMessages } from "./ai-chat-messages";
import { AiChatInput } from "./ai-chat-input";

/**
 * AI Chat Panel - Versao Desktop
 *
 * Painel lateral embutido no layout para desktop.
 * Nao usa Sheet/overlay, fica ao lado da PagePanel.
 *
 * Features:
 * - Header com gradiente e botoes de acao
 * - Area de mensagens com scroll
 * - Input fixo no bottom
 * - Estilo "elevado" com rounded corners e shadow
 * - Animacao via CSS transition no container pai (igual sidebar)
 */
export function AiChatPanel() {
  const { close, clearMessages, messages } = useAiChat();

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg bg-background shadow-sm">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border/40 px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2">
          <Image
            src="/ivy-ai.jpg"
            alt="Ivy AI"
            width={1920}
            height={1920}
            className="h-7 w-7 rounded-lg object-cover"
          />
          <h2
            className="text-base font-semibold"
            style={{
              background:
                "linear-gradient(135deg, #a855f7 0%, #ec4899 50%, #3b82f6 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Ivy AI
          </h2>
        </div>

        <div className="flex items-center gap-1">
          {/* Clear messages button */}
          {messages.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearMessages}
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Limpar conversa</TooltipContent>
            </Tooltip>
          )}

          {/* Close button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={close}
                className="h-7 w-7"
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Fechar <kbd className="ml-1 text-xs">Esc</kbd>
            </TooltipContent>
          </Tooltip>
        </div>
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-hidden">
        <AiChatMessages />
      </div>

      {/* Input */}
      <AiChatInput />
    </div>
  );
}
