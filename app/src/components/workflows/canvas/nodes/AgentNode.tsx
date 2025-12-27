"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Bot, Sparkles } from "lucide-react";
import { cn } from "~/lib/utils";
import type { AgentNodeData, AgentNode as AgentNodeType } from "../types";

// ============================================
// MODEL COLORS (visual distinction)
// ============================================

function getModelColor(model: string): string {
  const modelLower = model.toLowerCase();
  if (modelLower.includes("gemini")) return "text-blue-500";
  if (modelLower.includes("gpt")) return "text-green-500";
  if (modelLower.includes("claude")) return "text-orange-500";
  if (modelLower.includes("llama")) return "text-purple-500";
  return "text-primary";
}

function formatModelName(model: string): string {
  // Shorten long model names for display
  if (model.length > 20) {
    return model.slice(0, 17) + "...";
  }
  return model;
}

// ============================================
// COMPONENT
// ============================================

function AgentNodeComponent({ data, selected }: NodeProps<AgentNodeType>) {
  const nodeData = data as AgentNodeData;
  const modelColor = getModelColor(nodeData.model);

  return (
    <div
      className={cn(
        "relative rounded-lg border-2 bg-card shadow-md",
        // Only transition visual properties, not transforms (which React Flow controls)
        "[transition:border-color_150ms_ease,box-shadow_150ms_ease]",
        "min-w-[200px] px-4 py-3",
        selected
          ? "border-primary ring-2 ring-primary/20"
          : "border-border hover:border-primary/50"
      )}
    >
      {/* Input handle (left side) */}
      <Handle
        type="target"
        position={Position.Left}
        className={cn(
          "!h-3 !w-3 !border-2 !border-background !bg-muted-foreground",
          "hover:!bg-primary transition-colors"
        )}
      />

      {/* Header with icon and label */}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            "bg-primary/10"
          )}
        >
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{nodeData.label}</p>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Sparkles className={cn("h-3 w-3", modelColor)} />
            <span className="truncate">{formatModelName(nodeData.model)}</span>
          </div>
        </div>
      </div>

      {/* Instructions preview (if present) */}
      {nodeData.instructions && (
        <p className="mt-2 text-xs text-muted-foreground/70 line-clamp-2 border-t border-border pt-2">
          {nodeData.instructions}
        </p>
      )}

      {/* Output handle (right side) */}
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

export const AgentNode = memo(AgentNodeComponent);
