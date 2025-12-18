"""
Tests for refactored llm.py with string-based interface.

TDD: These tests define the expected behavior for:
1. _detect_provider() - auto-detect provider from model ID
2. get_model(model_id, provider) - new string-based interface
"""

import pytest
from unittest.mock import patch, MagicMock


class TestDetectProvider:
    """Tests for provider auto-detection from model ID."""

    def test_detect_openai_gpt(self):
        """GPT models should detect as OpenAI."""
        from core.llm import _detect_provider

        assert _detect_provider("gpt-5-nano") == "openai"
        assert _detect_provider("gpt-4o-mini") == "openai"
        assert _detect_provider("gpt-5.1") == "openai"

    def test_detect_openai_o_series(self):
        """O-series models should detect as OpenAI."""
        from core.llm import _detect_provider

        assert _detect_provider("o1-preview") == "openai"
        assert _detect_provider("o3-mini") == "openai"

    def test_detect_anthropic(self):
        """Claude models should detect as Anthropic."""
        from core.llm import _detect_provider

        assert _detect_provider("claude-sonnet-4-5") == "anthropic"
        assert _detect_provider("claude-haiku-4-5") == "anthropic"
        assert _detect_provider("claude-opus-4-5") == "anthropic"

    def test_detect_google(self):
        """Gemini models should detect as Google."""
        from core.llm import _detect_provider

        assert _detect_provider("gemini-3-flash-preview") == "google"
        assert _detect_provider("gemini-2.5-pro") == "google"
        assert _detect_provider("gemini-1.5-pro") == "google"

    def test_detect_groq_llama(self):
        """Llama models should detect as Groq."""
        from core.llm import _detect_provider

        assert _detect_provider("llama-3.3-70b") == "groq"
        assert _detect_provider("llama-3.1-8b") == "groq"
        assert _detect_provider("meta-llama/llama-guard-4-12b") == "groq"

    def test_detect_groq_mixtral(self):
        """Mixtral models should detect as Groq."""
        from core.llm import _detect_provider

        assert _detect_provider("mixtral-8x7b") == "groq"

    def test_detect_xai(self):
        """Grok models should detect as XAI."""
        from core.llm import _detect_provider

        assert _detect_provider("grok-4") == "xai"
        assert _detect_provider("grok-3-beta") == "xai"
        assert _detect_provider("grok-4-fast-non-reasoning") == "xai"

    def test_detect_deepseek(self):
        """Deepseek models should detect as Deepseek."""
        from core.llm import _detect_provider

        assert _detect_provider("deepseek-chat") == "deepseek"
        assert _detect_provider("deepseek-coder") == "deepseek"

    def test_detect_unknown_raises(self):
        """Unknown model should raise ValueError."""
        from core.llm import _detect_provider

        with pytest.raises(ValueError, match="Cannot detect provider"):
            _detect_provider("unknown-model-xyz")

    def test_detect_case_insensitive(self):
        """Detection should be case insensitive."""
        from core.llm import _detect_provider

        assert _detect_provider("GPT-5-NANO") == "openai"
        assert _detect_provider("Claude-Sonnet-4-5") == "anthropic"
        assert _detect_provider("GEMINI-3-FLASH-PREVIEW") == "google"


