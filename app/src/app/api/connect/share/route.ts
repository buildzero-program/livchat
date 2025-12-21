/**
 * POST /api/connect/share
 *
 * Gera um código de compartilhamento para conexão remota de WhatsApp.
 * Requer autenticação (Clerk).
 *
 * Request: { instanceId: string }
 * Response: { code, shareUrl, expiresAt }
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { instances } from "~/server/db/schema";
import { eq, and } from "drizzle-orm";
import { generateShareCode, buildShareUrl } from "~/lib/connect";
import { syncUserFromClerk } from "~/server/lib/user";

export async function POST(request: Request) {
  try {
    // 1. Verificar autenticação
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Sincronizar usuário
    const user = await syncUserFromClerk(clerkId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    // 3. Extrair instanceId
    const body = await request.json();
    const { instanceId } = body as { instanceId?: string };

    if (!instanceId) {
      return NextResponse.json(
        { error: "instanceId is required" },
        { status: 400 }
      );
    }

    // 4. Verificar se instância existe e pertence à org
    const instance = await db.query.instances.findFirst({
      where: and(
        eq(instances.id, instanceId),
        eq(instances.organizationId, user.organizationId)
      ),
    });

    if (!instance) {
      return NextResponse.json(
        { error: "Instance not found" },
        { status: 404 }
      );
    }

    // 5. Gerar código
    const { code, expiresAt } = await generateShareCode(
      instanceId,
      user.organizationId,
      user.id
    );

    // 6. Construir URL
    const shareUrl = buildShareUrl(code);

    return NextResponse.json({
      code,
      shareUrl,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("Error generating share code:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
