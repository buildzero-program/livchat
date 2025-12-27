"use client";

import { motion } from "framer-motion";
import { Power, Trash2, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { EditableName } from "~/components/shared/editable-name";
import { StatusBadge, type InstanceStatus } from "~/components/shared/status-badge";
import { formatPhone, getInstanceStatusText } from "~/lib/utils";

export type { InstanceStatus };

export interface Instance {
  id: string;
  name: string;
  phoneNumber: string | undefined;
  whatsappName: string | null;
  pictureUrl: string | null;
  status: InstanceStatus;
  connectedSince: string | null;
  messagesUsed: number;
}

interface InstanceCardProps {
  instance: Instance;
  onRename: (name: string) => void;
  onDisconnect: () => void;
  onDelete: () => void;
  onClick?: () => void;
  isDisconnecting?: boolean;
  isDeleting?: boolean;
}

export function InstanceCard({
  instance,
  onRename,
  onDisconnect,
  onDelete,
  onClick,
  isDisconnecting = false,
  isDeleting = false,
}: InstanceCardProps) {
  const isOnline = instance.status === "online";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="group rounded-lg border bg-card p-4 transition-colors hover:bg-muted/30 cursor-pointer"
      onClick={onClick}
    >
      {/* Layout: Avatar + Text block (2 lines) + Controls (vertically centered) */}
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <Avatar className="h-10 w-10 rounded-lg flex-shrink-0">
          <AvatarImage
            src={instance.pictureUrl ?? undefined}
            alt={instance.name}
            className="rounded-lg"
          />
          <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-medium">
            {instance.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        {/* Text block - 2 lines */}
        <div className="flex-1 min-w-0">
          {/* Linha 1: Nome */}
          <div className="flex" onClick={(e) => e.stopPropagation()}>
            <EditableName name={instance.name} onSave={onRename} />
          </div>

          {/* Linha 2: Metadata - alinhado à esquerda */}
          <p className="mt-1 text-xs text-muted-foreground/70">
            {formatPhone(instance.phoneNumber)} · {getInstanceStatusText(instance.status, instance.messagesUsed)}
          </p>
        </div>

        {/* Controls - vertically centered */}
        <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
          <StatusBadge status={instance.status} className="mr-2" />

          {isOnline && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={onDisconnect}
              disabled={isDisconnecting}
              title="Desconectar"
              aria-label="Desconectar"
            >
              {isDisconnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Power className="h-4 w-4" />
              )}
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
            disabled={isDeleting}
            title="Excluir"
            aria-label="Excluir"
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
