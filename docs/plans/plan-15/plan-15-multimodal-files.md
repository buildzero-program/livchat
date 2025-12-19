# Plan-15: Suporte Multimodal (Arquivos e Imagens)

**Data:** 2024-12-18
**Status:** ✅ Concluído
**Dependências:** Plan-11 (Workflows), Plan-14 (Model Registry)

---

## Status dos Sub-Planos

| Sub-Plano | Escopo | Status |
|-----------|--------|--------|
| [Plan 15.1](./plan-15.1-mvp-images.md) | MVP Imagens (upload, preview, envio) | ✅ Concluído |
| [Plan 15.2](./plan-15.2-audio.md) | Gravação e envio de áudio | ✅ Concluído |
| [Plan 15.3](./plan-15.3-input-alignment.md) | Alinhamento vertical de ícones | ✅ Concluído |
| [Plan 15.4](./plan-15.4-expandable-input.md) | Layout ChatGPT-style (duas linhas) | ✅ Concluído |
| [Plan 15.5](./plan-15.5-pdf-images.md) | PDF + Resize + Tiling (FileProcessor) | ✅ Concluído |

> **Nota:** Plan 15.6 foi incorporado ao 15.5 - o `FileProcessor` cobre PDF, resize e tiling em uma única implementação.

---

## O que foi Implementado (15.1-15.4)

### Arquitetura Real vs Planejada

```
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (Next.js)                         │
│                                                                  │
│  AiChatInput:                                                   │
│    ├── Botão [+] → Upload para Vercel Blob                      │
│    ├── Botão [🎤] → MediaRecorder (OGG/WebM)                    │
│    └── Botão [↑] → sendMessage(text, images?, audio?)          │
│                                                                  │
│  APIs:                                                          │
│    ├── POST /api/ivy/upload → Vercel Blob (imagens)            │
│    └── POST /api/ivy/upload-audio → Vercel Blob (áudio)        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PARTYKIT SERVER                             │
│                                                                  │
│  ivy-chat.ts:                                                   │
│    ├── Recebe { content, images?, audio? }                      │
│    ├── Fetch imagem/áudio da URL → Base64                       │
│    └── POST /workflows/ivy/stream com multimodal                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AST BACKEND (Python)                        │
│                                                                  │
│  workflow_schema.py:                                            │
│    message: str | list[dict] → Validação customizada            │
│    Tipos válidos: "text", "image_url", "media"                  │
│                                                                  │
│  workflow_router.py:                                            │
│    HumanMessage(content=input_data.message) → LangChain nativo  │
└─────────────────────────────────────────────────────────────────┘
```

### Decisões de Implementação

| Planejado | Implementado | Motivo |
|-----------|--------------|--------|
| `TextContent`, `ImageContent` Pydantic | `str \| list[dict]` simples | LangChain aceita dict diretamente |
| `build_human_message()` separado | `HumanMessage(content=...)` direto | LangChain já é multimodal nativo |
| Upload no AST (`/files/upload`) | Upload no Next.js (Vercel Blob) | Mais simples, já tínhamos Vercel Blob |
| Resize no backend | Sem resize (< 20MB passa direto) | MVP não precisa |
| Gravação WAV | Gravação OGG/WebM | Browser moderno prefere, Gemini aceita |

### Arquivos Criados/Modificados

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `app/src/hooks/use-audio-recorder.ts` | **NOVO** | Hook React para gravação de áudio |
| `app/src/app/api/ivy/upload/route.ts` | **NOVO** | Upload de imagens para Vercel Blob |
| `app/src/app/api/ivy/upload-audio/route.ts` | **NOVO** | Upload de áudio para Vercel Blob |
| `app/src/components/ai-chat/ai-chat-input.tsx` | Modificado | UI completa: upload, gravação, layout ChatGPT |
| `app/src/components/ai-chat/ai-chat-messages.tsx` | Modificado | Renderização de imagens e áudio |
| `app/partykit/src/ivy-chat.ts` | Modificado | Processamento de imagens e áudio para AST |
| `app/partykit/src/types.ts` | Modificado | `images?: string[]`, `audio?: string` |
| `ast/src/schema/workflow_schema.py` | Modificado | `message: str \| list[dict]` com validação |
| `ast/tests/workflows/test_workflow_schema.py` | Modificado | +8 testes multimodal (imagem + áudio) |

