# Fase 8.1 - PartyKit Real-Time Streaming

## Status: ✅ Implementado

## Objetivo

Implementar streaming de tokens em tempo real para o chat da Ivy usando PartyKit, substituindo as chamadas síncronas atuais por WebSocket com feedback instantâneo.

---

## Contexto

### Situação Atual
- Chat usa `ivy.send` (tRPC mutation) - síncrono
- Usuário espera 5-15s sem feedback visual
- `streamingContent` existe no provider mas não é usado

### Solução Proposta
- PartyKit como bridge entre cliente e AST
- WebSocket para comunicação em tempo real
- SSE do AST convertido para WebSocket events
- Tokens exibidos conforme chegam

---

## Arquitetura

```
┌─────────────────┐     WebSocket      ┌─────────────────┐
│                 │  (partysocket)     │                 │
│  React Client   │◄──────────────────►│  PartyKit       │
│  (useIvyChat)   │                    │  Server         │
│                 │                    │  (ivy-chat.ts)  │
└─────────────────┘                    └────────┬────────┘
                                                │
                                                │ SSE (fetch)
                                                ▼
                                       ┌─────────────────┐
                                       │                 │
                                       │  AST            │
                                       │  /stream        │
                                       │                 │
                                       └─────────────────┘
```

### Fluxo de Mensagens

1. **Cliente → PartyKit**: `{ type: "message", content: "Oi" }`
2. **PartyKit → AST**: `POST /workflows/wf_ivy/stream` (SSE)
3. **AST → PartyKit**: `data: {"type": "token", "content": "Olá"}\n\n`
4. **PartyKit → Cliente**: `{ type: "token", content: "Olá" }`
5. **Final**: `{ type: "done", messageId: "...", fullContent: "..." }`

---

## Estrutura de Arquivos

```
livchat/app/
├── partykit/
│   ├── partykit.json       # Configuração PartyKit
│   ├── package.json        # Dependências
│   ├── tsconfig.json       # TypeScript config
│   └── src/
│       ├── ivy-chat.ts     # Servidor principal
│       └── types.ts        # Tipos compartilhados
├── src/
│   ├── lib/
│   │   └── partykit/
│   │       └── ivy-client.ts   # Cliente PartyKit
│   └── hooks/
│       └── use-ivy-chat.ts     # Hook React
```

---

## Implementação Detalhada

### 1. Configuração PartyKit

**partykit/partykit.json**
```json
{
  "$schema": "https://www.partykit.io/schema.json",
  "name": "livchat-ivy",
  "main": "src/ivy-chat.ts",
  "compatibilityDate": "2024-01-01",
  "vars": {
    "AST_URL": { "env": "AST_URL" },
    "AST_API_KEY": { "env": "AST_API_KEY" }
  }
}
```

### 2. Tipos Compartilhados

**partykit/src/types.ts**
```typescript
// Cliente → Servidor
export type ClientMessage =
  | { type: "message"; content: string }
  | { type: "history" }
  | { type: "clear" };

// Servidor → Cliente
export type ServerMessage =
  | { type: "message"; id: string; role: "user" | "assistant"; content: string; timestamp: string }
  | { type: "token"; content: string }
  | { type: "done"; messageId: string; fullContent: string }
  | { type: "error"; message: string }
  | { type: "history"; messages: ChatMessage[] }
  | { type: "streaming"; isStreaming: boolean };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}
```

### 3. Servidor PartyKit

