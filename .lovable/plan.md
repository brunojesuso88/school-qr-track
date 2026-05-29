## Objetivo

Adicionar, na aba **Mapeamento Escolar → Turmas**, um botão **"Adicionar em Lote (PDF)"**. Ao enviar um PDF (grade horária, planilha de distribuição etc.), a IA analisa o conteúdo e adiciona, para cada turma identificada, as **disciplinas com seus respectivos professores**, reutilizando professores já cadastrados sempre que possível.

## Comportamento

1. Usuário clica em **Adicionar em Lote (PDF)** ao lado de "Adicionar" e "Atualizar do Sistema".
2. Upload de um PDF (máx. 10 MB). A IA (Gemini via Lovable AI Gateway) extrai:
   - Lista de turmas (nome + turno quando disponível).
   - Para cada turma: disciplinas (nome completo ou abreviação) + professor responsável (nome completo ou sigla) + carga semanal (quando disponível, padrão 4).
3. Tela de **revisão** mostra:
   - Cada turma agrupada, com suas disciplinas e o professor proposto.
   - Para cada professor: badge **Existente** (verde, casado por nome OU abreviação com `mapping_teachers`) ou **Novo** (âmbar, será criado).
   - Para cada disciplina: badge **Existente** (casada com `mapping_global_subjects`) ou **Nova** (será criada se selecionada).
   - Para cada turma: badge **Existente** (em `mapping_classes`) ou **Nova** (será criada).
   - Checkboxes para selecionar/desmarcar turmas individualmente e ação "Selecionar todos".
4. Ao confirmar:
   - Cria turmas novas (`mapping_classes`, `weekly_hours` = 25 noite / 30 demais).
   - Cria disciplinas globais novas selecionadas (`mapping_global_subjects`).
   - Cria professores novos (`mapping_teachers`) com cor da paleta `TEACHER_COLORS` e abreviação preservada.
   - Para cada par turma×disciplina:
     - Se já existe linha em `mapping_class_subjects` com mesmo `subject_name` (case-insensitive), **atualiza** `teacher_id` e `weekly_classes`.
     - Senão, insere nova linha.
   - Toast de resumo: `X turmas · Y disciplinas · Z professores (novo/atualizado) · W atribuições`.
   - `refreshData()` único ao final.

## Matching (rigoroso)

- **Professor**: match por `name` OU `abbreviation` (trim + case-insensitive). Cruzado também entre nome↔abreviação para tolerar PDFs que listam só sigla.
- **Disciplina**: idem, contra `mapping_global_subjects` (name/abbreviation). Nome canônico (o já cadastrado) é gravado em `mapping_class_subjects.subject_name`.
- **Turma**: match por `name` (trim + case-insensitive) contra `mapping_classes`.

## Arquivos

### Novo
- `supabase/functions/parse-classes-pdf/index.ts` — espelha `parse-teachers-pdf`, mas com tool-calling que retorna:
  ```
  classes: [{
    name, shift?,
    subjects: [{ name, weekly_classes?, teacher_name?, teacher_abbreviation? }]
  }]
  ```
  Roles permitidas: `admin`, `direction`. Modelo: `google/gemini-2.5-flash`.
- `src/components/mapping/ClassesBulkImportDialog.tsx` — diálogo com etapas `upload | processing | review`, baseado em `TeacherBulkImportDialog.tsx` (mesma UX, ScrollArea com altura fixa, badges, checkboxes).

### Editado
- `src/pages/mapping/MappingClasses.tsx` — adicionar botão `Upload` que abre `ClassesBulkImportDialog`.

## Fora de escopo

- Não remove turmas/disciplinas/professores existentes; apenas adiciona ou reatribui.
- Não altera turno de turma já existente, mesmo se o PDF indicar diferente.
- Não toca em `current_hours` manualmente — o `SchoolMappingContext` recalcula a partir de `mapping_class_subjects` no próximo fetch.
