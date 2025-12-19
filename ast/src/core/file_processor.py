"""File processor for multimodal content - handles PDF, resize, and tiling."""

import base64
import io
import math
from dataclasses import dataclass
from enum import Enum

import fitz  # PyMuPDF
import httpx
from PIL import Image


class ProcessingAction(Enum):
    """Actions for file processing."""

    DIRECT = "direct"  # Send without processing
    COMPRESS = "compress"  # Compress to JPEG 85%
    TILE = "tile"  # Split into tiles
    RENDER_PAGES = "render"  # PDF → images


class FileProcessingError(Exception):
    """Base error for file processing."""

    pass


class FileTooLargeError(FileProcessingError):
    """File exceeds maximum size."""

    pass


class UnsupportedFileTypeError(FileProcessingError):
    """File type not supported."""

    pass


@dataclass
class ProcessedFile:
    """A processed file ready for LLM."""

    data: str  # base64 encoded
    mime_type: str
    width: int
    height: int


@dataclass
class ProcessingResult:
    """Result of file processing."""

    files: list[ProcessedFile]
    action: ProcessingAction
    original_pages: int | None = None  # For PDFs


# Supported mime types
SUPPORTED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp"}
SUPPORTED_PDF_TYPES = {"application/pdf"}
SUPPORTED_TYPES = SUPPORTED_IMAGE_TYPES | SUPPORTED_PDF_TYPES


