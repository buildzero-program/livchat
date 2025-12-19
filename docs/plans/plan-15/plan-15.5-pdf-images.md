# Plan-15.5: Processamento de Arquivos (PDF + Resize + Tiling)

**Data:** 2024-12-19
**Status:** ✅ Concluído
**Dependências:** Plan-15.1 (MVP Images)
**Escopo:** Processamento completo de arquivos para LLM

## Objetivo

Criar o `FileProcessor` - um processador unificado que:
1. **PDF → Imagens**: Converte PDFs para imagens (PyMuPDF, 150 DPI)
2. **Resize/Compress**: Comprime imagens > 20MB (JPEG 85%)
3. **Tiling**: Divide imagens > 4096px em tiles (1568px, 10% overlap)

O processamento é **transparente** - o usuário envia o arquivo e o sistema processa automaticamente.

## Casos de Uso

**Arte x Arte (ANVISA):**
- Usuário envia 2 PDFs de embalagens farmacêuticas
- Sistema converte cada página para imagem
- LLM compara visualmente e identifica diferenças

**Imagens grandes:**
- Usuário envia foto de alta resolução (> 4096px)
- Sistema divide em tiles para não perder detalhe
- LLM analisa cada tile

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (Next.js)                         │
│                                                                  │
│  AiChatInput:                                                   │
│    └── Usuário seleciona PDF                                    │
│    └── Upload para Vercel Blob (igual imagem)                   │
│    └── sendMessage({ content, files: [{ url, type: "pdf" }] }) │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PARTYKIT SERVER                             │
│                                                                  │
│  ivy-chat.ts:                                                   │
│    └── Detecta file.type === "pdf"                              │
│    └── Chama AST: POST /files/process                           │
│    └── Recebe imagens base64                                    │
│    └── Envia para workflow (mesmo fluxo de imagens)             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AST BACKEND (Python)                        │
│                                                                  │
│  POST /files/process:                                           │
│    └── FileProcessor.process(url, mime_type)                    │
│    └── PDF: PyMuPDF → render pages → base64                     │
│    └── Imagem > 20MB: Pillow → compress                         │
│    └── Imagem > 4096px: Pillow → tile                           │
│    └── Retorna: [{ base64, mime_type }, ...]                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Regras de Processamento

### Imagens

| Condição | Ação | Detalhes |
|----------|------|----------|
| < 10MB e < 1568px | Enviar direto | Nenhum processamento |
| 10-20MB | Comprimir | JPEG 85% quality |
| > 20MB | Comprimir obrigatório | JPEG 85%, resize se necessário |
| > 4096px (qualquer lado) | Tiling | 1568px tiles, 10% overlap |

### PDF

| Regra | Valor |
|-------|-------|
| DPI de renderização | 150 |
| Formato de saída | PNG (preserva qualidade) |
| Páginas máximas | 50 |
| Se > 50 páginas | Erro com mensagem clara |
| Tamanho máximo | 50MB |

### Tiling

```python
TILE_SIZE = 1568  # px
OVERLAP = 0.1     # 10% para não cortar texto
MAX_TILES = 9     # 3x3 grid máximo
```

---

## Implementação

### Fase 1: Dependências

**Arquivo:** `ast/pyproject.toml`

```toml
dependencies = [
    # ... existentes ...
    "pillow ~=11.0.0",      # Processamento de imagens
    "pymupdf ~=1.25.0",     # PDF → imagens
]
```

### Fase 2: FileProcessor (TDD)

**Arquivo:** `ast/src/core/file_processor.py`

