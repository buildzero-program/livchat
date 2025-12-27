"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Zap, MessageSquare, Clock, Webhook } from "lucide-react";
import { cn } from "~/lib/utils";
import type { TriggerNodeData, TriggerNode as TriggerNodeType } from "../types";

// ============================================
// TRIGGER TYPE ICONS
// ============================================

const TRIGGER_ICONS = {
  message: MessageSquare,
  schedule: Clock,
  webhook: Webhook,
} as const;

const TRIGGER_COLORS = {
  message: "text-green-500",
  schedule: "text-blue-500",
  webhook: "text-orange-500",
} as const;

// ============================================
// COMPONENT
// ============================================

function TriggerNodeComponent({ data, selected }: NodeProps<TriggerNodeType>) {
  const nodeData = data as TriggerNodeData;
  const Icon = TRIGGER_ICONS[nodeData.triggerType] ?? Zap;
  const iconColor = TRIGGER_COLORS[nodeData.triggerType] ?? "text-primary";

  return (
    <div
      className={cn(
        "relative rounded-lg border-2 bg-card shadow-md",
        // Only transition visual properties, not transforms (which React Flow controls)
        "[transition:border-color_150ms_ease,box-shadow_150ms_ease]",
        "min-w-[180px] px-4 py-3",
        selected
          ? "border-primary ring-2 ring-primary/20"
          : "border-border hover:border-primary/50"
      )}
    >
      {/* Header with icon and label */}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            "bg-muted"
          )}
        >
          <Icon className={cn("h-5 w-5", iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{nodeData.label}</p>
          <p className="text-xs text-muted-foreground capitalize">
            {nodeData.triggerType}
          </p>
        </div>
      </div>

      {/* Output handle (right side only - triggers don't have inputs) */}
      <Handle
        type="source"
        position={Position.Right}
        className={cn(
          "!h-3 !w-3 !border-2 !border-background !bg-primary",
          "hover:!bg-primary/80 transition-colors"
        )}
      />
    </div>
  );
}

export const TriggerNode = memo(TriggerNodeComponent);
