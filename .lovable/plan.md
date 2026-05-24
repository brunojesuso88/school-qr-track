# Nova aba "PAEE" no editor do aluno (Sistema AEE)

## Objetivo

Adicionar uma 4ª aba **PAEE** (Plano de Atendimento Educacional Especializado, modelo Caxias/MA) ao modal de edição do aluno em `src/pages/AEE.tsx`, espelhando rigorosamente a estrutura/UX da aba **PEI** já existente, com sugestões geradas por IA via Lovable AI Gateway.

## Escopo de UI (componente novo `PAEEForm.tsx`)

Seguir mesmo padrão visual do `PEIForm.tsx` (tons azul/cinza, Shadcn, micro-feedback ao preencher).

1. **Cabeçalho de identificação** — Nome do estudante, Escola, Turma, Idade, Data, e seletor **Deficiência/CID** (Intelectual, Física, Auditiva, Surdez, Visual, TEA, Altas Habilidades/Superdotação, Múltipla, Outros). Nome/Turma pré-preenchidos a partir do `student` (snapshot), Escola via `useSchoolName`.
2. **Painel de organização do atendimento**:
   - Composição: Individual / Dupla / Grupo (Select).
   - Assistência na sala regular: checkboxes *Tradutor/Intérprete de Libras* e *Auxiliar de Apoio*.
   - Grid Seg–Sex (toggles) + campo Horário.
   - Periodicidade: Avaliação Inicial / 1º Semestre / 2º Semestre.
3. **Matriz Pedagógica** — 5 cards (Cognitiva, Motora, Comunicação, Social, Comportamento), cada um com 3 textareas: *Objetivos*, *Estratégias*, *Registro Avaliativo*. Tooltip explicativo por área (ex.: Motora → coordenação ampla e fina).
4. **Sugestões IA** por área/campo — botão "Sugerir com IA" em cada textarea, mesmo padrão usado no PEI (popover/lista para inserir).
5. **Rodapé** — campos texto para assinatura do Professor de AEE e Coordenador (texto livre, igual ao padrão atual do PEI).

## Integração na aba do modal (`src/pages/AEE.tsx`)

- `TabsList grid-cols-3` → `grid-cols-4`; adicionar `<TabsTrigger value="paee">PAEE</TabsTrigger>`.
- `<TabsContent value="paee">` renderiza `<PAEEForm>` com mesmo padrão de estado/`isEditMode`/`Salvar`/somente leitura do PEI.
- Novos estados: `paeeData`, `paeeSaving`, funções `loadPAEE`, `handleSavePAEE` análogas às de PEI.
- Exportar PDF do PAEE: botão na aba (mesmo padrão de `exportPEIReport`) gerando HTML formatado para impressão (`window.print`), seguindo layout oficial do modelo Caxias/MA. *(MVP — sem dependência nova.)*

## Backend

Nova tabela `public.student_paee` (1 PAEE por aluno, espelhando `student_pei`):

- `student_id uuid` (único)
- Identificação: `school`, `class_snapshot`, `age`, `elaboration_date`, `disability_type` (text — valor do select)
- Atendimento: `composition` (individual/dupla/grupo), `libras_interpreter bool`, `support_assistant bool`, `weekdays text[]`, `schedule_time text`, `periodicity` (text)
- Matriz: `pedagogical_matrix jsonb` (chave por área → `{objectives, strategies, evaluation_record}`)
- Assinaturas: `aee_teacher_signature`, `coordinator_signature`
- `created_by`, `created_at`, `updated_at`

RLS idêntica a `student_pei`: SELECT/INSERT/UPDATE para `admin|direction|teacher`; DELETE para `admin|direction`. Trigger `update_updated_at_column`.

## Sugestões IA

Reutilizar Lovable AI Gateway. Duas opções:

- **A) Estática:** novo `paeeSuggestions.ts` com listas por área/campo (rápido, sem custo). 
- **B) Dinâmica (recomendada):** nova edge function `paee-suggest` (modelo `google/gemini-3-flash-preview`) que recebe `{ area, field, studentContext }` e retorna 5 sugestões via tool calling estruturado. Usa o prompt do usuário como system prompt.

Plano: implementar **B** seguindo o mesmo formato das demais funções (`event-ai-suggest`), com botão "Sugerir com IA" que abre popover listando sugestões clicáveis.

## Fora de escopo (a confirmar se necessário)

- Auto-save em rascunho real-time (atualmente PEI salva por botão — manter mesmo padrão para consistência).
- Geração de PDF "pixel-perfect" idêntica ao formulário oficial digitalizado (faremos HTML imprimível alinhado ao modelo, sem libs adicionais).
- Assinatura digital com canvas/desenho (usando texto por ora).

## Arquivos a criar/editar

- **Criar:** `src/components/aee/PAEEForm.tsx`, `src/components/aee/paeeSuggestions.ts` (fallback), `supabase/functions/paee-suggest/index.ts`, migração SQL para `student_paee`.
- **Editar:** `src/pages/AEE.tsx` (4ª aba, load/save/export PAEE).

## Pergunta para confirmar antes de implementar

1. Sugestões IA: confirma a opção **B (edge function dinâmica)** ou prefere **A (lista estática)** para começar simples?
2. Exportar PDF: ok seguir o padrão atual do PEI (HTML imprimível via `window.print`) em vez de lib externa?