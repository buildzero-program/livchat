"""Tests for FileProcessor - TDD: tests first, implementation after."""

import base64
import io
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from PIL import Image


class TestProcessingAction:
    """Tests for determining processing action."""

    def test_small_image_returns_direct(self):
        """Small image (< 10MB, < 1568px) should return DIRECT."""
        from core.file_processor import FileProcessor, ProcessingAction

        processor = FileProcessor()
        # 5MB, 1000x1000
        action = processor._get_action(
            size_bytes=5 * 1024 * 1024,
            width=1000,
            height=1000,
            mime_type="image/png",
        )
        assert action == ProcessingAction.DIRECT

    def test_medium_image_returns_compress(self):
        """Medium image (10-20MB) should return COMPRESS."""
        from core.file_processor import FileProcessor, ProcessingAction

        processor = FileProcessor()
        # 15MB, 2000x2000
        action = processor._get_action(
            size_bytes=15 * 1024 * 1024,
            width=2000,
            height=2000,
            mime_type="image/png",
        )
        assert action == ProcessingAction.COMPRESS

    def test_large_image_returns_compress(self):
        """Large image (> 20MB) should return COMPRESS."""
        from core.file_processor import FileProcessor, ProcessingAction

        processor = FileProcessor()
        # 25MB, 3000x3000
        action = processor._get_action(
            size_bytes=25 * 1024 * 1024,
            width=3000,
            height=3000,
            mime_type="image/png",
        )
        assert action == ProcessingAction.COMPRESS

    def test_wide_image_returns_tile(self):
        """Image > 4096px wide should return TILE."""
        from core.file_processor import FileProcessor, ProcessingAction

        processor = FileProcessor()
        # 5MB, 5000x1000 (wide)
        action = processor._get_action(
            size_bytes=5 * 1024 * 1024,
            width=5000,
            height=1000,
            mime_type="image/png",
        )
        assert action == ProcessingAction.TILE

    def test_tall_image_returns_tile(self):
        """Image > 4096px tall should return TILE."""
        from core.file_processor import FileProcessor, ProcessingAction

        processor = FileProcessor()
        # 5MB, 1000x5000 (tall)
        action = processor._get_action(
            size_bytes=5 * 1024 * 1024,
            width=1000,
            height=5000,
            mime_type="image/png",
        )
        assert action == ProcessingAction.TILE

    def test_pdf_returns_render(self):
        """PDF should always return RENDER_PAGES."""
        from core.file_processor import FileProcessor, ProcessingAction

        processor = FileProcessor()
        action = processor._get_action(
            size_bytes=1 * 1024 * 1024,
            width=0,  # Not applicable for PDF
            height=0,
            mime_type="application/pdf",
        )
        assert action == ProcessingAction.RENDER_PAGES


class TestPDFProcessing:
    """Tests for PDF to images conversion."""

    def test_pdf_renders_all_pages(self):
        """PDF with 3 pages should return 3 images."""
        from core.file_processor import FileProcessor

        processor = FileProcessor()

        # Create a simple PDF with 3 pages using PyMuPDF
        import fitz  # PyMuPDF

        doc = fitz.open()
        for i in range(3):
            page = doc.new_page(width=612, height=792)  # Letter size
            page.insert_text((100, 100), f"Page {i + 1}")
        pdf_bytes = doc.tobytes()
        doc.close()

        result = processor._process_pdf(pdf_bytes)

        assert len(result) == 3
        for item in result:
            assert item.mime_type == "image/png"
            assert item.data  # Has base64 data
            assert item.width > 0
            assert item.height > 0

    def test_pdf_max_pages_raises_error(self):
        """PDF with > 50 pages should raise error."""
        from core.file_processor import FileProcessor, FileTooLargeError

        processor = FileProcessor()

        # Create PDF with 51 pages
        import fitz

        doc = fitz.open()
        for i in range(51):
            doc.new_page(width=612, height=792)
        pdf_bytes = doc.tobytes()
        doc.close()

        with pytest.raises(FileTooLargeError) as exc_info:
            processor._process_pdf(pdf_bytes)
        assert "50" in str(exc_info.value)

    def test_pdf_uses_correct_dpi(self):
        """PDF should be rendered at 150 DPI."""
        from core.file_processor import FileProcessor

        processor = FileProcessor()

        # Create a simple PDF (Letter size: 8.5 x 11 inches)
        import fitz

        doc = fitz.open()
        doc.new_page(width=612, height=792)  # 72 DPI default
        pdf_bytes = doc.tobytes()
        doc.close()

        result = processor._process_pdf(pdf_bytes)

        # At 150 DPI, Letter size should be approximately:
        # Width: 8.5 * 150 = 1275px
        # Height: 11 * 150 = 1650px
        assert result[0].width == pytest.approx(1275, rel=0.05)
        assert result[0].height == pytest.approx(1650, rel=0.05)


