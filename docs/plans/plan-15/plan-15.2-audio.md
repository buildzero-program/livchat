# Plan-15.2: Suporte a Áudio no Chat

**Data:** 2024-12-19
**Status:** ✅ Concluído
**Concluído em:** 2024-12-19
**Dependências:** Plan-15.1 (Multimodal Images)
**Escopo:** Gravação e envio de áudio no chat da Ivy

## Objetivo

Adicionar suporte para gravação e envio de mensagens de áudio no chat da Ivy, seguindo o mesmo padrão do Plan 15.1 (imagens).

---

## Descobertas da Pesquisa

### Gemini Audio Support

| Formato | Suportado | MIME Type |
|---------|-----------|-----------|
| WAV | ✅ | audio/wav |
| MP3 | ✅ | audio/mpeg |
| AAC | ✅ | audio/aac |
| OGG | ✅ | audio/ogg |
| FLAC | ✅ | audio/flac |
| **WebM** | ❌ | audio/webm |

**Limites:**
- Tamanho inline: **20 MB** max
- Duração: até **9.5 horas**
- Tokens: **32 tokens/segundo** (~1,920 tokens/minuto)

### LangChain Format

```python
from langchain_core.messages import HumanMessage

message = HumanMessage(content=[
    {"type": "text", "text": "Transcreva este áudio."},
    {"type": "media", "data": base64_audio, "mime_type": "audio/mpeg"}
])
```

**Diferença de imagens:**
- Imagens usam `{"type": "image_url", "image_url": {"url": "..."}}`
- Áudio usa `{"type": "media", "data": base64, "mime_type": "audio/..."}`

### MediaRecorder API (Browser)

O browser grava por padrão em `audio/webm` (Opus codec), que **não é suportado pelo Gemini**.

**Soluções:**
1. Gravar como WAV (suportado, mas arquivos maiores)
2. Gravar como WebM e converter server-side (requer ffmpeg)
3. Usar library client-side para MP3 (ex: lamejs)

**Decisão MVP:** Gravar como WAV (simplicidade > otimização)

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React)                           │
│                                                                  │
│  [🎤 Mic Button] → MediaRecorder (WAV) → Upload Blob → URL     │
│       │                                                         │
│       ▼                                                         │
│  AiChatInput ──→ sendMessage({ audio: url }) ──→ WebSocket     │
└─────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PARTYKIT SERVER                             │
│                                                                  │
│  Recebe audio URL → Fetch audio → Base64 encode                 │
│  → Envia para AST como { type: "media", data: base64, ... }    │
└─────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AST BACKEND (Python)                        │
│                                                                  │
│  Recebe multimodal → HumanMessage(content=[...]) → Gemini      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Fases de Implementação

### Fase 1: Frontend

#### 1.1 Tipos de Mensagem
**Arquivo:** `partykit/src/types.ts`

```typescript
// Adicionar audio ao ChatMessage
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  images?: string[];
  audio?: string;  // URL do áudio
}

// Adicionar audio ao ClientMessage
type ClientMessage =
  | { type: "message"; content: string; images?: string[]; audio?: string }
  | { type: "history" }
  | { type: "clear" };
```

#### 1.2 Hook de Gravação
**Arquivo:** `src/hooks/use-audio-recorder.ts` (NOVO)

```typescript
interface UseAudioRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;        // segundos
  audioBlob: Blob | null;
  audioUrl: string | null; // para preview
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  cancelRecording: () => void;
}
```

Usar `MediaRecorder` nativo com `mimeType: 'audio/wav'` ou fallback.

#### 1.3 UI de Gravação
**Arquivo:** `src/components/ai-chat/ai-chat-input.tsx`

Adicionar ao input:
- Botão de microfone (ícone `Mic`)
- Quando gravando: mostrar duração + botões (pause, stop, cancel)
- Após gravar: preview com player + botão enviar/cancelar
- Animação de "gravando" (pulse)

**Estados:**
```
idle → recording → stopped (preview) → idle
                 ↓
              cancelled → idle
```

#### 1.4 API de Upload
**Arquivo:** `src/app/api/ivy/upload-audio/route.ts` (NOVO)

Similar ao upload de imagens:
- Aceitar: WAV, MP3, OGG, AAC, FLAC
- Rejeitar: WebM
- Max size: 20MB
- Retornar URL do Vercel Blob

#### 1.5 Renderização de Áudio
**Arquivo:** `src/components/ai-chat/ai-chat-messages.tsx`

Adicionar player de áudio nas mensagens:
- Usar `<audio>` nativo ou component estilizado
- Mostrar duração
- Controles: play/pause, seek bar

