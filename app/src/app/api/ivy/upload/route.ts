/**
 * API Route: Upload de arquivos para o chat da Ivy
 *
 * POST /api/ivy/upload
 * Body: FormData com campo "file"
 * Response: { url: string }
 *
 * Suporta imagens e PDFs. PDFs são convertidos para imagens
 * pelo AST via /files/process antes de enviar ao LLM.
 */

import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

// Tipos permitidos (imagens + PDF)
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
];

// Tamanho máximo: 50MB (PDFs podem ser maiores)
const MAX_SIZE = 50 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    // Verifica autenticação
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse FormData
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Valida tipo
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Invalid file type: ${file.type}. Allowed: ${ALLOWED_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Valida tamanho
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        {
          error: `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Max: 50MB`,
        },
        { status: 400 }
      );
    }

    // Gera nome único para o arquivo
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const extension = file.name.split(".").pop() || "jpg";
    const filename = `ivy-chat/${userId}/${timestamp}-${randomId}.${extension}`;

    // Upload para Vercel Blob
    const { url } = await put(filename, file, {
      access: "public",
      contentType: file.type,
    });

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
