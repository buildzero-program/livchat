"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Panel,
  ReactFlowProvider,
  type DefaultEdgeOptions,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { MessageCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";

import { nodeTypes } from "./nodes";
import { edgeTypes } from "./edges";
import { CanvasToolbar } from "./controls/CanvasToolbar";
import { CanvasControls } from "./controls/CanvasControls";
import { WorkflowChatWidget } from "./widgets";
import { useWorkflowCanvas } from "./hooks/useWorkflowCanvas";
import { GRID_SIZE } from "./types";

// ============================================
// DEFAULT EDGE OPTIONS
// ============================================

const defaultEdgeOptions: DefaultEdgeOptions = {
  type: "workflow",
  animated: false,
};

// ============================================
// INNER CANVAS (needs ReactFlowProvider)
// ============================================

function WorkflowCanvasInner() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addTriggerNode,
    addAgentNode,
    deleteEdge,
    clearCanvas,
    resetCanvas,
  } = useWorkflowCanvas();

  // Chat widget state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Listen for edge delete events from custom edge component
  useEffect(() => {
    const handleDeleteEdge = (event: CustomEvent<{ edgeId: string }>) => {
      deleteEdge(event.detail.edgeId);
    };

    window.addEventListener(
      "workflow:delete-edge",
      handleDeleteEdge as EventListener
    );
    return () => {
      window.removeEventListener(
        "workflow:delete-edge",
        handleDeleteEdge as EventListener
      );
    };
  }, [deleteEdge]);

  // Handle keyboard shortcuts
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      // Delete selected nodes/edges with Delete or Backspace
      if (event.key === "Delete" || event.key === "Backspace") {
        // React Flow handles this internally via onNodesChange/onEdgesChange
      }
      // Close chat with Escape
      if (event.key === "Escape" && isChatOpen) {
        setIsChatOpen(false);
      }
    },
    [isChatOpen]
  );

  const toggleChat = useCallback(() => {
    setIsChatOpen((prev) => !prev);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full"
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        snapToGrid
        snapGrid={[GRID_SIZE, GRID_SIZE]}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.5 }}
        minZoom={0.1}
        maxZoom={2}
        deleteKeyCode={["Delete", "Backspace"]}
        proOptions={{ hideAttribution: true }}
        className="bg-background"
      >
        {/* Background dots */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={GRID_SIZE}
          size={1}
          className="opacity-40"
        />

        {/* Toolbar (top-left) - com margem para não sobrepor header */}
        <Panel position="top-left" className="!top-4 !left-4">
          <CanvasToolbar
            onAddTrigger={addTriggerNode}
            onAddAgent={addAgentNode}
            onClear={clearCanvas}
            onReset={resetCanvas}
          />
        </Panel>

        {/* Zoom controls (bottom-left) - com margem */}
        <Panel position="bottom-left" className="!bottom-4 !left-4">
          <CanvasControls />
        </Panel>

        {/* Chat toggle (top-right) */}
        <Panel position="top-right" className="!top-4 !right-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isChatOpen ? "default" : "outline"}
                size="icon"
                onClick={toggleChat}
                className="h-9 w-9 rounded-lg shadow-lg"
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              {isChatOpen ? "Fechar Chat" : "Testar com Ivy"}
            </TooltipContent>
          </Tooltip>
        </Panel>
      </ReactFlow>

      {/* Floating Chat Widget */}
      <WorkflowChatWidget
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        containerRef={containerRef}
      />
    </div>
  );
}

// ============================================
// EXPORTED COMPONENT (with provider)
// ============================================

export function WorkflowCanvas() {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner />
    </ReactFlowProvider>
  );
}
