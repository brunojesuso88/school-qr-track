## Diagnóstico

Existem **dois campos independentes** armazenando "aulas por semana", e eles não se comunicam:

1. `mapping_global_subjects.default_weekly_classes` — exibido na aba **Disciplinas** (o "valor padrão" global da disciplina).
2. `mapping_class_subjects.weekly_classes` — exibido na aba **Distribuição** (o valor real daquela disciplina dentro de cada turma).

### Pontos onde a divergência nasce

- **`ClassSubjectsDialog.tsx`** (linha 22): ao adicionar uma disciplina à turma o input começa fixo em `"2"`, ignorando o `default_weekly_classes` da disciplina global.
- **`ClassesBulkImportDialog.tsx`**: quando o PDF não traz `weekly_classes`, cai para `4` (default da coluna), também ignorando o valor global.
- **`SubjectForm.tsx`**: ao editar `default_weekly_classes` da disciplina global, **nenhuma** das linhas já existentes em `mapping_class_subjects` é atualizada → quem já está nas turmas continua com o valor antigo.
- Resultado: a aba Disciplinas mostra (por ex.) 4 aulas/semana e a Distribuição mostra 2 para a mesma disciplina.

## Solução definitiva

Fazer da disciplina global a **fonte única da verdade** para "aulas/semana padrão", propagando para baixo automaticamente.

### 1. `SubjectForm.tsx` — propagar alterações do padrão
Ao salvar uma disciplina existente, se `default_weekly_classes` mudou:
- Atualizar `mapping_global_subjects` (já é feito).
- Em seguida `UPDATE mapping_class_subjects SET weekly_classes = <novo> WHERE subject_name = <nome>`.
- Mostrar no toast: "X linhas em turmas atualizadas".
- Como isso muda a carga horária dos professores, chamar `refreshData()` (o context já recalcula `current_hours` a partir das `mapping_class_subjects`).

### 2. `ClassSubjectsDialog.tsx` — usar o padrão da disciplina selecionada
- Trocar o estado inicial fixo `"2"` por um valor derivado do `globalSubjects.find(...).default_weekly_classes` da disciplina escolhida.
- `useEffect` que sincroniza `weeklyClasses` sempre que `selectedSubject` mudar.
- O input fica editável (override pontual), mas o default é sempre o da disciplina.

### 3. `ClassesBulkImportDialog.tsx` — mesma regra no import
- No mapeamento `subject.weekly_classes ?? 4`, trocar o fallback `4` por `globalSubjects.find(name match)?.default_weekly_classes ?? 4`.
- Para disciplinas novas criadas pelo import, o registro em `mapping_class_subjects` herda o `default_weekly_classes` que acabou de ser inserido.

### 4. (Opcional/coerência) `MappingSubjects.tsx`
- Adicionar um pequeno texto sob o badge "X aulas/semana" indicando "valor padrão — aplicado a turmas ao adicionar". Sem mudança de comportamento, apenas clareza.

## Arquivos a editar

- `src/components/mapping/SubjectForm.tsx`
- `src/components/mapping/ClassSubjectsDialog.tsx`
- `src/components/mapping/ClassesBulkImportDialog.tsx`
- `src/pages/mapping/MappingSubjects.tsx` (apenas texto auxiliar)

## Fora de escopo

- Não remover a coluna `weekly_classes` de `mapping_class_subjects` (turmas ainda podem ter override pontual).
- Sem migration de schema; apenas um `UPDATE` em runtime quando o admin edita o padrão.
