"use client";

import {
  createContext,
  useContext,
  useCallback,
  useState,
  useMemo,
  type ReactNode,
} from "react";

// ============================================
// CONSTANTS
// ============================================

export const WIDGET_GAP = 16;
export const WIDGET_MIN_WIDTH = 320;
export const WIDGET_MIN_HEIGHT = 300;
export const DOCKED_WIDTH = 380;
export const POSITION_GRID = 80;
export const CURSOR_DOCK_THRESHOLD = 24;

// ============================================
// TYPES
// ============================================

export type WidgetId = "chat" | "nodeInspector";
export type DockPosition = "left" | "right" | "floating";

export interface WidgetPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WidgetState {
  id: WidgetId;
  isOpen: boolean;
  isMinimized: boolean;
  dockPosition: DockPosition;
  position: WidgetPosition | null;
  zIndex: number;
}

interface NodeInfo {
  id: string;
  type: string;
  label: string;
}

interface WidgetManagerContextType {
  // Container size
  containerSize: { width: number; height: number };
  setContainerSize: (size: { width: number; height: number }) => void;

  // Widget states
  widgets: Record<WidgetId, WidgetState>;

  // Actions
  openWidget: (id: WidgetId, options?: { dockPosition?: DockPosition }) => void;
  closeWidget: (id: WidgetId) => void;
  toggleWidget: (id: WidgetId) => void;
  minimizeWidget: (id: WidgetId) => void;
  updateWidgetPosition: (id: WidgetId, position: WidgetPosition, dockPosition: DockPosition) => void;
  bringToFront: (id: WidgetId) => void;

  // Node inspector specific
  selectedNode: NodeInfo | null;
  setSelectedNode: (node: NodeInfo | null) => void;

  // Layout helpers
  getAvailableSpace: (forWidget: WidgetId, dockSide: "left" | "right") => number;
  getDockedWidgetOnSide: (side: "left" | "right", excludeWidget?: WidgetId) => WidgetId | null;
  pushWidgetAway: (pusher: WidgetId, pushee: WidgetId, newPusherWidth: number) => void;
}

// ============================================
// INITIAL STATE
// ============================================

const createInitialWidgetState = (id: WidgetId, defaultDock: DockPosition): WidgetState => ({
  id,
  isOpen: false,
  isMinimized: false,
  dockPosition: defaultDock,
  position: null,
  zIndex: 50,
});

const initialWidgets: Record<WidgetId, WidgetState> = {
  chat: createInitialWidgetState("chat", "right"),
  nodeInspector: createInitialWidgetState("nodeInspector", "left"),
};

// ============================================
// CONTEXT
// ============================================

const WidgetManagerContext = createContext<WidgetManagerContextType | null>(null);

// ============================================
// PROVIDER
// ============================================

