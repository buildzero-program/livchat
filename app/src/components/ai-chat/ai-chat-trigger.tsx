"use client";

import { PanelRightOpen, PanelRightClose } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useAiChat } from "./ai-chat-provider";
import { cn } from "~/lib/utils";

interface AiChatTriggerProps {
  className?: string;
}

/**
 * AI Chat Trigger Button
 *
 * - Ícone PanelRight que muda entre Open/Close
 * - Gradiente AI (roxo/rosa/azul)
 * - Animação suave ao abrir/fechar
 */
export function AiChatTrigger({ className }: AiChatTriggerProps) {
  const { toggle, isOpen } = useAiChat();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          className={cn(
            "relative h-7 w-7 overflow-hidden transition-all duration-200",
            isOpen && "bg-primary/10",
            className
          )}
        >
          {/* Icon container with animation */}
          <div className="relative flex items-center justify-center">
            <AnimatePresence mode="wait" initial={false}>
              {isOpen ? (
                <motion.div
                  key="close"
                  initial={{ opacity: 0, x: 4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -4 }}
                  transition={{ duration: 0.15 }}
                >
                  <PanelRightClose
                    className="h-4 w-4"
                    style={{ stroke: "url(#ai-gradient-trigger)" }}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="open"
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 4 }}
                  transition={{ duration: 0.15 }}
                >
                  <PanelRightOpen
                    className="h-4 w-4"
                    style={{ stroke: "url(#ai-gradient-trigger)" }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* SVG gradient definition */}
            <svg width="0" height="0" className="absolute">
              <defs>
                <linearGradient
                  id="ai-gradient-trigger"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#a855f7" />
                  <stop offset="50%" stopColor="#ec4899" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end">
        {isOpen ? "Fechar" : "Abrir"} AI Chat{" "}
        <kbd className="ml-2 text-xs">⌘K</kbd>
      </TooltipContent>
    </Tooltip>
  );
}
