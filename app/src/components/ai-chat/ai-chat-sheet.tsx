"use client";

import Image from "next/image";
import { X, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
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
 * AI Chat Sheet - Versao Mobile
 *
 * Sheet lateral para o chat AI. Usado APENAS em mobile.
 * No desktop, usa AiChatPanel embutido no layout.
 *
 * Features:
 * - Header com titulo gradiente e botoes de acao
 * - Area de mensagens com scroll
 * - Input fixo no bottom
 * - Overlay escuro e slide-in animation
 */
export function AiChatSheet() {
  const { isOpen, close, clearMessages, messages } = useAiChat();

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-[400px]"
      >
        {/* Header */}
        <SheetHeader className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Image
              src="/ivy-ai.jpg"
              alt="Ivy AI"
              width={1920}
              height={1920}
              className="h-8 w-8 rounded-lg object-cover"
            />
            <SheetTitle
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
            </SheetTitle>
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
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Limpar conversa</TooltipContent>
              </Tooltip>
            )}

            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={close}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        {/* Messages area */}
        <div className="flex-1 overflow-hidden">
          <AiChatMessages />
        </div>

        {/* Input */}
        <AiChatInput />
      </SheetContent>
    </Sheet>
  );
}
