/**
 * POST /api/connect/[code]/pairing
 *
 * Gera um código de pareamento (pairing code) para conexão via número de telefone.
 * Rota pública (sem autenticação).
 *
 * Request: { phone: string } (número limpo, sem formatação)
 * Response: { pairingCode: string }
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

export async function POST(request: Request, { params }: RouteParams) {
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

    // 2. Extrair telefone do body
    const body = await request.json();
    const { phone } = body as { phone?: string };

    if (!phone) {
      return NextResponse.json(
        { error: "Número de telefone é obrigatório" },
        { status: 400 }
      );
    }

    // 3. Buscar instância
    const instance = await db.query.instances.findFirst({
      where: eq(instances.id, data.instanceId),
    });

    if (!instance) {
      return NextResponse.json(
        { error: "Instância não encontrada" },
        { status: 404 }
      );
    }

    // 4. Gerar pairing code no WuzAPI
    const client = new WuzAPIClient({
      baseUrl: env.WUZAPI_URL,
      token: instance.providerToken,
    });

    try {
      const result = await client.getPairingCode(phone);

      return NextResponse.json({
        pairingCode: result.data.LinkingCode,
      });
    } catch (error) {
      console.error("Error getting pairing code:", error);
      return NextResponse.json(
        { error: "Falha ao gerar código de pareamento" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in pairing endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
