

# Plano: Disponibilidade nos Cards de Professores, PDF com Resumo por Professor, e Selecao de Turmas na Geracao

## 1. Mapeamento > Professores - Disponibilidade no card

### Problema
Ao clicar no card do professor, abre o `TeacherSummarySheet` que ja mostra um resumo de disponibilidade (ex: "Manha: 28/30"), mas nao mostra a grade detalhada por horario.

### Solucao
Adicionar o componente `TeacherAvailabilityGrid` (ja existente, modo `readOnly`) dentro do `TeacherSummarySheet`, abaixo do resumo de disponibilidade por turno. Buscar os dados detalhados da tabela `teacher_availability` e renderizar uma grade por turno ativo.

### Alteracoes em `src/components/mapping/TeacherSummarySheet.tsx`

- Importar `TeacherAvailabilityGrid`
- Buscar os dados completos de disponibilidade (ja faz `select('*')`)
- Converter os dados para o formato esperado pelo grid, separando por turno (1-6 = Manha, 7-12 = Tarde, 13-18 = Noite)
- Renderizar um grid compacto para cada turno que tenha dados, com abas (Tabs) para alternar entre turnos
- Grid em modo `readOnly`, sem permitir edicao

---

## 2. Mapeamento > Resumo - PDF com resumo por professor

### Problema
O PDF exportado contem apenas a distribuicao por turno (turmas x disciplinas). Falta um resumo individual por professor.

### Solucao
Adicionar pagina(s) extra(s) ao final do PDF com uma tabela listando cada professor, suas turmas, disciplinas atribuidas e carga horaria total.

### Alteracoes em `src/pages/mapping/MappingSummary.tsx`

**No `preparePreviewData`:**
- Adicionar dados de resumo por professor ao objeto `PreviewData`
- Para cada professor: listar turmas e disciplinas atribuidas com horas, e total

**No `generatePDF`:**
- Apos as paginas de turnos, adicionar nova(s) pagina(s) com titulo "Resumo por Professor"
- Tabela com colunas: Professor | Turma | Disciplina | Aulas/Semana
- Linha de total de carga horaria por professor
- Usar `autoTable` com agrupamento por professor (merge de celulas ou linhas separadoras)

**No preview (Dialog):**
- Adicionar secao de preview do resumo por professor abaixo das tabelas de turno

---

## 3. Criacao de Horario > Gerar - Selecao por turmas

### Problema
A selecao atual e por turno. O usuario quer poder selecionar turmas individuais ou grupos.

### Solucao
Substituir a secao "Selecionar Turnos" por "Selecionar Turmas", agrupadas por turno, com checkboxes individuais e botoes de grupo.

### Alteracoes em `src/pages/timetable/TimetableGenerate.tsx`

- Remover estado `selectedShifts` e constante `SHIFTS`
- Adicionar estado `selectedClassIds: string[]`
- Agrupar turmas por turno para exibicao visual
- Adicionar funcoes:
  - `toggleClass(id)`: adiciona/remove turma individual
  - `toggleShiftGroup(shift)`: seleciona/desmarca todas as turmas de um turno
  - `selectAll()`: seleciona/desmarca todas
- Atualizar `classesForGeneration` para filtrar por `selectedClassIds`
- Atualizar `canGenerate` para usar `selectedClassIds.length > 0`
- Atualizar mensagem de erro no `handleGenerate`

**Nova UI:**
```text
+------------------------------------------+
| Selecionar Turmas     [Selecionar Todas] |
+------------------------------------------+
| Manha                  [Selecionar Grupo]|
|  [x] 1A   [x] 1B   [ ] 1C              |
|                                          |
| Tarde                  [Selecionar Grupo]|
|  [ ] 2A   [x] 2B                        |
+------------------------------------------+
```

---

## Resumo de Arquivos Alterados

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/mapping/TeacherSummarySheet.tsx` | Adicionar grid de disponibilidade detalhado por turno com Tabs |
| `src/pages/mapping/MappingSummary.tsx` | Adicionar pagina de resumo por professor ao PDF e preview |
| `src/pages/timetable/TimetableGenerate.tsx` | Substituir selecao por turnos por selecao individual de turmas |

