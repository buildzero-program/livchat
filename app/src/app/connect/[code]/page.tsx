/**
 * /connect/[code]
 *
 * Página pública para conexão remota de WhatsApp via link compartilhado.
 * Não requer autenticação.
 */

import { PublicConnectPage } from "~/components/connect/public-connect-page";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ code: string }>;
}

export const metadata: Metadata = {
  title: "Conectar WhatsApp - LivChat",
  description: "Escaneie o QR code para conectar seu WhatsApp",
};

export default async function ConnectPage({ params }: PageProps) {
  const { code } = await params;
  return <PublicConnectPage code={code} />;
}
