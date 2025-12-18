"""
LLM Model instantiation.

Provides get_model() for creating LangChain chat model instances.
Supports both string-based IDs (new) and enum-based names (deprecated).
"""

import logging
from functools import cache
from typing import TypeAlias

from langchain_anthropic import ChatAnthropic
from langchain_aws import ChatBedrock
from langchain_community.chat_models import FakeListChatModel
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_google_vertexai import ChatVertexAI
from langchain_groq import ChatGroq
from langchain_ollama import ChatOllama
from langchain_openai import AzureChatOpenAI, ChatOpenAI
from langchain_xai import ChatXAI

from core.profiling import log_timing, start_timer
from core.settings import settings

logger = logging.getLogger("profiling")

# Import deprecated enums for backwards compatibility
from schema.models import (
    AllModelEnum,
    AnthropicModelName,
    AWSModelName,
    AzureOpenAIModelName,
    DeepseekModelName,
    FakeModelName,
    GoogleModelName,
    GroqModelName,
    OllamaModelName,
    OpenAICompatibleName,
    OpenAIModelName,
    OpenRouterModelName,
    VertexAIModelName,
    XAIModelName,
)

_MODEL_TABLE = (
    {m: m.value for m in OpenAIModelName}
    | {m: m.value for m in OpenAICompatibleName}
    | {m: m.value for m in AzureOpenAIModelName}
    | {m: m.value for m in DeepseekModelName}
    | {m: m.value for m in AnthropicModelName}
    | {m: m.value for m in GoogleModelName}
    | {m: m.value for m in VertexAIModelName}
    | {m: m.value for m in GroqModelName}
    | {m: m.value for m in XAIModelName}
    | {m: m.value for m in AWSModelName}
    | {m: m.value for m in OllamaModelName}
    | {m: m.value for m in OpenRouterModelName}
    | {m: m.value for m in FakeModelName}
)


class FakeToolModel(FakeListChatModel):
    def __init__(self, responses: list[str]):
        super().__init__(responses=responses)

    def bind_tools(self, tools):
        return self


ModelT: TypeAlias = (
    AzureChatOpenAI
    | ChatOpenAI
    | ChatAnthropic
    | ChatGoogleGenerativeAI
    | ChatVertexAI
    | ChatGroq
    | ChatXAI
    | ChatBedrock
    | ChatOllama
    | FakeToolModel
)


def _detect_provider(model_id: str) -> str:
    """
    Auto-detect provider from model ID using heuristics.

    Args:
        model_id: Model identifier string

    Returns:
        Provider name string

    Raises:
        ValueError: If provider cannot be detected
    """
    model_lower = model_id.lower()

    # OpenAI patterns
    if model_lower.startswith(("gpt-", "o1-", "o3-")):
        return "openai"

    # Anthropic patterns
    if model_lower.startswith("claude-"):
        return "anthropic"

    # Google patterns
    if model_lower.startswith("gemini-"):
        return "google"

    # Groq patterns (Llama, Mixtral, Gemma)
    if any(x in model_lower for x in ["llama", "mixtral", "gemma"]):
        return "groq"

    # XAI patterns
    if model_lower.startswith("grok-"):
        return "xai"

    # Deepseek patterns
    if model_lower.startswith("deepseek-"):
        return "deepseek"

    # AWS Bedrock patterns
    if "." in model_id and any(x in model_lower for x in ["anthropic", "amazon", "meta"]):
        return "aws"

    # OpenRouter patterns (provider/model format)
    if "/" in model_id and not model_lower.startswith("meta-llama"):
        return "openrouter"

    # Ollama (generic)
    if model_lower == "ollama" or (settings.OLLAMA_BASE_URL and settings.OLLAMA_MODEL):
        return "ollama"

    raise ValueError(
        f"Cannot detect provider for model '{model_id}'. "
        "Please specify provider explicitly."
    )


