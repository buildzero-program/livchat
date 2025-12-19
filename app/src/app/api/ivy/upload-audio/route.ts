/**
 * API Route: Upload de áudio para o chat da Ivy
 *
 * POST /api/ivy/upload-audio
 * Body: FormData com campo "file"
 * Response: { url: string, mimeType: string }
 */

import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

// Tipos de áudio permitidos
// Gemini suporta: WAV, MP3, AAC, OGG, FLAC
// Browser grava: WebM (Opus) ou MP4 (AAC no Safari)
const ALLOWED_TYPES = [
  // Suportados nativamente pelo Gemini
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg", // MP3
  "audio/mp3",
  "audio/aac",
  "audio/ogg",
  "audio/flac",
  // Formatos de browser (podem precisar conversão)
  "audio/webm",
  "audio/mp4",
  "audio/x-m4a",
];

// Tamanho máximo: 20MB (limite do Gemini para inline)
const MAX_SIZE = 20 * 1024 * 1024;

// Duração máxima recomendada: 5 minutos (para UX do chat)
// Não validamos aqui pois não temos acesso à duração facilmente

export async function POST(request: Request) {
  try {
    // Verifica autenticação
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse FormData
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Valida tipo
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Invalid audio type: ${file.type}. Allowed: ${ALLOWED_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Valida tamanho
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        {
          error: `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Max: 20MB`,
        },
        { status: 400 }
      );
    }

    // Determina extensão baseada no tipo
    const extensionMap: Record<string, string> = {
      "audio/wav": "wav",
      "audio/x-wav": "wav",
      "audio/mpeg": "mp3",
      "audio/mp3": "mp3",
      "audio/aac": "aac",
      "audio/ogg": "ogg",
      "audio/flac": "flac",
      "audio/webm": "webm",
      "audio/mp4": "m4a",
      "audio/x-m4a": "m4a",
    };
    const extension = extensionMap[file.type] || "audio";

    // Gera nome único para o arquivo
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const filename = `ivy-audio/${userId}/${timestamp}-${randomId}.${extension}`;

    // Upload para Vercel Blob
    const { url } = await put(filename, file, {
      access: "public",
      contentType: file.type,
    });

    return NextResponse.json({ url, mimeType: file.type });
  } catch (error) {
    console.error("Audio upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
