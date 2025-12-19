# Plan-15.1: MVP Multimodal - Suporte a Imagens

**Data:** 2024-12-18
**Status:** ✅ Concluído
**Concluído em:** 2024-12-19
**Dependências:** Plan-11 (Workflows), Plan-15 (Arquitetura)
**Escopo:** Apenas imagens (sem PDF, sem resize/tiling)

## Objetivo

Implementar suporte básico a upload de imagens no chat da Ivy, seguindo a arquitetura definida no Plan-15 mas sem as complexidades de processamento (resize, tiling, PDF).

## Descobertas da Exploração

### Arquitetura Atual do Chat

```
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React)                            │
│                                                                  │
│  AiChatInput ──→ useAiChat ──→ IvyClient (WebSocket)            │
│       │                              │                           │
│       ▼                              ▼                           │
│  AiChatMessages ←── streaming ←── PartyKit Server               │
└─────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PARTYKIT SERVER                             │
│                                                                  │
│  ivy-chat.ts ──→ fetch AST ──→ SSE streaming                    │
└─────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AST BACKEND (Python)                        │
│                                                                  │
│  workflow_router.py ──→ workflow_agent.py ──→ LLM               │
└─────────────────────────────────────────────────────────────────┘
```

### Recursos Disponíveis

| Recurso | Status | Local |
|---------|--------|-------|
| Vercel Blob | ✅ Configurado | `src/server/lib/blob-storage.ts` |
| shadcn/ui Input | ✅ Disponível | `src/components/ui/input.tsx` |
| lucide-react Icons | ✅ Disponível | Image, Paperclip, X |
| PartyKit WebSocket | ✅ Funcionando | `partykit/src/ivy-chat.ts` |

### Arquivos Principais

| Arquivo | Propósito |
|---------|-----------|
| `src/components/ai-chat/ai-chat-input.tsx` | Input de mensagem |
| `src/components/ai-chat/ai-chat-messages.tsx` | Lista de mensagens |
| `src/components/ai-chat/ai-chat-provider.tsx` | Context e estado |
| `partykit/src/types.ts` | Tipos compartilhados |
| `partykit/src/ivy-chat.ts` | Server WebSocket |
| `src/lib/partykit/ivy-client.ts` | Client WebSocket |

---

## Fases de Implementação

### Fase 1: Frontend (LivChat App)

#### 1.1 Tipos de Mensagem
**Arquivo:** `partykit/src/types.ts`

```typescript
// ANTES
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

// DEPOIS
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  images?: string[];  // URLs do Vercel Blob
}

// ANTES
type ClientMessage =
  | { type: "message"; content: string }
  | { type: "history" }
  | { type: "clear" };

// DEPOIS
type ClientMessage =
  | { type: "message"; content: string; images?: string[] }
  | { type: "history" }
  | { type: "clear" };
```

#### 1.2 Upload de Imagens
**Arquivo:** `src/app/api/ivy/upload/route.ts` (NOVO)

```typescript
// POST /api/ivy/upload
// Body: FormData with file
// Response: { url: string }
```

#### 1.3 Input com Imagem
**Arquivo:** `src/components/ai-chat/ai-chat-input.tsx`

Adicionar:
- Botão de anexar imagem (ícone Image ou Paperclip)
- Input file hidden (accept="image/*")
- Preview da imagem selecionada
- Botão de remover imagem (ícone X)
- Upload ao enviar mensagem

#### 1.4 Renderização de Imagens
**Arquivo:** `src/components/ai-chat/ai-chat-messages.tsx`

Adicionar:
- Renderização de imagens nas mensagens do usuário
- Loading state para imagens
- Click para expandir (opcional)

#### 1.5 PartyKit Server
**Arquivo:** `partykit/src/ivy-chat.ts`

Atualizar:
- Receber `images` no payload
- Enviar para AST no formato correto

---

### Fase 2: Backend (AST)

#### 2.1 Schema Multimodal
**Arquivo:** `src/schema/schema.py`

```python
# Novos tipos
class TextContent(BaseModel):
    type: Literal["text"] = "text"
    text: str

class ImageContent(BaseModel):
    type: Literal["image_url"] = "image_url"
    image_url: dict  # {"url": "https://..."}

ContentItem = TextContent | ImageContent

# Modificar UserInput
class UserInput(BaseModel):
    message: str | list[ContentItem]  # Aceita texto ou lista multimodal
```

#### 2.2 Workflow Router
**Arquivo:** `src/service/workflow_router.py`

Atualizar:
- Aceitar `images` no input
- Converter para formato LangChain

#### 2.3 Message Builder
**Arquivo:** `src/agents/workflow_agent.py`

```python
def build_human_message(content: str | list[ContentItem]) -> HumanMessage:
    """Converte input para HumanMessage multimodal."""
    if isinstance(content, str):
        return HumanMessage(content=content)

    # Lista multimodal
    parts = []
    for item in content:
        if item["type"] == "text":
            parts.append({"type": "text", "text": item["text"]})
        elif item["type"] == "image_url":
            parts.append({
                "type": "image_url",
                "image_url": {"url": item["image_url"]["url"]}
            })
    return HumanMessage(content=parts)
```

---

## Testes TDD

### Frontend (Vitest)

