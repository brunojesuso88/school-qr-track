## Eventos e Atas

Nova área completa para registrar eventos do plano escolar (reuniões, projetos, formações, feiras, atas) com auxílio de IA, importação de PDF, galeria de fotos e exportação institucional.

### 1. Banco de dados (migration)

Tabela `school_events`:
- `id`, `created_at`, `updated_at`
- `title` (text)
- `enfoque` (text)
- `metas` (text)
- `pontos_atencao` (text)
- `acoes_estrategicas` (jsonb — array de strings)
- `procedimentos` (jsonb — array de strings)
- `responsaveis` (jsonb — array de strings)
- `prazo_inicio` (date), `prazo_fim` (date), `is_continuous` (bool)
- `status` (text: planejado | em_andamento | concluido | arquivado)
- `tags` (text[])
- `resumo_ia` (text)
- `images` (jsonb — array de paths no storage)
- `pdf_original` (text — path no storage)
- `created_by` (uuid)

RLS: admin/direction/teacher podem CRUD; staff somente leitura.

Bucket de Storage privado `school-events` com policies por role; subpastas `images/` e `pdfs/`.

### 2. Edge functions (Lovable AI Gateway, modelo `google/gemini-3-flash-preview`)

- `event-ai-suggest` — recebe `{ field, context }` e devolve sugestões para os campos: enfoque, metas, pontos_atencao, ações estratégicas (verbos infinitivo), procedimentos (gerúndio), tags, resumo institucional. Usa tool calling para JSON estruturado.
- `event-ai-fill` — “✨ Preencher com IA”: recebe rascunho parcial e devolve evento completo melhorado em linguagem institucional.
- `parse-event-pdf` — recebe PDF (base64), extrai texto (pdfjs no edge ou envio direto p/ Gemini multimodal) e devolve JSON com todos os campos preenchidos + resumo. Loading: “Analisando documento com IA...”.

### 3. Frontend

Rotas (`src/App.tsx`) protegidas por `AdminRoute` para admin/direction/teacher:
- `/events` — lista/timeline
- `/events/new` e `/events/:id/edit` — formulário (modal grande dentro da lista, não rota separada, para fluxo mais rápido)

Sidebar (`src/components/DashboardLayout.tsx`): adicionar item “Eventos e Atas” (ícone `ClipboardList`) entre “Frequência” e “Declarações”.

#### Página principal `src/pages/Events.tsx`
- Cabeçalho com título, subtítulo e botão **➕ Novo Evento**
- Dashboard de métricas no topo (4 cards): total, do mês, em andamento, concluídos + mini gráfico de responsáveis mais ativos (recharts)
- Barra de busca inteligente (filtra por título, enfoque, responsáveis, tags, texto)
- Filtros: data, responsável, status, tag
- **Timeline vertical** com cards (mais recentes primeiro), animados via framer-motion

#### Card do evento `src/components/events/EventCard.tsx`
- Miniatura da primeira imagem
- Título, resumo IA, badge de status colorido, badge de enfoque
- Datas e responsáveis
- Ações: visualizar, editar, exportar PDF, excluir

#### Formulário `src/components/events/EventFormDialog.tsx`
Modal grande, multi-seção com tabs ou acordeon:
1. Identificação (título, status, prazos)
2. Enfoque / Metas / Pontos de Atenção (textareas com botão ✨ ao lado para sugerir via IA)
3. Ações Estratégicas (lista dinâmica + IA sugere)
4. Procedimentos (lista dinâmica + IA converte ações → gerúndio)
5. Responsáveis (multi-select de usuários da `profiles` + adicionar manual)
6. Fotos do Evento (drag-and-drop, preview, compressão `browser-image-compression`, upload múltiplo p/ storage)
7. Botões topo: **📄 Importar PDF** e **✨ Preencher com IA** (preenche todo o formulário)

Tags geradas automaticamente pela IA ao salvar; usuário pode editar.

#### Visualização e exportação
- `src/components/events/EventDetailDialog.tsx` — visualização completa estilo ata
- Exportar PDF institucional via `jspdf` + `html2canvas` (já presentes no projeto pelos PEIs/declarações) com cabeçalho da escola, todas as seções e galeria

### 4. Notas técnicas
- Reutilizar padrões do AEE (PEIForm + Edge Functions Gemini) para consistência.
- Validações com Zod no client e nos edge functions.
- Realtime opcional não incluído (fora de escopo).
- Tratar 429/402 da Lovable AI Gateway com toast amigável.

### Arquivos a criar/editar
- Migration `school_events` + bucket `school-events` + RLS
- Edge functions: `event-ai-suggest`, `event-ai-fill`, `parse-event-pdf`
- `src/pages/Events.tsx`
- `src/components/events/EventCard.tsx`
- `src/components/events/EventFormDialog.tsx`
- `src/components/events/EventDetailDialog.tsx`
- `src/components/events/EventMetrics.tsx`
- `src/components/events/EventTimeline.tsx`
- `src/components/events/PdfImportButton.tsx`
- Editar: `src/App.tsx` (rota), `src/components/DashboardLayout.tsx` (sidebar)
