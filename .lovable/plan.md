
# Plano: Disponibilidade de Professores ao Clicar nos Dias da Semana

## O que sera feito

Na pagina "Visao Geral" (rota `/timetable`), os cabecalhos dos dias da semana na grade de horario (Segunda, Terca, etc.) se tornarao clicaveis. Ao clicar em um dia, um Popover ou Dialog exibira a lista de professores disponiveis naquele dia, separados por periodo (1o ao 6o horario), com indicacao visual de disponibilidade.

## Alteracoes

### 1. `src/components/timetable/TimetableGrid.tsx`

- Importar `Popover`, `PopoverTrigger`, `PopoverContent` e `ScrollArea`
- Importar `teacherAvailability` do `useTimetable()`
- Tornar os cabecalhos dos dias (`<th>`) clicaveis via `PopoverTrigger`
- No `PopoverContent`, exibir uma tabela compacta:

```
Segunda-feira
+-----------+---------------------------+
| 1o Horario | Prof. Ana, Prof. Carlos   |
| 2o Horario | Prof. Ana                 |
| 3o Horario | Prof. Carlos, Prof. Maria |
| ...        | ...                       |
+-----------+---------------------------+
```

**Logica:**
- Para cada periodo do dia clicado, filtrar `teacherAvailability` onde `day_of_week === dia` e `period_number === periodo` e `available === true`
- Considerar os offsets de turno: se a turma selecionada for do turno da manha, usar periodos 1-6; tarde 7-12; noite 13-18
- Caso nao haja registro de disponibilidade para um professor naquele slot, considerar como disponivel (comportamento padrao do sistema)
- Exibir nome do professor com bolinha de cor ao lado
- Professores indisponiveis aparecem em texto riscado/cinza

### 2. Ajuste de contexto

- Verificar se `teacherAvailability` do `TimetableContext` ja esta acessivel no `TimetableGrid` -- esta, via `useTimetable()`
- Tambem precisara do `shift` da turma selecionada para calcular o offset correto dos periodos. O `classId` ja e recebido como prop; buscar o shift via `classes` do `useSchoolMapping()`

## Resumo de Arquivos

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/timetable/TimetableGrid.tsx` | Adicionar Popover nos cabecalhos dos dias com lista de professores disponiveis por periodo |
