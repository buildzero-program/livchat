"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, GitBranch } from "lucide-react";
import { Button } from "~/components/ui/button";
import { ViewToggle, type ViewMode } from "~/components/shared/view-toggle";
import { ListSectionHeader } from "~/components/shared/list-section-header";
import { DeleteConfirmDialog } from "~/components/shared/delete-confirm-dialog";
import { WorkflowCard, type WorkflowData } from "~/components/workflows/workflow-card";
import { pageVariants } from "~/lib/animations";
import { isProduction } from "~/lib/api-url";

// ============================================
// MOCK DATA (temporary until tRPC integration)
// ============================================

const MOCK_WORKFLOWS: WorkflowData[] = [
  {
    id: "wf_ivy",
    name: "Ivy - Assistente",
    description: "Assistente virtual inteligente da LivChat",
    isActive: true,
    nodeCount: 3,
    model: "gemini-2.0-flash",
    createdAt: new Date("2024-12-01"),
    updatedAt: new Date("2024-12-24"),
  },
  {
    id: "wf_suporte",
    name: "Suporte Técnico",
    description: "Atendimento de tickets e dúvidas técnicas",
    isActive: false,
    nodeCount: 5,
    model: "gpt-4o-mini",
    createdAt: new Date("2024-12-10"),
    updatedAt: new Date("2024-12-20"),
  },
  {
    id: "wf_vendas",
    name: "Qualificação de Leads",
    description: null,
    isActive: true,
    nodeCount: 4,
    model: "claude-sonnet-4-5",
    createdAt: new Date("2024-12-15"),
    updatedAt: new Date("2024-12-22"),
  },
];

// ============================================
// COMPONENTS
// ============================================

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <GitBranch className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-1">Nenhum workflow</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        Crie seu primeiro workflow para automatizar conversas com IA.
      </p>
      <Button onClick={onAdd}>
        <Plus className="h-4 w-4 mr-2" />
        Criar Workflow
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
            <div className="h-5 w-10 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-muted rounded" />
              <div className="h-3 w-48 bg-muted rounded" />
            </div>
            <div className="h-8 w-8 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// PAGE
// ============================================

export default function WorkflowsPage() {
  const router = useRouter();
  const [view, setView] = useState<ViewMode>("list");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState<WorkflowData | null>(null);

  // Redireciona para dashboard se acessar em produção
  useEffect(() => {
    if (isProduction()) {
      router.replace("/app");
    }
  }, [router]);

  // TODO: Replace with tRPC query
  const [workflows, setWorkflows] = useState<WorkflowData[]>(MOCK_WORKFLOWS);
  const isLoading = false;
  const isEmpty = workflows.length === 0;

  // Não renderiza nada em produção (enquanto redireciona)
  if (isProduction()) {
    return null;
  }

  // ============================================
  // HANDLERS (mock implementations)
  // ============================================

  const handleRename = (workflowId: string) => (name: string) => {
    setWorkflows((prev) =>
      prev.map((w) => (w.id === workflowId ? { ...w, name, updatedAt: new Date() } : w))
    );
  };

  const handleToggle = (workflowId: string) => (isActive: boolean) => {
    setWorkflows((prev) =>
      prev.map((w) => (w.id === workflowId ? { ...w, isActive, updatedAt: new Date() } : w))
    );
  };

  const handleEdit = (workflow: WorkflowData) => () => {
    router.push(`/app/workflows/${workflow.id}`);
  };

  const handleDelete = (workflow: WorkflowData) => () => {
    setWorkflowToDelete(workflow);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (workflowToDelete) {
      setWorkflows((prev) => prev.filter((w) => w.id !== workflowToDelete.id));
      setDeleteDialogOpen(false);
      setWorkflowToDelete(null);
    }
  };

  const handleAddWorkflow = () => {
    router.push("/app/workflows/new");
  };

  // ============================================
  // RENDER
  // ============================================

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
          <h1 className="text-2xl font-bold tracking-tight">Workflows</h1>
          <p className="text-muted-foreground">
            Gerencie seus fluxos de automação com IA
          </p>
        </motion.div>

        {/* List Content */}
        <motion.div variants={pageVariants.item}>
          {/* Section Header */}
          <ListSectionHeader
            title="Workflows"
            icon={GitBranch}
            count={workflows.length}
            hideActionsWhenEmpty
            actions={
              <div className="flex items-center gap-2">
                <ViewToggle view={view} onViewChange={setView} />
                <Button size="sm" onClick={handleAddWorkflow}>
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
            <EmptyState onAdd={handleAddWorkflow} />
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {view === "cards" ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {workflows.map((workflow) => (
                    <WorkflowCard
                      key={workflow.id}
                      workflow={workflow}
                      variant="card"
                      onRename={handleRename(workflow.id)}
                      onToggle={handleToggle(workflow.id)}
                      onEdit={handleEdit(workflow)}
                      onDelete={handleDelete(workflow)}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {workflows.map((workflow) => (
                    <WorkflowCard
                      key={workflow.id}
                      workflow={workflow}
                      variant="list"
                      onRename={handleRename(workflow.id)}
                      onToggle={handleToggle(workflow.id)}
                      onEdit={handleEdit(workflow)}
                      onDelete={handleDelete(workflow)}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </motion.div>
      </motion.div>

      {/* Delete Confirmation Dialog */}
      {workflowToDelete && (
        <DeleteConfirmDialog
          itemName={workflowToDelete.name}
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={confirmDelete}
          isLoading={false}
        />
      )}
    </>
  );
}
