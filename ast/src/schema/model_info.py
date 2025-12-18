"""
Schema definitions for LLM model information.

Provides data models for representing model metadata
used by the ModelRegistry for dynamic discovery.
"""

from enum import StrEnum

from pydantic import BaseModel, Field


class ProviderName(StrEnum):
    """Supported LLM providers for dynamic discovery."""

    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    GROQ = "groq"
    XAI = "xai"
    OLLAMA = "ollama"


class ModelInfo(BaseModel):
    """Information about an LLM model."""

    id: str = Field(..., description="Model identifier (e.g., gpt-4o-mini)")
    provider: ProviderName = Field(..., description="Model provider")
    display_name: str | None = Field(None, description="Human-friendly name")
    context_window: int | None = Field(None, description="Context window in tokens")
    is_available: bool = Field(True, description="Whether the model is available")


class ModelListResponse(BaseModel):
    """Response schema for listing models."""

    models: list[ModelInfo] = Field(..., description="List of available models")
    cached_at: str | None = Field(None, description="Cache timestamp (ISO format)")
    ttl_seconds: int = Field(86400, description="Cache TTL in seconds (default 24h)")