class TestGetModelStringInterface:
    """Tests for get_model with string-based interface."""

    @patch("core.llm.ChatOpenAI")
    def test_get_model_openai_auto_detect(self, mock_chat):
        """OpenAI model should auto-detect provider and instantiate correctly."""
        from core.llm import get_model

        # Clear cache for fresh test
        get_model.cache_clear()

        mock_chat.return_value = MagicMock()

        model = get_model("gpt-5-nano")

        mock_chat.assert_called_once_with(model="gpt-5-nano", streaming=True)

    @patch("core.llm.ChatGoogleGenerativeAI")
    def test_get_model_google_auto_detect(self, mock_chat):
        """Google model should auto-detect provider and instantiate correctly."""
        from core.llm import get_model

        get_model.cache_clear()
        mock_chat.return_value = MagicMock()

        model = get_model("gemini-3-flash-preview")

        mock_chat.assert_called_once_with(
            model="gemini-3-flash-preview",
            temperature=0.5,
            streaming=True,
        )

    @patch("core.llm.ChatAnthropic")
    def test_get_model_explicit_provider(self, mock_chat):
        """Explicit provider should be used without auto-detection."""
        from core.llm import get_model

        get_model.cache_clear()
        mock_chat.return_value = MagicMock()

        model = get_model("claude-sonnet-4-5", provider="anthropic")

        mock_chat.assert_called_once_with(
            model="claude-sonnet-4-5",
            temperature=0.5,
            streaming=True,
        )

    @patch("core.llm.ChatGroq")
    def test_get_model_groq_llama_guard_temp_zero(self, mock_chat):
        """Llama Guard should have temperature=0."""
        from core.llm import get_model

        get_model.cache_clear()
        mock_chat.return_value = MagicMock()

        model = get_model("meta-llama/llama-guard-4-12b", provider="groq")

        mock_chat.assert_called_once_with(
            model="meta-llama/llama-guard-4-12b",
            temperature=0.0,
        )

    @patch("core.llm.ChatGroq")
    def test_get_model_groq_regular_temp(self, mock_chat):
        """Regular Groq models should have temperature=0.5."""
        from core.llm import get_model

        get_model.cache_clear()
        mock_chat.return_value = MagicMock()

        model = get_model("llama-3.3-70b", provider="groq")

        mock_chat.assert_called_once_with(
            model="llama-3.3-70b",
            temperature=0.5,
        )

    def test_get_model_unsupported_provider(self):
        """Unsupported provider should raise ValueError."""
        from core.llm import get_model

        get_model.cache_clear()

        with pytest.raises(ValueError, match="Unsupported provider"):
            get_model("some-model", provider="unknown-provider")

    @patch("core.llm.ChatXAI")
    def test_get_model_xai_with_search(self, mock_chat):
        """XAI/Grok should include search parameters."""
        from core.llm import get_model

        get_model.cache_clear()
        mock_chat.return_value = MagicMock()

        with patch("core.llm.settings") as mock_settings:
            mock_settings.XAI_API_KEY = "test-key"

            model = get_model("grok-4", provider="xai")

            # Check that search_parameters were included
            call_kwargs = mock_chat.call_args[1]
            assert "search_parameters" in call_kwargs
            assert call_kwargs["search_parameters"]["mode"] == "auto"

    @patch("core.llm.FakeToolModel")
    def test_get_model_fake_for_testing(self, mock_fake):
        """Fake model should work for testing."""
        from core.llm import get_model

        get_model.cache_clear()
        mock_fake.return_value = MagicMock()

        model = get_model("fake", provider="fake")

        mock_fake.assert_called_once()

    def test_get_model_caching(self):
        """Same model should be cached and returned."""
        from core.llm import get_model

        get_model.cache_clear()

        with patch("core.llm.ChatOpenAI") as mock_chat:
            mock_instance = MagicMock()
            mock_chat.return_value = mock_instance

            model1 = get_model("gpt-5-nano")
            model2 = get_model("gpt-5-nano")

            # Should only be called once due to caching
            assert mock_chat.call_count == 1
            assert model1 is model2


class TestGetModelDeepseek:
    """Tests for Deepseek model instantiation."""

    @patch("core.llm.ChatOpenAI")
    def test_get_model_deepseek(self, mock_chat):
        """Deepseek should use OpenAI client with custom base URL."""
        from core.llm import get_model

        get_model.cache_clear()
        mock_chat.return_value = MagicMock()

        with patch("core.llm.settings") as mock_settings:
            mock_settings.DEEPSEEK_API_KEY = "test-key"

            model = get_model("deepseek-chat", provider="deepseek")

            mock_chat.assert_called_once()
            call_kwargs = mock_chat.call_args[1]
            assert call_kwargs["openai_api_base"] == "https://api.deepseek.com"


class TestGetModelOpenRouter:
    """Tests for OpenRouter model instantiation."""

    @patch("core.llm.ChatOpenAI")
    def test_get_model_openrouter(self, mock_chat):
        """OpenRouter should use OpenAI client with OpenRouter base URL."""
        from core.llm import get_model

        get_model.cache_clear()
        mock_chat.return_value = MagicMock()

        with patch("core.llm.settings") as mock_settings:
            mock_settings.OPENROUTER_API_KEY = "test-key"

            model = get_model("google/gemini-2.5-flash", provider="openrouter")

            mock_chat.assert_called_once()
            call_kwargs = mock_chat.call_args[1]
            assert call_kwargs["base_url"] == "https://openrouter.ai/api/v1/"
