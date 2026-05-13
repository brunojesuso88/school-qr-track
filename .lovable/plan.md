## Nova aba "Eventos" na sidebar

Criar uma seção nova chamada **Eventos** ao lado de "Projetos", reaproveitando o padrão visual já utilizado na aba de projetos, mas com estrutura simplificada (sem os 9 tópicos institucionais — apenas dados básicos do evento + galeria de mídia).

### O que será criado

**1. Banco de dados — nova tabela `school_event_simple`**
Campos:
- `name` (texto, obrigatório) — nome do evento
- `event_date` (data) — data do evento
- `description` (texto) — descrição
- `cover_image` (texto) — URL da capa
- `images` (jsonb) — fotos do evento
- `created_by`, `created_at`, `updated_at`

RLS idêntica à `school_events`:
- Admin/Direção/Professor podem inserir/editar/excluir
- Admin/Direção/Professor/Funcionário podem visualizar

Armazenamento de imagens reaproveita o bucket privado existente `school-events`.

**2. Sidebar (`DashboardLayout.tsx`)**
Adicionar item logo abaixo de "Projetos":
- Nome: **Eventos**
- Rota: `/school-events`
- Ícone: `Calendar` (ou `PartyPopper`)
- Roles: admin, direction, teacher

**3. Nova rota e página**
- Rota `/school-events` em `App.tsx` (protegida por `AdminRoute`)
- Página `src/pages/SchoolEvents.tsx` com layout no mesmo estilo de `Events.tsx`:
  - Header com título "Eventos" e botão "Novo Evento"
  - Campo de busca por nome
  - Lista de cards de eventos

**4. Componentes (em `src/components/school-events/`)**
- `SchoolEventCard.tsx` — card visual com capa quadrada, nome, data e descrição resumida; ações Visualizar / Editar / Excluir
- `SchoolEventFormDialog.tsx` — dialog com 2 abas:
  - **Informações**: Nome, Data, Descrição
  - **Mídia**: Capa do evento + galeria de fotos (upload múltiplo)
- `SchoolEventDetailDialog.tsx` — visualização completa (capa, dados, galeria em grid)
- `types.ts` — tipo `SchoolEventSimple`

### Fora do escopo
- Geração de PDF (não solicitado para esta aba)
- Integração com IA (não solicitada)
- Tópicos institucionais (Justificativa, Objetivos, etc. — esses ficam na aba "Projetos")

### Observação
A aba existente **"Projetos"** (rota `/events`, tabela `school_events`) permanece intocada. A nova aba é totalmente independente para evitar misturar projetos institucionais com simples registros de eventos.
