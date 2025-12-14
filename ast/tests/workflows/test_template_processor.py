"""Tests for workflow template processor."""

import pytest
from datetime import datetime

from workflows.template_processor import (
    WEEKDAYS_PT,
    MONTHS_PT,
    resolve_datetime,
    process_template,
)


# Fixture for consistent datetime testing
@pytest.fixture
def fixed_friday():
    """Friday, December 13, 2024 at 14:30:45"""
    return datetime(2024, 12, 13, 14, 30, 45)


@pytest.fixture
def fixed_monday():
    """Monday, January 1, 2024 at 09:05:00"""
    return datetime(2024, 1, 1, 9, 5, 0)


# =============================================================================
# Tests for WEEKDAYS_PT and MONTHS_PT constants
# =============================================================================


def test_weekdays_pt_length():
    """Should have 7 weekdays."""
    assert len(WEEKDAYS_PT) == 7


def test_weekdays_pt_monday_first():
    """Monday (segunda-feira) should be at index 0."""
    assert WEEKDAYS_PT[0] == "segunda-feira"


def test_weekdays_pt_sunday_last():
    """Sunday (domingo) should be at index 6."""
    assert WEEKDAYS_PT[6] == "domingo"


def test_months_pt_length():
    """Should have 12 months."""
    assert len(MONTHS_PT) == 12


def test_months_pt_january_first():
    """January (janeiro) should be at index 0."""
    assert MONTHS_PT[0] == "janeiro"


def test_months_pt_december_last():
    """December (dezembro) should be at index 11."""
    assert MONTHS_PT[11] == "dezembro"


# =============================================================================
# Tests for resolve_datetime function
# =============================================================================


def test_resolve_datetime_default(fixed_friday):
    """Default format should be full PT-BR datetime."""
    result = resolve_datetime(None, fixed_friday)
    assert "sexta-feira" in result
    assert "13 de dezembro de 2024" in result
    assert "14:30" in result


def test_resolve_datetime_empty_string(fixed_friday):
    """Empty string should behave like None (default format)."""
    result = resolve_datetime("", fixed_friday)
    assert "sexta-feira" in result
    assert "13 de dezembro de 2024" in result


def test_resolve_datetime_iso(fixed_friday):
    """ISO format should return ISO 8601 string."""
    result = resolve_datetime("iso", fixed_friday)
    assert result == "2024-12-13T14:30:45"


def test_resolve_datetime_date(fixed_friday):
    """Date format should return DD/MM/YYYY."""
    result = resolve_datetime("date", fixed_friday)
    assert result == "13/12/2024"


def test_resolve_datetime_date_iso(fixed_friday):
    """Date ISO format should return YYYY-MM-DD."""
    result = resolve_datetime("date.iso", fixed_friday)
    assert result == "2024-12-13"


def test_resolve_datetime_time(fixed_friday):
    """Time format should return HH:MM."""
    result = resolve_datetime("time", fixed_friday)
    assert result == "14:30"


def test_resolve_datetime_time_with_leading_zero(fixed_monday):
    """Time format should preserve leading zeros."""
    result = resolve_datetime("time", fixed_monday)
    assert result == "09:05"


def test_resolve_datetime_weekday(fixed_friday):
    """Weekday format should return weekday name in PT-BR."""
    result = resolve_datetime("weekday", fixed_friday)
    assert result == "sexta-feira"


def test_resolve_datetime_weekday_monday(fixed_monday):
    """Weekday format for Monday."""
    result = resolve_datetime("weekday", fixed_monday)
    assert result == "segunda-feira"


def test_resolve_datetime_month(fixed_friday):
    """Month format should return month name in PT-BR."""
    result = resolve_datetime("month", fixed_friday)
    assert result == "dezembro"


def test_resolve_datetime_month_january(fixed_monday):
    """Month format for January."""
    result = resolve_datetime("month", fixed_monday)
    assert result == "janeiro"


def test_resolve_datetime_year(fixed_friday):
    """Year format should return year as string."""
    result = resolve_datetime("year", fixed_friday)
    assert result == "2024"


def test_resolve_datetime_day(fixed_friday):
    """Day format should return day of month as string."""
    result = resolve_datetime("day", fixed_friday)
    assert result == "13"


def test_resolve_datetime_day_single_digit(fixed_monday):
    """Day format for single digit day (no leading zero)."""
    result = resolve_datetime("day", fixed_monday)
    assert result == "1"