---

## Objetivo

Adicionar suporte para upload e processamento de arquivos (imagens, PDFs, documentos) no AST, permitindo que workflows recebam conteúdo multimodal além de texto.

## Contexto

### Caso de Uso Principal: Arte x Arte (ANVISA)
- Comparação visual de artes de embalagens farmacêuticas
- Verificação de conformidade regulatória
- Arquivos: PDFs de 47KB a 23MB

### Modelos Suportados
- **Gemini 3 Flash Preview** (principal) - suporta `media_resolution` per-part
- GPT-4o, Claude 3.5 - suporte nativo a imagens
- Groq, XAI - verificar suporte

---

## Descobertas da Pesquisa

### 1. Limites do Gemini Flash

| Limite | Valor |
|--------|-------|
| Tamanho máximo inline | **20 MB** |
| Resolução máxima | **4096x4096 px** |
| Resolução recomendada | **≤1568 px** (evita tiling interno) |
| Imagens por request | até 3.600 |
| Context window | 1M tokens |

### 2. Tokens por Resolução (Gemini 3)

| Resolução | Tokens/Imagem |
|-----------|---------------|
| LOW | 280 |
| MEDIUM | 560 |
| HIGH | 1120 |
| ULTRA_HIGH | 2240 |

### 3. Resize Manual: É Necessário?

**Depende:**
- < 10MB, < 1568px → **Não precisa** (enviar direto)
- 10-20MB → **Opcional** (melhora latência)
- > 20MB → **Obrigatório** (excede limite)

**Alternativa:** Usar parâmetro `media_resolution` em vez de resize manual.

### 4. PDF → Imagem

| Biblioteca | Performance | Recomendação |
|------------|-------------|--------------|
| PyMuPDF | 800ms/7 páginas | **Usar** |
| pdf2image | 10s/7 páginas | Evitar |
| pypdfium2 | Mais rápido | Alternativa |

**DPI recomendado:** 150 (sweet spot para LLM)

### 5. LangChain

O LangChain já suporta imagens nativamente:
```python
HumanMessage(content=[
    {"type": "text", "text": "Descreva:"},
    {"type": "image_url", "image_url": {"url": "data:image/png;base64,..."}}
])
```

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (Upload)                           │
│  file_uploader → FormData → POST /files/upload                 │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  FILE ROUTER (FastAPI)                          │
│                                                                  │
│  POST /files/upload                                             │
│    → Valida tipo/tamanho                                        │
│    → Processa arquivo (resize, PDF→imagens)                     │
│    → Retorna URL(s) ou base64                                   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  WORKFLOW INVOKE                                 │
│                                                                  │
│  POST /workflows/{id}/invoke                                    │
│    message: str | list[ContentItem]                             │
│                                                                  │
│  ContentItem:                                                   │
│    - TextContent(text="...")                                    │
│    - ImageContent(url="data:...", detail="high")               │
│    - FileContent(url="...", mime_type="application/pdf")       │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  WORKFLOW AGENT                                  │
│                                                                  │
│  build_human_message(content) → HumanMessage                    │
│  model.ainvoke([system_msg, human_msg])                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Regras de Negócio

### Processamento de Arquivos

```python
def get_processing_strategy(file_size_mb: float, mime_type: str) -> str:
    """Define estratégia de processamento."""

    # Imagens
    if mime_type.startswith("image/"):
        if file_size_mb > 20:
            return "REJECT"  # Excede limite
        if file_size_mb > 10:
            return "COMPRESS"  # Comprimir para JPEG 85%
        return "DIRECT"  # Enviar como está

    # PDFs
    if mime_type == "application/pdf":
        return "RENDER_PAGES"  # Sempre renderizar como imagens

    # Documentos Office
    if mime_type in OFFICE_TYPES:
        return "CONVERT_MARKDOWN"  # Docling → Markdown

    return "TEXT"  # Texto puro
```

