"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Smartphone,
  Wifi,
  WifiOff,
  Clock,
  Power,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Loader2,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";
import { formatRelativeTime } from "~/lib/mock-dashboard";
import { formatPhone } from "~/lib/utils";

// Shared components
import { StatusBadge, type InstanceStatus } from "~/components/shared/status-badge";
import { EditableName } from "~/components/shared/editable-name";
import { DeleteConfirmDialog } from "~/components/shared/delete-confirm-dialog";

interface Instance {
  id: string;
  name: string;
  phoneNumber: string | undefined;
  whatsappName: string | null;
  pictureUrl: string | null;
  status: InstanceStatus;
  connectedSince: string | null;
  messagesUsed: number;
}

// ============================================
// INSTANCE CARD
// ============================================

function InstanceCard({
  instance,
  onRename,
  onDelete,
  onReconnect,
  onDisconnect,
  isReconnecting,
  isDisconnecting,
}: {
  instance: Instance;
  onRename: (name: string) => void;
  onDelete: () => void;
  onReconnect: () => void;
  onDisconnect: () => void;
  isReconnecting: boolean;
  isDisconnecting: boolean;
}) {
  const [uptime, setUptime] = useState("");
  const isOnline = instance.status === "online";

  useEffect(() => {
    const updateUptime = () => {
      if (instance.connectedSince) {
        setUptime(formatRelativeTime(new Date(instance.connectedSince)).replace("há ", ""));
      }
    };

    updateUptime();
    const interval = setInterval(updateUptime, 60000);
    return () => clearInterval(interval);
  }, [instance.connectedSince]);


  return (
    <motion.div
      key={instance.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {/* Header: Avatar + Info + Status */}
      <div className="flex items-start gap-3">
        {/* Avatar - rounded-lg como o avatar do user */}
        <Avatar className="h-12 w-12 rounded-lg">
          <AvatarImage
            src={instance.pictureUrl ?? undefined}
            alt={instance.name}
            className="rounded-lg"
          />
          <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-medium">
            {instance.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <EditableName name={instance.name} onSave={onRename} />
            <StatusBadge status={instance.status} />
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {formatPhone(instance.phoneNumber)}
          </p>
          {instance.whatsappName && (
            <p className="text-xs text-muted-foreground">
              {instance.whatsappName}
            </p>
          )}
        </div>
      </div>

      {/* Stats */}
      {isOnline ? (
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Wifi className="h-3.5 w-3.5 text-green-500" />
            <span>Conectado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span>{uptime || "..."}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            <span>{instance.messagesUsed} msgs</span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <WifiOff className="h-4 w-4" />
          <span>
            {instance.status === "connecting"
              ? "Aguardando conexão..."
              : "Desconectado"}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {isOnline ? (
          <>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={onReconnect}
              disabled={isReconnecting}
            >
              {isReconnecting ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              )}
              Reconectar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
              onClick={onDisconnect}
              disabled={isDisconnecting}
              title="Desconectar"
            >
              {isDisconnecting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Power className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
              onClick={onDelete}
              title="Deletar"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : instance.status === "connecting" ? (
          <>
            <Button variant="outline" size="sm" className="flex-1" disabled>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Conectando...
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
              onClick={onDelete}
              title="Deletar"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              className="flex-1"
              onClick={onReconnect}
              disabled={isReconnecting}
            >
              {isReconnecting ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Wifi className="h-3.5 w-3.5 mr-1.5" />
              )}
              Conectar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
              onClick={onDelete}
              title="Deletar"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ============================================
// SKELETON
// ============================================

function InstancesWidgetSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Smartphone className="h-4 w-4" />
          Instâncias WhatsApp
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3">
          <Skeleton className="h-12 w-12 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-full" />
      </CardContent>
    </Card>
  );
}

// ============================================
// ERROR STATE
// ============================================

function InstancesWidgetError({ onRetry }: { onRetry: () => void }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Smartphone className="h-4 w-4" />
          Instâncias WhatsApp
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="rounded-full bg-destructive/10 p-3 mb-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <p className="text-sm font-medium">Erro ao carregar</p>
          <p className="text-xs text-muted-foreground mt-1">
            Não foi possível carregar as instâncias
          </p>
          <Button size="sm" variant="outline" className="mt-4" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Tentar novamente
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// EMPTY STATE
// ============================================

function InstancesWidgetEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="rounded-full bg-muted p-3 mb-3">
        <Smartphone className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">Nenhuma instância</p>
      <p className="text-xs text-muted-foreground mt-1">
        Conecte um WhatsApp para começar
      </p>
      <Button size="sm" className="mt-4">
        <Wifi className="h-3.5 w-3.5 mr-1.5" />
        Conectar WhatsApp
      </Button>
    </div>
  );
}

// ============================================
// MAIN WIDGET
// ============================================

export function InstancesWidget() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // First load syncs avatars, then polling without sync
  const [syncAvatars, setSyncAvatars] = useState(true);

  const { data, isLoading, isError, refetch } = api.whatsapp.list.useQuery(
    { syncAvatars },
    {
      // Only start polling after first load (when syncAvatars becomes false)
      refetchInterval: syncAvatars ? false : 30000,
    }
  );

  // After first successful load, disable avatar sync for polling
  useEffect(() => {
    if (data && syncAvatars) {
      setSyncAvatars(false);
    }
  }, [data, syncAvatars]);

  // Mutations
  const renameMutation = api.whatsapp.rename.useMutation({
    onSuccess: () => void refetch(),
  });

  const deleteMutation = api.whatsapp.delete.useMutation({
    onSuccess: () => {
      setDeleteDialogOpen(false);
      setCurrentIndex(0);
      void refetch();
    },
  });

  const reconnectMutation = api.whatsapp.reconnect.useMutation({
    onSuccess: () => void refetch(),
  });

  const disconnectMutation = api.whatsapp.disconnect.useMutation({
    onSuccess: () => void refetch(),
  });

  // Loading state
  if (isLoading) {
    return <InstancesWidgetSkeleton />;
  }

  // Error state
  if (isError) {
    return <InstancesWidgetError onRetry={() => void refetch()} />;
  }

  const instances = data?.instances ?? [];
  const hasMultiple = instances.length > 1;
  const currentInstance = instances[currentIndex];
  const isOnline = currentInstance?.status === "online";

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? instances.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === instances.length - 1 ? 0 : prev + 1));
  };

  // Empty state
  if (instances.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            Instâncias WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent>
          <InstancesWidgetEmpty />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="relative overflow-hidden">
        {/* Glow effect quando online */}
        {isOnline && (
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent pointer-events-none" />
        )}

        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            Instâncias WhatsApp
          </CardTitle>

          {/* Carousel Navigation in Header */}
          {hasMultiple && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={goToPrevious}
                aria-label="Anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground min-w-[2.5rem] text-center">
                {currentIndex + 1}/{instances.length}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={goToNext}
                aria-label="Próxima"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent>
          <AnimatePresence mode="wait">
            {currentInstance && (
              <InstanceCard
                instance={currentInstance}
                onRename={(name) =>
                  renameMutation.mutate({ instanceId: currentInstance.id, name })
                }
                onDelete={() => setDeleteDialogOpen(true)}
                onReconnect={() =>
                  reconnectMutation.mutate({ instanceId: currentInstance.id })
                }
                onDisconnect={() => disconnectMutation.mutate()}
                isReconnecting={reconnectMutation.isPending}
                isDisconnecting={disconnectMutation.isPending}
              />
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      {currentInstance && (
        <DeleteConfirmDialog
          itemName={currentInstance.name}
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={() =>
            deleteMutation.mutate({ instanceId: currentInstance.id })
          }
          isLoading={deleteMutation.isPending}
        />
      )}
    </>
  );
}