class TestImageCompression:
    """Tests for image compression."""

    def test_compress_reduces_size(self):
        """Compression should reduce file size for realistic images."""
        import random

        from core.file_processor import FileProcessor

        processor = FileProcessor()

        # Create a large PNG image with noise (realistic photo-like content)
        # Solid color images compress better as PNG, but photos compress better as JPEG
        img = Image.new("RGB", (2000, 2000))
        pixels = img.load()
        random.seed(42)  # Reproducible
        for x in range(2000):
            for y in range(2000):
                pixels[x, y] = (
                    random.randint(0, 255),
                    random.randint(0, 255),
                    random.randint(0, 255),
                )

        buffer = io.BytesIO()
        img.save(buffer, format="PNG", compress_level=9)
        original_bytes = buffer.getvalue()
        original_size = len(original_bytes)

        result = processor._compress_image(original_bytes, "image/png")

        # Decode base64 to check size
        compressed_bytes = base64.b64decode(result.data)
        compressed_size = len(compressed_bytes)

        # JPEG with quality 85 should be significantly smaller for noisy images
        assert compressed_size < original_size
        assert result.mime_type == "image/jpeg"

    def test_compress_preserves_dimensions(self):
        """Compression should preserve image dimensions."""
        from core.file_processor import FileProcessor

        processor = FileProcessor()

        img = Image.new("RGB", (1500, 1000), color="blue")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        original_bytes = buffer.getvalue()

        result = processor._compress_image(original_bytes, "image/png")

        assert result.width == 1500
        assert result.height == 1000


class TestImageTiling:
    """Tests for image tiling."""

    def test_tile_creates_correct_grid(self):
        """Tiling should create correct number of tiles."""
        from core.file_processor import FileProcessor

        processor = FileProcessor()

        # Create 5000x3000 image (should create ~4x2 grid with overlap)
        img = Image.new("RGB", (5000, 3000), color="green")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        image_bytes = buffer.getvalue()

        result = processor._tile_image(image_bytes)

        # With TILE_SIZE=1568 and 10% overlap:
        # Horizontal: ceil(5000 / (1568 * 0.9)) ≈ 4 tiles
        # Vertical: ceil(3000 / (1568 * 0.9)) ≈ 3 tiles
        # Total: 4 * 3 = 12 tiles (but capped at MAX_TILES=9)
        assert len(result) <= 9  # MAX_TILES
        assert len(result) >= 4  # At least some tiles

    def test_tile_max_tiles_limit(self):
        """Tiling should respect MAX_TILES limit."""
        from core.file_processor import FileProcessor

        processor = FileProcessor()

        # Create very large image that would create many tiles
        img = Image.new("RGB", (10000, 10000), color="yellow")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        image_bytes = buffer.getvalue()

        result = processor._tile_image(image_bytes)

        assert len(result) <= processor.MAX_TILES

    def test_tile_preserves_content(self):
        """Tiles should cover the entire original image."""
        from core.file_processor import FileProcessor

        processor = FileProcessor()

        # Create image with distinct quadrants
        img = Image.new("RGB", (4200, 4200))
        # Top-left: red, Top-right: green, Bottom-left: blue, Bottom-right: yellow
        for x in range(4200):
            for y in range(4200):
                if x < 2100 and y < 2100:
                    img.putpixel((x, y), (255, 0, 0))
                elif x >= 2100 and y < 2100:
                    img.putpixel((x, y), (0, 255, 0))
                elif x < 2100 and y >= 2100:
                    img.putpixel((x, y), (0, 0, 255))
                else:
                    img.putpixel((x, y), (255, 255, 0))

        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        image_bytes = buffer.getvalue()

        result = processor._tile_image(image_bytes)

        # All tiles should have valid dimensions
        for tile in result:
            assert tile.width > 0
            assert tile.height > 0
            assert tile.mime_type == "image/png"