def test_resolve_datetime_unknown_variation_fallback(fixed_friday):
    """Unknown variation should fallback to ISO format."""
    result = resolve_datetime("unknown_variation", fixed_friday)
    assert result == "2024-12-13T14:30:45"


# =============================================================================
# Tests for process_template function - @current_datetime
# =============================================================================


def test_process_template_current_datetime_default(fixed_friday):
    """@current_datetime should be replaced with full PT-BR format."""
    result = process_template("Hoje é @current_datetime.", now=fixed_friday)
    assert "sexta-feira" in result
    assert "13 de dezembro de 2024" in result
    assert "14:30" in result
    assert "@current_datetime" not in result


def test_process_template_current_datetime_iso(fixed_friday):
    """@current_datetime.iso should be replaced with ISO format."""
    result = process_template("Data: @current_datetime.iso", now=fixed_friday)
    assert "2024-12-13T14:30:45" in result
    assert "@current_datetime" not in result


def test_process_template_current_datetime_date(fixed_friday):
    """@current_datetime.date should be replaced with DD/MM/YYYY."""
    result = process_template("Data: @current_datetime.date", now=fixed_friday)
    assert "13/12/2024" in result


def test_process_template_current_datetime_date_iso(fixed_friday):
    """@current_datetime.date.iso should be replaced with YYYY-MM-DD."""
    result = process_template("Data: @current_datetime.date.iso", now=fixed_friday)
    assert "2024-12-13" in result


def test_process_template_current_datetime_weekday(fixed_friday):
    """@current_datetime.weekday should be replaced with weekday name."""
    result = process_template("Dia: @current_datetime.weekday", now=fixed_friday)
    assert "sexta-feira" in result


def test_process_template_current_datetime_month(fixed_friday):
    """@current_datetime.month should be replaced with month name."""
    result = process_template("Mês: @current_datetime.month", now=fixed_friday)
    assert "dezembro" in result


def test_process_template_current_datetime_time(fixed_friday):
    """@current_datetime.time should be replaced with HH:MM."""
    result = process_template("Hora: @current_datetime.time", now=fixed_friday)
    assert "14:30" in result


# =============================================================================
# Tests for process_template function - @model_name
# =============================================================================


def test_process_template_model_name():
    """@model_name should be replaced with provided model name."""
    result = process_template("Modelo: @model_name", model_name="gpt-4o-mini")
    assert "gpt-4o-mini" in result
    assert "@model_name" not in result


def test_process_template_model_name_missing():
    """@model_name should fallback to 'unknown' when not provided."""
    result = process_template("Modelo: @model_name")
    assert "unknown" in result
    assert "@model_name" not in result


def test_process_template_model_name_none():
    """@model_name should fallback to 'unknown' when None."""
    result = process_template("Modelo: @model_name", model_name=None)
    assert "unknown" in result


# =============================================================================
# Tests for process_template function - @thread_id
# =============================================================================


def test_process_template_thread_id():
    """@thread_id should be replaced with provided thread ID."""
    result = process_template("Thread: @thread_id", thread_id="abc-123-def")
    assert "abc-123-def" in result
    assert "@thread_id" not in result


def test_process_template_thread_id_missing():
    """@thread_id should fallback to 'unknown' when not provided."""
    result = process_template("Thread: @thread_id")
    assert "unknown" in result
    assert "@thread_id" not in result


def test_process_template_thread_id_none():
    """@thread_id should fallback to 'unknown' when None."""
    result = process_template("Thread: @thread_id", thread_id=None)
    assert "unknown" in result


# =============================================================================
# Tests for process_template function - Unknown variables
# =============================================================================


def test_process_template_unknown_variable_preserved():
    """Unknown variables should be preserved as-is."""
    result = process_template("Olá @unknown_var!")
    assert "@unknown_var" in result


def test_process_template_unknown_variable_with_variation():
    """Unknown variables with variations should be preserved."""
    result = process_template("Value: @unknown.variation")
    assert "@unknown.variation" in result


# =============================================================================
# Tests for process_template function - Multiple variables
# =============================================================================


def test_process_template_multiple_variables(fixed_friday):
    """Multiple variables should all be replaced."""
    template = "Hoje é @current_datetime.weekday. Modelo: @model_name. Thread: @thread_id."
    result = process_template(
        template,
        model_name="gpt-4o",
        thread_id="thread-123",
        now=fixed_friday,
    )
    assert "sexta-feira" in result
    assert "gpt-4o" in result
    assert "thread-123" in result
    assert "@" not in result  # All variables replaced


