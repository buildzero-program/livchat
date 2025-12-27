"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Webhook, Link2, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "~/components/ui/button";
import { ViewToggle, type ViewMode } from "~/components/shared/view-toggle";
import { DeleteConfirmDialog } from "~/components/shared/delete-confirm-dialog";
import { ListSectionHeader } from "~/components/shared/list-section-header";
import { Skeleton } from "~/components/ui/skeleton";
import { WebhookCard, type WebhookData, type Instance } from "./webhook-card";
import {
  WebhookLogsDialog,
  type WebhookLog,
} from "./webhook-logs-dialog";
import { WebhookFormDialog, type WebhookFormData } from "./webhook-form-dialog";
import { api } from "~/trpc/react";

// ============================================
// LOADING SKELETON
// ============================================

function WebhooksListSkeleton() {
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Webhook className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Webhooks</h2>
        </div>
      </div>
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-10 rounded-full" />
              <Skeleton className="h-5 w-32" />
            </div>
            <div className="mt-2 pl-11 space-y-1">
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ============================================
// ERROR STATE
// ============================================

function WebhooksListError({ onRetry }: { onRetry: () => void }) {
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Webhook className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Webhooks</h2>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-destructive/10 p-4 mb-4">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        <h3 className="text-lg font-medium mb-1">Erro ao carregar</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Não foi possível carregar os webhooks
        </p>
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Tentar novamente
        </Button>
      </div>
    </>
  );
}

// ============================================
// EMPTY STATE
// ============================================

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Link2 className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-1">Nenhum webhook configurado</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        Configure webhooks para receber eventos do WhatsApp em tempo real na sua
        aplicação
      </p>
      <Button onClick={onAdd}>
        <Plus className="h-4 w-4 mr-2" />
        Adicionar Webhook
      </Button>
    </div>
  );
}


// ============================================
// MAIN COMPONENT
// ============================================

