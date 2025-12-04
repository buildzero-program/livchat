"use client"

import * as React from "react"
import { GripVerticalIcon } from "lucide-react"
import * as ResizablePrimitive from "react-resizable-panels"

import { cn } from "~/lib/utils"

function ResizablePanelGroup({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) {
  return (
    <ResizablePrimitive.PanelGroup
      data-slot="resizable-panel-group"
      className={cn(
        "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
        className
      )}
      {...props}
    />
  )
}

function ResizablePanel({
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Panel>) {
  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
  withHandle?: boolean
}) {
  return (
    <ResizablePrimitive.PanelResizeHandle
      data-slot="resizable-handle"
      className={cn(
        "bg-border focus-visible:ring-ring relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:translate-x-0 data-[panel-group-direction=vertical]:after:-translate-y-1/2 [&[data-panel-group-direction=vertical]>div]:rotate-90",
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-xs border">
          <GripVerticalIcon className="size-2.5" />
        </div>
      )}
    </ResizablePrimitive.PanelResizeHandle>
  )
}

/**
 * ClickUp-style ResizableHandle
 *
 * - Invisible by default (transparent, occupies gap space)
 * - On hover: subtle glow background + thin centered line
 * - Generous hover area for easy clicking
 * - Smooth transitions
 */
function ResizableHandleClickUp({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle>) {
  return (
    <ResizablePrimitive.PanelResizeHandle
      data-slot="resizable-handle"
      className={cn(
        // Base: fills the gap, transparent background
        "group relative flex w-3 items-center justify-center",
        // Cursor
        "cursor-col-resize",
        // Focus styles
        "focus-visible:outline-none",
        // Vertical direction support
        "data-[panel-group-direction=vertical]:h-3 data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:cursor-row-resize",
        className
      )}
      {...props}
    >
      {/* Hover glow background */}
      <div
        className={cn(
          "absolute inset-y-2 inset-x-0 rounded-full",
          // Transition
          "transition-all duration-200 ease-out",
          // Default: invisible
          "opacity-0 bg-transparent",
          // Hover: subtle glow
          "group-hover:opacity-100 group-hover:bg-primary/15",
          // Active/dragging: stronger glow
          "group-data-[resize-handle-active]:opacity-100 group-data-[resize-handle-active]:bg-primary/25"
        )}
      />

      {/* Centered thin line */}
      <div
        className={cn(
          // Position & size
          "absolute left-1/2 top-4 bottom-4 w-[2px] -translate-x-1/2 rounded-full",
          // Transition
          "transition-all duration-200 ease-out",
          // Default: invisible
          "opacity-0 bg-transparent scale-y-0",
          // Hover: visible thin line
          "group-hover:opacity-100 group-hover:bg-primary/70 group-hover:scale-y-100",
          // Active/dragging: brighter line
          "group-data-[resize-handle-active]:opacity-100 group-data-[resize-handle-active]:bg-primary group-data-[resize-handle-active]:scale-y-100"
        )}
      />
    </ResizablePrimitive.PanelResizeHandle>
  )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle, ResizableHandleClickUp }
