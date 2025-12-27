"use client";

import { Header } from "./header";
import { usePathname } from "next/navigation";

interface PagePanelProps {
  children: React.ReactNode;
}

// Rotas que precisam de conteúdo full-bleed (sem padding, sem scroll)
const FULL_BLEED_ROUTES = ["/app/workflows/"];

/**
 * Page Panel Component
 *
 * Wrapper para o conteudo da pagina com:
 * - Header fixo no topo (com AI trigger + UserMenu)
 * - Area de conteudo com scroll (ou full-bleed para canvas)
 * - Estilo "elevado" com rounded corners e shadow
 *
 * Este componente representa a "PAGE" na hierarquia:
 * SidebarInset > ResizablePanelGroup > [PagePanel, AiChatPanel]
 */
export function PagePanel({ children }: PagePanelProps) {
  const pathname = usePathname();

  // Verifica se a rota precisa de full-bleed (ex: workflow canvas)
  const isFullBleed = FULL_BLEED_ROUTES.some((route) => pathname.startsWith(route));

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg bg-background shadow-sm">
      <Header />
      {isFullBleed ? (
        // Full-bleed: sem padding, sem scroll, overflow hidden
        <div className="relative flex-1 overflow-hidden">
          {children}
        </div>
      ) : (
        // Normal: com padding e scroll
        <div className="relative flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-4">{children}</div>
        </div>
      )}
    </div>
  );
}