### Limites

| Tipo | Limite | Ação se exceder |
|------|--------|-----------------|
| Imagem única | 20 MB | Rejeitar |
| PDF páginas | 50 páginas | Paginar (chunks de 20) |
| Total request | 100 MB | Rejeitar |
| Dimensão imagem | 4096 px | Resize |

### Tiling (Imagens Muito Grandes)

```python
# Se imagem > 4096px em qualquer dimensão
TILE_SIZE = 1568
OVERLAP = 0.1  # 10% overlap para não cortar texto

def should_tile(width: int, height: int) -> bool:
    return width > 4096 or height > 4096
```

---

## Fases de Implementação

### ✅ Fase 1: Schema e Tipos (Simplificado)
**Status:** Concluído (via Plan 15.1)
**Implementação diferente:** Usamos `str | list[dict]` com validação customizada em vez de tipos Pydantic específicos.

| Item | Status | Descrição |
|------|--------|-----------|
| 1.4 | ✅ | `workflow_schema.py` - `message: str \| list[dict]` com validação |
| 1.6 | ✅ | 8 testes multimodal em `test_workflow_schema.py` |

### ✅ Fase 2: Message Builder (Não Necessário)
**Status:** Não implementado - LangChain já aceita multimodal nativo
**Motivo:** `HumanMessage(content=[...])` aceita listas de `{"type": "text/image_url/media", ...}` diretamente.

### ⏳ Fase 3: File Processor (Pendente - Plan 15.5)
**Objetivo:** Processar arquivos (resize, PDF→imagens)
**Prioridade:** Alta (necessário para caso Arte x Arte)

| Item | Arquivo | Descrição |
|------|---------|-----------|
| 3.1 | `src/core/file_processor.py` | Criar `FileProcessor` class |
| 3.2 | `src/core/file_processor.py` | `process_image()` - resize, compress |
| 3.3 | `src/core/file_processor.py` | `process_pdf()` - render pages (PyMuPDF) |
| 3.4 | `src/core/file_processor.py` | `process_document()` - DOCX→MD (opcional) |
| 3.5 | `tests/core/test_file_processor.py` | Testes unitários |

### ⏳ Fase 4: File Router (Pendente - opcional)
**Objetivo:** Endpoint de upload no AST
**Prioridade:** Baixa - já temos upload via Vercel Blob no frontend

| Item | Arquivo | Descrição | Status |
|------|---------|-----------|--------|
| 4.1-4.4 | `src/service/file_router.py` | Upload no AST | ❓ Avaliar necessidade |
| - | `POST /api/ivy/upload` (Next.js) | Upload para Vercel Blob | ✅ Implementado |
| - | `POST /api/ivy/upload-audio` (Next.js) | Upload de áudio | ✅ Implementado |

### ✅ Fase 5: Integração no Workflow
**Status:** Concluído (via Plan 15.1, 15.2)

| Item | Status | Descrição |
|------|--------|-----------|
| 5.1 | ✅ | `workflow_router.py` já passa `content` diretamente |
| 5.2 | ✅ | `ivy-chat.ts` formata multimodal para AST |
| 5.3 | ✅ | Teste E2E manual (imagens e áudio funcionando) |

### 🔄 Fase 6: Client (Parcialmente Pendente)
**Objetivo:** Client suportar upload e multimodal

| Item | Status | Descrição |
|------|--------|-----------|
| 6.1 | ✅ | `ainvoke()` já aceita `message: list[dict]` |
| 6.2 | ⏳ | `upload_file()` - opcional, pode usar Vercel Blob direto |

