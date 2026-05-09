## Plano: refinar aba Projetos

### 1. Substituir "evento(s)" por "projeto(s)" em toda a aba
Trocar em strings visíveis ao usuário (mantendo nomes de tabela/rotas/components):
- `src/pages/Events.tsx` → toast "Erro ao carregar eventos" → "Erro ao carregar projetos".
- `src/components/events/EventMetrics.tsx` → "Total de eventos" → "Total de projetos"; "Eventos do mês" → "Projetos do mês".
- `src/components/events/EventDetailDialog.tsx` → "Evento contínuo" → "Projeto contínuo".
- `src/components/events/EventCard.tsx` → "Evento contínuo" → "Projeto contínuo".
- `src/components/events/EventFormDialog.tsx` →
  - "Evento preenchido pela IA" → "Projeto preenchido pela IA"
  - "Evento contínuo" → "Projeto contínuo"
  - placeholder "...do evento" → "...do projeto"
  - "...relacionado ao evento" → "...relacionado ao projeto"
  - "Fotos do Evento" → "Fotos do Projeto"

### 2. Card mais profissional e técnico (`EventCard.tsx`)

**Visual da capa (quadrada):**
- Substituir o bloco lateral atual (`md:w-48 h-40 md:h-auto`) por uma capa **quadrada fixa** de 160x160px (`w-40 h-40`), alinhada ao topo, com `object-cover` e `rounded-md`.
- Quando não houver capa: placeholder discreto (ícone `ClipboardList` centralizado em fundo `bg-muted`) mantendo a mesma área quadrada — evita cards sem imagem ficarem inconsistentes.
- Layout: `flex gap-4 p-4` (capa à esquerda + conteúdo à direita). Em mobile (<sm): capa no topo, full-width, ainda quadrada via `aspect-square` limitada a `max-w-[200px]`.

**Aspecto profissional/técnico:**
- Reduzir borda lateral colorida (`border-l-4`) para uma faixa mais sutil (`border-l-2`) e usar tipografia mais densa.
- Título em `text-base font-semibold tracking-tight` (em vez de `text-lg`) e adicionar pequena linha de metadados acima do título: status + período em fonte mono-like (`text-[11px] uppercase tracking-wider text-muted-foreground`).
- Padding interno consistente, sem gradientes; manter paleta semântica do design system.
- Botões de ação compactados em `size="sm" variant="ghost"` apenas com ícones + tooltip (Visualizar/Editar/PDF/Excluir), reduzindo poluição visual. Ações ficam no rodapé direito.

### 3. Auditoria de informações exibidas no card
Manter **apenas o essencial**, mover detalhes para o modal de visualização:

**Manter:**
- Título do projeto.
- Badge de status.
- Período / "Projeto contínuo" (1 linha).
- Resumo IA (`line-clamp-2`) — é o "pitch" do projeto.
- Linha de métricas compactas: nº de ações, nº de procedimentos, indicador "PDF" (se houver).
- Até 3 tags (resto colapsa em `+N`).
- Ações (ícones).

**Remover do card** (ainda visíveis no Detail/Edit):
- Linha "Enfoque: ..."
- Linha "Metas: ..."
- Indicador "Pontos de atenção" (já vai no detail)
- Lista de responsáveis (move para o detail)

Isso reduz o card de ~7 linhas de texto para 3-4, ficando limpo e escaneável.

### Fora do escopo
- Sem mudanças em rotas, tabela `school_events`, edge functions, lógica de IA ou PDF.
- Sem alterações no `EventFormDialog` além das trocas de termo da seção 1.
