# Plano

## 1. Abreviação para Professores

### Banco
- Migration: adicionar coluna `abbreviation TEXT NULL` em `mapping_teachers`.

### Tipos / Contexto
- `MappingTeacher` em `src/contexts/SchoolMappingContext.tsx`: adicionar `abbreviation?: string | null`.

### Formulário (`TeacherForm.tsx`)
- Novo campo "Abreviação" (input curto, opcional, máx 10 chars, salvo em UPPERCASE).
- Enviar em `addTeacher` / `updateTeacher`.

### Listagem (`src/pages/mapping/MappingTeachers.tsx`)
- Exibir badge com a abreviação ao lado do nome.

### Identificação por abreviação
- Em selects/buscas de professor (ex.: `TeacherAssociationDialog`, distribuição), mostrar `Nome (ABREV)` e permitir filtro por nome **ou** abreviação (case-insensitive).

## 2. Importação em Lote (PDF) — Match e Atualização

### Edge Function `parse-teachers-pdf`
- Atualizar prompt e schema para também extrair `abbreviation` (sigla) do professor, **além** do nome, e marcá-la como opcional.
- Manter extração de disciplinas (`subjects`) — já existe no array `subjects` da tabela, mas hoje a função não pede. Adicionar `subjects: string[]` (nomes ou abreviações) ao schema do tool call para suportar atualizações.

### Diálogo de import (`TeacherBulkImportDialog.tsx`)

Mudar o fluxo de "apenas inserir novos" para **upsert inteligente**:

1. Após extração, para cada professor extraído, fazer match contra `teachers` existentes por (case-insensitive, trim):
   - `name` exato OR
   - `abbreviation` exata OR
   - `name` extraído == `abbreviation` existente OR `abbreviation` extraída == `name` existente.
2. Classificar cada item como **NOVO** ou **ATUALIZAR (id existente)** e mostrar badge no review (ex.: "Novo" verde / "Atualizar" amarelo) com o nome do registro casado.
3. Para disciplinas mencionadas: tentar casar contra `mapping_global_subjects` por `name`/`abbreviation` (case-insensitive). Se não existir, marcar como "criar disciplina" (toggle opcional, padrão ligado).
4. Ao salvar:
   - **Novos professores**: insert em batch (como hoje), incluindo `abbreviation`.
   - **Professores existentes**: update apenas dos campos preenchidos no PDF (não sobrescrever com vazio); mesclar `subjects` (união sem duplicar, normalizando para o nome canônico da disciplina).
   - **Disciplinas novas** (se confirmado): insert em `mapping_global_subjects` com `default_weekly_classes = 4`.
   - Atribuição a turmas (`classes`) continua como hoje.

### UI do Review
- Cabeçalho com contadores: `X novos · Y atualizações · Z disciplinas novas`.
- Cada card mostra badge de status e, em atualizações, exibe os campos que mudarão.

## Arquivos afetados
- Nova migration em `supabase/migrations/` (coluna `abbreviation` em `mapping_teachers`)
- `src/contexts/SchoolMappingContext.tsx`
- `src/components/mapping/TeacherForm.tsx`
- `src/pages/mapping/MappingTeachers.tsx`
- `src/components/mapping/TeacherAssociationDialog.tsx` (exibir/filtrar por abreviação)
- `src/components/mapping/TeacherBulkImportDialog.tsx` (upsert + match)
- `supabase/functions/parse-teachers-pdf/index.ts` (extrair abreviação e disciplinas)
