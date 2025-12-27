"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Rnd, type RndDragCallback, type RndResizeCallback } from "react-rnd";
import Image from "next/image";
import { X, Trash2, GripVertical, Minimize2, Maximize2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "~/components/ui/tooltip";
import { useAiChat, AiChatMessages, AiChatInput } from "~/components/ai-chat";
import { cn } from "~/lib/utils";

// ============================================
// CONSTANTS
// ============================================

const WIDGET_MIN_WIDTH = 320;
const WIDGET_MIN_HEIGHT = 300;
const WIDGET_GAP = 16; // Gap from all edges (always maintained)
const DOCKED_WIDTH = 400; // Default width when docked

// Quantized grid for floating positions (like ClickUp)
// Larger grid = fewer positions = more "snappy" feel
const POSITION_GRID = 80;

// Dock snap: only when CURSOR is very close to edge (like Windows)
// This allows placing widget near edge without forcing dock
const CURSOR_DOCK_THRESHOLD = 24;

// ============================================
// TYPES
// ============================================

type DockPosition = "left" | "right" | "floating";

interface WorkflowChatWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

interface WidgetPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ============================================
// HELPERS
// ============================================

/**
 * Quantize a value to the nearest grid point
 */
function quantize(value: number, grid: number): number {
  return Math.round(value / grid) * grid;
}

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ============================================
// COMPONENT
// ============================================

export function WorkflowChatWidget({
  isOpen,
  onClose,
  containerRef,
}: WorkflowChatWidgetProps) {
  const { clearMessages, messages } = useAiChat();
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState<WidgetPosition | null>(null);
  const [dockPosition, setDockPosition] = useState<DockPosition>("right");
  const [previewPosition, setPreviewPosition] = useState<WidgetPosition | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const rndRef = useRef<Rnd>(null);

  // Track container size
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [containerRef]);

  // Calculate bounds (available area minus gaps)
  const bounds = useMemo(() => ({
    minX: WIDGET_GAP,
    maxX: containerSize.width - WIDGET_GAP,
    minY: WIDGET_GAP,
    maxY: containerSize.height - WIDGET_GAP,
  }), [containerSize]);

  // Initialize position when opened
  useEffect(() => {
    if (isOpen && !position && containerSize.width > 0) {
      // Start docked to the right
      setPosition({
        x: containerSize.width - DOCKED_WIDTH - WIDGET_GAP,
        y: WIDGET_GAP,
        width: DOCKED_WIDTH,
        height: containerSize.height - WIDGET_GAP * 2,
      });
      setDockPosition("right");
    }
  }, [isOpen, position, containerSize]);

  // Calculate docked position
  const getDockedPosition = useCallback(
    (dock: "left" | "right", currentWidth: number): WidgetPosition => {
      const height = containerSize.height - WIDGET_GAP * 2;
      if (dock === "left") {
        return {
          x: WIDGET_GAP,
          y: WIDGET_GAP,
          width: currentWidth,
          height,
        };
      }
      return {
        x: containerSize.width - currentWidth - WIDGET_GAP,
        y: WIDGET_GAP,
        width: currentWidth,
        height,
      };
    },
    [containerSize]
  );

  // Calculate quantized floating position (always respects bounds)
  const getQuantizedPosition = useCallback(
    (rawX: number, rawY: number, width: number, height: number): WidgetPosition => {
      // Quantize to grid
      const quantizedX = quantize(rawX, POSITION_GRID);
      const quantizedY = quantize(rawY, POSITION_GRID);

      // Clamp to bounds (ensure gap is always maintained)
      const clampedX = clamp(quantizedX, bounds.minX, bounds.maxX - width);
      const clampedY = clamp(quantizedY, bounds.minY, bounds.maxY - height);

      return {
        x: clampedX,
        y: clampedY,
        width,
        height,
      };
    },
    [bounds]
  );

  // Detect if cursor is in dock zone (like Windows snap)
  // Only docks when the CURSOR (not widget edge) is very close to screen edge
  const detectDockZone = useCallback(
    (cursorX: number): "left" | "right" | null => {
      // Cursor very close to left edge
      if (cursorX < CURSOR_DOCK_THRESHOLD) {
        return "left";
      }
      // Cursor very close to right edge
      if (containerSize.width - cursorX < CURSOR_DOCK_THRESHOLD) {
        return "right";
      }
      return null;
    },
    [containerSize.width]
  );

  // Calculate preview position during drag
  // cursorX is the mouse position relative to container
  const calculatePreview = useCallback(
    (
      widgetX: number,
      widgetY: number,
      cursorX: number,
      width: number,
      height: number
    ): { position: WidgetPosition; dock: DockPosition } => {
      // Check dock zone based on CURSOR position (like Windows)
      const dockZone = detectDockZone(cursorX);

      if (dockZone) {
        // Docked preview - full height
        return {
          position: getDockedPosition(dockZone, width),
          dock: dockZone,
        };
      }

      // Floating preview - quantized position based on widget position
      return {
        position: getQuantizedPosition(widgetX, widgetY, width, height),
        dock: "floating",
      };
    },
    [detectDockZone, getDockedPosition, getQuantizedPosition]
  );

  // Handlers
  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  // Get cursor position relative to container from mouse event
  const getCursorPosition = useCallback(
    (e: MouseEvent | TouchEvent): number => {
      const container = containerRef.current;
      if (!container) return 0;

      const rect = container.getBoundingClientRect();
      const clientX = "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
      return clientX - rect.left;
    },
    [containerRef]
  );

  const handleDrag: RndDragCallback = useCallback(
    (e, data) => {
      if (!position) return;

      const cursorX = getCursorPosition(e as MouseEvent);
      const { position: preview } = calculatePreview(
        data.x,
        data.y,
        cursorX,
        position.width,
        position.height
      );
      setPreviewPosition(preview);
    },
    [position, calculatePreview, getCursorPosition]
  );

  const handleDragStop: RndDragCallback = useCallback(
    (e, data) => {
      setIsDragging(false);
      setPreviewPosition(null);

      if (!position) return;

      const cursorX = getCursorPosition(e as MouseEvent);
      const { position: finalPos, dock } = calculatePreview(
        data.x,
        data.y,
        cursorX,
        position.width,
        position.height
      );

      setDockPosition(dock);
      setPosition(finalPos);
    },
    [position, calculatePreview, getCursorPosition]
  );

  const handleResizeStart = useCallback(() => {
    setIsResizing(true);
  }, []);

  const handleResizeStop: RndResizeCallback = useCallback(
    (_e, _dir, ref, _delta, pos) => {
      setIsResizing(false);
      const newWidth = parseInt(ref.style.width, 10);
      const newHeight = parseInt(ref.style.height, 10);

      if (dockPosition !== "floating") {
        // When docked, update width but keep docked position
        setPosition(getDockedPosition(dockPosition, newWidth));
      } else {
        // Quantize the new position
        const quantized = getQuantizedPosition(pos.x, pos.y, newWidth, newHeight);
        setPosition(quantized);
      }
    },
    [dockPosition, getDockedPosition, getQuantizedPosition]
  );

  const handleMinimize = useCallback(() => {
    setIsMinimized((prev) => !prev);
  }, []);

  // Don't render if not open or no position
  if (!isOpen || !position || containerSize.width === 0) return null;

  const minimizedHeight = 48;
  const isDocked = dockPosition !== "floating";

  // Determine resize directions based on dock state
  const getResizeDirections = () => {
    if (isMinimized) return false;

    if (dockPosition === "left") {
      return {
        top: false,
        right: true,
        bottom: false,
        left: false,
        topRight: false,
        bottomRight: false,
        bottomLeft: false,
        topLeft: false,
      };
    }
    if (dockPosition === "right") {
      return {
        top: false,
        right: false,
        bottom: false,
        left: true,
        topRight: false,
        bottomRight: false,
        bottomLeft: false,
        topLeft: false,
      };
    }
    // Floating: all directions
    return {
      top: true,
      right: true,
      bottom: true,
      left: true,
      topRight: true,
      bottomRight: true,
      bottomLeft: true,
      topLeft: true,
    };
  };

  // Calculate actual position (docked widgets update with container)
  const actualPosition = isDocked
    ? getDockedPosition(dockPosition, position.width)
    : position;

  const actualHeight = isMinimized
    ? minimizedHeight
    : isDocked
      ? containerSize.height - WIDGET_GAP * 2
      : position.height;

  // Preview to show during drag
  const showPreview = isDragging && previewPosition;
  const previewIsDocked = showPreview && (
    previewPosition.x === WIDGET_GAP ||
    previewPosition.x === containerSize.width - previewPosition.width - WIDGET_GAP
  );

  return (
    <TooltipProvider delayDuration={300}>
      {/* Preview Shadow - Always shows quantized final position */}
      {showPreview && (
        <div
          className={cn(
            "absolute z-40 rounded-xl pointer-events-none",
            "bg-primary/10 border-2 border-primary/30",
            "transition-all duration-100 ease-out"
          )}
          style={{
            left: previewPosition.x,
            top: previewPosition.y,
            width: previewPosition.width,
            height: previewIsDocked
              ? containerSize.height - WIDGET_GAP * 2
              : previewPosition.height,
          }}
        />
      )}

      <Rnd
        ref={rndRef}
        position={{ x: actualPosition.x, y: actualPosition.y }}
        size={{
          width: actualPosition.width,
          height: actualHeight,
        }}
        minWidth={WIDGET_MIN_WIDTH}
        minHeight={isMinimized ? minimizedHeight : WIDGET_MIN_HEIGHT}
        maxWidth={containerSize.width - WIDGET_GAP * 2}
        maxHeight={containerSize.height - WIDGET_GAP * 2}
        bounds="parent"
        dragHandleClassName="widget-drag-handle"
        // No grid during drag - we handle quantization ourselves
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragStop={handleDragStop}
        onResizeStart={handleResizeStart}
        onResizeStop={handleResizeStop}
        enableResizing={getResizeDirections()}
        resizeGrid={[POSITION_GRID, POSITION_GRID]}
        className={cn(
          "!absolute z-50",
          // Smooth transitions when not dragging/resizing
          !isDragging && !isResizing && "transition-all duration-200"
        )}
      >
        <div
          className={cn(
            "flex h-full flex-col overflow-hidden rounded-xl",
            // Background with blur
            "bg-background/95 backdrop-blur-md",
            // Border
            "border border-border/50",
            // Shadow
            "shadow-xl shadow-black/10",
            // Glow effect during drag
            isDragging && "ring-2 ring-primary/30 shadow-2xl shadow-primary/10"
          )}
        >
          {/* Header - Draggable */}
          <header
            className={cn(
              "widget-drag-handle",
              "flex h-12 shrink-0 items-center justify-between",
              "border-b border-border/40 px-3",
              "cursor-grab select-none",
              isDragging && "cursor-grabbing"
            )}
          >
            {/* Left side - Drag indicator + Title */}
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground/50" />
              <Image
                src="/ivy-ai.jpg"
                alt="Ivy AI"
                width={24}
                height={24}
                className="h-6 w-6 rounded-md object-cover"
              />
              <h2
                className="text-sm font-semibold"
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
              {/* Dock indicator */}
              {isDocked && (
                <span className="text-[10px] text-muted-foreground/50">
                  {dockPosition === "left" ? "◀" : "▶"}
                </span>
              )}
            </div>

            {/* Right side - Actions */}
            <div className="flex items-center gap-0.5">
              {/* Clear messages */}
              {messages.length > 0 && !isMinimized && (
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
              )}

              {/* Minimize */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleMinimize}
                    className="h-7 w-7"
                  >
                    {isMinimized ? (
                      <Maximize2 className="h-3.5 w-3.5" />
                    ) : (
                      <Minimize2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {isMinimized ? "Expandir" : "Minimizar"}
                </TooltipContent>
              </Tooltip>

              {/* Close */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-7 w-7"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Fechar</TooltipContent>
              </Tooltip>
            </div>
          </header>

          {/* Content - Only show when not minimized */}
          {!isMinimized && (
            <>
              {/* Messages area */}
              <div className="flex-1 overflow-hidden">
                <AiChatMessages />
              </div>

              {/* Input */}
              <AiChatInput />
            </>
          )}
        </div>
      </Rnd>
    </TooltipProvider>
  );
}
