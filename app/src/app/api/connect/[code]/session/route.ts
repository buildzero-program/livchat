/**
 * POST/GET /api/connect/[code]/session
 *
 * POST: Inicia sessão de conexão no WuzAPI
 * GET: Obtém QR code para escanear
 *
 * Rota pública (sem autenticação).
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

/**
 * POST - Inicia sessão de conexão
 */
export async function POST(_request: Request, { params }: RouteParams) {
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

    // 3. Iniciar conexão no WuzAPI
    const client = new WuzAPIClient({
      baseUrl: env.WUZAPI_URL,
      token: instance.providerToken,
    });

    try {
      await client.connect(["Message", "ReadReceipt", "Connected"]);
    } catch (error) {
      console.error("Error connecting to WuzAPI:", error);
      // Ignora erro se já estiver conectando
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error starting session:", error);
    return NextResponse.json(
      { error: "Falha ao iniciar conexão" },
      { status: 500 }
    );
  }
}

/**
 * GET - Obtém QR code
 */
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

    // 3. Obter QR code do WuzAPI
    const client = new WuzAPIClient({
      baseUrl: env.WUZAPI_URL,
      token: instance.providerToken,
    });

    try {
      const status = await client.getStatus();

      return NextResponse.json({
        qrCode: status.data.qrcode ?? null,
        connected: status.data.connected,
        loggedIn: status.data.loggedIn,
      });
    } catch (error) {
      console.error("Error getting QR code:", error);
      return NextResponse.json({
        qrCode: null,
        connected: false,
        loggedIn: false,
      });
    }
  } catch (error) {
    console.error("Error getting session:", error);
    return NextResponse.json(
      { error: "Falha ao obter QR code" },
      { status: 500 }
    );
  }
}
