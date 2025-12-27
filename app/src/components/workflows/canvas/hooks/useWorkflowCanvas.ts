"use client";

import { useCallback, useState } from "react";
import {
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type OnConnect,
  type Node,
  type Edge,
} from "@xyflow/react";
import type {
  WorkflowNode,
  WorkflowEdge,
  TriggerNodeData,
  AgentNodeData,
  NodeType,
} from "../types";
import { GRID_SIZE } from "../types";

// ============================================
// MOCK DATA
// ============================================

const INITIAL_NODES: Node[] = [
  {
    id: "trigger-1",
    type: "trigger",
    position: { x: 100, y: 200 },
    data: { label: "Nova Mensagem", triggerType: "message" } satisfies TriggerNodeData,
  },
  {
    id: "agent-1",
    type: "agent",
    position: { x: 400, y: 200 },
    data: { label: "Assistente Ivy", model: "gemini-2.0-flash" } satisfies AgentNodeData,
  },
];

const INITIAL_EDGES: Edge[] = [
  { id: "e-trigger-1-agent-1", source: "trigger-1", target: "agent-1" },
];

// ============================================
// HELPERS
// ============================================

function generateNodeId(type: NodeType): string {
  return `${type}-${Date.now()}`;
}

function snapToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

// ============================================
// HOOK
// ============================================

export function useWorkflowCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Handle new connections
  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      const newEdge: Edge = {
        id: `e-${connection.source}-${connection.target}`,
        source: connection.source!,
        target: connection.target!,
        sourceHandle: connection.sourceHandle ?? undefined,
        targetHandle: connection.targetHandle ?? undefined,
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  // Add a new trigger node
  const addTriggerNode = useCallback(
    (position?: { x: number; y: number }) => {
      const id = generateNodeId("trigger");
      const newNode: Node = {
        id,
        type: "trigger",
        position: position ?? { x: snapToGrid(200), y: snapToGrid(200) },
        data: {
          label: "Novo Trigger",
          triggerType: "message",
        } satisfies TriggerNodeData,
      };
      setNodes((nds) => [...nds, newNode]);
      return id;
    },
    [setNodes]
  );

  // Add a new agent node
  const addAgentNode = useCallback(
    (position?: { x: number; y: number }) => {
      const id = generateNodeId("agent");
      const newNode: Node = {
        id,
        type: "agent",
        position: position ?? { x: snapToGrid(400), y: snapToGrid(200) },
        data: {
          label: "Novo Agente",
          model: "gemini-2.0-flash",
        } satisfies AgentNodeData,
      };
      setNodes((nds) => [...nds, newNode]);
      return id;
    },
    [setNodes]
  );

  // Delete a node and its connected edges
  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
      );
      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
      }
    },
    [setNodes, setEdges, selectedNodeId]
  );

  // Delete an edge
  const deleteEdge = useCallback(
    (edgeId: string) => {
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    },
    [setEdges]
  );

  // Update node data
  const updateNodeData = useCallback(
    (nodeId: string, data: Partial<TriggerNodeData | AgentNodeData>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
        )
      );
    },
    [setNodes]
  );

  // Handle node selection
  const onNodeSelect = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
  }, []);

  // Clear canvas
  const clearCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
  }, [setNodes, setEdges]);

  // Reset to initial state
  const resetCanvas = useCallback(() => {
    setNodes(INITIAL_NODES);
    setEdges(INITIAL_EDGES);
    setSelectedNodeId(null);
  }, [setNodes, setEdges]);

  return {
    // State
    nodes,
    edges,
    selectedNodeId,

    // React Flow handlers
    onNodesChange,
    onEdgesChange,
    onConnect,

    // Node operations
    addTriggerNode,
    addAgentNode,
    deleteNode,
    updateNodeData,
    onNodeSelect,

    // Edge operations
    deleteEdge,

    // Canvas operations
    clearCanvas,
    resetCanvas,
  };
}
