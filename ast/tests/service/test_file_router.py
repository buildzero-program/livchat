"""Tests for file router endpoint."""

import base64
import io
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from PIL import Image


@pytest.fixture
def client():
    """Create test client."""
    from service.service import app

    return TestClient(app)


class TestFileRouterEndpoint:
    """Tests for POST /files/process endpoint."""

    def test_process_pdf_returns_images(self, client):
        """POST /files/process with PDF returns list of images."""
        import fitz

        # Create simple PDF
        doc = fitz.open()
        doc.new_page(width=612, height=792)
        doc.new_page(width=612, height=792)
        pdf_bytes = doc.tobytes()
        doc.close()

        with patch("core.file_processor.httpx") as mock_httpx:
            mock_response = AsyncMock()
            mock_response.content = pdf_bytes
            mock_response.raise_for_status = AsyncMock()

            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_httpx.AsyncClient.return_value = mock_client

            response = client.post(
                "/files/process",
                json={"url": "https://example.com/doc.pdf", "mime_type": "application/pdf"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["action"] == "render"
        assert len(data["files"]) == 2
        assert data["original_pages"] == 2
        assert data["files"][0]["mime_type"] == "image/png"

    def test_process_small_image_returns_direct(self, client):
        """POST /files/process with small image returns direct."""
        # Create small image
        img = Image.new("RGB", (500, 500), color="red")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        image_bytes = buffer.getvalue()

        with patch("core.file_processor.httpx") as mock_httpx:
            mock_response = AsyncMock()
            mock_response.content = image_bytes
            mock_response.raise_for_status = AsyncMock()

            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_httpx.AsyncClient.return_value = mock_client

            response = client.post(
                "/files/process",
                json={"url": "https://example.com/image.png", "mime_type": "image/png"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["action"] == "direct"
        assert len(data["files"]) == 1
        assert data["files"][0]["width"] == 500
        assert data["files"][0]["height"] == 500

    def test_process_unsupported_type_returns_400(self, client):
        """POST /files/process with unsupported type returns 400."""
        with patch("core.file_processor.httpx") as mock_httpx:
            mock_response = AsyncMock()
            mock_response.content = b"video content"
            mock_response.raise_for_status = AsyncMock()

            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_httpx.AsyncClient.return_value = mock_client

            response = client.post(
                "/files/process",
                json={"url": "https://example.com/video.mp4", "mime_type": "video/mp4"},
            )

        assert response.status_code == 400
        assert "Unsupported" in response.json()["detail"]

    def test_process_invalid_url_returns_500(self, client):
        """POST /files/process with invalid URL returns 500."""
        with patch("core.file_processor.httpx") as mock_httpx:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(side_effect=Exception("Connection failed"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_httpx.AsyncClient.return_value = mock_client

            response = client.post(
                "/files/process",
                json={"url": "https://invalid.com/file.pdf", "mime_type": "application/pdf"},
            )

        assert response.status_code == 500
        assert "Failed to fetch" in response.json()["detail"]

    def test_process_missing_fields_returns_422(self, client):
        """POST /files/process with missing fields returns 422."""
        response = client.post("/files/process", json={"url": "https://example.com/file.pdf"})

        assert response.status_code == 422  # Validation error
