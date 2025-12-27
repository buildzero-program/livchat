"use client";

import { useCallback, useEffect } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Panel,
  ReactFlowProvider,
  type DefaultEdgeOptions,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { nodeTypes } from "./nodes";
import { edgeTypes } from "./edges";
import { CanvasToolbar } from "./controls/CanvasToolbar";
import { CanvasControls } from "./controls/CanvasControls";
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
    },
    []
  );

  return (
    <div className="h-full w-full" onKeyDown={onKeyDown} tabIndex={0}>
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
      </ReactFlow>
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
