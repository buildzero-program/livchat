import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AppLayout } from "~/components/layout/app-layout";

/**
 * Layout protegido para área logada (/app)
 *
 * Dupla camada de proteção:
 * 1. middleware.ts (edge) - redireciona para LP se não autenticado
 * 2. Este layout (server) - redireciona para LP se não autenticado
 *
 * Estrutura:
 * - SidebarProvider (client)
 * - AppSidebar (left navigation)
 * - Header (top bar)
 * - Main content area
 */
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  // Se não estiver autenticado, redireciona para a LP
  if (!userId) {
    redirect("/");
  }

  return <AppLayout>{children}</AppLayout>;
}
