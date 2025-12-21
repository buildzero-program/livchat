"use client";

import { motion } from "framer-motion";
import { ClipboardList, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { EditableName } from "~/components/shared/editable-name";

// ============================================
// TYPES
// ============================================

export interface WebhookData {
  id: string;
  name: string;
  url: string;
  isActive: boolean;
  instanceIds: string[] | null; // null = todas
  subscriptions: string[] | null; // null = todos
  signingSecret: string | null;
  headers: Record<string, string> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Instance {
  id: string;
  name: string;
}

interface WebhookCardProps {
  webhook: WebhookData;
  instances: Instance[];
  onRename: (name: string) => void;
  onToggle: (isActive: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onViewLogs: () => void;
}

// ============================================
// WEBHOOK CARD
// ============================================

export function WebhookCard({
  webhook,
  onRename,
  onToggle,
  onEdit,
  onDelete,
  onViewLogs,
}: WebhookCardProps) {
  // Summary text for filters
  const getFilterSummary = () => {
    const parts: string[] = [];

    if (webhook.instanceIds === null) {
      parts.push("Todas instâncias");
    } else {
      parts.push(
        `${webhook.instanceIds.length} instância${webhook.instanceIds.length > 1 ? "s" : ""}`
      );
    }

    if (webhook.subscriptions === null) {
      parts.push("todos eventos");
    } else {
      parts.push(
        `${webhook.subscriptions.length} evento${webhook.subscriptions.length > 1 ? "s" : ""}`
      );
    }

    return parts.join(" · ");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="group rounded-lg border bg-card p-4 transition-colors hover:bg-muted/30 cursor-pointer"
      onClick={onEdit}
    >
      {/* Header Row: Switch + Name + Actions */}
      <div className="flex items-center gap-3">
        {/* Switch */}
        <div onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={webhook.isActive}
            onCheckedChange={onToggle}
            aria-label={webhook.isActive ? "Desativar webhook" : "Ativar webhook"}
          />
        </div>

        {/* Name (editable) */}
        <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
          <EditableName name={webhook.name} onSave={onRename} />
        </div>

        {/* Action Buttons - Always visible */}
        <div className="flex items-center gap-1">
          {/* Logs Button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              onViewLogs();
            }}
            title="Ver logs"
          >
            <ClipboardList className="h-4 w-4" />
          </Button>

          {/* Delete Button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Deletar"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* URL + Summary */}
      <div className="mt-2 pl-11 space-y-1">
        <p className="text-sm text-muted-foreground truncate">{webhook.url}</p>
        <p className="text-xs text-muted-foreground/70">{getFilterSummary()}</p>
      </div>
    </motion.div>
  );
}
