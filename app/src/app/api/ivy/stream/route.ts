/**
 * Ivy Stream API Route
 * Streaming de respostas da Ivy via Server-Sent Events (SSE)
 */

import { NextRequest, NextResponse } from "next/server";
import { createASTClient } from "~/server/lib/ast";
import { getThreadWithWorkflow, incrementMessageCount } from "~/server/lib/thread";
import { env } from "~/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/ivy/stream
 * Envia mensagem para a Ivy com streaming de resposta
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      threadId: string;
      message: string;
    };

    const { threadId, message } = body;

    // Validação básica
    if (!threadId || !message) {
      return NextResponse.json(
        { error: "Missing threadId or message" },
        { status: 400 }
      );
    }

    // Busca thread com workflow
    const threadWithWorkflow = await getThreadWithWorkflow(threadId);
    if (!threadWithWorkflow) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    if (threadWithWorkflow.status === "archived") {
      return NextResponse.json(
        { error: "Cannot send message to archived thread" },
        { status: 400 }
      );
    }

    const { workflow } = threadWithWorkflow;

    // Cria cliente AST
    const ast = createASTClient({
      baseUrl: env.AST_URL,
      apiKey: env.AST_API_KEY,
    });

    // Inicia streaming
    const stream = await ast.stream(workflow.providerId, {
      message,
      threadId: threadWithWorkflow.providerThreadId,
    });

    // Cria encoder para SSE
    const encoder = new TextEncoder();

    // Transform stream para SSE format
    const sseStream = new ReadableStream({
      async start(controller) {
        const reader = stream.getReader();

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              // Incrementa contador de mensagens
              await incrementMessageCount(threadId);
              await incrementMessageCount(threadId);

              // Envia [DONE]
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              break;
            }

            // Envia chunk como SSE
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(value)}\n\n`)
            );
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Stream error";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`)
          );
          controller.close();
        }
      },
    });

    // Retorna response com SSE headers
    return new Response(sseStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Stream error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
