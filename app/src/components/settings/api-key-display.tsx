"use client";

import * as React from "react";
import { Eye, EyeOff, Copy, Check, Trash2, Smartphone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { useCopyToClipboard } from "~/hooks/use-copy-to-clipboard";

interface ApiKeyDisplayProps {
  id: string;
  name: string;
  token: string;
  instanceName?: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  onRevoke?: (id: string) => void;
  className?: string;
}

function maskApiKey(token: string): string {
  const prefix = "lc_live_";
  if (!token.startsWith(prefix)) {
    // Fallback for non-standard tokens
    const first4 = token.slice(0, 4);
    const last4 = token.slice(-4);
    return `${first4}${"●".repeat(Math.max(0, token.length - 8))}${last4}`;
  }

  const withoutPrefix = token.slice(prefix.length);
  const first4 = withoutPrefix.slice(0, 4);
  const last4 = withoutPrefix.slice(-4);
  const maskedLength = Math.max(0, withoutPrefix.length - 8);

  return `${prefix}${first4}${"●".repeat(maskedLength)}${last4}`;
}

function formatRelativeTime(date: Date | null): string {
  if (!date) return "Nunca usada";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Agora mesmo";
  if (diffMins < 60) return `há ${diffMins} min`;
  if (diffHours < 24) return `há ${diffHours}h`;
  if (diffDays < 7) return `há ${diffDays} dias`;

  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function ApiKeyDisplay({
  id,
  name,
  token,
  instanceName,
  createdAt,
  lastUsedAt,
  onRevoke,
  className,
}: ApiKeyDisplayProps) {
  const [revealed, setRevealed] = React.useState(false);
  const { copy, copied } = useCopyToClipboard();

  const handleCopy = async () => {
    const success = await copy(token);
    if (success) {
      toast.success("Chave copiada para a área de transferência");
    } else {
      toast.error("Falha ao copiar chave");
    }
  };

  const handleRevoke = () => {
    onRevoke?.(id);
  };

  const displayToken = revealed ? token : maskApiKey(token);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group rounded-lg border bg-card p-4 transition-colors hover:bg-muted/30",
        className
      )}
    >
      {/* Header: Icon + Name */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Smartphone className="h-5 w-5 text-primary" />
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium truncate">{name}</h4>
            {instanceName && (
              <span className="text-xs text-muted-foreground">
                ({instanceName})
              </span>
            )}
          </div>

          {/* Token display */}
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded select-all">
              {displayToken}
            </code>
          </div>

          {/* Meta info */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground/70">
            <span>Criada em {formatDate(createdAt)}</span>
            <span>•</span>
            <span>Último uso: {formatRelativeTime(lastUsedAt)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setRevealed(!revealed)}
            title={revealed ? "Esconder" : "Revelar"}
          >
            <AnimatePresence mode="wait">
              {revealed ? (
                <motion.div
                  key="hide"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <EyeOff className="h-4 w-4" />
                </motion.div>
              ) : (
                <motion.div
                  key="show"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Eye className="h-4 w-4" />
                </motion.div>
              )}
            </AnimatePresence>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleCopy}
            title="Copiar"
          >
            <AnimatePresence mode="wait">
              {copied ? (
                <motion.div
                  key="check"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Check className="h-4 w-4 text-green-500" />
                </motion.div>
              ) : (
                <motion.div
                  key="copy"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Copy className="h-4 w-4" />
                </motion.div>
              )}
            </AnimatePresence>
          </Button>

          {onRevoke && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleRevoke}
              title="Revogar"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
