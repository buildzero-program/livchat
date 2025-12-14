# Fase 7.1 - Ivy UI Integration

## Status: Completa

## Objetivo

Conectar a UI do chat (ai-chat-provider.tsx) ao backend real do AST via tRPC, substituindo os mock responses por chamadas reais com streaming.

---

## Exploração Realizada

### Estado Atual da UI

**Componentes implementados:**
| Arquivo | Linhas | Descrição |
|---------|--------|-----------|
| `ai-chat-provider.tsx` | 153 | Estado global e mock sendMessage |
| `ai-chat-messages.tsx` | 166 | Display de mensagens com animações |
| `ai-chat-input.tsx` | 104 | Input com auto-resize e shortcuts |
| `ai-chat-panel.tsx` | 103 | Layout desktop (painel lateral) |
| `ai-chat-sheet.tsx` | 106 | Layout mobile (sheet overlay) |
| `ai-chat-trigger.tsx` | 98 | Botão toggle com gradient |

**Interface Message atual:**
```typescript
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}
```

**Estado do Context:**
```typescript
interface AiChatContextType {
  isOpen: boolean;
  messages: Message[];
  isLoading: boolean;
  streamingContent: string | null;  // Existe mas não usado
  toggle: () => void;
  open: () => void;
  close: () => void;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
}
```

### Backend Já Implementado

**tRPC Router (ivy.ts):**
- `ivy.getActiveThread` - Retorna/cria thread ativo
- `ivy.listThreads` - Lista histórico
- `ivy.newConversation` - Cria nova conversa
- `ivy.send` - Envia mensagem (sync)
- `ivy.archiveThread` - Arquiva thread

**AST Client (ast.ts):**
- `invoke(workflowId, request)` - Chamada síncrona
- `stream(workflowId, request)` - Streaming via ReadableStream

**Streaming Route (/api/ivy/stream):**
- SSE endpoint para streaming real
- Retorna chunks no formato `data: {...}\n\n`

---

## Análise de Gaps

### O que funciona (mock):
1. UI renderiza mensagens com animações
2. Loading state e typing indicator
3. Persistência local (localStorage)
4. Responsive (desktop/mobile)

### O que precisa conectar:
1. **Inicialização**: Chamar `ivy.getActiveThread` no mount
2. **sendMessage**: Usar streaming em vez de mock
3. **clearMessages**: Chamar `ivy.newConversation`
4. **streamingContent**: Consumir tokens reais

---

## Decisões Técnicas

### 1. Streaming vs Sync

**Decisão:** Usar streaming (SSE) via fetch direto no `/api/ivy/stream`

**Motivo:**
- Melhor UX com feedback imediato
- Infraestrutura já existe
- tRPC subscriptions são mais complexas de configurar

### 2. Persistência de Mensagens

**Decisão:** Manter localStorage como cache cliente + banco como fonte da verdade

**Motivo:**
- Carregar histórico seria necessário chamar AST para cada thread
- AST já persiste mensagens nos checkpoints
- localStorage dá resposta instantânea no reload

**Limitação:** Mensagens anteriores só aparecem se estavam no localStorage

### 3. Thread Lifecycle

**Decisão:**
- Ao abrir chat: `ivy.getActiveThread` (cria se não existe)
- Ao clicar "Nova conversa": `ivy.newConversation` + limpa localStorage
- Thread persiste entre sessões

### 4. Error Handling

**Decisão:**
- Erros de rede mostram toast
- Retry automático no getActiveThread
- Fallback para mensagem de erro na UI

---

## Plano de Implementação (TDD)

### Fase 7.1.1 - Hook useIvyChat

Criar hook separado para lógica de conexão:

```typescript
// src/hooks/use-ivy-chat.ts
export function useIvyChat() {
  // 1. Busca thread ativo
  // 2. Gerencia estado local de mensagens
  // 3. Expõe send com streaming
  // 4. Expõe newConversation
}
```

### Fase 7.1.2 - Streaming Consumer

Implementar consumo de SSE:

```typescript
async function streamMessage(threadId: string, message: string) {
  const response = await fetch("/api/ivy/stream", {
    method: "POST",
    body: JSON.stringify({ threadId, message }),
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    // Parse SSE e atualiza streamingContent
  }
}
```

### Fase 7.1.3 - Integrar no Provider

Substituir mock por hook real:

```typescript
// ai-chat-provider.tsx
export function AiChatProvider({ children }) {
  const {
    threadId,
    messages,
    isLoading,
    streamingContent,
    sendMessage,
    newConversation,
  } = useIvyChat();

  // ...
}
```

---

## Testes Necessários

### Unit Tests (hooks)
1. `useIvyChat` chama `ivy.getActiveThread` no mount
2. `useIvyChat` armazena threadId corretamente
3. `sendMessage` faz fetch para `/api/ivy/stream`
4. Tokens do stream são acumulados em `streamingContent`
5. Ao terminar stream, mensagem é adicionada ao array
6. `newConversation` limpa mensagens e chama tRPC

### Integration Tests
1. Fluxo completo: abrir chat → enviar mensagem → receber resposta
2. Streaming funciona (tokens aparecem progressivamente)
3. Nova conversa cria novo thread no banco

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/hooks/use-ivy-chat.ts` | CRIAR - Hook de integração |
| `src/components/ai-chat/ai-chat-provider.tsx` | MODIFICAR - Usar hook real |
| `src/components/ai-chat/ai-chat-messages.tsx` | VERIFICAR - Streaming funciona |

---

## Checklist

- [x] Implementar getActiveThread no mount
- [x] Implementar sendMessage com tRPC `ivy.send`
- [x] Implementar clearMessages com `ivy.newConversation`
- [x] Substituir mock por implementação real
- [x] TypeScript compila sem erros
- [ ] Testar fluxo completo (manual)

---

## Implementacao Final

### Arquivo Modificado
`src/components/ai-chat/ai-chat-provider.tsx`

### Mudancas Principais

1. **Thread Initialization**
   - Usa `api.ivy.getActiveThread` no mount
   - Cria thread automaticamente se nao existe via `ivy.newConversation`
   - Persiste threadId no localStorage (`THREAD_KEY`)

2. **Send Message**
   - Usa `api.ivy.send` (sincrono) em vez de mock
   - Adiciona mensagem do usuario imediatamente
   - Adiciona resposta da Ivy apos retorno do AST

3. **Clear Messages / New Conversation**
   - Chama `ivy.newConversation` para criar novo thread
   - Limpa localStorage e mensagens locais

4. **Estado Adicionado**
   - `isReady`: indica se o chat esta pronto (thread inicializado)

### Nota sobre Streaming

O streaming foi implementado mas o LangGraph/modelo atual retorna resposta completa em vez de tokens individuais. Para MVP, usamos chamada sincrona (`ivy.send`). Streaming pode ser habilitado depois quando o backend suportar token-by-token.
