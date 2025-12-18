# Planos de Desenvolvimento

Documentação dos planos de implementação do LivChat.

## Estrutura

```
plans/
├── archived/           # Planos concluídos ou obsoletos
├── plan-XX/            # Plano ativo com sua documentação
│   ├── plan-XX-*.md    # Plano principal
│   └── fase-X.X-*.md   # Documentos de exploração por fase
└── README.md           # Este arquivo
```

## Metodologia

### 1. Exploração Antes de Implementar

Cada fase passa por exploração profunda antes do TDD:

1. **Investigar** - Usar ferramentas de busca para entender o contexto
2. **Documentar** - Criar `fase-X.X-*.md` com descobertas e decisões
3. **Validar** - Confirmar que a abordagem é a melhor

### 2. TDD (Test-Driven Development)

Após exploração, seguir ciclo RED → GREEN → REFACTOR:

1. **RED** - Escrever testes que falham
2. **GREEN** - Implementar código mínimo para passar
3. **REFACTOR** - Melhorar sem quebrar testes

### 3. Documentação Contínua

- Atualizar status das fases no documento de exploração
- Manter CHANGELOG.md atualizado com mudanças
- Registrar decisões técnicas e trade-offs

## Planos

### Plan-15: Multimodal Files (Planejamento)

Suporte a upload e processamento de arquivos (imagens, PDFs, documentos) nos workflows.

| Fase | Descrição | Status |
|------|-----------|--------|
| 1 | Schema e Tipos | 📋 Planejado |
| 2 | Message Builder | 📋 Planejado |
| 3 | File Processor | 📋 Planejado |
| 4 | File Router | 📋 Planejado |
| 5 | Integração Workflow | 📋 Planejado |
| 6 | Client | 📋 Planejado |
| 7 | Dependências | 📋 Planejado |

### Plan-14: Model Registry ✅

Sistema dinâmico de descoberta de modelos LLM via SDKs nativos.

| Fase | Descrição | Status |
|------|-----------|--------|
| 1 | Schema ModelInfo | ✅ 10 testes |
| 2 | Model Registry | ✅ 27 testes |
| 3 | Model Router | ✅ 13 testes |
| 4 | Deprecar Enums | ✅ Documentado |

### Plan-11: AST Workflows System ✅

Sistema de workflows dinâmicos para a Ivy e futuros agentes AI.

| Fase | Descrição | Status |
|------|-----------|--------|
| 1.1 | Schema Layer (Pydantic) | ✅ 25 testes |
| 1.2 | Storage Layer (PostgresStore) | ✅ 16 testes |
| 1.3 | Template Processor | ✅ 52 testes |
| 2.1 | Workflow Agent | ✅ 24 testes |
| 3.1 | API Router | ✅ 17 testes |
| 4.1 | LivChat Database Schema | ✅ Completa |
| 5.1 | LivChat Service Layer | ✅ Completa |
| 6.1 | LivChat tRPC Router (Ivy) | ✅ Completa |
| 7.1 | LivChat UI Integration | ✅ Completa |
| 8.1 | PartyKit Real-Time Streaming | ✅ Completa |

## Comandos

```bash
# Rodar testes do AST
cd /home/pedro/dev/sandbox/livchat/ast
uv run pytest tests/workflows/ -v

# Rodar testes do LivChat
cd /home/pedro/dev/sandbox/livchat/app
bun test
```
