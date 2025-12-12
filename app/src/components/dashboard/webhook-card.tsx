"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ClipboardList, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";

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
// EDITABLE NAME
// ============================================

function EditableName({
  name,
  onSave,
}: {
  name: string;
  onSave: (name: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayName(name);
  }, [name]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmed = displayName.trim();
    if (trimmed && trimmed !== name) {
      setDisplayName(trimmed);
      onSave(trimmed);
    } else {
      setDisplayName(name);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    }
    if (e.key === "Escape") {
      setDisplayName(name);
      setIsEditing(false);
    }
  };

  const typography = "font-semibold text-base leading-7";

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        maxLength={50}
        className={`${typography} h-7 field-sizing-content min-w-20 max-w-full rounded-md border border-input bg-transparent px-2 outline-none transition-colors focus-visible:border-ring`}
      />
    );
  }

  return (
    <h3
      onClick={() => setIsEditing(true)}
      className={`${typography} h-7 truncate cursor-text rounded-md px-2 hover:bg-muted/50 transition-colors`}
      title="Clique para editar"
    >
      {displayName}
    </h3>
  );
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

        {/* Direct Action Buttons */}
        <div className="flex items-center gap-1">
          {/* Logs Button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
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
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
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