### ⏳ Fase 7: Dependências (Pendente - Plan 15.5)
**Objetivo:** Adicionar bibliotecas para PDF

| Item | Arquivo | Descrição |
|------|---------|-----------|
| 7.1 | `pyproject.toml` | Adicionar `pillow ~=11.0.0` (resize) |
| 7.2 | `pyproject.toml` | Adicionar `pymupdf ~=1.25.0` (PDF→imagens) |
| 7.3 | - | Rodar `uv sync` |

---

## Arquivos Afetados

| Arquivo | Modificação |
|---------|-------------|
| `src/schema/schema.py` | Adicionar ContentItem types |
| `src/schema/workflow_schema.py` | Modificar WorkflowInvokeInput |
| `src/schema/__init__.py` | Exportar novos tipos |
| `src/agents/multimodal.py` | **NOVO** - build_human_message |
| `src/core/file_processor.py` | **NOVO** - FileProcessor |
| `src/service/file_router.py` | **NOVO** - Upload endpoint |
| `src/service/workflow_router.py` | Usar build_human_message |
| `src/service/service.py` | Registrar router, usar build_human_message |
| `src/client/client.py` | Suportar multimodal |
| `pyproject.toml` | Adicionar pillow, pymupdf |

---

## Dependências

### Bibliotecas a Adicionar

```toml
# pyproject.toml
dependencies = [
    # ... existentes ...
    "pillow ~=11.0.0",        # Processamento de imagens
    "pymupdf ~=1.25.0",       # PDF → imagens (melhor que pypdf)
    # "docling ~=2.0.0",      # Opcional: DOCX, PPTX, XLSX
]
```

### Justificativa

| Biblioteca | Uso | Alternativa |
|------------|-----|-------------|
| Pillow | Resize, compress, convert | Nenhuma (padrão) |
| PyMuPDF | PDF→imagens, OCR | pdf2image (10x mais lento) |
| Docling | DOCX→Markdown | Unstructured (menos preciso) |

---

## Exemplo de Uso Final

### API Request
```json
POST /workflows/wf_123/invoke
{
  "message": [
    {"type": "text", "text": "Compare estas duas artes:"},
    {"type": "image", "url": "data:image/png;base64,...", "detail": "high"},
    {"type": "image", "url": "data:image/png;base64,...", "detail": "high"}
  ],
  "threadId": "thread_456"
}
```

### Python Client
```python
client = AgentClient(base_url="http://localhost:9000")

# Upload de arquivos
url1 = await client.upload_file("arte_atual.pdf")
url2 = await client.upload_file("arte_aprovada.pdf")

# Invoke com multimodal
response = await client.ainvoke(
    message=[
        {"type": "text", "text": "Compare e identifique diferenças:"},
        {"type": "image", "url": url1, "detail": "high"},
        {"type": "image", "url": url2, "detail": "high"}
    ],
    workflow_id="wf_arte_x_arte"
)
```

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Arquivos > 20MB | Alta (23MB encontrado) | Alto | Render PDF como imagens separadas |
| Latência alta | Média | Médio | Pre-resize, usar `media_resolution` |
| Tokens excessivos | Média | Alto | Limitar páginas, usar LOW/MEDIUM |
| Modelo não suporta imagens | Baixa | Alto | Validar modelo antes de enviar |

---

## Métricas de Sucesso

- [x] Testes passando - 8 testes multimodal no AST
- [x] Upload de imagens funcionando (Vercel Blob)
- [x] Upload de áudio funcionando (Vercel Blob)
- [ ] PDF renderizado como imagens (Plan 15.5)
- [ ] Workflow Arte x Arte funcionando (Plan 15.5)
- [ ] Latência < 10s para documento típico
- [x] UI estilo ChatGPT (layout duas linhas)

---

## Análise: Próximos Passos

### Questão Principal: Nós de Workflow vs Processamento Transparente

Para o caso **Arte x Arte (ANVISA)** e outros usos de PDF, temos duas abordagens:

