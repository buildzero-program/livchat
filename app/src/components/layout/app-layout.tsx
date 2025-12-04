"use client";

import { useState, useCallback } from "react";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { PagePanel } from "./page-panel";
import {
  AiChatProvider,
  AiChatSheet,
  AiChatPanel,
  useAiChat,
} from "~/components/ai-chat";
import { useIsMobile } from "~/hooks/use-mobile";
import { useSidebarResize } from "~/hooks/use-sidebar-resize";
import { cn } from "~/lib/utils";

interface AppLayoutProps {
  children: React.ReactNode;
}

/**
 * AI Chat Panel default width
 */
const AI_CHAT_DEFAULT_WIDTH = "380px";
const AI_CHAT_MIN_WIDTH = "280px";
const AI_CHAT_MAX_WIDTH = "600px";

/**
 * Inner layout component that has access to AiChat context
 */
function AppLayoutInner({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();
  const { isOpen, toggle } = useAiChat();
  const [aiChatWidth, setAiChatWidth] = useState(AI_CHAT_DEFAULT_WIDTH);
  const [isDraggingRail, setIsDraggingRail] = useState(false);

  // Resize handler for AI Chat panel
  const { dragRef, handleMouseDown } = useSidebarResize({
    direction: "left", // Handle on left side of AI panel
    currentWidth: aiChatWidth,
    onResize: setAiChatWidth,
    onToggle: toggle,
    isCollapsed: !isOpen,
    minResizeWidth: AI_CHAT_MIN_WIDTH,
    maxResizeWidth: AI_CHAT_MAX_WIDTH,
    enableAutoCollapse: true,
    autoCollapseThreshold: 0.8,
    expandThreshold: 0.3,
    enableDrag: true,
    setIsDraggingRail,
    isNested: true, // Not at window edge
    enableToggle: true,
  });

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AppSidebar />
      <SidebarInset className="flex flex-col overflow-hidden bg-sidebar !rounded-none !shadow-none">
        {isMobile ? (
          // Mobile: Layout simples
          <PagePanel>{children}</PagePanel>
        ) : (
          // Desktop: Flex layout com AI Chat Panel animado
          <div
            className="flex h-full"
            data-dragging={isDraggingRail ? "true" : undefined}
          >
            {/* PAGE Panel - flex-1 ocupa espaço restante */}
            <div className="flex-1 min-w-0">
              <PagePanel>{children}</PagePanel>
            </div>

            {/* Resize Handle - estilo ClickUp (só aparece quando AI Chat está aberto) */}
            {isOpen && (
              <button
                ref={dragRef}
                onMouseDown={handleMouseDown}
                className={cn(
                  // Base styles
                  "group relative flex w-3 shrink-0 items-center justify-center",
                  "cursor-col-resize select-none",
                  "focus-visible:outline-none",
                  // Disable transitions during drag
                  isDraggingRail ? "" : "transition-opacity duration-200"
                )}
                aria-label="Resize AI Chat panel"
              >
                {/* Hover glow background */}
                <div
                  className={cn(
                    "absolute inset-y-2 inset-x-0 rounded-full",
                    "transition-all duration-200 ease-out",
                    "opacity-0 bg-transparent",
                    "group-hover:opacity-100 group-hover:bg-primary/15",
                    isDraggingRail && "opacity-100 bg-primary/25"
                  )}
                />

                {/* Centered thin line */}
                <div
                  className={cn(
                    "absolute left-1/2 top-4 bottom-4 w-[2px] -translate-x-1/2 rounded-full",
                    "transition-all duration-200 ease-out",
                    "opacity-0 bg-transparent scale-y-0",
                    "group-hover:opacity-100 group-hover:bg-primary/70 group-hover:scale-y-100",
                    isDraggingRail && "opacity-100 bg-primary scale-y-100"
                  )}
                />
              </button>
            )}

            {/* AI CHAT Panel - width animada igual à sidebar */}
            <div
              className={cn(
                // Overflow hidden para esconder conteúdo quando fechado
                "overflow-hidden shrink-0",
                // Transition igual à sidebar: duration-200 ease-linear
                // Disable during drag for instant feedback
                isDraggingRail
                  ? ""
                  : "duration-200 transition-[width,opacity] ease-linear",
                // Opacity
                isOpen ? "opacity-100" : "opacity-0"
              )}
              style={{
                width: isOpen ? aiChatWidth : 0,
              }}
            >
              <div className="h-full" style={{ width: aiChatWidth }}>
                <AiChatPanel />
              </div>
            </div>
          </div>
        )}
      </SidebarInset>

      {/* AI Chat Sheet - Apenas mobile */}
      {isMobile && <AiChatSheet />}
    </SidebarProvider>
  );
}

/**
 * Client-side App Layout with Inset Sidebar
 *
 * Layout style: sidebar-08 (shadcn)
 * - Content appears "on top" of sidebar with rounded corners and shadow
 * - SidebarProvider (context for sidebar state)
 * - AppSidebar (left navigation with variant="inset")
 * - SidebarInset (main content area)
 *
 * AI Chat behavior:
 * - Desktop: Flex layout com CSS transition + resize handle
 * - Mobile: Sheet overlay para AI Chat
 *
 * Animação:
 * - duration-200 (200ms)
 * - ease-linear
 * - transition-[width,opacity]
 * - Disabled during drag for instant feedback
 */
export function AppLayout({ children }: AppLayoutProps) {
  return (
    <AiChatProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </AiChatProvider>
  );
}
