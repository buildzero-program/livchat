"""
Template processor for workflow prompts.

Supports variable substitution with the pattern @variable or @variable.variation.
All datetime formatting uses Brazilian Portuguese (PT-BR).
"""

import re
from datetime import datetime

# Brazilian Portuguese weekday names (Monday = 0, Sunday = 6)
WEEKDAYS_PT = [
    "segunda-feira",
    "terça-feira",
    "quarta-feira",
    "quinta-feira",
    "sexta-feira",
    "sábado",
    "domingo",
]

# Brazilian Portuguese month names (January = index 0)
MONTHS_PT = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
]


def resolve_datetime(variation: str | None, now: datetime) -> str:
    """
    Resolve a datetime variable with optional variation.

    Args:
        variation: The variation suffix (e.g., "iso", "date", "weekday")
        now: The datetime to format

    Returns:
        Formatted datetime string

    Variations:
        - None or "": Full PT-BR format "sexta-feira, 13 de dezembro de 2024 às 14:30"
        - "iso": ISO 8601 format "2024-12-13T14:30:45"
        - "date": Brazilian date format "13/12/2024"
        - "date.iso": ISO date format "2024-12-13"
        - "time": Time format "14:30"
        - "weekday": Weekday name in PT-BR "sexta-feira"
        - "month": Month name in PT-BR "dezembro"
        - "year": Year as string "2024"
        - "day": Day of month as string "13"
    """
    if variation is None or variation == "":
        # Default: "sexta-feira, 13 de dezembro de 2024 às 14:30"
        weekday = WEEKDAYS_PT[now.weekday()]
        month = MONTHS_PT[now.month - 1]
        return f"{weekday}, {now.day} de {month} de {now.year} às {now.strftime('%H:%M')}"

    match variation:
        case "iso":
            return now.isoformat()
        case "date":
            return now.strftime("%d/%m/%Y")
        case "date.iso":
            return now.strftime("%Y-%m-%d")
        case "time":
            return now.strftime("%H:%M")
        case "weekday":
            return WEEKDAYS_PT[now.weekday()]
        case "month":
            return MONTHS_PT[now.month - 1]
        case "year":
            return str(now.year)
        case "day":
            return str(now.day)
        case _:
            # Unknown variation: fallback to ISO format
            return now.isoformat()


def process_template(
    template: str,
    model_name: str | None = None,
    thread_id: str | None = None,
    now: datetime | None = None,
) -> str:
    """
    Process a template string, replacing variables with their values.

    Args:
        template: The template string containing @variable patterns
        model_name: The LLM model name (optional)
        thread_id: The thread/conversation ID (optional)
        now: The datetime to use for @current_datetime (defaults to datetime.now())

    Returns:
        Processed template with variables replaced

    Supported variables:
        - @current_datetime: Current date/time (supports variations)
        - @model_name: The LLM model name
        - @thread_id: The conversation thread ID

    Unknown variables are preserved as-is.

    Examples:
        >>> process_template("Hoje é @current_datetime.weekday")
        "Hoje é sexta-feira"

        >>> process_template("Modelo: @model_name", model_name="gpt-4o-mini")
        "Modelo: gpt-4o-mini"
    """
    if now is None:
        now = datetime.now()

    # Pattern: @variable or @variable.variation
    # Matches @word followed optionally by .word(.word)*
    # Must be followed by whitespace, end of string, or punctuation
    pattern = r"@(\w+)(?:\.(\w+(?:\.\w+)*))?(?=\s|$|[.,!?;:\)\]\}])"

    def replace_variable(match: re.Match) -> str:
        var_name = match.group(1)
        variation = match.group(2)

        match var_name:
            case "current_datetime":
                return resolve_datetime(variation, now)
            case "model_name":
                return model_name or "unknown"
            case "thread_id":
                return thread_id or "unknown"
            case _:
                # Unknown variable: preserve as-is
                return match.group(0)

    return re.sub(pattern, replace_variable, template)
