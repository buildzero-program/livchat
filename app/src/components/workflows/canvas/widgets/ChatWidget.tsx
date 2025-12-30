"use client";

import Image from "next/image";
import { Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useAiChat, AiChatMessages, AiChatInput } from "~/components/ai-chat";
import { BaseWidget } from "./BaseWidget";
import { useWidgetManager } from "./WidgetManagerContext";

// ============================================
// TYPES
// ============================================

interface ChatWidgetProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

// ============================================
// COMPONENT
// ============================================

export function ChatWidget({ containerRef }: ChatWidgetProps) {
  const { clearMessages, messages } = useAiChat();
  const { widgets } = useWidgetManager();

  // Don't render if widget not open
  if (!widgets.chat.isOpen) return null;

  return (
    <BaseWidget
      id="chat"
      title="Ivy AI"
      titleGradient="linear-gradient(135deg, #a855f7 0%, #ec4899 50%, #3b82f6 100%)"
      icon={
        <Image
          src="/ivy-ai.jpg"
          alt="Ivy AI"
          width={24}
          height={24}
          className="h-6 w-6 rounded-md object-cover"
        />
      }
      headerActions={
        messages.length > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={clearMessages}
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Limpar</TooltipContent>
          </Tooltip>
        ) : undefined
      }
      containerRef={containerRef}
    >
      {/* Messages area */}
      <div className="flex-1 overflow-hidden">
        <AiChatMessages />
      </div>

      {/* Input */}
      <AiChatInput />
    </BaseWidget>
  );
}
