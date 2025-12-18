# Plan-15: Suporte Multimodal (Arquivos e Imagens)

**Data:** 2024-12-18
**Status:** Planejamento
**Dependências:** Plan-11 (Workflows), Plan-14 (Model Registry)

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

### Fase 1: Schema e Tipos
**Objetivo:** Definir tipos para conteúdo multimodal

| Item | Arquivo | Descrição |
|------|---------|-----------|
| 1.1 | `src/schema/schema.py` | Criar `TextContent`, `ImageContent`, `FileContent` |
| 1.2 | `src/schema/schema.py` | Criar `ContentItem = TextContent \| ImageContent \| FileContent` |
| 1.3 | `src/schema/schema.py` | Modificar `UserInput.message: str \| list[ContentItem]` |
| 1.4 | `src/schema/workflow_schema.py` | Modificar `WorkflowInvokeInput.message` |
| 1.5 | `src/schema/__init__.py` | Exportar novos tipos |
| 1.6 | `tests/schema/test_multimodal.py` | Testes unitários |

### Fase 2: Message Builder
**Objetivo:** Converter ContentItem para formato LangChain

| Item | Arquivo | Descrição |
|------|---------|-----------|
| 2.1 | `src/agents/multimodal.py` | Criar `build_human_message()` |
| 2.2 | `src/agents/multimodal.py` | Criar `validate_content_items()` |
| 2.3 | `tests/agents/test_multimodal.py` | Testes unitários |

### Fase 3: File Processor
**Objetivo:** Processar arquivos (resize, PDF→imagens)

| Item | Arquivo | Descrição |
|------|---------|-----------|
| 3.1 | `src/core/file_processor.py` | Criar `FileProcessor` class |
| 3.2 | `src/core/file_processor.py` | `process_image()` - resize, compress |
| 3.3 | `src/core/file_processor.py` | `process_pdf()` - render pages |
| 3.4 | `src/core/file_processor.py` | `process_document()` - DOCX→MD |
| 3.5 | `tests/core/test_file_processor.py` | Testes unitários |

### Fase 4: File Router
**Objetivo:** Endpoint de upload de arquivos

| Item | Arquivo | Descrição |
|------|---------|-----------|
| 4.1 | `src/service/file_router.py` | Criar router FastAPI |
| 4.2 | `src/service/file_router.py` | `POST /files/upload` endpoint |
| 4.3 | `src/service/file_router.py` | `POST /files/process` endpoint (PDF→imagens) |
| 4.4 | `src/service/service.py` | Registrar file_router |
| 4.5 | `tests/service/test_file_router.py` | Testes de integração |

### Fase 5: Integração no Workflow
**Objetivo:** Workflow agent aceitar multimodal

| Item | Arquivo | Descrição |
|------|---------|-----------|
| 5.1 | `src/service/workflow_router.py` | Usar `build_human_message()` |
| 5.2 | `src/service/service.py` | Usar `build_human_message()` |
| 5.3 | `tests/workflows/test_multimodal_workflow.py` | Testes E2E |

### Fase 6: Client
**Objetivo:** Client suportar upload e multimodal

| Item | Arquivo | Descrição |
|------|---------|-----------|
| 6.1 | `src/client/client.py` | Modificar `ainvoke()` |
| 6.2 | `src/client/client.py` | Adicionar `upload_file()` |
| 6.3 | `tests/client/test_multimodal_client.py` | Testes |

### Fase 7: Dependências
**Objetivo:** Adicionar bibliotecas necessárias

| Item | Arquivo | Descrição |
|------|---------|-----------|
| 7.1 | `pyproject.toml` | Adicionar `pillow ~=11.0.0` |
| 7.2 | `pyproject.toml` | Adicionar `pymupdf ~=1.25.0` |
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

- [ ] Testes passando (estimativa: ~50 novos testes)
- [ ] Upload de imagens funcionando
- [ ] PDF renderizado como imagens
- [ ] Workflow Arte x Arte funcionando
- [ ] Latência < 10s para documento típico
- [ ] Documentação atualizada

---

## Referências

- [Gemini Vision API](https://ai.google.dev/gemini-api/docs/vision)
- [Gemini Media Resolution](https://ai.google.dev/gemini-api/docs/media-resolution)
- [LangChain Multimodal](https://python.langchain.com/docs/how_to/multimodal_inputs/)
- [PyMuPDF Documentation](https://pymupdf.readthedocs.io/)
