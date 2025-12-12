"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  RotateCw,
  ChevronDown,
  ChevronUp,
  Clock,
  Rocket,
  Inbox,
  Copy,
  Check,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";

// ============================================
// TYPES
// ============================================

export interface WebhookLog {
  id: string;
  eventType: string;
  status: "success" | "failed" | "pending";
  statusCode: number | null;
  latencyMs: number | null;
  attempt: number;
  error: string | null;
  payload: object;
  timestamp: Date;
}

interface WebhookLogsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhookName: string;
  logs: WebhookLog[];
  onResend: (logId: string) => void;
  onSendTest: () => void;
  isResending?: string | null;
  isSendingTest?: boolean;
  isLoading?: boolean;
}

// ============================================
// COPY BUTTON
// ============================================

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-xs"
      onClick={handleCopy}
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 mr-1" />
          Copiado
        </>
      ) : (
        <>
          <Copy className="h-3 w-3 mr-1" />
          Copiar
        </>
      )}
    </Button>
  );
}

// ============================================
// LOG ITEM
// ============================================

function LogItem({
  log,
  onResend,
  isResending,
}: {
  log: WebhookLog;
  onResend: () => void;
  isResending: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (minutes < 1) return "agora";
    if (minutes < 60) return `há ${minutes} min`;
    if (hours < 24) return `há ${hours}h`;
    return date.toLocaleDateString("pt-BR");
  };

  const statusConfig = {
    success: {
      icon: CheckCircle2,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    failed: {
      icon: XCircle,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    },
    pending: {
      icon: Clock,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
    },
  };

  const config = statusConfig[log.status];
  const StatusIcon = config.icon;
  const payloadString = JSON.stringify(log.payload, null, 2);

  return (
    <div className="rounded-lg border bg-card w-full">
      {/* Header Row */}
      <div
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/50 transition-colors min-w-0"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Status Icon */}
        <div
          className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${config.bgColor}`}
        >
          <StatusIcon className={`h-5 w-5 ${config.color}`} />
        </div>

        {/* Event Type */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{log.eventType}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {log.statusCode !== null && `Status ${log.statusCode}`}
            {log.latencyMs !== null && ` · ${log.latencyMs}ms`}
          </p>
        </div>

        {/* Time */}
        <span className="text-sm text-muted-foreground shrink-0">
          {formatTime(log.timestamp)}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={(e) => {
              e.stopPropagation();
              onResend();
            }}
            disabled={isResending}
          >
            <RotateCw
              className={`h-3.5 w-3.5 mr-1.5 ${isResending ? "animate-spin" : ""}`}
            />
            Reenviar
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t"
          >
            <div className="p-5 space-y-4 w-full">
              {/* Metadata Badges */}
              <div className="flex flex-wrap gap-2">
                {log.statusCode !== null && (
                  <Badge variant="outline" className="text-sm px-3 py-1">
                    Status: {log.statusCode}
                  </Badge>
                )}
                {log.latencyMs !== null && (
                  <Badge variant="outline" className="text-sm px-3 py-1">
                    Latência: {log.latencyMs}ms
                  </Badge>
                )}
                <Badge variant="outline" className="text-sm px-3 py-1">
                  Tentativa: {log.attempt}/3
                </Badge>
              </div>

              {/* Payload */}
              <div style={{ width: 0, minWidth: "100%" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Payload</p>
                  <CopyButton text={payloadString} />
                </div>
                <div className="rounded-lg bg-muted overflow-auto max-h-80">
                  <pre className="text-sm p-4 font-mono whitespace-pre min-w-max">
                    <code>{payloadString}</code>
                  </pre>
                </div>
              </div>

              {/* Error Message */}
              {log.error && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-destructive">Erro</p>
                  <p className="text-sm text-muted-foreground bg-destructive/10 rounded-lg p-4">
                    {log.error}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// EMPTY STATE
// ============================================

function EmptyState({
  onSendTest,
  isLoading,
}: {
  onSendTest: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-5 mb-5">
        <Inbox className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-2">Nenhum evento registrado</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        Aguardando primeiro evento ou envie um teste para verificar a conexão
      </p>
      <Button onClick={onSendTest} disabled={isLoading}>
        {isLoading ? (
          <RotateCw className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Rocket className="h-4 w-4 mr-2" />
        )}
        Enviar evento de teste
      </Button>
    </div>
  );
}

// ============================================
// LOADING STATE
// ============================================

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
      <p className="text-sm text-muted-foreground">Carregando logs...</p>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function WebhookLogsDialog({
  open,
  onOpenChange,
  webhookName,
  logs,
  onResend,
  onSendTest,
  isResending,
  isSendingTest,
  isLoading,
}: WebhookLogsDialogProps) {
  const [filter, setFilter] = useState<"all" | "success" | "failed">("all");

  const filteredLogs = logs.filter((log) => {
    if (filter === "all") return true;
    return log.status === filter;
  });

  const successCount = logs.filter((l) => l.status === "success").length;
  const failedCount = logs.filter((l) => l.status === "failed").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl p-0 gap-0 max-h-[85vh] overflow-hidden">
        <DialogHeader className="px-8 pt-8 pb-6 border-b">
          <DialogTitle className="text-xl flex items-center gap-3">
            Event Logs
            <span className="text-base font-normal text-muted-foreground">
              {webhookName}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="px-8 py-6 flex flex-col min-h-0">
          {/* Filter Tabs */}
          <Tabs
            value={filter}
            onValueChange={(v) => setFilter(v as typeof filter)}
            className="mb-6"
          >
            <TabsList className="h-11">
              <TabsTrigger value="all" className="px-6 h-9">
                Todos
                <Badge variant="secondary" className="ml-2 h-5 px-2 text-xs">
                  {logs.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="success" className="px-6 h-9">
                Sucesso
                <Badge
                  variant="secondary"
                  className="ml-2 h-5 px-2 text-xs bg-green-500/10 text-green-600"
                >
                  {successCount}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="failed" className="px-6 h-9">
                Falha
                <Badge
                  variant="secondary"
                  className="ml-2 h-5 px-2 text-xs bg-red-500/10 text-red-600"
                >
                  {failedCount}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Logs List */}
          {isLoading ? (
            <LoadingState />
          ) : logs.length === 0 ? (
            <EmptyState onSendTest={onSendTest} isLoading={isSendingTest ?? false} />
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Nenhum evento com esse filtro
            </div>
          ) : (
            <ScrollArea className="flex-1 -mx-8 px-8" style={{ maxHeight: "calc(85vh - 220px)" }}>
              <div className="space-y-3 pb-4">
                {filteredLogs.map((log) => (
                  <LogItem
                    key={log.id}
                    log={log}
                    onResend={() => onResend(log.id)}
                    isResending={isResending === log.id}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
