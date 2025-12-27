"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Smartphone, Loader2 } from "lucide-react";
import { pageVariants } from "~/lib/animations";
import { Button } from "~/components/ui/button";
import { ViewToggle, type ViewMode } from "~/components/shared/view-toggle";
import { ListSectionHeader } from "~/components/shared/list-section-header";
import { DeleteConfirmDialog } from "~/components/shared/delete-confirm-dialog";
import { InstanceCard, type Instance } from "~/components/instances/instance-card";
import { InstanceFormDialog } from "~/components/instances/instance-form-dialog";
import { api } from "~/trpc/react";


function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Smartphone className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-1">Nenhuma instância</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        Conecte seu primeiro WhatsApp para começar a enviar e receber mensagens.
      </p>
      <Button onClick={onAdd}>
        <Plus className="h-4 w-4 mr-2" />
        Conectar WhatsApp
      </Button>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-lg border bg-card p-4 animate-pulse"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-3 w-32 bg-muted rounded" />
            </div>
            <div className="h-8 w-8 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function InstancesPage() {
  const [view, setView] = useState<ViewMode>("list");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [instanceToDelete, setInstanceToDelete] = useState<Instance | null>(null);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  // Para reconectar instância existente
  const [reconnectInstance, setReconnectInstance] = useState<Instance | null>(null);

  // tRPC Query - lista instâncias
  const {
    data,
    isLoading,
    error,
    refetch,
  } = api.whatsapp.list.useQuery(
    { syncAvatars: true },
    { refetchInterval: 30000 } // Atualiza a cada 30s
  );

  // Mutations
  const renameMutation = api.whatsapp.rename.useMutation({
    onSuccess: () => void refetch(),
  });

  const deleteMutation = api.whatsapp.delete.useMutation({
    onSuccess: () => {
      setDeleteDialogOpen(false);
      setInstanceToDelete(null);
      void refetch();
    },
  });

  const disconnectMutation = api.whatsapp.disconnect.useMutation({
    onSuccess: () => void refetch(),
  });

  const reconnectMutation = api.whatsapp.reconnect.useMutation({
    onSuccess: () => void refetch(),
  });

  const instances: Instance[] = data?.instances ?? [];
  const isEmpty = instances.length === 0 && !isLoading;
  const maxInstances = data?.maxInstances ?? 1;
  const canAddMore = instances.length < maxInstances;

  // Handlers
  const handleRename = (instanceId: string) => (name: string) => {
    renameMutation.mutate({ instanceId, name });
  };

  const handleDisconnect = (instanceId: string) => () => {
    disconnectMutation.mutate();
  };

  const handleReconnect = (instanceId: string) => () => {
    reconnectMutation.mutate({ instanceId });
  };

  const handleDelete = (instance: Instance) => () => {
    setInstanceToDelete(instance);
    setDeleteDialogOpen(true);
  };

  const handleClick = (instance: Instance) => () => {
    // Se está offline ou conectando, abre dialog para reconectar
    if (instance.status === "offline" || instance.status === "connecting") {
      setReconnectInstance(instance);
      setFormDialogOpen(true);
    } else {
      // TODO: Navigate to instance detail page
      console.log(`Opening instance ${instance.id} details`);
    }
  };

  const confirmDelete = () => {
    if (instanceToDelete) {
      deleteMutation.mutate({ instanceId: instanceToDelete.id });
    }
  };

  const handleAddInstance = () => {
    setReconnectInstance(null); // Limpa para criar nova
    setFormDialogOpen(true);
  };

  const handleFormDialogClose = (open: boolean) => {
    setFormDialogOpen(open);
    if (!open) {
      setReconnectInstance(null); // Limpa ao fechar
    }
  };

  const handleConnectionSuccess = () => {
    setReconnectInstance(null);
    void refetch();
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-red-500 mb-4">Erro ao carregar instâncias</p>
        <Button variant="outline" onClick={() => void refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <>
      <motion.div
        className="space-y-6"
        variants={pageVariants.container}
        initial="hidden"
        animate="visible"
      >
        {/* Page Header */}
        <motion.div variants={pageVariants.item}>
          <h1 className="text-2xl font-bold tracking-tight">Instâncias</h1>
          <p className="text-muted-foreground">
            Gerencie suas conexões WhatsApp
          </p>
        </motion.div>

        {/* List Content */}
        <motion.div variants={pageVariants.item}>
          {/* Section Header */}
          <ListSectionHeader
            title="Instâncias"
            icon={Smartphone}
            count={instances.length}
            hideActionsWhenEmpty
            actions={
              <div className="flex items-center gap-2">
                <ViewToggle view={view} onViewChange={setView} />
                <Button
                  size="sm"
                  onClick={handleAddInstance}
                  disabled={!canAddMore}
                  title={!canAddMore ? `Limite de ${maxInstances} instância(s) atingido` : undefined}
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Adicionar
                </Button>
              </div>
            }
          />

          {/* Content */}
          {isLoading ? (
            <LoadingSkeleton />
          ) : isEmpty ? (
            <EmptyState onAdd={handleAddInstance} />
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {view === "cards" ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {instances.map((instance) => (
                    <InstanceCard
                      key={instance.id}
                      instance={instance}
                      onRename={handleRename(instance.id)}
                      onDisconnect={handleDisconnect(instance.id)}
                      onDelete={handleDelete(instance)}
                      onClick={handleClick(instance)}
                      isDisconnecting={disconnectMutation.isPending}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {instances.map((instance) => (
                    <InstanceCard
                      key={instance.id}
                      instance={instance}
                      onRename={handleRename(instance.id)}
                      onDisconnect={handleDisconnect(instance.id)}
                      onDelete={handleDelete(instance)}
                      onClick={handleClick(instance)}
                      isDisconnecting={disconnectMutation.isPending}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </motion.div>
      </motion.div>

      {/* Delete Confirmation Dialog */}
      {instanceToDelete && (
        <DeleteConfirmDialog
          itemName={instanceToDelete.name}
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={confirmDelete}
          isLoading={deleteMutation.isPending}
        />
      )}

      {/* Add Instance / Reconnect Dialog */}
      <InstanceFormDialog
        open={formDialogOpen}
        onOpenChange={handleFormDialogClose}
        onSuccess={handleConnectionSuccess}
        existingInstanceId={reconnectInstance?.id}
        existingInstanceName={reconnectInstance?.name}
      />
    </>
  );
}
