/**
 * PartyKit Server para streaming de chat da Ivy
 *
 * Converte SSE do AST em WebSocket para streaming em tempo real.
 *
 * Room ID format: ivy_{threadId}
 */

import type * as Party from "partykit/server";
import type {
  ClientMessage,
  ServerMessage,
  ChatMessage,
  RoomState,
} from "./types";

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export default class IvyChatServer implements Party.Server {
  state: RoomState = {
    messages: [],
    threadId: null,
    isStreaming: false,
  };

  constructor(public room: Party.Room) {
    // Extrai threadId do room.id (formato: ivy_{threadId})
    const parts = room.id.split("_");
    if (parts.length >= 2) {
      this.state.threadId = parts.slice(1).join("_");
    }
  }

  // ===========================================================================
  // LIFECYCLE
  // ===========================================================================

  onConnect(conn: Party.Connection) {
    // Envia histórico ao conectar
    this.send(conn, {
      type: "history",
      messages: this.state.messages,
    });

    // Notifica se está streamando
    if (this.state.isStreaming) {
      this.send(conn, {
        type: "streaming",
        isStreaming: true,
      });
    }
  }

  async onMessage(message: string, sender: Party.Connection) {
    try {
      const data = JSON.parse(message) as ClientMessage;

      switch (data.type) {
        case "message":
          await this.handleUserMessage(data.content, data.images, data.audio);
          break;

        case "history":
          this.send(sender, {
            type: "history",
            messages: this.state.messages,
          });
          break;

        case "clear":
          this.state.messages = [];
          this.broadcast({ type: "history", messages: [] });
          break;
      }
    } catch (error) {
      console.error("Error handling message:", error);
      this.send(sender, {
        type: "error",
        message: "Invalid message format",
      });
    }
  }

  // ===========================================================================
  // MESSAGE HANDLING
  // ===========================================================================

  private async handleUserMessage(content: string, images?: string[], audio?: string) {
    // Previne mensagens concorrentes
    if (this.state.isStreaming) {
      return;
    }

    // Gera threadId se não existe (fallback)
    if (!this.state.threadId) {
      this.state.threadId = generateId();
    }

    // Adiciona mensagem do usuário
    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content,
      timestamp: new Date().toISOString(),
      images,
      audio,
    };
    this.state.messages.push(userMessage);

    // Broadcast mensagem do usuário (inclui imagens e áudio)
    this.broadcast({
      type: "message",
      ...userMessage,
    });

    // Inicia streaming
    this.state.isStreaming = true;
    this.broadcast({ type: "streaming", isStreaming: true });

    try {
      await this.streamFromAST(content, images, audio);
    } catch (error) {
      console.error("AST streaming error:", error);
      this.broadcast({
        type: "error",
        message:
          error instanceof Error ? error.message : "Erro ao processar mensagem",
      });
    } finally {
      this.state.isStreaming = false;
      this.broadcast({ type: "streaming", isStreaming: false });
    }
  }

  // ===========================================================================
  // AST STREAMING
  // ===========================================================================

  private async streamFromAST(message: string, images?: string[], audio?: string) {
    const astUrl = this.room.env.AST_URL as string;
    const astKey = this.room.env.AST_API_KEY as string | undefined;

    if (!astUrl) {
      throw new Error("AST_URL not configured");
    }

    // Constrói payload - se tem mídia, envia como array multimodal
    let payload: { message: string | object[]; threadId: string | null };

    const hasImages = images && images.length > 0;
    const hasAudio = !!audio;

    if (hasImages || hasAudio) {
      const multimodalContent: object[] = [];

      // Adiciona imagens (como URL)
      if (hasImages) {
        for (const url of images) {
          multimodalContent.push({
            type: "image_url",
            image_url: { url },
          });
        }
      }

      // Adiciona áudio (precisa converter para base64)
      if (hasAudio) {
        try {
          const audioData = await this.fetchAudioAsBase64(audio);
          if (audioData) {
            multimodalContent.push({
              type: "media",
              data: audioData.base64,
              mime_type: audioData.mimeType,
            });
          }
        } catch (error) {
          console.error("Failed to fetch audio:", error);
          // Continua sem o áudio se falhar
        }
      }

      // Adiciona texto por último
      if (message) {
        multimodalContent.push({ type: "text", text: message });
      } else {
        // Se não tem texto, adiciona instrução padrão
        multimodalContent.push({ type: "text", text: "Processe este conteúdo." });
      }

      payload = {
        message: multimodalContent,
        threadId: this.state.threadId,
      };
    } else {
      payload = {
        message,
        threadId: this.state.threadId,
      };
    }

    // Faz request para o AST stream
    const response = await fetch(`${astUrl}/workflows/wf_ivy/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(astKey && { Authorization: `Bearer ${astKey}` }),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`AST error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body from AST");
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let fullContent = "";
    const messageId = generateId();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Acumula no buffer
        buffer += decoder.decode(value, { stream: true });

        // Processa linhas completas
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Mantém linha incompleta no buffer

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const event = JSON.parse(data) as {
              type: string;
              content?: string;
              data?: string;
              threadId?: string;
            };

            // Token de streaming (se AST suportar)
            if (event.type === "token" && event.content) {
              fullContent += event.content;
              this.broadcast({
                type: "token",
                content: event.content,
              });
            }

            // Update event - contém a mensagem completa
            if (event.type === "update" && event.data) {
              // Extrai content do AIMessage usando regex
              // Formato: AIMessage(content='...', ...)
              const contentMatch = event.data.match(
                /AIMessage\(content='([\s\S]*?)'(?:,|\))/
              );
              if (contentMatch?.[1]) {
                fullContent = contentMatch[1]
                  // Unescape caracteres Python
                  .replace(/\\n/g, "\n")
                  .replace(/\\'/g, "'")
                  .replace(/\\"/g, '"');
              }
            }

            // Done event - atualiza threadId
            if (event.type === "done" && event.threadId) {
              this.state.threadId = event.threadId;
            }
          } catch {
            // Skip JSON inválido
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Adiciona mensagem final
    const assistantMessage: ChatMessage = {
      id: messageId,
      role: "assistant",
      content: fullContent,
      timestamp: new Date().toISOString(),
    };
    this.state.messages.push(assistantMessage);

    // Broadcast mensagem completa
    this.broadcast({
      type: "done",
      messageId,
      fullContent,
    });
  }

  // ===========================================================================
  // AUDIO PROCESSING
  // ===========================================================================

  /**
   * Fetch audio from URL and convert to base64.
   * Returns { base64, mimeType } or null if failed.
   */
  private async fetchAudioAsBase64(
    url: string
  ): Promise<{ base64: string; mimeType: string } | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Failed to fetch audio: ${response.status}`);
        return null;
      }

      const contentType = response.headers.get("content-type") || "audio/webm";
      const arrayBuffer = await response.arrayBuffer();

      // Convert to base64
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      // Map content type to Gemini-compatible mime type
      // Gemini suporta: audio/wav, audio/mpeg, audio/aac, audio/ogg, audio/flac
      // NÃO suporta: audio/webm
      let mimeType = contentType.split(";")[0]; // Remove codecs suffix

      // Log para debug
      console.log(`Audio fetched: ${url}, type: ${mimeType}, size: ${bytes.length} bytes`);

      return { base64, mimeType };
    } catch (error) {
      console.error("Error fetching audio:", error);
      return null;
    }
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private send(conn: Party.Connection, message: ServerMessage) {
    conn.send(JSON.stringify(message));
  }

  private broadcast(message: ServerMessage) {
    this.room.broadcast(JSON.stringify(message));
  }
}
