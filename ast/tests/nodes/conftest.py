"""Pytest configuration for nodes tests."""

import sys
from pathlib import Path

# Ensure src is in path (should be handled by pyproject.toml pythonpath but adding as fallback)
src_path = Path(__file__).parent.parent.parent / "src"
if str(src_path) not in sys.path:
    sys.path.insert(0, str(src_path))