#### 1.6 PartyKit Client
**Arquivo:** `src/lib/partykit/ivy-client.ts`

Atualizar `sendMessage` para aceitar `audio?: string`.

---

### Fase 2: Backend Integration

#### 2.1 PartyKit Server
**Arquivo:** `partykit/src/ivy-chat.ts`

Quando receber mensagem com áudio:
1. Fetch o áudio da URL (Vercel Blob)
2. Converter para base64
3. Enviar para AST no formato:

```typescript
const payload = {
  message: [
    { type: "media", data: base64Audio, mime_type: "audio/wav" },
    { type: "text", text: message || "Processe este áudio." }
  ],
  threadId: this.state.threadId
};
```

#### 2.2 Schema (AST)
**Arquivo:** `src/schema/workflow_schema.py`

O schema atual já aceita `list[dict]`, então já suporta áudio! Apenas validar o formato `media`.

```python
# Adicionar validação para type "media"
for item in v:
    item_type = item.get("type")
    if item_type not in ("text", "image_url", "media"):
        raise ValueError(f"Invalid content type: {item_type}")
```

---

## Considerações de UX

### Padrão de Mercado (WhatsApp/Telegram)

1. **Press & Hold** para gravar (mais intuitivo para mobile)
2. **Tap** para gravar (melhor para desktop)
3. Mostrar forma de onda durante gravação
4. Permitir cancelar arrastando para fora

### MVP (Simplificado)

1. **Tap** no ícone de mic para iniciar
2. **Tap** novamente para parar
3. Preview do áudio antes de enviar
4. Botões: Enviar / Cancelar / Re-gravar

---

## Testes TDD

### Frontend (Vitest)

```typescript
// tests/hooks/use-audio-recorder.test.ts
describe("useAudioRecorder", () => {
  it("should start recording when startRecording is called")
  it("should stop recording and return blob")
  it("should track duration while recording")
  it("should cancel recording and clear state")
  it("should handle permission denied")
})

// tests/ai-chat-input-audio.test.tsx
describe("AiChatInput Audio", () => {
  it("should show mic button")
  it("should show recording UI when recording")
  it("should show preview after recording")
  it("should upload and send audio")
})
```

### Backend (Pytest)

```python
# tests/workflows/test_workflow_schema.py
def test_invoke_input_audio_valid():
    """Audio multimodal input should be valid."""
    data = WorkflowInvokeInput(
        message=[
            {"type": "media", "data": "base64...", "mime_type": "audio/wav"},
            {"type": "text", "text": "Transcreva"},
        ]
    )
    assert isinstance(data.message, list)

def test_invoke_input_audio_invalid_type():
    """Invalid media type should fail."""
    with pytest.raises(ValidationError):
        WorkflowInvokeInput(
            message=[{"type": "invalid", "data": "..."}]
        )
```

---

## Checklist

### Fase 1 - Frontend
- [x] 1.1 Atualizar tipos em `partykit/src/types.ts`
- [x] 1.2 Criar hook `use-audio-recorder.ts`
- [x] 1.3 Adicionar UI de gravação em `ai-chat-input.tsx`
- [x] 1.4 Criar `/api/ivy/upload-audio` route
- [x] 1.5 Renderizar áudio em `ai-chat-messages.tsx`
- [x] 1.6 Atualizar `ivy-client.ts`

### Fase 2 - Backend
- [x] 2.1 Atualizar `ivy-chat.ts` (PartyKit) para processar áudio
- [x] 2.2 Adicionar validação de `type: "media"` no schema (4 novos testes)

### Testes
- [ ] Testes do hook de gravação
- [ ] Testes do componente de input
- [x] Testes backend multimodal áudio (32 testes passando)
- [ ] Teste E2E manual

---

## Limitações do MVP

| Feature | Status | Motivo |
|---------|--------|--------|
| Press & hold | ❌ | Simplificar MVP |
| Waveform visual | ❌ | Simplificar MVP |
| Conversão WebM→MP3 | ❌ | Usar WAV direto |
| Áudio longo (>5min) | ❌ | Limitar para UX |

---

## Referências

- [MediaRecorder API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [Gemini Audio Support](https://www.datastudios.org/post/google-gemini-file-upload-size-limits-supported-types-and-advanced-document-processing)
- [LangChain Gemini Cheatsheet](https://www.philschmid.de/gemini-langchain-cheatsheet)
- [react-media-recorder](https://www.npmjs.com/package/react-media-recorder)
- [use-media-recorder](https://github.com/wmik/use-media-recorder)