export function WebhooksList() {
  // Dialog states
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookData | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingWebhook, setDeletingWebhook] = useState<WebhookData | null>(null);

  // Logs dialog state
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [viewingWebhook, setViewingWebhook] = useState<WebhookData | null>(null);
  const [resendingLogId, setResendingLogId] = useState<string | null>(null);

  // View mode
  const [view, setView] = useState<ViewMode>("list");

  // ═══════════════════════════════════════════════════════════════════════════
  // Queries
  // ═══════════════════════════════════════════════════════════════════════════

  const {
    data: webhooksData,
    isLoading: isLoadingWebhooks,
    isError: isWebhooksError,
    refetch: refetchWebhooks,
  } = api.webhooks.list.useQuery();

  // Get instances for the multi-select filter
  const { data: instancesData } = api.whatsapp.list.useQuery(
    { syncAvatars: false },
    { staleTime: 60000 }
  );

  // Get logs for the selected webhook
  const {
    data: logsData,
    isLoading: isLoadingLogs,
    refetch: refetchLogs,
  } = api.webhooks.logs.useQuery(
    { webhookId: viewingWebhook?.id ?? "", status: "all" },
    { enabled: !!viewingWebhook?.id && logsDialogOpen }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // Mutations
  // ═══════════════════════════════════════════════════════════════════════════

  const createMutation = api.webhooks.create.useMutation({
    onSuccess: () => {
      setFormDialogOpen(false);
      void refetchWebhooks();
    },
    onError: (error) => {
      console.error("Erro ao criar webhook:", error.message);
    },
  });

  const updateMutation = api.webhooks.update.useMutation({
    onSuccess: () => {
      setFormDialogOpen(false);
      void refetchWebhooks();
    },
    onError: (error) => {
      console.error("Erro ao atualizar webhook:", error.message);
    },
  });

  const renameMutation = api.webhooks.update.useMutation({
    onSuccess: () => void refetchWebhooks(),
    onError: (error) => console.error("Erro ao renomear webhook:", error.message),
  });

  const toggleMutation = api.webhooks.toggle.useMutation({
    onSuccess: () => void refetchWebhooks(),
    onError: (error) => console.error("Erro ao alterar status do webhook:", error.message),
  });

  const deleteMutation = api.webhooks.delete.useMutation({
    onSuccess: () => {
      setDeleteDialogOpen(false);
      setDeletingWebhook(null);
      void refetchWebhooks();
    },
    onError: (error) => {
      console.error("Erro ao deletar webhook:", error.message);
    },
  });

  const testMutation = api.webhooks.test.useMutation({
    onSuccess: (result) => {
      if (!result.success) {
        console.error("Falha no teste:", result.error);
      }
      void refetchLogs();
    },
    onError: (error) => {
      console.error("Erro ao enviar teste:", error.message);
    },
  });

  const resendMutation = api.webhooks.resend.useMutation({
    onSuccess: (result) => {
      if (!result.success) {
        console.error("Falha ao reenviar:", result.error);
      }
      setResendingLogId(null);
      void refetchLogs();
    },
    onError: (error) => {
      console.error("Erro ao reenviar evento:", error.message);
      setResendingLogId(null);
    },
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Derived data
  // ═══════════════════════════════════════════════════════════════════════════

  // Transform API response to WebhookData format
  const webhooks: WebhookData[] = (webhooksData ?? []).map((wh) => ({
    id: wh.id,
    name: wh.name,
    url: wh.url,
    isActive: wh.isActive,
    instanceIds: wh.instanceIds,
    subscriptions: wh.subscriptions,
    signingSecret: wh.hasSigningSecret ? "********" : null, // Masked
    headers: wh.headers,
    createdAt: new Date(wh.createdAt),
    updatedAt: new Date(wh.updatedAt),
  }));

  // Transform instances to Instance format
  const instances: Instance[] = (instancesData?.instances ?? []).map((inst) => ({
    id: inst.id,
    name: inst.name,
  }));

  // Transform logs to WebhookLog format (now comes from logsData.items)
  const logs: WebhookLog[] = (logsData?.items ?? []).map((log) => ({
    id: log.id,
    eventType: log.eventType,
    status: log.status as "success" | "failed" | "pending",
    statusCode: log.statusCode,
    latencyMs: log.latencyMs,
    attempt: log.attempt,
    error: log.error,
    payload: log.payload as object,
    timestamp: new Date(log.timestamp),
  }));

  // Extract counts from backend (real totals, not client-side counts)
  const logsCounts = {
    total: logsData?.totalCount ?? 0,
    success: logsData?.successCount ?? 0,
    failed: logsData?.failedCount ?? 0,
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Handlers
  // ═══════════════════════════════════════════════════════════════════════════

  const handleOpenAddDialog = () => {
    setEditingWebhook(null);
    setFormDialogOpen(true);
  };

  const handleOpenEditDialog = (webhook: WebhookData) => {
    setEditingWebhook(webhook);
    setFormDialogOpen(true);
  };

  const handleOpenDeleteDialog = (webhook: WebhookData) => {
    setDeletingWebhook(webhook);
    setDeleteDialogOpen(true);
  };

  const handleOpenLogsDialog = (webhook: WebhookData) => {
    setViewingWebhook(webhook);
    setLogsDialogOpen(true);
  };

  const handleRename = (webhookId: string, name: string) => {
    renameMutation.mutate({ webhookId, name });
  };

  const handleToggle = (webhookId: string, isActive: boolean) => {
    toggleMutation.mutate({ webhookId, isActive });
  };

  const handleFormSubmit = (data: WebhookFormData) => {
    const headers =
      data.headers.length > 0
        ? Object.fromEntries(data.headers.filter(h => h.key.trim()).map((h) => [h.key, h.value]))
        : null;

    if (editingWebhook) {
      updateMutation.mutate({
        webhookId: editingWebhook.id,
        url: data.url,
        signingSecret: data.signingSecret || null,
        headers,
        instanceIds: data.instanceIds,
        subscriptions: data.subscriptions,
      });
    } else {
      createMutation.mutate({
        url: data.url,
        signingSecret: data.signingSecret || null,
        headers,
        instanceIds: data.instanceIds,
        subscriptions: data.subscriptions,
      });
    }
  };

  const handleDelete = () => {
    if (deletingWebhook) {
      deleteMutation.mutate({ webhookId: deletingWebhook.id });
    }
  };

  const handleResend = (logId: string) => {
    setResendingLogId(logId);
    resendMutation.mutate({ eventId: logId });
  };

  const handleSendTest = () => {
    if (viewingWebhook) {
      testMutation.mutate({ webhookId: viewingWebhook.id });
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Render states
  // ═══════════════════════════════════════════════════════════════════════════

  if (isLoadingWebhooks) {
    return <WebhooksListSkeleton />;
  }

  if (isWebhooksError) {
    return <WebhooksListError onRetry={() => void refetchWebhooks()} />;
  }

  return (
    <>
      {/* Header */}
      <ListSectionHeader
        title="Webhooks"
        icon={Webhook}
        count={webhooks.length}
        hideActionsWhenEmpty
        actions={
          <div className="flex items-center gap-2">
            <ViewToggle view={view} onViewChange={setView} />
            <Button size="sm" onClick={handleOpenAddDialog}>
              <Plus className="h-4 w-4 mr-1.5" />
              Adicionar
            </Button>
          </div>
        }
      />

      {/* Content */}
      {webhooks.length === 0 ? (
        <EmptyState onAdd={handleOpenAddDialog} />
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {view === "cards" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {webhooks.map((webhook) => (
                <WebhookCard
                  key={webhook.id}
                  webhook={webhook}
                  instances={instances}
                  variant="card"
                  onRename={(name) => handleRename(webhook.id, name)}
                  onToggle={(isActive) => handleToggle(webhook.id, isActive)}
                  onEdit={() => handleOpenEditDialog(webhook)}
                  onDelete={() => handleOpenDeleteDialog(webhook)}
                  onViewLogs={() => handleOpenLogsDialog(webhook)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {webhooks.map((webhook) => (
                <WebhookCard
                  key={webhook.id}
                  webhook={webhook}
                  instances={instances}
                  variant="list"
                  onRename={(name) => handleRename(webhook.id, name)}
                  onToggle={(isActive) => handleToggle(webhook.id, isActive)}
                  onEdit={() => handleOpenEditDialog(webhook)}
                  onDelete={() => handleOpenDeleteDialog(webhook)}
                  onViewLogs={() => handleOpenLogsDialog(webhook)}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Form Dialog */}
      <WebhookFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        webhook={editingWebhook}
        instances={instances}
        onSubmit={handleFormSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Dialog */}
      <DeleteConfirmDialog
        itemName={deletingWebhook?.name ?? ""}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        isLoading={deleteMutation.isPending}
        title="Deletar Webhook"
        description="Esta ação é irreversível. O webhook será removido permanentemente."
      />

      {/* Logs Dialog */}
      <WebhookLogsDialog
        open={logsDialogOpen}
        onOpenChange={setLogsDialogOpen}
        webhookName={viewingWebhook?.name ?? ""}
        logs={logs}
        counts={logsCounts}
        onResend={handleResend}
        onSendTest={handleSendTest}
        isResending={resendingLogId}
        isSendingTest={testMutation.isPending}
        isLoading={isLoadingLogs}
      />
    </>
  );
}