```typescript
// tests/ai-chat-input.test.tsx
describe("AiChatInput", () => {
  it("should show image button")
  it("should open file picker on button click")
  it("should show preview when image selected")
  it("should remove image on X click")
  it("should upload image before sending message")
  it("should clear preview after send")
})

// tests/ai-chat-messages.test.tsx
describe("AiChatMessages", () => {
  it("should render text-only messages")
  it("should render messages with images")
  it("should show loading state for images")
})
```

### Backend (Pytest)

```python
# tests/schema/test_multimodal.py
def test_text_content_schema()
def test_image_content_schema()
def test_user_input_accepts_string()
def test_user_input_accepts_content_list()

# tests/agents/test_multimodal.py
def test_build_human_message_text_only()
def test_build_human_message_with_images()
def test_build_human_message_mixed_content()
```

---

## Fluxo Final

```
1. Usuário seleciona imagem
   └─→ Preview aparece acima do input

2. Usuário escreve texto e clica enviar
   └─→ Upload imagem para Vercel Blob
   └─→ Recebe URL do blob

3. Mensagem enviada via WebSocket
   └─→ { type: "message", content: "texto", images: ["https://blob..."] }

4. PartyKit recebe e formata para AST
   └─→ POST /workflows/wf_ivy/stream
   └─→ Body: { message: [{ type: "text", ... }, { type: "image_url", ... }] }

5. AST processa com modelo multimodal
   └─→ build_human_message() cria HumanMessage multimodal
   └─→ Gemini/GPT-4o processa imagem + texto

6. Resposta streamed de volta
   └─→ SSE → PartyKit → WebSocket → React state
```

---

## Limitações do MVP

| Feature | Status | Motivo |
|---------|--------|--------|
| Múltiplas imagens | ❌ | Simplificar MVP |
| PDF | ❌ | Requer PyMuPDF |
| Resize automático | ❌ | Imagens < 20MB passam direto |
| Tiling | ❌ | Imagens < 4096px passam direto |
| Drag & drop | ❌ | Simplificar MVP |
| Paste de clipboard | ❌ | Simplificar MVP |

---

## Checklist

### Fase 1 - Frontend
- [x] 1.1 Atualizar tipos em `partykit/src/types.ts`
- [x] 1.2 Criar `/api/ivy/upload` route
- [x] 1.3 Adicionar UI de upload em `ai-chat-input.tsx`
- [x] 1.4 Renderizar imagens em `ai-chat-messages.tsx`
- [x] 1.5 Atualizar `ivy-chat.ts` no PartyKit

### Fase 2 - Backend
- [x] 2.1 Atualizar `workflow_schema.py` para aceitar `str | list[dict]`
- [x] 2.2 Atualizado automaticamente (LangChain HumanMessage já aceita multimodal)
- [x] 2.3 Não necessário - `HumanMessage(content=...)` já funciona com lista

### Testes
- [ ] Testes frontend (Vitest)
- [x] Testes backend (Pytest) - 3 testes multimodal adicionados
- [x] Teste E2E manual

---

## Notas de Implementação

### O que foi feito diferente do planejado

1. **Sem `build_human_message()`**: LangChain já aceita `HumanMessage(content=[...])` nativamente. O `workflow_router.py` já passava `content=input_data.message` direto.

2. **UI seguindo padrão de mercado**: Refatoramos `ai-chat-input.tsx` para seguir o padrão ChatGPT/Claude com container unificado (`rounded-2xl`, `shadow-sm`, botões internos).

3. **Schema simplificado**: Em vez de criar `TextContent`, `ImageContent`, etc., usamos `str | list[dict[str, Any]]` com validação customizada.

### Arquivos modificados

| Arquivo | Modificação |
|---------|-------------|
| `partykit/src/types.ts` | Adicionado `images?: string[]` |
| `src/app/api/ivy/upload/route.ts` | **NOVO** - Upload para Vercel Blob |
| `src/components/ai-chat/ai-chat-input.tsx` | UI completa com upload |
| `src/components/ai-chat/ai-chat-messages.tsx` | Renderização de imagens |
| `partykit/src/ivy-chat.ts` | Formata multimodal para AST |
| `ast/src/schema/workflow_schema.py` | `message: str \| list[dict]` |
| `ast/tests/workflows/test_workflow_schema.py` | +3 testes multimodal |

---

## Próximos Passos (Plan 15.2+)

### Áudio (Gemini 2.0+ suporta nativamente)

O Gemini aceita áudio diretamente via LangChain:

```python
message = HumanMessage(content=[
    {"type": "text", "text": "Transcreva este áudio."},
    {"type": "media", "data": base64_audio, "mime_type": "audio/mpeg"}
])
```

**Nota:** Usa `type: "media"` em vez de `type: "image_url"`.

### PDF → Imagens

Para o caso Arte x Arte (ANVISA), precisamos:
- PyMuPDF para render PDF → imagens (150 DPI)
- Tiling se página > 4096px

### Resize/Compression

Só necessário se:
- Imagem > 20MB (rejeitar ou comprimir)
- Dimensão > 4096px (tiling)

---

## Referências

- [Plan-15 Arquitetura Completa](./plan-15-multimodal-files.md)
- [LangChain Multimodal](https://python.langchain.com/docs/how_to/multimodal_inputs/)
- [Vercel Blob Docs](https://vercel.com/docs/storage/vercel-blob)
- [Gemini Audio Support](https://www.philschmid.de/gemini-langchain-cheatsheet)
- [Build Multimodal Agents - Google Cloud](https://cloud.google.com/blog/products/ai-machine-learning/build-multimodal-agents-using-gemini-langchain-and-langgraph)
