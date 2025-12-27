import type { NodeTypes } from "@xyflow/react";
import { TriggerNode } from "./TriggerNode";
import { AgentNode } from "./AgentNode";

export const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  agent: AgentNode,
};

export { TriggerNode, AgentNode };
