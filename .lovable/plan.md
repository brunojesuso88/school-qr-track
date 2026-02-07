

# Plano: Disponibilidade do Professor na Distribuicao + Selecao de Turmas na Geracao de Horario

## 1. Distribuicao - Mostrar disponibilidade ao clicar no professor

### Problema
Atualmente, ao clicar no card de um professor na lista de atribuicao (Popover), nao ha informacao sobre sua disponibilidade por horario.

### Solucao
Adicionar um botao/icone de "ver disponibilidade" ao lado de cada professor no Popover de atribuicao. Ao clicar, exibir um mini-grid de disponibilidade (similar ao `TeacherAvailabilityGrid`, porem em modo `readOnly` e compacto).

### Alteracoes em `src/pages/mapping/MappingDistribution.tsx`

- Importar `supabase` e o componente `TeacherAvailabilityGrid`
- Adicionar estado para controlar qual professor esta com a disponibilidade expandida: `expandedTeacherId`
- Buscar dados de `teacher_availability` do banco para os professores (fetch sob demanda ou ao abrir o dialog)
- Ao clicar no nome/icone do professor, expandir uma secao abaixo do card mostrando a grade de disponibilidade em modo somente leitura
- Filtrar a disponibilidade pelo turno da turma selecionada (Manha: 1-6, Tarde: 7-12, Noite: 13-18)

```text
+------------------------------------------+
| Professor A  [icon disponibilidade]      |
|   12h/20h  [==========]                 |
+------------------------------------------+
|  Seg  Ter  Qua  Qui  Sex               |
|   V    V    X    V    V   <- 1o horario |
|   V    V    V    V    X   <- 2o horario |
|   ...                                    |
+------------------------------------------+
```

### Detalhes Tecnicos

- Criar estado `teacherAvailabilityData` no componente `MappingDistributionContent` para armazenar dados de disponibilidade
- Ao abrir o dialog de uma turma, buscar disponibilidade de todos os professores de uma vez:
  ```typescript
  const { data } = await supabase.from('teacher_availability').select('*');
  ```
- Calcular o offset do turno da turma: morning=0, afternoon=6, evening=12
- Filtrar os registros do professor pelo range de period_number correspondente ao turno
- Renderizar uma versao compacta do grid de disponibilidade (5 dias x 6 periodos) em modo readOnly

---

## 2. Geracao de Horario - Substituir turnos por turmas

### Problema
Atualmente a pagina "Gerar Horario" usa selecao por turnos. O usuario quer selecionar turmas individuais ou grupos de turmas.

### Solucao
Remover a secao "Selecionar Turnos" e substituir por "Selecionar Turmas" com checkboxes individuais por turma, agrupadas por turno, com opcoes de selecionar/desmarcar todas e selecionar por grupo.

### Alteracoes em `src/pages/timetable/TimetableGenerate.tsx`

- Remover estado `selectedShifts` e substituir por `selectedClassIds: string[]`
- Remover constante `SHIFTS` e funcoes `toggleShift`, `selectAllShifts`
- Adicionar funcoes: `toggleClass`, `toggleShiftGroup`, `selectAll`
- Agrupar turmas por turno na UI para organizacao visual
- Atualizar `classesForGeneration` para filtrar por `selectedClassIds`
- Atualizar `handleGenerate` para usar os IDs selecionados diretamente

### Nova UI

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

### Detalhes Tecnicos

- Estado principal: `selectedClassIds: string[]`
- Agrupar turmas: `classes.reduce()` por `shift`
- `toggleClass(id)`: adiciona/remove do array
- `toggleShiftGroup(shift)`: seleciona/desmarca todas do turno
- `selectAll()`: seleciona/desmarca todas
- `canGenerate`: `selectedClassIds.length > 0 && ...`

---

## Resumo de Arquivos Alterados

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/mapping/MappingDistribution.tsx` | Adicionar fetch de disponibilidade e exibicao de grid compacto ao clicar no professor |
| `src/pages/timetable/TimetableGenerate.tsx` | Substituir selecao por turnos por selecao individual de turmas agrupadas por turno |

