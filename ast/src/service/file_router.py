"""File processing router for multimodal content."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from core import (
    FileProcessingError,
    FileProcessor,
    FileTooLargeError,
    UnsupportedFileTypeError,
)

router = APIRouter(prefix="/files", tags=["files"])


class ProcessRequest(BaseModel):
    """Request to process a file."""

    url: str
    mime_type: str


class ProcessedFileResponse(BaseModel):
    """A processed file."""

    data: str  # base64
    mime_type: str
    width: int
    height: int


class ProcessResponse(BaseModel):
    """Response from file processing."""

    files: list[ProcessedFileResponse]
    action: str
    original_pages: int | None = None


@router.post("/process", response_model=ProcessResponse)
async def process_file(request: ProcessRequest) -> ProcessResponse:
    """Process a file (PDF, large image) for LLM consumption.

    - PDF: Renders each page as an image (150 DPI)
    - Large image (> 20MB): Compresses to JPEG 85%
    - Huge image (> 4096px): Splits into tiles

    Args:
        request: URL and mime type of file to process

    Returns:
        List of processed files (base64 encoded)

    Raises:
        400: Invalid request (unsupported type, too large)
        500: Processing error
    """
    processor = FileProcessor()

    try:
        result = await processor.process(request.url, request.mime_type)

        return ProcessResponse(
            files=[
                ProcessedFileResponse(
                    data=f.data,
                    mime_type=f.mime_type,
                    width=f.width,
                    height=f.height,
                )
                for f in result.files
            ],
            action=result.action.value,
            original_pages=result.original_pages,
        )

    except UnsupportedFileTypeError as e:
        raise HTTPException(status_code=400, detail=str(e))

    except FileTooLargeError as e:
        raise HTTPException(status_code=400, detail=str(e))

    except FileProcessingError as e:
        raise HTTPException(status_code=500, detail=str(e))
