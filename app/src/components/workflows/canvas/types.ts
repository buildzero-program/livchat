import type { Node, Edge } from "@xyflow/react";

// ============================================
// NODE DATA TYPES (with index signature for React Flow compatibility)
// ============================================

export interface TriggerNodeData extends Record<string, unknown> {
  label: string;
  triggerType: "message" | "schedule" | "webhook";
}

export interface AgentNodeData extends Record<string, unknown> {
  label: string;
  model: string;
  instructions?: string;
}

// Union type for all node data
export type WorkflowNodeData = TriggerNodeData | AgentNodeData;

// ============================================
// NODE TYPES (React Flow format)
// ============================================

export type TriggerNode = Node<TriggerNodeData, "trigger">;
export type AgentNode = Node<AgentNodeData, "agent">;
export type WorkflowNode = TriggerNode | AgentNode;

// ============================================
// EDGE TYPES
// ============================================

export interface WorkflowEdgeData extends Record<string, unknown> {
  label?: string;
}

export type WorkflowEdge = Edge<WorkflowEdgeData>;

// ============================================
// CANVAS STATE
// ============================================

export interface WorkflowCanvasState {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNodeId: string | null;
}

// ============================================
// CONSTANTS
// ============================================

export const GRID_SIZE = 16;

export const NODE_TYPES = {
  trigger: "trigger",
  agent: "agent",
} as const;

export type NodeType = (typeof NODE_TYPES)[keyof typeof NODE_TYPES];