```python
from dataclasses import dataclass
from enum import Enum

class ProcessingAction(Enum):
    DIRECT = "direct"           # Enviar sem processar
    COMPRESS = "compress"       # Comprimir (JPEG 85%)
    TILE = "tile"               # Dividir em tiles
    RENDER_PAGES = "render"     # PDF → imagens

@dataclass
class ProcessedFile:
    data: str          # base64
    mime_type: str     # image/png, image/jpeg
    width: int
    height: int

@dataclass
class ProcessingResult:
    files: list[ProcessedFile]
    action: ProcessingAction
    original_pages: int | None = None  # Para PDFs

class FileProcessor:
    """Processa arquivos para envio ao LLM."""

    MAX_SIZE_MB = 20
    MAX_DIMENSION = 4096
    TILE_SIZE = 1568
    TILE_OVERLAP = 0.1
    PDF_DPI = 150
    PDF_MAX_PAGES = 50
    JPEG_QUALITY = 85

    async def process(self, url: str, mime_type: str) -> ProcessingResult:
        """Processa arquivo da URL e retorna imagens prontas para LLM."""
        ...

    def _get_action(self, size_bytes: int, width: int, height: int, mime_type: str) -> ProcessingAction:
        """Determina ação de processamento."""
        ...

    async def _process_pdf(self, data: bytes) -> list[ProcessedFile]:
        """Converte PDF para lista de imagens."""
        ...

    def _compress_image(self, data: bytes, mime_type: str) -> ProcessedFile:
        """Comprime imagem para JPEG 85%."""
        ...

    def _tile_image(self, data: bytes) -> list[ProcessedFile]:
        """Divide imagem grande em tiles."""
        ...
```

### Fase 3: File Router

**Arquivo:** `ast/src/service/file_router.py`

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/files", tags=["files"])

class ProcessRequest(BaseModel):
    url: str
    mime_type: str

class ProcessedFileResponse(BaseModel):
    data: str       # base64
    mime_type: str

class ProcessResponse(BaseModel):
    files: list[ProcessedFileResponse]
    original_pages: int | None = None

@router.post("/process")
async def process_file(request: ProcessRequest) -> ProcessResponse:
    """Processa arquivo (PDF, imagem grande) para envio ao LLM."""
    processor = FileProcessor()
    result = await processor.process(request.url, request.mime_type)
    return ProcessResponse(
        files=[ProcessedFileResponse(data=f.data, mime_type=f.mime_type) for f in result.files],
        original_pages=result.original_pages
    )
