# Plan 24: Workflow Canvas Core

## Objetivo

Implementar o canvas visual para edição de workflows de agentes IA, usando React Flow como engine base. Esta fase foca no **core do frontend** - 100% mockado, sem integração com backend.

## Stack Técnico

- **@xyflow/react** v12 - Canvas engine (React Flow)
- **@dagrejs/dagre** - Auto-layout de nodes
- **zustand** - State management do canvas (opcional, começamos com useState)
- **framer-motion** - Animações (já temos)

## Arquitetura

```
components/workflows/canvas/
├── WorkflowCanvas.tsx           # Container principal do React Flow
├── nodes/
│   ├── index.ts                 # Export dos nodeTypes
│   ├── AgentNode.tsx            # Node de agente IA (principal)
│   ├── TriggerNode.tsx          # Node de trigger (entrada)
│   └── BaseNode.tsx             # Wrapper comum para todos nodes
├── edges/
│   ├── index.ts                 # Export dos edgeTypes
│   └── WorkflowEdge.tsx         # Edge customizada com label
├── controls/
│   ├── CanvasToolbar.tsx        # Toolbar: add node, auto-layout, zoom
│   └── CanvasControls.tsx       # Zoom in/out, fit view
└── hooks/
    └── useWorkflowCanvas.ts     # Estado e handlers do canvas
```

## Tipos de Nodes

### 1. TriggerNode
- **Propósito:** Ponto de entrada do workflow
- **Visual:** Ícone de raio, borda colorida
- **Handles:** Apenas output (direita)
- **Campos:** Tipo de trigger (message, schedule, webhook)

### 2. AgentNode
- **Propósito:** Representa um agente IA no fluxo
- **Visual:** Card com ícone, nome, modelo
- **Handles:** Input (esquerda) + Output (direita)
- **Campos:** Nome, modelo, instruções (resumo)

## Estrutura de Dados (Mock)

```typescript
interface WorkflowNode {
  id: string;
  type: 'trigger' | 'agent';
  position: { x: number; y: number };
  data: TriggerNodeData | AgentNodeData;
}

interface TriggerNodeData {
  label: string;
  triggerType: 'message' | 'schedule' | 'webhook';
}

interface AgentNodeData {
  label: string;
  model: string;
  instructions?: string;
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}
```

## Implementação Passo a Passo

### Fase 1: Setup Base
1. Instalar dependências (@xyflow/react)
2. Criar WorkflowCanvas.tsx com React Flow básico
3. Configurar background, minimap, controls

### Fase 2: Custom Nodes
1. Criar BaseNode wrapper (handles, seleção, hover)
2. Criar TriggerNode
3. Criar AgentNode
4. Registrar nodeTypes

### Fase 3: Custom Edges
1. Criar WorkflowEdge com path suave
2. Adicionar label opcional
3. Hover state com botão de delete

### Fase 4: Interatividade
1. useWorkflowCanvas hook com estado
2. Adicionar/remover nodes
3. Criar connections (drag handle)
4. Delete nodes/edges

### Fase 5: Toolbar & Controls
1. Toolbar: botões de adicionar node
2. Controls: zoom, fit view
3. Keyboard shortcuts (delete, undo?)

### Fase 6: Integração
1. Criar página /app/workflows/[id]/edit
2. Conectar canvas com mock data
3. Save/load estado (localStorage por agora)

## Mock Data Inicial

```typescript
const MOCK_NODES: WorkflowNode[] = [
  {
    id: 'trigger-1',
    type: 'trigger',
    position: { x: 100, y: 200 },
    data: { label: 'Nova Mensagem', triggerType: 'message' }
  },
  {
    id: 'agent-1',
    type: 'agent',
    position: { x: 400, y: 200 },
    data: { label: 'Assistente Ivy', model: 'gemini-2.0-flash' }
  }
];

const MOCK_EDGES: WorkflowEdge[] = [
  { id: 'e1', source: 'trigger-1', target: 'agent-1' }
];
```

## Critérios de Sucesso

- [ ] Canvas renderiza com background dots
- [ ] Nodes são arrastáveis e conectáveis
- [ ] Edges aparecem ao conectar handles
- [ ] Toolbar permite adicionar nodes
- [ ] Zoom/pan funcionam corretamente
- [ ] Visual limpo e consistente com o design system

## Referências

- **n8n:** Vue Flow com multi-segment edges, zoom compensation
- **app-template:** React Flow + Yjs para colaboração real-time
- **React Flow docs:** https://reactflow.dev/

---

## Progresso

- [x] Plano criado
- [x] Dependências instaladas (@xyflow/react v12.10.0)
- [x] Canvas base implementado (WorkflowCanvas.tsx)
- [x] Nodes customizados (TriggerNode, AgentNode)
- [x] Edges customizadas (WorkflowEdge com delete button)
- [x] Toolbar e controls (CanvasToolbar, CanvasControls)
- [x] Página de edição (/app/workflows/[id])
- [x] TypeScript compilando sem erros
