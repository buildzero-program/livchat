"use client";

import { motion } from "framer-motion";
import { Trash2, GitBranch, Bot } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { EditableName } from "~/components/shared/editable-name";

// ============================================
// TYPES
// ============================================

export interface WorkflowData {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  nodeCount: number;
  model: string | null; // Primary model from first agent node
  createdAt: Date;
  updatedAt: Date;
}

interface WorkflowCardProps {
  workflow: WorkflowData;
  variant?: "list" | "card"; // Layout variant: horizontal list or vertical card
  onRename: (name: string) => void;
  onToggle: (isActive: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

// ============================================
// HELPERS
// ============================================

function getNodeSummary(nodeCount: number): string {
  if (nodeCount === 0) return "Nenhum node";
  if (nodeCount === 1) return "1 node";
  return `${nodeCount} nodes`;
}

function formatModel(model: string | null): string {
  if (!model) return "Sem modelo";
  // Shorten long model names
  if (model.length > 25) {
    return model.slice(0, 22) + "...";
  }
  return model;
}

// ============================================
// WORKFLOW CARD
// ============================================

export function WorkflowCard({
  workflow,
  variant = "list",
  onRename,
  onToggle,
  onEdit,
  onDelete,
}: WorkflowCardProps) {
  // CARD VIEW: Vertical layout with header, body, footer
  if (variant === "card") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="group rounded-lg border bg-card transition-colors hover:bg-muted/30 cursor-pointer flex flex-col"
        onClick={onEdit}
      >
        {/* Header: Name + Switch */}
        <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
          <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
            <EditableName name={workflow.name} onSave={onRename} />
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <Switch
              checked={workflow.isActive}
              onCheckedChange={onToggle}
              aria-label={workflow.isActive ? "Desativar workflow" : "Ativar workflow"}
            />
          </div>
        </div>

        {/* Body: Metadata vertical */}
        <div className="px-4 py-3 space-y-2 flex-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <GitBranch className="h-3.5 w-3.5" />
            <span>{getNodeSummary(workflow.nodeCount)}</span>
          </div>
          {workflow.model && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Bot className="h-3.5 w-3.5" />
              <span className="break-all">{workflow.model}</span>
            </div>
          )}
          {workflow.description && (
            <p className="text-xs text-muted-foreground/70 line-clamp-2">
              {workflow.description}
            </p>
          )}
        </div>

        {/* Footer: Delete button */}
        <div className="px-4 pb-3 pt-1 flex justify-end" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
            title="Deletar"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    );
  }

  // LIST VIEW: Horizontal layout (original)
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="group rounded-lg border bg-card p-4 transition-colors hover:bg-muted/30 cursor-pointer"
      onClick={onEdit}
    >
      {/* Layout: Text block (2 lines) + Controls (vertically centered) */}
      <div className="flex items-center gap-4">
        {/* Text block - 2 lines */}
        <div className="flex-1 min-w-0">
          {/* Linha 1: Nome */}
          <div className="flex" onClick={(e) => e.stopPropagation()}>
            <EditableName name={workflow.name} onSave={onRename} />
          </div>

          {/* Linha 2: Metadata - alinhado à esquerda */}
          <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground/70">
            <span className="inline-flex items-center gap-1">
              <GitBranch className="h-3 w-3" />
              {getNodeSummary(workflow.nodeCount)}
            </span>
            {workflow.model && (
              <span className="inline-flex items-center gap-1">
                <Bot className="h-3 w-3" />
                {formatModel(workflow.model)}
              </span>
            )}
            {workflow.description && (
              <span className="truncate" title={workflow.description}>
                · {workflow.description}
              </span>
            )}
          </p>
        </div>

        {/* Controls - vertically centered */}
        <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={workflow.isActive}
            onCheckedChange={onToggle}
            aria-label={workflow.isActive ? "Desativar workflow" : "Ativar workflow"}
            className="mr-2"
          />

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
            title="Deletar"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
