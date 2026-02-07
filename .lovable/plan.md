
# Plano: Corrigir Carga Horaria dos Professores

## Problema Identificado

O campo `current_hours` na tabela `mapping_teachers` esta desatualizado para varios professores. Exemplos reais do banco:

| Professor     | current_hours (DB) | Calculado Real |
|---------------|-------------------|----------------|
| A. Francisco  | 6h                | 24h            |
| Allison       | 10h               | 15h            |
| Givanilson    | 7h                | 12h            |
| Jorge         | 19h               | 21h            |
| Keliane       | 10h               | 12h            |

Isso acontece porque o `current_hours` e mantido manualmente via incrementos/decrementos nas funcoes `assignTeacher`, `unassignTeacher` e `batchSaveAssignments`. Qualquer falha, race condition ou operacao manual no banco causa a dessincronizacao.

## Solucao

Adotar o calculo dinamico de `current_hours` a partir dos dados reais de `mapping_class_subjects`, eliminando a dependencia do valor armazenado.

### 1. `src/contexts/SchoolMappingContext.tsx`

**Apos o `fetchData`**, recalcular `current_hours` de cada professor com base nos `classSubjects` reais e atualizar o estado local:

```
// Apos carregar os dados, recalcular current_hours
const recalculatedTeachers = teachersData.map(teacher => {
  const realHours = classSubjectsData
    .filter(cs => cs.teacher_id === teacher.id)
    .reduce((sum, cs) => sum + cs.weekly_classes, 0);
  return { ...teacher, current_hours: realHours };
});
setTeachers(recalculatedTeachers);
```

Tambem sincronizar o banco quando houver divergencia (correcao silenciosa):

```
// Sincronizar banco quando houver divergencia
for (const teacher of recalculatedTeachers) {
  const original = teachersData.find(t => t.id === teacher.id);
  if (original && original.current_hours !== teacher.current_hours) {
    supabase.from('mapping_teachers')
      .update({ current_hours: teacher.current_hours })
      .eq('id', teacher.id);
  }
}
```

### 2. `src/components/mapping/TeacherSummarySheet.tsx`

Substituir o uso de `teacher.current_hours` pelo calculo dinamico a partir dos `classSubjects` recebidos como prop:

```
// Calcular horas reais
const realHours = classSubjects
  .filter(cs => cs.teacher_id === teacher.id)
  .reduce((sum, cs) => sum + cs.weekly_classes, 0);

// Usar realHours em vez de teacher.current_hours
const progressPercent = (realHours / teacher.max_weekly_hours) * 100;
const isOverloaded = realHours >= teacher.max_weekly_hours * 0.8;
```

## Resumo de Arquivos

| Arquivo | Alteracao |
|---------|-----------|
| `src/contexts/SchoolMappingContext.tsx` | Recalcular `current_hours` apos fetchData e sincronizar banco |
| `src/components/mapping/TeacherSummarySheet.tsx` | Usar calculo dinamico em vez de `teacher.current_hours` |