**partykit/src/ivy-chat.ts**
```typescript
import type * as Party from "partykit/server";
import { randomUUID } from "crypto";
import type { ClientMessage, ServerMessage, ChatMessage } from "./types";

interface RoomState {
  messages: ChatMessage[];
  threadId: string | null;
  isStreaming: boolean;
}

export default class IvyChatServer implements Party.Server {
  state: RoomState = {
    messages: [],
    threadId: null,
    isStreaming: false,
  };

  constructor(public room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    // Envia histórico ao conectar
    this.send(conn, {
      type: "history",
      messages: this.state.messages,
    });
  }

  async onMessage(message: string, sender: Party.Connection) {
    const data = JSON.parse(message) as ClientMessage;

    switch (data.type) {
      case "message":
        await this.handleUserMessage(data.content, sender);
        break;
      case "clear":
        this.state.messages = [];
        this.state.threadId = null;
        this.broadcast({ type: "history", messages: [] });
        break;
    }
  }

  private async handleUserMessage(content: string, sender: Party.Connection) {
    if (this.state.isStreaming) return;

    // Gera thread ID se não existe
    if (!this.state.threadId) {
      this.state.threadId = randomUUID();
    }

    // Adiciona mensagem do usuário
    const userMessage: ChatMessage = {
      id: randomUUID(),
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };
    this.state.messages.push(userMessage);
    this.broadcast({ type: "message", ...userMessage });

    // Inicia streaming
    this.state.isStreaming = true;
    this.broadcast({ type: "streaming", isStreaming: true });

    try {
      await this.streamFromAST(content);
    } catch (error) {
      this.broadcast({
        type: "error",
        message: error instanceof Error ? error.message : "Erro ao processar",
      });
    } finally {
      this.state.isStreaming = false;
      this.broadcast({ type: "streaming", isStreaming: false });
    }
  }

  private async streamFromAST(message: string) {
    const astUrl = this.room.env.AST_URL as string;
    const astKey = this.room.env.AST_API_KEY as string;

    const response = await fetch(`${astUrl}/workflows/wf_ivy/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(astKey && { Authorization: `Bearer ${astKey}` }),
      },
      body: JSON.stringify({
        message,
        threadId: this.state.threadId,
      }),
    });

    if (!response.ok) {
      throw new Error(`AST error: ${response.status}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullContent = "";
    const messageId = randomUUID();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;

        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;

        try {
          const event = JSON.parse(data);

          if (event.type === "token" && event.content) {
            fullContent += event.content;
            this.broadcast({ type: "token", content: event.content });
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }

    // Adiciona mensagem final
    const assistantMessage: ChatMessage = {
      id: messageId,
      role: "assistant",
      content: fullContent,
      timestamp: new Date().toISOString(),
    };
    this.state.messages.push(assistantMessage);

    this.broadcast({
      type: "done",
      messageId,
      fullContent,
    });
  }

  private send(conn: Party.Connection, message: ServerMessage) {
    conn.send(JSON.stringify(message));
  }

  private broadcast(message: ServerMessage) {
    this.room.broadcast(JSON.stringify(message));
  }
}
```

### 4. Cliente PartyKit

**src/lib/partykit/ivy-client.ts**
```typescript
import PartySocket from "partysocket";
import type { ClientMessage, ServerMessage, ChatMessage } from "@/partykit/src/types";

export interface IvyClientOptions {
  threadId: string;
  onMessage?: (message: ChatMessage) => void;
  onToken?: (token: string) => void;
  onDone?: (messageId: string, fullContent: string) => void;
  onError?: (error: string) => void;
  onHistory?: (messages: ChatMessage[]) => void;
  onStreamingChange?: (isStreaming: boolean) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export class IvyClient {
  private socket: PartySocket | null = null;
  private options: IvyClientOptions;

  constructor(options: IvyClientOptions) {
    this.options = options;
  }

  connect() {
    const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST || "localhost:1999";

    this.socket = new PartySocket({
      host,
      room: `ivy_${this.options.threadId}`,
    });

    this.socket.addEventListener("open", () => {
      this.options.onConnectionChange?.(true);
    });

    this.socket.addEventListener("close", () => {
      this.options.onConnectionChange?.(false);
    });

    this.socket.addEventListener("message", (event) => {
      this.handleMessage(event.data as string);
    });
  }

  disconnect() {
    this.socket?.close();
    this.socket = null;
  }

  sendMessage(content: string) {
    this.send({ type: "message", content });
  }

  clearMessages() {
    this.send({ type: "clear" });
  }

  private send(message: ClientMessage) {
    this.socket?.send(JSON.stringify(message));
  }

  private handleMessage(data: string) {
    const message = JSON.parse(data) as ServerMessage;

    switch (message.type) {
      case "message":
        this.options.onMessage?.({
          id: message.id,
          role: message.role,
          content: message.content,
          timestamp: message.timestamp,
        });
        break;
      case "token":
        this.options.onToken?.(message.content);
        break;
      case "done":
        this.options.onDone?.(message.messageId, message.fullContent);
        break;
      case "error":
        this.options.onError?.(message.message);
        break;
      case "history":
        this.options.onHistory?.(message.messages);
        break;
      case "streaming":
        this.options.onStreamingChange?.(message.isStreaming);
        break;
    }
  }
}
```

### 5. Hook React

**src/hooks/use-ivy-chat.ts**
```typescript
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { IvyClient, type ChatMessage } from "@/lib/partykit/ivy-client";

interface UseIvyChatOptions {
  threadId: string | null;
  enabled?: boolean;
}

interface UseIvyChatReturn {
  messages: ChatMessage[];
  isStreaming: boolean;
  isConnected: boolean;
  streamingContent: string;
  error: string | null;
  sendMessage: (content: string) => void;
  clearMessages: () => void;
}

export function useIvyChat({
  threadId,
  enabled = true,
}: UseIvyChatOptions): UseIvyChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<IvyClient | null>(null);
  const streamingContentRef = useRef("");

  useEffect(() => {
    if (!enabled || !threadId) return;

    const client = new IvyClient({
      threadId,
      onMessage: (msg) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      },
      onToken: (token) => {
        streamingContentRef.current += token;
        setStreamingContent(streamingContentRef.current);
      },
      onDone: (messageId, fullContent) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === messageId)) return prev;
          return [
            ...prev,
            {
              id: messageId,
              role: "assistant",
              content: fullContent,
              timestamp: new Date().toISOString(),
            },
          ];
        });
        streamingContentRef.current = "";
        setStreamingContent("");
      },
      onError: (err) => setError(err),
      onHistory: (history) => setMessages(history),
      onStreamingChange: (streaming) => {
        setIsStreaming(streaming);
        if (streaming) {
          streamingContentRef.current = "";
          setStreamingContent("");
        }
      },
      onConnectionChange: setIsConnected,
    });

    clientRef.current = client;
    client.connect();

    return () => {
      client.disconnect();
      clientRef.current = null;
    };
  }, [threadId, enabled]);

  const sendMessage = useCallback((content: string) => {
    clientRef.current?.sendMessage(content);
  }, []);

  const clearMessages = useCallback(() => {
    clientRef.current?.clearMessages();
    setMessages([]);
  }, []);

  return {
    messages,
    isStreaming,
    isConnected,
    streamingContent,
    error,
    sendMessage,
    clearMessages,
  };
}
```

---

## Checklist de Implementação

### Fase 8.1.1 - Setup PartyKit
- [x] Criar estrutura `partykit/`
- [x] Configurar `partykit.json`
- [x] Configurar `package.json` com dependências
- [x] Configurar `tsconfig.json`
- [x] Adicionar scripts npm (`bun partykit`)

### Fase 8.1.2 - Servidor PartyKit
- [x] Implementar `ivy-chat.ts`
- [x] Implementar `types.ts`
- [x] Testar conexão WebSocket
- [ ] Testar streaming do AST (pendente - requer AST rodando)

### Fase 8.1.3 - Cliente React
- [x] Implementar `ivy-client.ts`
- [x] Implementar `use-ivy-chat.ts`
- [x] Integrar no `ai-chat-provider.tsx`
- [ ] Testar streaming no UI (pendente - requer AST rodando)

### Fase 8.1.4 - Ambiente
- [x] Adicionar `NEXT_PUBLIC_PARTYKIT_HOST` ao .env
- [x] Configurar AST_URL/AST_API_KEY para PartyKit
- [x] Testar em dev local (PartyKit server OK)
- [ ] Documentar deploy (Cloudflare Workers)

---

## Variáveis de Ambiente

**.env.local (adicionar)**
```bash
# PartyKit (local dev)
NEXT_PUBLIC_PARTYKIT_HOST="localhost:1999"
```

**partykit/.env (criar)**
```bash
AST_URL="http://localhost:9000"
AST_API_KEY="ast_f4ba1aaff667c5ac1d5b4df3c7d5d59e458d632122fa67ce53ffe6e954fad006"
```

---

## Comandos de Desenvolvimento

```bash
# Instalar dependências do PartyKit
cd partykit && npm install

# Dev PartyKit (porta 1999)
npm run dev:partykit

# Dev Next.js + PartyKit juntos
npm run dev:all

# Ou em terminais separados:
# Terminal 1: cd app && bun dev
# Terminal 2: cd app/partykit && npx partykit dev
```

---

## Notas Técnicas

### Room ID Strategy
- Formato: `ivy_{threadId}`
- Thread ID vem do banco LivChat
- Permite múltiplas conversas simultâneas

### Token Buffering
- SSE pode enviar chunks incompletos
- Buffer acumula até `\n` completo
- Parse JSON apenas de linhas completas

### Error Recovery
- Reconexão automática do PartySocket
- Histórico recuperado do estado do room
- Thread ID persistido no banco

### Performance
- Ref para acumular tokens (evita re-render por token)
- State atualizado com conteúdo acumulado
- Duplicate detection em mensagens
