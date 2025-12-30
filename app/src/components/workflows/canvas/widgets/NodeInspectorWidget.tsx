"use client";

import { Settings2 } from "lucide-react";
import { BaseWidget } from "./BaseWidget";
import { useWidgetManager } from "./WidgetManagerContext";

// ============================================
// TYPES
// ============================================

interface NodeInspectorWidgetProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

// ============================================
// COMPONENT
// ============================================

export function NodeInspectorWidget({ containerRef }: NodeInspectorWidgetProps) {
  const { selectedNode, widgets } = useWidgetManager();

  // Don't render if no node selected or widget not open
  if (!widgets.nodeInspector.isOpen || !selectedNode) return null;

  return (
    <BaseWidget
      id="nodeInspector"
      title={selectedNode.label}
      icon={
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
          <Settings2 className="h-3.5 w-3.5 text-primary" />
        </div>
      }
      containerRef={containerRef}
    >
      {/* Content - Placeholder for now */}
      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-4">
          {/* Node type indicator */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="capitalize">{selectedNode.type}</span>
            <span>•</span>
            <span className="font-mono">{selectedNode.id}</span>
          </div>

          {/* Placeholder config sections */}
          <div className="rounded-lg border border-dashed border-border/60 p-4">
            <p className="text-sm text-muted-foreground text-center">
              Configurações do nó
            </p>
          </div>

          {/* More placeholder sections */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Nome
            </label>
            <div className="h-9 rounded-md bg-muted/50 animate-pulse" />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Descrição
            </label>
            <div className="h-20 rounded-md bg-muted/50 animate-pulse" />
          </div>

          {selectedNode.type === "agent" && (
            <>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Modelo
                </label>
                <div className="h-9 rounded-md bg-muted/50 animate-pulse" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  System Prompt
                </label>
                <div className="h-32 rounded-md bg-muted/50 animate-pulse" />
              </div>
            </>
          )}

          {selectedNode.type === "trigger" && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Tipo de Trigger
              </label>
              <div className="h-9 rounded-md bg-muted/50 animate-pulse" />
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