```

### Fase 4: Integração PartyKit

**Arquivo:** `app/partykit/src/ivy-chat.ts`

```typescript
// Detectar PDF e processar
async function processFiles(files: FileAttachment[]): Promise<MultimodalContent[]> {
  const result: MultimodalContent[] = [];

  for (const file of files) {
    if (file.mime_type === "application/pdf" || needsProcessing(file)) {
      // Chamar AST para processar
      const processed = await fetch(`${AST_URL}/files/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: file.url, mime_type: file.mime_type })
      }).then(r => r.json());

      // Adicionar cada imagem resultante
      for (const img of processed.files) {
        result.push({
          type: "image_url",
          image_url: { url: `data:${img.mime_type};base64,${img.data}` }
        });
      }
    } else {
      // Imagem normal - processar como antes
      result.push(await fetchImageAsBase64(file.url));
    }
  }

  return result;
}
```

### Fase 5: Frontend (aceitar PDF)

**Arquivo:** `app/src/components/ai-chat/ai-chat-input.tsx`

```typescript
// Atualizar accept para incluir PDF
const ACCEPTED_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf"
];

// Atualizar validação
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB para PDF
```

---

## Testes TDD

### Testes Unitários

```python
# tests/core/test_file_processor.py

class TestFileProcessorAction:
    """Testes para determinação de ação."""

    def test_small_image_returns_direct(self):
        """Imagem pequena não precisa de processamento."""

    def test_large_image_returns_compress(self):
        """Imagem > 10MB deve comprimir."""

    def test_huge_image_returns_compress(self):
        """Imagem > 20MB deve comprimir obrigatoriamente."""

    def test_wide_image_returns_tile(self):
        """Imagem > 4096px deve fazer tiling."""

    def test_pdf_returns_render(self):
        """PDF sempre renderiza páginas."""


class TestFileProcessorPDF:
    """Testes para processamento de PDF."""

    def test_pdf_renders_all_pages(self):
        """PDF com 3 páginas retorna 3 imagens."""

    def test_pdf_respects_max_pages(self):
        """PDF com > 50 páginas gera erro."""

    def test_pdf_uses_correct_dpi(self):
        """Renderização usa 150 DPI."""


class TestFileProcessorImage:
    """Testes para processamento de imagens."""

    def test_compress_reduces_size(self):
        """Compressão reduz tamanho do arquivo."""

    def test_compress_uses_jpeg(self):
        """Compressão converte para JPEG."""

    def test_tile_creates_correct_grid(self):
        """Tiling cria grid correto com overlap."""

    def test_tile_preserves_content(self):
        """Tiles cobrem toda a imagem original."""
```

### Testes de Integração

```python
# tests/service/test_file_router.py

class TestFileRouter:
    """Testes do endpoint /files/process."""

    async def test_process_pdf_returns_images(self):
        """POST /files/process com PDF retorna lista de imagens."""

    async def test_process_large_image_compresses(self):
        """POST /files/process com imagem grande comprime."""

    async def test_process_invalid_url_returns_error(self):
        """URL inválida retorna 400."""

    async def test_process_unsupported_type_returns_error(self):
        """Tipo não suportado retorna 400."""
```

---

## Checklist

### Fase 1 - Setup
- [ ] Adicionar `pillow ~=11.0.0` no pyproject.toml
- [ ] Adicionar `pymupdf ~=1.25.0` no pyproject.toml
- [ ] Rodar `uv sync`
- [ ] Verificar imports funcionando

### Fase 2 - FileProcessor (TDD)
- [ ] Criar `tests/core/test_file_processor.py` com testes
- [ ] Criar `src/core/file_processor.py`
- [ ] Implementar `_get_action()`
- [ ] Implementar `_process_pdf()`
- [ ] Implementar `_compress_image()`
- [ ] Implementar `_tile_image()`
- [ ] Implementar `process()`
- [ ] Todos os testes passando

### Fase 3 - File Router
- [ ] Criar `tests/service/test_file_router.py`
- [ ] Criar `src/service/file_router.py`
- [ ] Registrar router em `service.py`
- [ ] Testes de integração passando

### Fase 4 - PartyKit
- [ ] Atualizar tipos para suportar `files`
- [ ] Implementar `processFiles()` em ivy-chat.ts
- [ ] Testar com PDF local

### Fase 5 - Frontend
- [ ] Atualizar `accept` para incluir PDF
- [ ] Atualizar limite de tamanho para 50MB
- [ ] Preview de PDF (mostrar ícone ou primeira página)
- [ ] Testar upload de PDF

### Fase 6 - E2E
- [ ] Testar com PDF real de 1 página
- [ ] Testar com PDF de múltiplas páginas
- [ ] Testar com PDF grande (> 10MB)
- [ ] Testar Arte x Arte (2 PDFs lado a lado)
- [ ] Deploy e teste em produção

---

## Arquivos a Criar/Modificar

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `ast/pyproject.toml` | Modificar | Adicionar pillow, pymupdf |
| `ast/src/core/__init__.py` | Criar | Package init |
| `ast/src/core/file_processor.py` | **NOVO** | Classe FileProcessor |
| `ast/src/service/file_router.py` | **NOVO** | Router FastAPI |
| `ast/src/service/service.py` | Modificar | Registrar file_router |
| `ast/tests/core/__init__.py` | Criar | Package init |
| `ast/tests/core/test_file_processor.py` | **NOVO** | Testes unitários |
| `ast/tests/service/test_file_router.py` | **NOVO** | Testes integração |
| `app/partykit/src/ivy-chat.ts` | Modificar | Processar PDFs |
| `app/partykit/src/types.ts` | Modificar | Tipo FileAttachment |
| `app/src/components/ai-chat/ai-chat-input.tsx` | Modificar | Aceitar PDF |

---

## Referências

- [PyMuPDF Documentation](https://pymupdf.readthedocs.io/)
- [Pillow Documentation](https://pillow.readthedocs.io/)
- [Gemini Vision Limits](https://ai.google.dev/gemini-api/docs/vision)
- [Plan-15 Arquitetura](./plan-15-multimodal-files.md)
