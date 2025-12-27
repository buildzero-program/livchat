"use client";

import { memo, useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import { X } from "lucide-react";
import { cn } from "~/lib/utils";
import type { WorkflowEdgeData } from "../types";

// ============================================
// COMPONENT
// ============================================

function WorkflowEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
}: EdgeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const edgeData = data as WorkflowEdgeData | undefined;

  // Calculate bezier path
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      {/* Invisible wider path for easier hover/click */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={20}
        stroke="transparent"
        className="cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      {/* Visible edge - NO transition on path, only on stroke color */}
      <BaseEdge
        id={id}
        path={edgePath}
        className={cn(
          // Only transition stroke color, NOT the path position
          "[transition:stroke_150ms_ease,stroke-width_150ms_ease]",
          selected || isHovered
            ? "!stroke-primary !stroke-[2.5px]"
            : "!stroke-muted-foreground/40 !stroke-2"
        )}
      />

      {/* Delete button on hover */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
          className={cn(
            "transition-all duration-200",
            isHovered || selected ? "opacity-100 scale-100" : "opacity-0 scale-75"
          )}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <button
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full",
              "bg-destructive text-destructive-foreground shadow-md",
              "hover:bg-destructive/90 transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-destructive/50"
            )}
            onClick={(e) => {
              e.stopPropagation();
              // Delete is handled by onEdgesChange in the parent
              // We trigger a custom event that the parent can listen to
              const event = new CustomEvent("workflow:delete-edge", {
                detail: { edgeId: id },
              });
              window.dispatchEvent(event);
            }}
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        {/* Optional label */}
        {edgeData?.label && (
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -100%) translate(${labelX}px, ${labelY - 16}px)`,
              pointerEvents: "none",
            }}
            className="rounded bg-background/90 px-2 py-0.5 text-xs text-muted-foreground shadow-sm border"
          >
            {edgeData.label}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}

export const WorkflowEdge = memo(WorkflowEdgeComponent);
