/**
 * GET /api/connect/[code]/status
 *
 * Valida um código de compartilhamento e retorna o status da instância.
 * Rota pública (sem autenticação).
 *
 * Response: { instanceId, instanceName, status, phoneNumber }
 */

import { NextResponse } from "next/server";
import { verifyShareCode } from "~/lib/connect";
import { db } from "~/server/db";
import { instances } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { WuzAPIClient } from "~/server/lib/wuzapi";
import { env } from "~/env";

interface RouteParams {
  params: Promise<{ code: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { code } = await params;

    // 1. Verificar código
    const data = await verifyShareCode(code);

    if (!data) {
      return NextResponse.json(
        { error: "Link inválido ou expirado" },
        { status: 401 }
      );
    }

    // 2. Buscar instância
    const instance = await db.query.instances.findFirst({
      where: eq(instances.id, data.instanceId),
    });

    if (!instance) {
      return NextResponse.json(
        { error: "Instância não encontrada" },
        { status: 404 }
      );
    }

    // 3. Obter status do WuzAPI
    const client = new WuzAPIClient({
      baseUrl: env.WUZAPI_URL,
      token: instance.providerToken,
    });

    let status = "disconnected";
    let phoneNumber: string | null = null;

    try {
      const wuzStatus = await client.getStatus();
      if (wuzStatus.data.loggedIn) {
        status = "connected";
        phoneNumber = wuzStatus.data.jid ?? null;
      } else if (wuzStatus.data.connected) {
        status = "connecting";
      }
    } catch {
      // WuzAPI não disponível, mantém disconnected
    }

    return NextResponse.json({
      instanceId: data.instanceId,
      instanceName: instance.name,
      status,
      phoneNumber,
    });
  } catch (error) {
    console.error("Error checking share code status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