#### Opção A: Processamento Transparente (Recomendado para MVP)

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend: Usuário envia PDF                                    │
│     │                                                           │
│     ▼                                                           │
│  PartyKit: Detecta PDF → Chama /api/process-pdf                │
│     │                                                           │
│     ▼                                                           │
│  Next.js API: PDF → PyMuPDF → Imagens → Vercel Blob            │
│     │                                                           │
│     ▼                                                           │
│  PartyKit: Envia imagens para AST (mesmo fluxo atual)          │
└─────────────────────────────────────────────────────────────────┘
```

**Vantagens:**
- Zero mudanças no workflow editor
- Usuário não precisa configurar nada
- Funciona com qualquer workflow existente

**Desvantagens:**
- Sem controle de DPI/resolução por workflow
- Todas as páginas são processadas (pode ser lento para PDFs grandes)

#### Opção B: Nó de Processamento no Workflow

```
┌───────────────────────────────────────────────────────────────────┐
│  Workflow Editor:                                                  │
│                                                                    │
│  [Input] ──→ [PDF Processor Node] ──→ [Agent Node] ──→ [Output]   │
│               ├── DPI: 150                                        │
│               ├── Pages: 1-5                                      │
│               └── Resolution: MEDIUM                              │
└───────────────────────────────────────────────────────────────────┘
```

**Vantagens:**
- Controle granular (DPI, páginas, resolução)
- Reutilizável em diferentes workflows
- Visível no editor de workflows

**Desvantagens:**
- Requer novo tipo de nó no frontend e backend
- Mais complexidade para usuário

### Recomendação

**Para Plan 15.5 (Arte x Arte MVP):** Usar **Opção A - Processamento Transparente**

**Motivo:** O caso Arte x Arte é específico e não precisa de configuração. O usuário simplesmente envia o PDF e o sistema processa automaticamente.

**Quando migrar para Opção B:**
- Quando tivermos múltiplos casos de uso com requisitos diferentes
- Quando usuários pedirem controle sobre processamento
- Quando tivermos workflows complexos com múltiplos PDFs

---

## Plan 15.5: PDF → Imagens (Proposta)

### Escopo
1. Adicionar endpoint `/api/ivy/process-pdf` no Next.js
2. Usar PyMuPDF (executar via API separada ou subprocess)
3. Renderizar cada página como imagem (150 DPI)
4. Upload automático para Vercel Blob
5. Retornar lista de URLs para o PartyKit

### Desafio: Python no Next.js

**Problema:** Next.js roda em Node.js, mas PyMuPDF é Python.

**Soluções:**

| Solução | Complexidade | Performance | Recomendação |
|---------|--------------|-------------|--------------|
| AST endpoint `/files/process-pdf` | Baixa | Boa | ✅ Usar |
| Cloudflare Worker + R2 | Média | Excelente | Futuro |
| pdf.js (JS puro) | Alta | Ruim | Evitar |
| External service (CloudConvert) | Baixa | Variável | Backup |

**Decisão:** Adicionar endpoint no AST (`POST /files/process-pdf`) que:
1. Recebe URL do PDF (já no Vercel Blob)
2. Baixa, processa com PyMuPDF
3. Retorna lista de imagens em base64 ou URLs

### Checklist Plan 15.5

- [ ] Adicionar `pillow`, `pymupdf` no AST
- [ ] Criar `src/core/file_processor.py`
- [ ] Criar endpoint `POST /files/process-pdf`
- [ ] Atualizar `ivy-chat.ts` para detectar PDF e processar
- [ ] Testes unitários
- [ ] Teste E2E com PDF real

---

## Referências

- [Gemini Vision API](https://ai.google.dev/gemini-api/docs/vision)
- [Gemini Media Resolution](https://ai.google.dev/gemini-api/docs/media-resolution)
- [LangChain Multimodal](https://python.langchain.com/docs/how_to/multimodal_inputs/)
- [PyMuPDF Documentation](https://pymupdf.readthedocs.io/)
