"use client";

import { useMemo, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { X, Save } from "lucide-react";
import { Button } from "~/components/ui/button";
import { WorkflowCanvas } from "~/components/workflows/canvas";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { useHeaderConfig } from "~/components/layout/header-context";
import { isProduction } from "~/lib/api-url";

// ============================================
// PAGE
// ============================================

export default function WorkflowEditPage() {
  const params = useParams();
  const router = useRouter();
  const workflowId = params.id as string;

  // Redireciona para dashboard se acessar em produção
  useEffect(() => {
    if (isProduction()) {
      router.replace("/app");
    }
  }, [router]);

  // Não renderiza nada em produção
  if (isProduction()) {
    return null;
  }

  // TODO: Load workflow data from API based on workflowId
  const workflowName = workflowId === "new" ? "Novo Workflow" : "Ivy - Assistente";

  // Configure dynamic header with breadcrumb + icon-only actions
  const headerConfig = useMemo(
    () => ({
      breadcrumbs: [
        { label: "Workflows", href: "/app/workflows" },
        { label: workflowName },
      ],
      actions: (
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => router.push("/app/workflows")}
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Cancelar</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  // TODO: Save workflow
                  console.log("Saving workflow...");
                }}
              >
                <Save className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Salvar</TooltipContent>
          </Tooltip>
        </div>
      ),
      showAiChat: true,
    }),
    [workflowName, router]
  );

  useHeaderConfig(headerConfig);

  return (
    <TooltipProvider delayDuration={300}>
      {/* Canvas - preenche todo o espaço disponível */}
      <div className="h-full w-full">
        <WorkflowCanvas />
      </div>
    </TooltipProvider>
  );
}