export function WidgetManagerProvider({ children }: { children: ReactNode }) {
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [widgets, setWidgets] = useState<Record<WidgetId, WidgetState>>(initialWidgets);
  const [selectedNode, setSelectedNode] = useState<NodeInfo | null>(null);
  const [topZIndex, setTopZIndex] = useState(51);

  // Calculate position for a docked widget
  const getDockedPosition = useCallback(
    (dock: "left" | "right", width: number): WidgetPosition => {
      const height = containerSize.height - WIDGET_GAP * 2;
      if (dock === "left") {
        return { x: WIDGET_GAP, y: WIDGET_GAP, width, height };
      }
      return {
        x: containerSize.width - width - WIDGET_GAP,
        y: WIDGET_GAP,
        width,
        height,
      };
    },
    [containerSize]
  );

  // Get the widget docked on a specific side
  const getDockedWidgetOnSide = useCallback(
    (side: "left" | "right", excludeWidget?: WidgetId): WidgetId | null => {
      for (const [id, widget] of Object.entries(widgets)) {
        if (
          widget.isOpen &&
          widget.dockPosition === side &&
          id !== excludeWidget
        ) {
          return id as WidgetId;
        }
      }
      return null;
    },
    [widgets]
  );

  // Calculate available space for a widget on a side
  const getAvailableSpace = useCallback(
    (forWidget: WidgetId, dockSide: "left" | "right"): number => {
      const otherWidget = getDockedWidgetOnSide(
        dockSide === "left" ? "right" : "left",
        forWidget
      );

      if (!otherWidget) {
        // Full width available (minus gaps)
        return containerSize.width - WIDGET_GAP * 2;
      }

      const otherState = widgets[otherWidget];
      if (otherState.position) {
        // Available = total - other widget width - gaps - divider space
        return containerSize.width - otherState.position.width - WIDGET_GAP * 3;
      }

      return containerSize.width - DOCKED_WIDTH - WIDGET_GAP * 3;
    },
    [containerSize.width, widgets, getDockedWidgetOnSide]
  );

  // Push another widget to make space
  const pushWidgetAway = useCallback(
    (pusher: WidgetId, pushee: WidgetId, newPusherWidth: number) => {
      setWidgets((prev) => {
        const pusherWidget = prev[pusher];
        const pusheeWidget = prev[pushee];

        if (!pusheeWidget.isOpen || !pusheeWidget.position) return prev;

        // Calculate new position for the pushed widget
        let newPusheeX: number;
        let newPusheeWidth = pusheeWidget.position.width;

        if (pusherWidget.dockPosition === "left") {
          // Pusher is on left, push pushee to the right
          const pusherRight = WIDGET_GAP + newPusherWidth + WIDGET_GAP;
          newPusheeX = pusherRight;

          // If pushee is docked right, it should resize
          if (pusheeWidget.dockPosition === "right") {
            newPusheeWidth = containerSize.width - pusherRight - WIDGET_GAP;
          }
        } else {
          // Pusher is on right, push pushee to the left
          const pusherLeft = containerSize.width - newPusherWidth - WIDGET_GAP;
          newPusheeX = WIDGET_GAP;

          // If pushee is docked left, it should resize
          if (pusheeWidget.dockPosition === "left") {
            newPusheeWidth = pusherLeft - WIDGET_GAP * 2;
          }
        }

        // Clamp to minimum width
        newPusheeWidth = Math.max(newPusheeWidth, WIDGET_MIN_WIDTH);

        return {
          ...prev,
          [pushee]: {
            ...pusheeWidget,
            position: {
              ...pusheeWidget.position,
              x: newPusheeX,
              width: newPusheeWidth,
            },
          },
        };
      });
    },
    [containerSize.width]
  );

  // Open a widget
  const openWidget = useCallback(
    (id: WidgetId, options?: { dockPosition?: DockPosition }) => {
      const dockPosition = options?.dockPosition ?? widgets[id].dockPosition;

      setWidgets((prev) => {
        const widget = prev[id];

        // Check if there's another widget on the same side
        const conflictingWidget = getDockedWidgetOnSide(
          dockPosition as "left" | "right",
          id
        );

        let position: WidgetPosition;
        let updatedWidgets = { ...prev };

        if (dockPosition === "left" || dockPosition === "right") {
          // Calculate initial docked position
          let width = DOCKED_WIDTH;

          if (conflictingWidget) {
            // Another widget is on the same side, split the space
            const otherWidget = prev[conflictingWidget];
            if (otherWidget.position) {
              // Move the conflicting widget to the opposite side
              const oppositeSide = dockPosition === "left" ? "right" : "left";
              updatedWidgets = {
                ...updatedWidgets,
                [conflictingWidget]: {
                  ...otherWidget,
                  dockPosition: oppositeSide,
                  position: getDockedPosition(oppositeSide, otherWidget.position.width),
                },
              };
            }
          }

          position = getDockedPosition(dockPosition, width);
        } else {
          // Floating - use quantized center position
          const width = DOCKED_WIDTH;
          const height = Math.min(500, containerSize.height - WIDGET_GAP * 2);
          position = {
            x: Math.round((containerSize.width - width) / 2 / POSITION_GRID) * POSITION_GRID,
            y: Math.round((containerSize.height - height) / 2 / POSITION_GRID) * POSITION_GRID,
            width,
            height,
          };
        }

        const newZIndex = topZIndex;
        setTopZIndex((z) => z + 1);

        return {
          ...updatedWidgets,
          [id]: {
            ...widget,
            isOpen: true,
            isMinimized: false,
            dockPosition,
            position,
            zIndex: newZIndex,
          },
        };
      });
    },
    [widgets, getDockedWidgetOnSide, getDockedPosition, containerSize, topZIndex]
  );

  // Close a widget
  const closeWidget = useCallback((id: WidgetId) => {
    setWidgets((prev) => ({
      ...prev,
      [id]: { ...prev[id], isOpen: false },
    }));

    // Clear selected node if closing node inspector
    if (id === "nodeInspector") {
      setSelectedNode(null);
    }
  }, []);

  // Toggle a widget
  const toggleWidget = useCallback(
    (id: WidgetId) => {
      const widget = widgets[id];
      if (widget.isOpen) {
        closeWidget(id);
      } else {
        openWidget(id);
      }
    },
    [widgets, openWidget, closeWidget]
  );

  // Minimize a widget
  const minimizeWidget = useCallback((id: WidgetId) => {
    setWidgets((prev) => ({
      ...prev,
      [id]: { ...prev[id], isMinimized: !prev[id].isMinimized },
    }));
  }, []);

  // Update widget position
  const updateWidgetPosition = useCallback(
    (id: WidgetId, position: WidgetPosition, dockPosition: DockPosition) => {
      setWidgets((prev) => ({
        ...prev,
        [id]: { ...prev[id], position, dockPosition },
      }));
    },
    []
  );

  // Bring widget to front
  const bringToFront = useCallback((id: WidgetId) => {
    setWidgets((prev) => {
      const widget = prev[id];
      if (widget.zIndex === topZIndex - 1) return prev;

      const newZIndex = topZIndex;
      setTopZIndex((z) => z + 1);

      return {
        ...prev,
        [id]: { ...widget, zIndex: newZIndex },
      };
    });
  }, [topZIndex]);

  const value = useMemo(
    () => ({
      containerSize,
      setContainerSize,
      widgets,
      openWidget,
      closeWidget,
      toggleWidget,
      minimizeWidget,
      updateWidgetPosition,
      bringToFront,
      selectedNode,
      setSelectedNode,
      getAvailableSpace,
      getDockedWidgetOnSide,
      pushWidgetAway,
    }),
    [
      containerSize,
      widgets,
      openWidget,
      closeWidget,
      toggleWidget,
      minimizeWidget,
      updateWidgetPosition,
      bringToFront,
      selectedNode,
      getAvailableSpace,
      getDockedWidgetOnSide,
      pushWidgetAway,
    ]
  );

  return (
    <WidgetManagerContext.Provider value={value}>
      {children}
    </WidgetManagerContext.Provider>
  );
}

// ============================================
// HOOK
// ============================================

export function useWidgetManager() {
  const context = useContext(WidgetManagerContext);
  if (!context) {
    throw new Error("useWidgetManager must be used within WidgetManagerProvider");
  }
  return context;
}
