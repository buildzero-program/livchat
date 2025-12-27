"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Rnd, type RndDragCallback, type RndResizeCallback } from "react-rnd";
import { X, GripVertical, Minimize2, Maximize2, Settings2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

// ============================================
// CONSTANTS
// ============================================

const WIDGET_MIN_WIDTH = 320;
const WIDGET_MIN_HEIGHT = 300;
const WIDGET_GAP = 16;
const DOCKED_WIDTH = 380;
const POSITION_GRID = 80;
const CURSOR_DOCK_THRESHOLD = 24;

// ============================================
// TYPES
// ============================================

type DockPosition = "left" | "right" | "floating";

interface NodeInfo {
  id: string;
  type: string;
  label: string;
}

interface WorkflowNodeWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  node: NodeInfo | null;
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

function quantize(value: number, grid: number): number {
  return Math.round(value / grid) * grid;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ============================================
// COMPONENT
// ============================================

export function WorkflowNodeWidget({
  isOpen,
  onClose,
  containerRef,
  node,
}: WorkflowNodeWidgetProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState<WidgetPosition | null>(null);
  const [dockPosition, setDockPosition] = useState<DockPosition>("left");
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

  // Calculate bounds
  const bounds = useMemo(() => ({
    minX: WIDGET_GAP,
    maxX: containerSize.width - WIDGET_GAP,
    minY: WIDGET_GAP,
    maxY: containerSize.height - WIDGET_GAP,
  }), [containerSize]);

  // Initialize position when opened - DOCKED TO LEFT by default
  useEffect(() => {
    if (isOpen && !position && containerSize.width > 0) {
      setPosition({
        x: WIDGET_GAP,
        y: WIDGET_GAP,
        width: DOCKED_WIDTH,
        height: containerSize.height - WIDGET_GAP * 2,
      });
      setDockPosition("left");
    }
  }, [isOpen, position, containerSize]);

  // Reset position when node changes (new node selected)
  useEffect(() => {
    if (isOpen && node) {
      // Keep current position, just update content
    }
  }, [isOpen, node]);

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

  // Calculate quantized floating position
  const getQuantizedPosition = useCallback(
    (rawX: number, rawY: number, width: number, height: number): WidgetPosition => {
      const quantizedX = quantize(rawX, POSITION_GRID);
      const quantizedY = quantize(rawY, POSITION_GRID);
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

  // Detect dock zone based on cursor position
  const detectDockZone = useCallback(
    (cursorX: number): "left" | "right" | null => {
      if (cursorX < CURSOR_DOCK_THRESHOLD) {
        return "left";
      }
      if (containerSize.width - cursorX < CURSOR_DOCK_THRESHOLD) {
        return "right";
      }
      return null;
    },
    [containerSize.width]
  );

  // Calculate preview position
  const calculatePreview = useCallback(
    (
      widgetX: number,
      widgetY: number,
      cursorX: number,
      width: number,
      height: number
    ): { position: WidgetPosition; dock: DockPosition } => {
      const dockZone = detectDockZone(cursorX);

      if (dockZone) {
        return {
          position: getDockedPosition(dockZone, width),
          dock: dockZone,
        };
      }

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
        setPosition(getDockedPosition(dockPosition, newWidth));
      } else {
        const quantized = getQuantizedPosition(pos.x, pos.y, newWidth, newHeight);
        setPosition(quantized);
      }
    },
    [dockPosition, getDockedPosition, getQuantizedPosition]
  );

  const handleMinimize = useCallback(() => {
    setIsMinimized((prev) => !prev);
  }, []);

  // Don't render if not open or no position or no node
  if (!isOpen || !position || !node || containerSize.width === 0) return null;

  const minimizedHeight = 48;
  const isDocked = dockPosition !== "floating";

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

  const actualPosition = isDocked
    ? getDockedPosition(dockPosition, position.width)
    : position;

  const actualHeight = isMinimized
    ? minimizedHeight
    : isDocked
      ? containerSize.height - WIDGET_GAP * 2
      : position.height;

  const showPreview = isDragging && previewPosition;
  const previewIsDocked = showPreview && (
    previewPosition.x === WIDGET_GAP ||
    previewPosition.x === containerSize.width - previewPosition.width - WIDGET_GAP
  );

  return (
    <TooltipProvider delayDuration={300}>
      {/* Preview Shadow */}
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
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragStop={handleDragStop}
        onResizeStart={handleResizeStart}
        onResizeStop={handleResizeStop}
        enableResizing={getResizeDirections()}
        resizeGrid={[POSITION_GRID, POSITION_GRID]}
        className={cn(
          "!absolute z-50",
          !isDragging && !isResizing && "transition-all duration-200"
        )}
      >
        <div
          className={cn(
            "flex h-full flex-col overflow-hidden rounded-xl",
            "bg-background/95 backdrop-blur-md",
            "border border-border/50",
            "shadow-xl shadow-black/10",
            isDragging && "ring-2 ring-primary/30 shadow-2xl shadow-primary/10"
          )}
        >
          {/* Header */}
          <header
            className={cn(
              "widget-drag-handle",
              "flex h-12 shrink-0 items-center justify-between",
              "border-b border-border/40 px-3",
              "cursor-grab select-none",
              isDragging && "cursor-grabbing"
            )}
          >
            {/* Left side */}
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground/50" />
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                <Settings2 className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-sm font-semibold leading-tight">
                  {node.label}
                </h2>
                <span className="text-[10px] text-muted-foreground capitalize">
                  {node.type}
                </span>
              </div>
              {isDocked && (
                <span className="text-[10px] text-muted-foreground/50">
                  {dockPosition === "left" ? "◀" : "▶"}
                </span>
              )}
            </div>

            {/* Right side - Actions */}
            <div className="flex items-center gap-0.5">
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

          {/* Content - Placeholder */}
          {!isMinimized && (
            <div className="flex-1 overflow-auto p-4">
              <div className="space-y-4">
                {/* Placeholder content */}
                <div className="rounded-lg border border-dashed border-border/60 p-4">
                  <p className="text-sm text-muted-foreground text-center">
                    Configurações do nó
                  </p>
                  <p className="text-xs text-muted-foreground/60 text-center mt-1">
                    ID: {node.id}
                  </p>
                </div>

                {/* More placeholder sections */}
                <div className="space-y-2">
                  <div className="h-8 rounded-md bg-muted/50 animate-pulse" />
                  <div className="h-8 rounded-md bg-muted/50 animate-pulse" />
                  <div className="h-20 rounded-md bg-muted/50 animate-pulse" />
                </div>
              </div>
            </div>
          )}
        </div>
      </Rnd>
    </TooltipProvider>
  );
}