class FileProcessor:
    """Processes files for LLM consumption.

    Handles:
    - PDF → images (PyMuPDF, 150 DPI)
    - Large images → compression (JPEG 85%)
    - Huge images → tiling (1568px tiles, 10% overlap)
    """

    # Size limits
    MAX_FILE_SIZE_MB = 50
    COMPRESS_THRESHOLD_MB = 10
    FORCE_COMPRESS_MB = 20

    # Dimension limits
    MAX_DIMENSION = 4096
    TILE_SIZE = 1568
    TILE_OVERLAP = 0.1  # 10%
    MAX_TILES = 9

    # PDF settings
    PDF_DPI = 150
    PDF_MAX_PAGES = 50

    # Compression settings
    JPEG_QUALITY = 85

    def _get_action(
        self,
        size_bytes: int,
        width: int,
        height: int,
        mime_type: str,
    ) -> ProcessingAction:
        """Determine processing action for a file.

        Args:
            size_bytes: File size in bytes
            width: Image width (0 for PDF)
            height: Image height (0 for PDF)
            mime_type: MIME type of file

        Returns:
            ProcessingAction indicating what to do

        Raises:
            UnsupportedFileTypeError: If mime type not supported
            FileTooLargeError: If file > 50MB
        """
        # Check file type
        if mime_type not in SUPPORTED_TYPES:
            raise UnsupportedFileTypeError(f"Unsupported file type: {mime_type}")

        # Check file size
        size_mb = size_bytes / (1024 * 1024)
        if size_mb > self.MAX_FILE_SIZE_MB:
            raise FileTooLargeError(
                f"File size {size_mb:.1f}MB exceeds maximum {self.MAX_FILE_SIZE_MB}MB"
            )

        # PDF always renders to images
        if mime_type in SUPPORTED_PDF_TYPES:
            return ProcessingAction.RENDER_PAGES

        # Check dimensions for tiling
        if width > self.MAX_DIMENSION or height > self.MAX_DIMENSION:
            return ProcessingAction.TILE

        # Check size for compression
        if size_mb >= self.COMPRESS_THRESHOLD_MB:
            return ProcessingAction.COMPRESS

        # Small file, send directly
        return ProcessingAction.DIRECT

    def _process_pdf(self, data: bytes) -> list[ProcessedFile]:
        """Convert PDF to list of images.

        Args:
            data: PDF file bytes

        Returns:
            List of ProcessedFile, one per page

        Raises:
            FileTooLargeError: If PDF has > 50 pages
        """
        doc = fitz.open(stream=data, filetype="pdf")

        try:
            page_count = len(doc)
            if page_count > self.PDF_MAX_PAGES:
                raise FileTooLargeError(
                    f"PDF has {page_count} pages, maximum is {self.PDF_MAX_PAGES}"
                )

            result = []
            # DPI scaling: PyMuPDF uses 72 DPI base, so scale factor = target_dpi / 72
            scale = self.PDF_DPI / 72

            for page_num in range(page_count):
                page = doc[page_num]
                # Render with scaling matrix
                mat = fitz.Matrix(scale, scale)
                pix = page.get_pixmap(matrix=mat)

                # Convert to PNG bytes
                img_bytes = pix.tobytes("png")

                # Encode to base64
                b64_data = base64.b64encode(img_bytes).decode("utf-8")

                result.append(
                    ProcessedFile(
                        data=b64_data,
                        mime_type="image/png",
                        width=pix.width,
                        height=pix.height,
                    )
                )

            return result
        finally:
            doc.close()

    def _compress_image(self, data: bytes, mime_type: str) -> ProcessedFile:
        """Compress image to JPEG 85%.

        Args:
            data: Original image bytes
            mime_type: Original MIME type

        Returns:
            ProcessedFile with compressed JPEG
        """
        img = Image.open(io.BytesIO(data))

        # Convert to RGB if necessary (for PNG with alpha)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")

        width, height = img.size

        # Save as JPEG
        buffer = io.BytesIO()
        img.save(buffer, format="JPEG", quality=self.JPEG_QUALITY, optimize=True)
        jpeg_bytes = buffer.getvalue()

        b64_data = base64.b64encode(jpeg_bytes).decode("utf-8")

        return ProcessedFile(
            data=b64_data,
            mime_type="image/jpeg",
            width=width,
            height=height,
        )

    def _tile_image(self, data: bytes) -> list[ProcessedFile]:
        """Split large image into tiles.

        Args:
            data: Original image bytes

        Returns:
            List of ProcessedFile tiles
        """
        img = Image.open(io.BytesIO(data))
        width, height = img.size

        # Calculate tile step (with overlap)
        step = int(self.TILE_SIZE * (1 - self.TILE_OVERLAP))

        # Calculate grid dimensions
        cols = math.ceil(width / step)
        rows = math.ceil(height / step)

        # Limit total tiles
        total_tiles = cols * rows
        if total_tiles > self.MAX_TILES:
            # Reduce grid size proportionally
            scale = math.sqrt(self.MAX_TILES / total_tiles)
            cols = max(1, int(cols * scale))
            rows = max(1, int(rows * scale))
            # Recalculate step to cover entire image
            step = max(width // cols, height // rows)

        result = []

        for row in range(rows):
            for col in range(cols):
                # Calculate tile bounds
                x1 = col * step
                y1 = row * step
                x2 = min(x1 + self.TILE_SIZE, width)
                y2 = min(y1 + self.TILE_SIZE, height)

                # Crop tile
                tile = img.crop((x1, y1, x2, y2))

                # Save as PNG
                buffer = io.BytesIO()
                tile.save(buffer, format="PNG")
                tile_bytes = buffer.getvalue()

                b64_data = base64.b64encode(tile_bytes).decode("utf-8")

                result.append(
                    ProcessedFile(
                        data=b64_data,
                        mime_type="image/png",
                        width=x2 - x1,
                        height=y2 - y1,
                    )
                )

                if len(result) >= self.MAX_TILES:
                    break
            if len(result) >= self.MAX_TILES:
                break

        return result

    async def process(self, url: str, mime_type: str) -> ProcessingResult:
        """Process a file from URL.

        Args:
            url: URL to fetch file from
            mime_type: MIME type of file

        Returns:
            ProcessingResult with processed files

        Raises:
            FileProcessingError: If fetching or processing fails
        """
        try:
            # Fetch file (follow redirects for hosted files)
            async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
                response = await client.get(url)
                response.raise_for_status()
                data = response.content
        except Exception as e:
            raise FileProcessingError(f"Failed to fetch file: {e}") from e

        size_bytes = len(data)

        # For images, get dimensions
        width = 0
        height = 0
        if mime_type in SUPPORTED_IMAGE_TYPES:
            try:
                img = Image.open(io.BytesIO(data))
                width, height = img.size
            except Exception:
                pass

        # Determine action
        action = self._get_action(size_bytes, width, height, mime_type)

        # Process based on action
        if action == ProcessingAction.RENDER_PAGES:
            files = self._process_pdf(data)
            return ProcessingResult(
                files=files,
                action=action,
                original_pages=len(files),
            )

        elif action == ProcessingAction.TILE:
            files = self._tile_image(data)
            return ProcessingResult(files=files, action=action)

        elif action == ProcessingAction.COMPRESS:
            file = self._compress_image(data, mime_type)
            return ProcessingResult(files=[file], action=action)

        else:  # DIRECT
            b64_data = base64.b64encode(data).decode("utf-8")
            file = ProcessedFile(
                data=b64_data,
                mime_type=mime_type,
                width=width,
                height=height,
            )
            return ProcessingResult(files=[file], action=action)