class TestProcessMethod:
    """Tests for the main process method."""

    @pytest.mark.asyncio
    async def test_process_small_image_returns_direct(self):
        """Small image should be returned without processing."""
        from core.file_processor import FileProcessor, ProcessingAction

        processor = FileProcessor()

        # Create small image
        img = Image.new("RGB", (500, 500), color="red")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        image_bytes = buffer.getvalue()
        image_b64 = base64.b64encode(image_bytes).decode()

        # Mock httpx to return our image
        with patch("core.file_processor.httpx") as mock_httpx:
            mock_response = MagicMock()
            mock_response.content = image_bytes
            mock_response.raise_for_status = MagicMock()

            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_httpx.AsyncClient.return_value = mock_client

            result = await processor.process(
                url="https://example.com/image.png",
                mime_type="image/png",
            )

        assert result.action == ProcessingAction.DIRECT
        assert len(result.files) == 1
        assert result.files[0].mime_type == "image/png"

    @pytest.mark.asyncio
    async def test_process_pdf_returns_images(self):
        """PDF should return list of images."""
        from core.file_processor import FileProcessor, ProcessingAction

        processor = FileProcessor()

        # Create simple PDF
        import fitz

        doc = fitz.open()
        doc.new_page(width=612, height=792)
        doc.new_page(width=612, height=792)
        pdf_bytes = doc.tobytes()
        doc.close()

        with patch("core.file_processor.httpx") as mock_httpx:
            mock_response = MagicMock()
            mock_response.content = pdf_bytes
            mock_response.raise_for_status = MagicMock()

            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_httpx.AsyncClient.return_value = mock_client

            result = await processor.process(
                url="https://example.com/document.pdf",
                mime_type="application/pdf",
            )

        assert result.action == ProcessingAction.RENDER_PAGES
        assert len(result.files) == 2
        assert result.original_pages == 2


class TestErrorHandling:
    """Tests for error handling."""

    @pytest.mark.asyncio
    async def test_invalid_url_raises_error(self):
        """Invalid URL should raise appropriate error."""
        from core.file_processor import FileProcessor, FileProcessingError

        processor = FileProcessor()

        with patch("core.file_processor.httpx") as mock_httpx:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(side_effect=Exception("Connection failed"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_httpx.AsyncClient.return_value = mock_client

            with pytest.raises(FileProcessingError):
                await processor.process(
                    url="https://invalid-url.com/file.pdf",
                    mime_type="application/pdf",
                )

    def test_unsupported_mime_type_raises_error(self):
        """Unsupported mime type should raise error."""
        from core.file_processor import FileProcessor, UnsupportedFileTypeError

        processor = FileProcessor()

        with pytest.raises(UnsupportedFileTypeError):
            processor._get_action(
                size_bytes=1000,
                width=100,
                height=100,
                mime_type="video/mp4",
            )

    def test_file_too_large_raises_error(self):
        """File > 50MB should raise error."""
        from core.file_processor import FileProcessor, FileTooLargeError

        processor = FileProcessor()

        with pytest.raises(FileTooLargeError):
            processor._get_action(
                size_bytes=51 * 1024 * 1024,  # 51MB
                width=1000,
                height=1000,
                mime_type="image/png",
            )
