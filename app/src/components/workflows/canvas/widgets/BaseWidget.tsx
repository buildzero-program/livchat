"use client";

import { useState, useCallback, useRef, useEffect, useMemo, type ReactNode } from "react";
import { Rnd, type RndDragCallback, type RndResizeCallback } from "react-rnd";
import { X, GripVertical, Minimize2, Maximize2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import {
  useWidgetManager,
  type WidgetId,
  type DockPosition,
  type WidgetPosition,
  WIDGET_GAP,
  WIDGET_MIN_WIDTH,
  WIDGET_MIN_HEIGHT,
  DOCKED_WIDTH,
  POSITION_GRID,
  CURSOR_DOCK_THRESHOLD,
} from "./WidgetManagerContext";

// ============================================
// TYPES
// ============================================

interface BaseWidgetProps {
  id: WidgetId;
  title: string;
  icon: ReactNode;
  titleGradient?: string;
  headerActions?: ReactNode;
  children: ReactNode;
  containerRef: React.RefObject<HTMLDivElement | null>;
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

export function BaseWidget({
  id,
  title,
  icon,
  titleGradient,
  headerActions,
  children,
  containerRef,
}: BaseWidgetProps) {
  const {
    containerSize,
    setContainerSize,
    widgets,
    closeWidget,
    minimizeWidget,
    updateWidgetPosition,
    bringToFront,
    getDockedWidgetOnSide,
    pushWidgetAway,
  } = useWidgetManager();

  const widget = widgets[id];
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [previewPosition, setPreviewPosition] = useState<WidgetPosition | null>(null);
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
  }, [containerRef, setContainerSize]);

  // Calculate bounds
  const bounds = useMemo(
    () => ({
      minX: WIDGET_GAP,
      maxX: containerSize.width - WIDGET_GAP,
      minY: WIDGET_GAP,
      maxY: containerSize.height - WIDGET_GAP,
    }),
    [containerSize]
  );

  // Calculate docked position
  const getDockedPosition = useCallback(
    (dock: "left" | "right", currentWidth: number): WidgetPosition => {
      const height = containerSize.height - WIDGET_GAP * 2;
      if (dock === "left") {
        return { x: WIDGET_GAP, y: WIDGET_GAP, width: currentWidth, height };
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
      return { x: clampedX, y: clampedY, width, height };
    },
    [bounds]
  );

  // Detect dock zone based on cursor position
  const detectDockZone = useCallback(
    (cursorX: number): "left" | "right" | null => {
      if (cursorX < CURSOR_DOCK_THRESHOLD) return "left";
      if (containerSize.width - cursorX < CURSOR_DOCK_THRESHOLD) return "right";
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
        // Check if another widget is already docked there
        const otherWidget = getDockedWidgetOnSide(dockZone, id);

        if (otherWidget) {
          // Show preview that would push the other widget
          const otherState = widgets[otherWidget];
          if (otherState.position) {
            // This widget takes priority, other will be pushed
            const newWidth = Math.min(width, containerSize.width / 2 - WIDGET_GAP * 2);
            return {
              position: getDockedPosition(dockZone, newWidth),
              dock: dockZone,
            };
          }
        }

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
    [detectDockZone, getDockedPosition, getQuantizedPosition, getDockedWidgetOnSide, widgets, id, containerSize.width]
  );

  // Get cursor position relative to container
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

  // Handlers
  const handleDragStart = useCallback(() => {
    setIsDragging(true);
    bringToFront(id);
  }, [bringToFront, id]);

  const handleDrag: RndDragCallback = useCallback(
    (e, data) => {
      if (!widget.position) return;

      const cursorX = getCursorPosition(e as MouseEvent);
      const { position: preview } = calculatePreview(
        data.x,
        data.y,
        cursorX,
        widget.position.width,
        widget.position.height
      );
      setPreviewPosition(preview);
    },
    [widget.position, calculatePreview, getCursorPosition]
  );

  const handleDragStop: RndDragCallback = useCallback(
    (e, data) => {
      setIsDragging(false);
      setPreviewPosition(null);

      if (!widget.position) return;

      const cursorX = getCursorPosition(e as MouseEvent);
      const { position: finalPos, dock } = calculatePreview(
        data.x,
        data.y,
        cursorX,
        widget.position.width,
        widget.position.height
      );

      // If docking to a side that has another widget, push it
      if (dock === "left" || dock === "right") {
        const otherWidget = getDockedWidgetOnSide(dock, id);
        if (otherWidget) {
          pushWidgetAway(id, otherWidget, finalPos.width);
        }
      }

      updateWidgetPosition(id, finalPos, dock);
    },
    [widget.position, calculatePreview, getCursorPosition, id, updateWidgetPosition, getDockedWidgetOnSide, pushWidgetAway]
  );

  const handleResizeStart = useCallback(() => {
    setIsResizing(true);
    bringToFront(id);
  }, [bringToFront, id]);

  const handleResizeStop: RndResizeCallback = useCallback(
    (_e, _dir, ref, _delta, pos) => {
      setIsResizing(false);
      const newWidth = parseInt(ref.style.width, 10);
      const newHeight = parseInt(ref.style.height, 10);

      if (widget.dockPosition !== "floating") {
        const newPos = getDockedPosition(widget.dockPosition, newWidth);

        // If resizing a docked widget, push the adjacent one
        const oppositeSide = widget.dockPosition === "left" ? "right" : "left";
        const otherWidget = getDockedWidgetOnSide(oppositeSide, id);
        if (otherWidget) {
          pushWidgetAway(id, otherWidget, newWidth);
        }

        updateWidgetPosition(id, newPos, widget.dockPosition);
      } else {
        const quantized = getQuantizedPosition(pos.x, pos.y, newWidth, newHeight);
        updateWidgetPosition(id, quantized, "floating");
      }
    },
    [widget.dockPosition, getDockedPosition, getQuantizedPosition, id, updateWidgetPosition, getDockedWidgetOnSide, pushWidgetAway]
  );

  const handleClose = useCallback(() => {
    closeWidget(id);
  }, [closeWidget, id]);

  const handleMinimize = useCallback(() => {
    minimizeWidget(id);
  }, [minimizeWidget, id]);

  // Don't render if not open or no position
  if (!widget.isOpen || !widget.position || containerSize.width === 0) return null;

  const minimizedHeight = 48;
  const isDocked = widget.dockPosition !== "floating";

  // Determine resize directions based on dock state
  const getResizeDirections = () => {
    if (widget.isMinimized) return false;

    if (widget.dockPosition === "left") {
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
    if (widget.dockPosition === "right") {
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

  // Calculate actual position (docked widgets update with container)
  const actualPosition = isDocked && (widget.dockPosition === "left" || widget.dockPosition === "right")
    ? getDockedPosition(widget.dockPosition, widget.position.width)
    : widget.position;

  const actualHeight = widget.isMinimized
    ? minimizedHeight
    : isDocked
      ? containerSize.height - WIDGET_GAP * 2
      : widget.position.height;

  // Preview to show during drag
  const showPreview = isDragging && previewPosition;
  const previewIsDocked =
    showPreview &&
    (previewPosition.x === WIDGET_GAP ||
      previewPosition.x === containerSize.width - previewPosition.width - WIDGET_GAP);

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
        minHeight={widget.isMinimized ? minimizedHeight : WIDGET_MIN_HEIGHT}
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
        style={{ zIndex: widget.zIndex }}
        className={cn(
          "!absolute",
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
          onClick={() => bringToFront(id)}
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
              {icon}
              <h2
                className="text-sm font-semibold"
                style={
                  titleGradient
                    ? {
                        background: titleGradient,
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                      }
                    : undefined
                }
              >
                {title}
              </h2>
              {isDocked && (
                <span className="text-[10px] text-muted-foreground/50">
                  {widget.dockPosition === "left" ? "◀" : "▶"}
                </span>
              )}
            </div>

            {/* Right side - Actions */}
            <div className="flex items-center gap-0.5">
              {/* Custom header actions */}
              {!widget.isMinimized && headerActions}

              {/* Minimize */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleMinimize}
                    className="h-7 w-7"
                  >
                    {widget.isMinimized ? (
                      <Maximize2 className="h-3.5 w-3.5" />
                    ) : (
                      <Minimize2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {widget.isMinimized ? "Expandir" : "Minimizar"}
                </TooltipContent>
              </Tooltip>

              {/* Close */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleClose}
                    className="h-7 w-7"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Fechar</TooltipContent>
              </Tooltip>
            </div>
          </header>

          {/* Content */}
          {!widget.isMinimized && (
            <div className="flex-1 overflow-hidden flex flex-col">{children}</div>
          )}
        </div>
      </Rnd>
    </TooltipProvider>
  );
}
