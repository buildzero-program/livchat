"""Shared fixtures for workflow tests."""

import pytest
from unittest.mock import patch


@pytest.fixture
def mock_workflow_settings():
    """Mock settings for workflow router tests."""
    with patch("service.workflow_router.settings") as mock_settings:
        mock_settings.AUTH_SECRET = None
        yield mock_settings
