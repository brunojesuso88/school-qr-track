## Objetivo
Reverter o campo "Turmas / disciplina" na página Notificação Docente para um único campo de texto manual, como era originalmente, removendo os seletores múltiplos (MultiSelectPicker) de Disciplinas e Turmas vinculados ao mapeamento escolar.

## Arquivo afetado
`src/pages/TeacherNotifications.tsx`

## Mudanças
1. Substituir o bloco com os dois `MultiSelectPicker` (Disciplina(s) / Turma(s)) por um único `Input` (ou `Textarea`) ligado diretamente a `form.classes_subjects`, com placeholder explicativo (ex.: "Ex.: Matemática – 9º A, 9º B").
2. Remover estados e efeitos que não terão mais uso:
   - `subjectOptions`, `classOptions`, `selectedSubjects`, `selectedClasses`
   - `useEffect` que carrega `mapping_global_subjects` / `mapping_classes`
   - `useEffect` que sincroniza `classes_subjects` a partir das seleções
   - Funções utilitárias `composeClassesSubjects` e `parseClassesSubjects`
   - Componente `MultiSelectPicker` (não usado em mais lugar nenhum)
   - Constante `SHIFT_LABELS`
3. Ajustar `loadRecord` para não tentar parsear seleções; apenas carregar `classes_subjects` como texto.
4. Ajustar `resetForm` removendo limpeza de `selectedSubjects` / `selectedClasses`.
5. Remover imports que ficarão sem uso (`ChevronsUpDown`, `Check`, `X`, `Badge` se não usado em outro lugar — manter se ainda for usado em histórico, que é o caso).

## O que NÃO muda
- Esquema do banco: a coluna `classes_subjects` continua sendo `text`, então não há migração.
- Layout do PDF/preview: continuam exibindo o texto livre exatamente como antes.
- Histórico, filtros, impressão, assinaturas e demais campos.
