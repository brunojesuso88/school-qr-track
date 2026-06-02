## Alterações

### 1. Título da sidebar
**Arquivo:** `src/components/DashboardLayout.tsx` (linha 186)
- Trocar `"Sistema de Gestão de Alunos"` por `"Sistema de Gestão"`.

### 2. Filtro de ordenação por quantidade de faltas
**Arquivo:** `src/pages/Students.tsx`
- Buscar contagem de faltas por aluno na tabela `attendance` (status `absent`) e armazenar em um `Map<student_id, count>` (`absenceCountMap`), semelhante ao `occurrenceMap` já existente.
- Adicionar estado `sortByAbsences: 'none' | 'asc' | 'desc'`.
- Adicionar um `Select` na barra de filtros com três opções: "Sem ordenação", "Mais faltas primeiro", "Menos faltas primeiro".
- Aplicar a ordenação no array filtrado de alunos antes da renderização (quando `sortByAbsences !== 'none'`).
- Exibir um pequeno badge ao lado do nome do aluno com a quantidade de faltas quando o filtro estiver ativo (para o usuário enxergar a base da ordenação).

### 3. Novo tipo de ocorrência "Conselho de Classe"
**Arquivo:** `src/pages/Students.tsx` (constante `OCCURRENCE_TYPES`, linha 62)
- Adicionar `{ value: 'class_council', label: 'Conselho de Classe' }` à lista. O label aparecerá automaticamente no select do diálogo "Nova Ocorrência" e na renderização das ocorrências existentes via `getOccurrenceTypeLabel`.

## Fora de escopo
- Sem alterações de schema (a tabela `occurrences.type` é `text` livre).
- Sem alterações em outras páginas, autenticação ou backend.
