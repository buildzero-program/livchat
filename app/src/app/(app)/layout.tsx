import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppLayout } from "~/components/layout/app-layout";
import { syncUserFromClerk } from "~/server/lib/user";
import { getDeviceByToken } from "~/server/lib/device";
import { DEVICE_COOKIE_NAME } from "~/lib/constants";

/**
 * Layout protegido para área logada (/app)
 *
 * Dupla camada de proteção:
 * 1. middleware.ts (edge) - redireciona para LP se não autenticado
 * 2. Este layout (server) - redireciona para LP se não autenticado
 *
 * Também faz sync do user e claim de instances:
 * - Sync user do Clerk para nosso banco
 * - Claim instances órfãs do device para a organização do user
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

  // Sync user e claim instances (idempotent)
  try {
    const cookieStore = await cookies();
    const deviceToken = cookieStore.get(DEVICE_COOKIE_NAME)?.value;

    if (deviceToken) {
      const device = await getDeviceByToken(deviceToken);
      if (device) {
        // syncUserFromClerk é idempotent - cria user/org se não existe
        // e faz claim de instances órfãs do device
        await syncUserFromClerk(userId, device.id);
      }
    }
  } catch (error) {
    // Não bloquear render se sync falhar
    console.error("[layout] Failed to sync user:", error);
  }

  return <AppLayout>{children}</AppLayout>;
}
