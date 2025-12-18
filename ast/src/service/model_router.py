"""
Model Router - FastAPI endpoints for LLM model discovery and validation.

Provides endpoints to list available models, get model info,
validate models, and refresh the model cache.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from core.model_registry import model_registry
from core.settings import settings
from schema.model_info import ModelInfo, ModelListResponse, ProviderName


# =============================================================================
# Authentication
# =============================================================================


def verify_bearer(
    http_auth: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(HTTPBearer(description="Please provide AUTH_SECRET api key.", auto_error=False)),
    ],
) -> None:
    """Verify Bearer token authentication."""
    if not settings.AUTH_SECRET:
        return  # No AUTH_SECRET configured, allow all requests
    auth_secret = settings.AUTH_SECRET.get_secret_value()
    if not http_auth or http_auth.credentials != auth_secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)


# =============================================================================
# Request/Response Schemas
# =============================================================================


class ValidateRequest(BaseModel):
    """Request body for model validation."""

    models: list[str]


class ValidateResponse(BaseModel):
    """Response for model validation."""

    valid: list[str]
    invalid: list[dict]  # {"model": str, "error": str}


class RefreshResponse(BaseModel):
    """Response for cache refresh."""

    refreshed_at: str
    providers: list[str]


# =============================================================================
# Router Setup
# =============================================================================


router = APIRouter(
    prefix="/models",
    tags=["models"],
    dependencies=[Depends(verify_bearer)],
)


# =============================================================================
# Endpoints
# =============================================================================


@router.get("", response_model=ModelListResponse)
async def list_models(
    provider: ProviderName | None = Query(None, description="Filter by provider"),
    force_refresh: bool = Query(False, description="Force cache refresh"),
) -> ModelListResponse:
    """
    List available LLM models.

    Args:
        provider: Filter by specific provider (optional)
        force_refresh: Force cache refresh before returning

    Returns:
        List of available models with cache info
    """
    models = await model_registry.get_models(
        provider=provider,
        force_refresh=force_refresh,
    )

    cache_info = model_registry.get_cache_info()
    # Get most recent cache timestamp
    timestamps = [v for v in cache_info.values() if v]
    cached_at = max(timestamps) if timestamps else None

    return ModelListResponse(
        models=models,
        cached_at=cached_at,
    )


@router.get("/providers", response_model=list[str])
async def list_providers() -> list[str]:
    """
    List configured providers (those with API keys).

    Returns:
        List of provider names
    """
    cache_info = model_registry.get_cache_info()
    return list(cache_info.keys())


@router.get("/info/{model_id}", response_model=ModelInfo)
async def get_model_info(model_id: str) -> ModelInfo:
    """
    Get detailed information about a specific model.

    Args:
        model_id: The model identifier

    Returns:
        Model information

    Raises:
        HTTPException: 404 if model not found
    """
    info = await model_registry.get_model_info(model_id)
    if info is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Modelo '{model_id}' não encontrado",
        )
    return info


@router.post("/validate", response_model=ValidateResponse)
async def validate_models(request: ValidateRequest) -> ValidateResponse:
    """
    Validate a list of model identifiers.

    Useful for validating models before creating/updating workflows.

    Args:
        request: List of model IDs to validate

    Returns:
        Lists of valid and invalid models
    """
    valid = []
    invalid = []

    for model_id in request.models:
        is_valid, error = await model_registry.validate_model(model_id)
        if is_valid:
            valid.append(model_id)
        else:
            invalid.append({"model": model_id, "error": error})

    return ValidateResponse(valid=valid, invalid=invalid)


@router.post("/refresh", response_model=RefreshResponse)
async def refresh_cache() -> RefreshResponse:
    """
    Force refresh of the model cache.

    Fetches models from all configured providers.

    Returns:
        Refresh timestamp and list of providers
    """
    await model_registry.refresh_all()
    cache_info = model_registry.get_cache_info()

    timestamps = [v for v in cache_info.values() if v]
    refreshed_at = max(timestamps) if timestamps else ""

    return RefreshResponse(
        refreshed_at=refreshed_at,
        providers=list(cache_info.keys()),
    )
