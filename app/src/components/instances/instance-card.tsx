"use client";

import { motion } from "framer-motion";
import { Power, Trash2, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { EditableName } from "~/components/shared/editable-name";
import { StatusBadge, type InstanceStatus } from "~/components/shared/status-badge";

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

function formatPhone(phone: string | undefined): string {
  if (!phone) return "Não conectado";
  if (phone.length >= 12) {
    return `+${phone.slice(0, 2)} ${phone.slice(2, 4)} ${phone.slice(4, 9)}-${phone.slice(9)}`;
  }
  return phone;
}

function getStatusText(status: InstanceStatus, messagesUsed: number): string {
  const parts: string[] = [];

  switch (status) {
    case "online":
      parts.push("Online");
      break;
    case "connecting":
      parts.push("Conectando...");
      break;
    case "offline":
      parts.push("Offline");
      break;
  }

  if (messagesUsed > 0) {
    parts.push(`${messagesUsed} msgs`);
  }

  return parts.join(" · ");
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
      {/* Header Row: Avatar + Name + Status Badge + Actions */}
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

        {/* Name (editable) + Status Badge */}
        <div className="flex items-center gap-2 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
          <EditableName name={instance.name} onSave={onRename} />
          <StatusBadge status={instance.status} />
        </div>

        {/* Action Buttons - Red like widget */}
        <div className="flex items-center gap-1">
          {/* Disconnect Button (only when online) */}
          {isOnline && (
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/30"
              onClick={(e) => {
                e.stopPropagation();
                onDisconnect();
              }}
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

          {/* Delete Button */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/30"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
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

      {/* Phone + Status Summary */}
      <div className="mt-2 space-y-1">
        <p className="text-sm text-muted-foreground truncate">
          {formatPhone(instance.phoneNumber)}
        </p>
        <p className="text-xs text-muted-foreground/70">
          {getStatusText(instance.status, instance.messagesUsed)}
        </p>
      </div>
    </motion.div>
  );
}