@cache
def get_model(model_name: AllModelEnum | str, /, provider: str | None = None) -> ModelT:
    """
    Get a LangChain chat model instance.

    Supports two modes:
    1. Enum-based (deprecated): get_model(OpenAIModelName.GPT_5_NANO)
    2. String-based (new): get_model("gpt-5-nano") or get_model("gemini-3-flash-preview", provider="google")

    Args:
        model_name: Model identifier (enum or string)
        provider: Provider name (optional, auto-detected if not specified)

    Returns:
        Configured chat model instance

    Raises:
        ValueError: If provider unknown or model unsupported
    """
    start = start_timer()
    logger.warning(f"⏱️ [model_init] Creating {model_name}...")

    model: ModelT | None = None

    # Check if it's an enum (legacy API) or plain string (new API)
    # NOTE: StrEnum is subclass of str, so check enum membership first!
    from enum import Enum
    is_enum = isinstance(model_name, Enum)

    if not is_enum and isinstance(model_name, str):
        # NEW STRING-BASED API
        model_id = model_name

        # Auto-detect provider if not specified
        if provider is None:
            provider = _detect_provider(model_id)

        # Route to provider-specific instantiation
        match provider:
            case "openai":
                model = ChatOpenAI(model=model_id, streaming=True)

            case "anthropic":
                model = ChatAnthropic(model=model_id, temperature=0.5, streaming=True)

            case "google":
                model = ChatGoogleGenerativeAI(
                    model=model_id, temperature=0.5, streaming=True
                )

            case "groq":
                # Special case: Llama Guard needs temperature=0
                if "llama-guard" in model_id.lower():
                    model = ChatGroq(model=model_id, temperature=0.0)  # type: ignore[call-arg]
                else:
                    model = ChatGroq(model=model_id, temperature=0.5)  # type: ignore[call-arg]

            case "xai":
                model = ChatXAI(
                    model=model_id,
                    temperature=0.5,
                    streaming=True,
                    xai_api_key=settings.XAI_API_KEY,
                    search_parameters={
                        "mode": "auto",
                        "sources": [
                            {"type": "web"},
                            {"type": "x"},
                            {"type": "news"},
                        ],
                        "max_search_results": 20,
                        "return_citations": True,
                    },
                )

            case "deepseek":
                model = ChatOpenAI(
                    model=model_id,
                    temperature=0.5,
                    streaming=True,
                    openai_api_base="https://api.deepseek.com",
                    openai_api_key=settings.DEEPSEEK_API_KEY,
                )

            case "aws":
                model = ChatBedrock(model_id=model_id, temperature=0.5)

            case "ollama":
                actual_model = settings.OLLAMA_MODEL or model_id
                if settings.OLLAMA_BASE_URL:
                    model = ChatOllama(
                        model=actual_model,
                        temperature=0.5,
                        base_url=settings.OLLAMA_BASE_URL,
                    )
                else:
                    model = ChatOllama(model=actual_model, temperature=0.5)

            case "openrouter":
                model = ChatOpenAI(
                    model=model_id,
                    temperature=0.5,
                    streaming=True,
                    base_url="https://openrouter.ai/api/v1/",
                    api_key=settings.OPENROUTER_API_KEY,
                )

            case "azure":
                if not settings.AZURE_OPENAI_API_KEY or not settings.AZURE_OPENAI_ENDPOINT:
                    raise ValueError("Azure OpenAI API key and endpoint must be configured")
                model = AzureChatOpenAI(
                    azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
                    deployment_name=model_id,
                    api_version=settings.AZURE_OPENAI_API_VERSION,
                    temperature=0.5,
                    streaming=True,
                )

            case "vertexai":
                model = ChatVertexAI(model=model_id, temperature=0.5, streaming=True)

            case "fake":
                model = FakeToolModel(
                    responses=["This is a test response from the fake model."]
                )

            case _:
                raise ValueError(f"Unsupported provider: {provider}")

    else:
        # LEGACY ENUM-BASED API (backwards compatibility)
        api_model_name = _MODEL_TABLE.get(model_name)
        if not api_model_name:
            raise ValueError(f"Unsupported model: {model_name}")

        if model_name in OpenAIModelName:
            model = ChatOpenAI(model=api_model_name, streaming=True)
        elif model_name in OpenAICompatibleName:
            if not settings.COMPATIBLE_BASE_URL or not settings.COMPATIBLE_MODEL:
                raise ValueError("OpenAICompatible base url and endpoint must be configured")
            model = ChatOpenAI(
                model=settings.COMPATIBLE_MODEL,
                temperature=0.5,
                streaming=True,
                openai_api_base=settings.COMPATIBLE_BASE_URL,
                openai_api_key=settings.COMPATIBLE_API_KEY,
            )
        elif model_name in AzureOpenAIModelName:
            if not settings.AZURE_OPENAI_API_KEY or not settings.AZURE_OPENAI_ENDPOINT:
                raise ValueError("Azure OpenAI API key and endpoint must be configured")
            model = AzureChatOpenAI(
                azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
                deployment_name=api_model_name,
                api_version=settings.AZURE_OPENAI_API_VERSION,
                temperature=0.5,
                streaming=True,
                timeout=60,
                max_retries=3,
            )
        elif model_name in DeepseekModelName:
            model = ChatOpenAI(
                model=api_model_name,
                temperature=0.5,
                streaming=True,
                openai_api_base="https://api.deepseek.com",
                openai_api_key=settings.DEEPSEEK_API_KEY,
            )
        elif model_name in AnthropicModelName:
            model = ChatAnthropic(model=api_model_name, temperature=0.5, streaming=True)
        elif model_name in GoogleModelName:
            model = ChatGoogleGenerativeAI(model=api_model_name, temperature=0.5, streaming=True)
        elif model_name in VertexAIModelName:
            model = ChatVertexAI(model=api_model_name, temperature=0.5, streaming=True)
        elif model_name in GroqModelName:
            if model_name == GroqModelName.LLAMA_GUARD_4_12B:
                model = ChatGroq(model=api_model_name, temperature=0.0)  # type: ignore[call-arg]
            else:
                model = ChatGroq(model=api_model_name, temperature=0.5)  # type: ignore[call-arg]
        elif model_name in XAIModelName:
            model = ChatXAI(
                model=api_model_name,
                temperature=0.5,
                streaming=True,
                xai_api_key=settings.XAI_API_KEY,
                search_parameters={
                    "mode": "auto",
                    "sources": [
                        {"type": "web"},
                        {"type": "x"},
                        {"type": "news"},
                    ],
                    "max_search_results": 20,
                    "return_citations": True,
                },
            )
        elif model_name in AWSModelName:
            model = ChatBedrock(model_id=api_model_name, temperature=0.5)
        elif model_name in OllamaModelName:
            if settings.OLLAMA_BASE_URL:
                model = ChatOllama(
                    model=settings.OLLAMA_MODEL, temperature=0.5, base_url=settings.OLLAMA_BASE_URL
                )
            else:
                model = ChatOllama(model=settings.OLLAMA_MODEL, temperature=0.5)
        elif model_name in OpenRouterModelName:
            model = ChatOpenAI(
                model=api_model_name,
                temperature=0.5,
                streaming=True,
                base_url="https://openrouter.ai/api/v1/",
                api_key=settings.OPENROUTER_API_KEY,
            )
        elif model_name in FakeModelName:
            model = FakeToolModel(responses=["This is a test response from the fake model."])

    if model is None:
        raise ValueError(f"Unsupported model: {model_name}")

    log_timing(f"model_init_{model_name}", start)
    return model