def test_process_template_same_variable_multiple_times(fixed_friday):
    """Same variable appearing multiple times should all be replaced."""
    template = "Data: @current_datetime.date e hora: @current_datetime.time"
    result = process_template(template, now=fixed_friday)
    assert "13/12/2024" in result
    assert "14:30" in result


# =============================================================================
# Tests for process_template function - Edge cases
# =============================================================================


def test_process_template_no_variables():
    """Template without variables should remain unchanged."""
    template = "Este é um texto sem variáveis."
    result = process_template(template)
    assert result == template


def test_process_template_empty_string():
    """Empty template should return empty string."""
    result = process_template("")
    assert result == ""


def test_process_template_variable_at_end():
    """Variable at end of string should be replaced."""
    result = process_template("Modelo é @model_name", model_name="gpt-4")
    assert result == "Modelo é gpt-4"


def test_process_template_variable_followed_by_punctuation(fixed_friday):
    """Variable followed by punctuation should be replaced."""
    result = process_template("Hoje é @current_datetime.weekday.", now=fixed_friday)
    assert "sexta-feira." in result


def test_process_template_variable_followed_by_comma(fixed_friday):
    """Variable followed by comma should be replaced."""
    result = process_template("Dia: @current_datetime.weekday, ok?", now=fixed_friday)
    assert "sexta-feira," in result


def test_process_template_variable_followed_by_question_mark(fixed_friday):
    """Variable followed by question mark should be replaced."""
    result = process_template("É @current_datetime.weekday?", now=fixed_friday)
    assert "sexta-feira?" in result


def test_process_template_variable_followed_by_exclamation(fixed_friday):
    """Variable followed by exclamation mark should be replaced."""
    result = process_template("Bom @current_datetime.weekday!", now=fixed_friday)
    assert "sexta-feira!" in result


def test_process_template_variable_followed_by_parenthesis(fixed_friday):
    """Variable followed by closing parenthesis should be replaced."""
    result = process_template("(é @current_datetime.weekday)", now=fixed_friday)
    assert "sexta-feira)" in result


def test_process_template_variable_followed_by_bracket(fixed_friday):
    """Variable followed by closing bracket should be replaced."""
    result = process_template("[hoje @current_datetime.weekday]", now=fixed_friday)
    assert "sexta-feira]" in result


def test_process_template_variable_followed_by_colon(fixed_friday):
    """Variable followed by colon should be replaced."""
    result = process_template("@current_datetime.weekday: fim de semana", now=fixed_friday)
    assert "sexta-feira:" in result


def test_process_template_variable_followed_by_semicolon(fixed_friday):
    """Variable followed by semicolon should be replaced."""
    result = process_template("dia @current_datetime.weekday; ok", now=fixed_friday)
    assert "sexta-feira;" in result


def test_process_template_uses_current_time_when_now_not_provided():
    """Should use current datetime when now parameter is not provided."""
    result = process_template("Ano: @current_datetime.year")
    # Should contain current year (not raise error)
    assert len(result) > 0
    assert "@current_datetime" not in result


# =============================================================================
# Tests for real-world prompt scenarios
# =============================================================================


def test_process_template_ivy_system_prompt(fixed_friday):
    """Real-world Ivy system prompt template."""
    template = """Você é a Ivy, assistente virtual inteligente do LivChat.

Data atual: @current_datetime

Você ajuda desenvolvedores e empresas a integrar o WhatsApp em suas aplicações.

Seja útil, amigável e concisa. Responda em português brasileiro."""

    result = process_template(template, now=fixed_friday)

    assert "Ivy" in result
    assert "sexta-feira" in result
    assert "13 de dezembro de 2024" in result
    assert "14:30" in result
    assert "@current_datetime" not in result


def test_process_template_technical_prompt(fixed_friday):
    """Technical prompt with multiple datetime variations."""
    template = """Sistema iniciado em @current_datetime.iso.
Data: @current_datetime.date.iso
Modelo: @model_name
Thread ID: @thread_id

Por favor, registre todas as interações."""

    result = process_template(
        template,
        model_name="gpt-4o-mini",
        thread_id="550e8400-e29b-41d4-a716-446655440000",
        now=fixed_friday,
    )

    assert "2024-12-13T14:30:45" in result
    assert "2024-12-13" in result
    assert "gpt-4o-mini" in result
    assert "550e8400-e29b-41d4-a716-446655440000" in result
    assert "@" not in result
