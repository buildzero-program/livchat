"use client";

import { Header } from "./header";

interface PagePanelProps {
  children: React.ReactNode;
}

/**
 * Page Panel Component
 *
 * Wrapper para o conteudo da pagina com:
 * - Header fixo no topo (com AI trigger + UserMenu)
 * - Area de conteudo com scroll
 * - Estilo "elevado" com rounded corners e shadow
 *
 * Este componente representa a "PAGE" na hierarquia:
 * SidebarInset > ResizablePanelGroup > [PagePanel, AiChatPanel]
 */
export function PagePanel({ children }: PagePanelProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg bg-background shadow-sm">
      <Header />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4">{children}</div>
      </div>
    </div>
  );
}
