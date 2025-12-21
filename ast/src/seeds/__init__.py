"""
Auto-seed module for AST.

Seeds essential data on startup (like WuzAPI's initializeSchema).
"""

import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from langgraph.store.base import BaseStore

logger = logging.getLogger(__name__)

# =============================================================================
# Ivy Workflow Seed
# =============================================================================

IVY_WORKFLOW_ID = "wf_ivy"
DEFAULT_MODEL = "gemini-3-flash-preview"

IVY_SYSTEM_PROMPT = """Você é a Ivy, assistente virtual inteligente do LivChat.ai - a plataforma de WhatsApp API para desenvolvedores.

## Sua Personalidade
- Simpática, profissional e direta
- Usa emojis com moderação para humanizar
- Fala português brasileiro fluente
- Tom amigável mas técnico quando necessário

## Sobre o LivChat
O LivChat é uma API REST simples para integrar WhatsApp em aplicações:
- Enviar mensagens de texto, mídia, botões
- Receber webhooks de mensagens
- Gerenciar múltiplas instâncias WhatsApp
- Dashboard para monitoramento

## Contexto
Hoje é @current_datetime.
Modelo: @model_name

## Comportamento
1. Responda perguntas sobre o LivChat de forma clara
2. Para dúvidas técnicas, seja preciso e dê exemplos de código
3. Para pricing, direcione ao site livchat.ai
4. Se não souber algo, admita e sugira alternativas
5. Mantenha respostas concisas (máx 3 parágrafos)

## Exemplo de Código
Quando perguntarem sobre integração, mostre:

```bash
curl -X POST https://api.livchat.ai/v1/messages \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"to": "5511999999999", "text": "Hello!"}'
```
"""


def _get_ivy_workflow_data() -> dict:
    """Returns the Ivy workflow data structure."""
    now = datetime.now(timezone.utc).isoformat()
    return {
        "id": IVY_WORKFLOW_ID,
        "name": "Ivy",
        "description": "Assistente virtual do LivChat.ai",
        "flowData": {
            "nodes": [
                {
                    "id": "agent-1",
                    "name": "Ivy Agent",
                    "type": "agent",
                    "position": {"x": 100, "y": 100},
                    "config": {
                        "prompt": {
                            "system": IVY_SYSTEM_PROMPT,
                            "variables": ["current_datetime"],
                        },
                        "llm": {
                            "model": DEFAULT_MODEL,
                            "provider": "openai",
                            "temperature": 0.7,
                        },
                        "memory": {
                            "type": "buffer",
                            "tokenLimit": 16000,
                        },
                        "tools": [],
                    },
                }
            ],
            "edges": [],
        },
        "isActive": True,
        "createdAt": now,
        "updatedAt": now,
    }


# =============================================================================
# Main seed runner
# =============================================================================


async def run_seeds(store: "BaseStore") -> None:
    """
    Run all seeds on startup.

    Called from the FastAPI lifespan after store.setup().
    Similar to WuzAPI's initializeSchema() and App's db-setup.ts.
    """
    logger.info("🌱 Running seeds...")

    # Seed: Ivy Workflow
    namespace = ("workflows",)

    try:
        existing = await store.aget(namespace, IVY_WORKFLOW_ID)

        if existing:
            logger.info(f"   ⚠️  Workflow '{IVY_WORKFLOW_ID}' already exists, skipping")
        else:
            workflow_data = _get_ivy_workflow_data()
            await store.aput(namespace, IVY_WORKFLOW_ID, workflow_data)
            logger.info(f"   ✅ Created workflow '{IVY_WORKFLOW_ID}' (Ivy assistant)")
    except Exception as e:
        logger.error(f"   ❌ Failed to seed Ivy workflow: {e}")
        # Don't fail startup, just log the error

    logger.info("✅ Seeds complete!")
