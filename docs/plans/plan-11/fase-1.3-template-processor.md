# Fase 1.3 - Template Processor

## Status: COMPLETA (52 testes passando)

## Objetivo

Implementar processador de templates para substituir variáveis dinâmicas em system prompts de workflows.

---

## Exploração Realizada

### 1. Estado Atual do AST

**Template Processing existente:** Nenhum.

O `PromptConfig` em `src/schema/workflow_schema.py` apenas declara quais variáveis são usadas, mas não processa:

```python
class PromptConfig(BaseModel):
    system: str
    variables: list[str] = []  # Apenas declarativo
```

**Padrões encontrados no codebase:**

| Arquivo | Padrão Usado |
|---------|--------------|
| `research_assistant.py` | f-string simples |
| `interrupt_agent.py` | LangChain `.format()` |
| `llama_guard.py` | f-string + `.format()` |

### 2. Regex vs Jinja2 - Decisão

**Escolha: Regex simples**

| Critério | Regex | Jinja2 |
|----------|-------|--------|
| Dependências | Nenhuma | Nova dependência |
| Performance | O(n) linear | Overhead de compilação |
| Complexidade | Baixa | Alta |
| Lógica condicional | Não suporta | Suporta |
| Segurança | Seguro | Risco de code injection |
| Coerência LangChain | Sim (usa internamente) | Opcional |

**Trade-off aceito:** Sem lógica condicional (if/else em templates), mas simplifica muito a implementação e manutenção.

### 3. Sintaxe Escolhida

**Padrão:** `@variable` ou `@variable.variation`

**Exemplos:**
- `@current_datetime` → "sexta-feira, 13 de dezembro de 2024 às 14:30"
- `@current_datetime.iso` → "2024-12-13T14:30:00"
- `@current_datetime.date` → "13/12/2024"
- `@current_datetime.weekday` → "sexta-feira"
- `@model_name` → "gpt-4o-mini"
- `@thread_id` → "abc-123"

**Regex Pattern:**
```python
r"@(\w+)(?:\.(\w+(?:\.\w+)*))?(?=\s|$|[.,!?;:\)\]\}])"
```

### 4. Formatação PT-BR

Todas as datas em português brasileiro:

```python
WEEKDAYS_PT = [
    "segunda-feira", "terça-feira", "quarta-feira",
    "quinta-feira", "sexta-feira", "sábado", "domingo"
]

MONTHS_PT = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
]
```

---

## Especificação Técnica

### Variações Suportadas para `@current_datetime`

| Variation | Output Example | Format |
|-----------|----------------|--------|
| (default) | "sexta-feira, 13 de dezembro de 2024 às 14:30" | PT-BR completo |
| `.iso` | "2024-12-13T14:30:00" | ISO 8601 |
| `.date` | "13/12/2024" | DD/MM/YYYY |
| `.date.iso` | "2024-12-13" | YYYY-MM-DD |
| `.time` | "14:30" | HH:MM |
| `.weekday` | "sexta-feira" | Nome do dia |
| `.month` | "dezembro" | Nome do mês |
| `.year` | "2024" | Ano |
| `.day` | "13" | Dia do mês |

### Variáveis Suportadas

| Variable | Description | Default if missing |
|----------|-------------|-------------------|
| `@current_datetime` | Data/hora atual | Never missing |
| `@model_name` | Nome do modelo LLM | "unknown" |
| `@thread_id` | ID do thread | "unknown" |

### Comportamento de Variáveis Desconhecidas

Variáveis não reconhecidas são **mantidas como estão**:
```python
"Olá @unknown_var!" → "Olá @unknown_var!"
```

---

## Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `src/workflows/template_processor.py` | Implementação |
| `tests/workflows/test_template_processor.py` | Testes unitários |

---

## TDD - Casos de Teste

### Testes para `resolve_datetime`

1. `test_resolve_datetime_default` - Formato PT-BR completo
2. `test_resolve_datetime_iso` - ISO 8601
3. `test_resolve_datetime_date` - DD/MM/YYYY
4. `test_resolve_datetime_date_iso` - YYYY-MM-DD
5. `test_resolve_datetime_time` - HH:MM
6. `test_resolve_datetime_weekday` - Nome do dia
7. `test_resolve_datetime_month` - Nome do mês
8. `test_resolve_datetime_year` - Ano
9. `test_resolve_datetime_day` - Dia do mês
10. `test_resolve_datetime_unknown_variation` - Fallback ISO

### Testes para `process_template`

11. `test_current_datetime_default` - Substituição padrão
12. `test_current_datetime_with_variation` - Com variação
13. `test_model_name` - Variável model_name
14. `test_model_name_missing` - Fallback "unknown"
15. `test_thread_id` - Variável thread_id
16. `test_thread_id_missing` - Fallback "unknown"
17. `test_unknown_variable_preserved` - Manter @var desconhecida
18. `test_multiple_variables` - Múltiplas substituições
19. `test_no_variables` - Template sem variáveis
20. `test_variable_at_end_of_sentence` - Variável seguida de pontuação
21. `test_variable_in_middle_of_text` - Variável no meio do texto

---

## Próximos Passos

1. [ ] Criar testes em `tests/workflows/test_template_processor.py`
2. [ ] Rodar testes (RED)
3. [ ] Implementar `src/workflows/template_processor.py`
4. [ ] Rodar testes (GREEN)
5. [ ] Refatorar se necessário
6. [ ] Atualizar `__init__.py` com exports
