# Boletim/Notas + IRA (Gestão > Turmas e Alunos)

## Objetivo
Importar boletins em PDF por turma, auditar rigorosamente antes de gravar, exibir todas as notas no card do aluno e calcular o IRA com pesos vindos da carga semanal do mapeamento escolar. A importação de alunos atual não é alterada.

## Auditoria do que já existe (verificado)
- `src/pages/Classes.tsx` (1349 linhas): cards de turma agrupados por `location` (sede / salas_fora); já tem importação de alunos por PDF que NÃO será tocada.
- `src/pages/Students.tsx` (1280 linhas): lista de alunos, abre `StudentReportModal`; tipos de ocorrência incluem `class_council`.
- `src/components/StudentReportModal.tsx`: `Tabs` com 3 abas (Frequência, Ocorrências, Laudo) — será estendido para 4 (Notas).
- `src/contexts/SchoolMappingContext.tsx`: carrega `mapping_class_subjects` com `weekly_classes` e `mapping_classes`.
- Risco de integração confirmado: as turmas da tela atual vivem em `public.classes`, mas a carga semanal vive em `public.mapping_class_subjects` ligada a `public.mapping_classes`. **Não existe FK entre `classes` e `mapping_classes`** — hoje a ligação só é possível por nome + turno. Ver "Vínculo com o mapeamento".
- `supabase/functions/_shared/auth.ts`: `requireAuth(req, corsHeaders, roles)` já pronto — será reutilizado.
- `parse-students-pdf`: padrão de IA (Lovable AI Gateway, `gemini-2.5-flash` com fallback, limite 10MB) que servirá de modelo, sem reuso do prompt.

## Vínculo com o mapeamento (decisão)
Adicionar coluna opcional `classes.mapping_class_id uuid references public.mapping_classes(id)`. Na configuração do IRA, se o vínculo não existir, o sistema sugere por nome + turno normalizados e pede confirmação do administrador. Sem vínculo, o IRA fica `—` com motivo "turma não vinculada ao mapeamento escolar". Isso evita casamento silencioso por nome.

## Arquitetura de dados (migrations)
Todas as tabelas em `public`, com GRANT + RLS + `created_at/updated_at` e trigger de `updated_at`.

1. `grade_imports` — uma linha por importação: `class_id`, `school_year int`, `file_name`, `status` (`pending_review` | `confirmed` | `cancelled`), `stats jsonb` (páginas, alunos detectados/casados/não identificados, disciplinas, notas lidas, baixa confiança, células vazias), `issues jsonb`, `raw_payload jsonb`, `created_by`.
2. `grade_subjects` — disciplinas do boletim por turma: `class_id`, `name`, `normalized_name`, `mapping_class_subject_id` (nullable), `weekly_classes int` (snapshot), `include_in_ira boolean default false`, `sort_order`. Unique `(class_id, normalized_name)`.
3. `grade_periods` — períodos detectados: `class_id`, `label` ("1º Bimestre", "Final"), `kind` (`period` | `final` | `unknown`), `sort_order`. Unique `(class_id, label)`.
4. `student_grades` — `student_id`, `grade_subject_id`, `grade_period_id`, `value numeric(5,2)` nullable, `raw_text`, `confidence numeric`, `flags text[]`, `import_id`. Unique `(student_id, grade_subject_id, grade_period_id)` + índice em `student_id`.
5. `ira_settings` — regra por turma: `class_id` (unique), `mapping_class_id`, `ira_period_id` (período usado no IRA) ou `use_final_grade boolean`, `scale_max numeric default 10`, `updated_by`. Regra global default em `settings` (`key = 'ira_default'`).

Pesos: derivados de `weekly_classes` (1→1, 2→2, 4→4). Carga fora de {1,2,4} → disciplina marcada com aviso e `include_in_ira = false` até decisão explícita do administrador.

RLS: admin/direction podem tudo (via `user_has_any_role`); teacher/staff apenas leitura de `grade_subjects`, `grade_periods` e `student_grades` (mesma regra atual de leitura de alunos), sem INSERT/UPDATE/DELETE. Trigger de auditoria em `student_grades` e `grade_imports` reaproveitando `log_audit_event()` (usa `auth.uid()`, sem risco de user_id incorreto).

