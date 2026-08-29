# Auditoria de Ocorrências + Conselho de Classe rápido

## O que existe hoje (verificado)

**Tabela `public.occurrences`** — campos reais: `id`, `student_id` (FK → students, ON DELETE CASCADE), `type` (text livre, só CHECK de comprimento ≥ 1 — não é enum), `description` (text, CHECK ≤ 1000 chars), `date`, `end_date`, `teacher_name`, `created_by`, `created_at`. Não há `updated_at`, não há anexos, não há status/cancelamento. Trigger `audit_occurrences_trigger` grava tudo em `audit_logs`.

**RLS atual** (4 policies, todas para `authenticated`):
- Ver: admin, direction, teacher
- Criar: admin, direction, teacher, **staff**
- Editar: admin, direction, teacher
- Excluir: admin, direction, teacher

Ou seja: `staff` consegue inserir mas não ver o que inseriu; professor pode excluir ocorrência de qualquer aluno.

**Dados reais**: 360 registros já usam `type = 'class_council'` — de longe o tipo mais usado (disciplinar: 99, outros: 39, doença: 13, atraso: 4, saída antecipada: 4). As descrições confirmam o problema de digitação repetitiva: "Não faz atividades / Notas baixas" aparece 43x, "Nenhuma atividade: Ing e Fis" 18x, "Infrequente" 11x, etc. — texto livre digitado à mão, com variações de grafia que impedem qualquer relatório agregado.

**Componentes envolvidos**
- `src/pages/Students.tsx` — lista de alunos, `OCCURRENCE_TYPES` (já inclui `class_council`), diálogo "Ocorrências - aluno", formulário "Nova ocorrência" (tipo + data + `end_date` só para atestado + textarea), exclusão, `occurrenceMap` (última data por aluno) que alimenta o filtro "Alunos com ocorrência" e a ordenação.
- `src/components/StudentReportModal.tsx` — detalhe do aluno com 5 abas (Frequência, Notas, Ocorrências, Atestados, Laudo); a aba Ocorrências lista tudo em ordem de data.
- `src/components/OccurrencesReportDialog.tsx` — PDF diário por turma via jsPDF/autoTable, colunas Aluno/Matrícula/Tipo/Registrado por/Descrição. Já rotula `class_council`.
- `src/lib/validations.ts` — `occurrenceSchema` (type, description ≤ 1000, date).

## Diagnóstico

O tipo `class_council` **já existe e já é reutilizável** — não é preciso criar categoria nova nem tabela nova. O gargalo não é o tipo, é o `description` em texto livre. Sem estrutura de itens, o preenchimento em reunião é lento e o histórico não é agregável.

Riscos de manter tudo misturado: relatório disciplinar polui com conselho de classe (que é pedagógico, não punitivo); filtro "Alunos com ocorrência" acende para quem só tem apontamento de conselho; permissões iguais (professor exclui registro de conselho de outro colega).

## Proposta recomendada

**Migration aditiva mínima, sem tabela nova e sem tocar nos 360 registros existentes.**

Adicionar a `occurrences`:
- `council_items text[] not null default '{}'` — presets marcados
- `updated_at timestamptz not null default now()` + trigger `update_updated_at_column`
- CHECK: `council_items` só pode ter conteúdo quando `type = 'class_council'`

Presets versionados no código (`src/lib/occurrences/councilPresets.ts`), com chaves estáveis e rótulos:
- `no_classwork` — Não realiza atividades em sala de aula
- `no_homework` — Não realiza atividades de casa
- `infrequent` — Aluno infrequente
- `low_grades` — Notas baixas
- `no_material` — Não traz material
- `behavior` — Comportamento inadequado
- `improving` — Apresentou melhora

Motivo de array de chaves em vez de tabela relacional: uma ocorrência de conselho é um único apontamento com N marcações, sempre lido junto do registro; array evita join, mantém o insert único e o RLS já existente.

**UX de registro rápido (dentro do fluxo atual, sem tela nova)**
No formulário Nova ocorrência, ao escolher "Conselho de Classe":
1. Grade de chips/checkboxes multi-select dos presets (toque único, sem digitação).
2. Campo livre "Observação do conselho" permanece, opcional e complementar — nunca substituído.
3. Data com default hoje; rótulo "Data da reunião".
4. Registrador automático (`teacher_name` do perfil, `created_by`), como já é feito.
5. Botão habilita com ≥ 1 preset **ou** observação preenchida.
6. Aviso não-bloqueante de duplicidade quando já existe registro de conselho do mesmo aluno na mesma data, com opção de editar o existente em vez de criar outro.
7. Edição posterior do registro (presets + observação) usando a policy UPDATE já existente.

**Abas no detalhe do aluno** (`StudentReportModal`): a aba Ocorrências passa a listar somente os tipos gerais; nova aba **Conselho de Classe** lista os registros `class_council` agrupados por data de reunião, mostrando os presets como badges + observação + registrador. Nada é perdido: é filtro de apresentação sobre a mesma consulta já existente. Mesma separação no diálogo de ocorrências em `Students.tsx`.

**Filtros e relatórios**
- "Alunos com ocorrência" passa a considerar apenas tipos gerais; filtro separado "Com apontamento de conselho".
- `OccurrencesReportDialog` ganha um seletor de escopo (Gerais / Conselho de Classe / Todas). No modo Conselho, a coluna Descrição mostra os presets em badges + observação, e o PDF sai agrupado por turma como hoje.

**Registro em lote por turma**: fora desta primeira versão. A estrutura (`council_items` + presets versionados) já viabiliza um insert em lote depois sem migration adicional.

## Segurança
- Nenhuma policy nova é necessária para o campo; RLS de `occurrences` continua igual.
- Ajuste recomendado no mesmo pacote: restringir DELETE de ocorrências a admin/direction (hoje professor apaga registro de qualquer aluno) — coerente com a regra já adotada em notas e atestados. Confirmar antes de aplicar.
- `staff` continua sem SELECT, portanto não vê apontamentos de conselho.
- Auditoria já cobre INSERT/UPDATE/DELETE via trigger existente.

## Arquivos afetados
- Migration: coluna `council_items`, `updated_at` + trigger, CHECK.
- Novo: `src/lib/occurrences/councilPresets.ts`, `src/components/students/CouncilOccurrenceForm.tsx`, `src/components/students/CouncilHistoryTab.tsx`.
- Editados: `src/pages/Students.tsx`, `src/components/StudentReportModal.tsx`, `src/components/OccurrencesReportDialog.tsx`, `src/lib/validations.ts`.

## Testes obrigatórios (vitest)
- Presets: chaves estáveis, rótulo desconhecido cai em fallback legível.
- Validação: conselho aceita só presets, só observação, ambos; rejeita vazio; presets bloqueados em tipo não-conselho.
- Separação de abas: registro `class_council` não aparece em Ocorrências gerais e vice-versa.
- Filtros: aluno só com conselho não entra em "Alunos com ocorrência".
- Duplicidade: detecção de registro de conselho mesmo aluno + mesma data.
- Compatibilidade retroativa: os 360 registros antigos (sem `council_items`) renderizam pela observação sem erro.

Preservados integralmente: notas, IRA, medalhas, importador de boletim, matriz curricular, atestados, AEE, frequência.