## Edge Function `parse-grades-pdf`
- `requireAuth(req, corsHeaders, ['admin','direction'])`; limite 10MB; CORS igual às demais funções.
- Entrada: `{ pdfBase64, class_id, students: [{id, full_name, student_id}], expected_subjects: [{name, weekly_classes}] }`.
- Passo 1 (extração): IA retorna JSON estruturado `{ pages, periods[], subjects[], rows: [{student_name, subject, period, raw_value, confidence}] }`, instruída a varrer todas as páginas, preservar células vazias como `null` e nunca inventar valores.
- Passo 2 (checagens determinísticas em Deno, sem IA): parse numérico (vírgula/ponto), faixa 0–10 (ou escala detectada), duplicidade de aluno, duplicidade de disciplina, linhas com contagem de colunas divergente, alunos do PDF ausentes na turma e alunos da turma ausentes no PDF, matriz esperada (alunos × disciplinas × períodos) vs. lida.
- Passo 3 (reconciliação, só quando o passo 2 acusar problema): segunda chamada de IA focada nas páginas/linhas suspeitas; divergência entre passes marca a nota como `low_confidence` em vez de sobrescrever.
- Normalização de nomes (NFD + lowercase + colapso de espaços, igual ao padrão existente) e casamento por similaridade com limiar; abaixo do limiar → "Aluno não identificado".
- Saída: payload de revisão + `stats` + `issues`. **A função não grava nada no banco.**

## Fluxo de UX
Botão “Inserir boletim da turma” em cada card de turma (visível só para admin/direction) abrindo `GradesImportDialog`:
`Selecionar PDF → Processando → Auditoria → Revisão → Confirmar importação`
- Painel de contadores: páginas, alunos detectados, casados, não identificados, disciplinas, notas lidas, baixa confiança, células vazias, inconsistências.
- Tabela de revisão editável: aluno | disciplina | período | nota | alerta; seletor manual para “Aluno não identificado”; nota corrigível à mão (marcada como `manual`).
- Conflito com notas já existentes: aviso explícito e escolha "manter existentes" ou "sobrescrever" — nunca sobrescreve por padrão.
- Cancelar em qualquer etapa não altera o banco (a gravação ocorre só no Confirmar, em um único batch: `grade_imports` + upsert de disciplinas/períodos + upsert de `student_grades`).

## Notas e IRA no aluno
- `StudentReportModal.tsx`: nova aba “Notas” (grade disciplina × período, valores sempre visíveis, ausência no PDF como “—” com legenda "Não informado no boletim").
- Bloco IRA destacado no topo da aba: valor + "ver composição" → tabela disciplina | nota usada | peso | nota × peso | resultado. Sem dados/configuração → `IRA: —` com motivo (turma não vinculada, nenhuma disciplina marcada, período do IRA não definido, carga semanal inválida).
- Badge discreto de IRA no card do aluno em `Students.tsx`.
- Nota representativa: a nota do período configurado em `ira_settings` (ou a nota `final` quando o boletim tiver uma). Todos os períodos permanecem gravados; mudar a configuração só muda o cálculo.
- Cálculo em `src/lib/ira.ts` (função pura, determinística) usada no modal e na tela de configuração — recalculado a cada leitura, sem valor materializado que possa ficar desatualizado.

## Configuração do IRA
Nova aba em Configurações ("Configuração do IRA"): seleciona a turma, mostra o vínculo com o mapeamento, lista as disciplinas com carga semanal, peso derivado, checkbox “Participa do IRA”, seletor do período/nota usada e escala. Ligar/desligar disciplina nunca apaga notas. Acesso restrito a admin/direction.

## Arquivos
Criar: `supabase/functions/parse-grades-pdf/index.ts`, `src/components/grades/GradesImportDialog.tsx`, `src/components/grades/GradesReviewTable.tsx`, `src/components/grades/StudentGradesTab.tsx`, `src/components/grades/IRABreakdown.tsx`, `src/components/settings/IRASettings.tsx`, `src/hooks/useStudentGrades.ts`, `src/lib/ira.ts`.
Alterar: `src/pages/Classes.tsx` (botão no card), `src/pages/Students.tsx` (badge IRA), `src/components/StudentReportModal.tsx` (aba Notas), `src/pages/Settings.tsx` (aba de configuração), `supabase/config.toml` (nova função). Intocados: `parse-students-pdf` e o fluxo atual de importação de alunos.

## Riscos
- Ausência de FK entre `classes` e `mapping_classes` (mitigada pela coluna de vínculo + confirmação manual).
- Boletins com layout muito irregular: mitigado pela revisão manual obrigatória.
- Custo/limite de IA na segunda passada: só roda quando há inconsistência.
- `StudentReportModal` cresce: aba Notas extraída para componente próprio.

## Testes e critérios de aceitação
- Importação de PDF de teste: contadores coerentes com o arquivo, zero gravação antes do Confirmar, cancelamento sem efeito no banco.
- Aluno de fora da turma nunca é vinculado automaticamente.
- Notas duplicadas bloqueadas pelas constraints unique.
- Aba Notas mostra todas as disciplinas/períodos, inclusive vazios.
- IRA confere com cálculo manual: ex. 8,0 (peso 4) + 6,0 (peso 2) + 9,0 (peso 1) = (32+12+9)/7 = 7,57.
- Desligar uma disciplina muda o IRA e mantém as notas.
- Teacher/staff não conseguem importar nem alterar a configuração (403/RLS); a importação aparece em `audit_logs` com o usuário correto.