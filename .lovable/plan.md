

# Plano: Corrigir Card de Professor e Toggle de Atribuição

## Problemas Identificados

### 1. Quantidade de Disciplinas no Card
O card mostra `teacher.subjects.length` que conta disciplinas que o professor *pode* lecionar, mas deveria mostrar quantas disciplinas estão efetivamente *atribuídas* a ele.

**Atual (linha 161 MappingTeachers.tsx):**
```tsx
{getSubjectNames(teacher.subjects).length} disciplinas
```

**Correto:** Contar `classSubjects` onde `teacher_id === teacher.id`

### 2. Carga Horária no Card
A carga horária (`current_hours`) deveria ser calculada dinamicamente a partir das disciplinas atribuídas, não apenas confiar no valor do banco.

### 3. Toggle de Atribuição/Desatribuição
O diálogo atual mostra "Já atribuído" como badge estático. Deveria permitir clicar para remover a atribuição.

---

## Alterações

### Arquivo: `src/pages/mapping/MappingTeachers.tsx`

**1. Adicionar função para contar disciplinas atribuídas**

```tsx
const getAssignedSubjectsCount = (teacherId: string) => {
  return classSubjects.filter(cs => cs.teacher_id === teacherId).length;
};

const getCalculatedHours = (teacherId: string) => {
  return classSubjects
    .filter(cs => cs.teacher_id === teacherId)
    .reduce((sum, cs) => sum + cs.weekly_classes, 0);
};
```

**2. Atualizar badge de disciplinas (linha 160-162)**

```tsx
<Badge variant="secondary" className="text-xs">
  {getAssignedSubjectsCount(teacher.id)} disciplinas
</Badge>
```

**3. Usar carga horária calculada (linhas 131-132, 167-170)**

Usar `getCalculatedHours(teacher.id)` em vez de `teacher.current_hours`

---

### Arquivo: `src/components/mapping/TeacherAssociationDialog.tsx`

**1. Adicionar função para desatribuir (toggle)**

Modificar a lógica para permitir clicar em "Já atribuído" e adicionar uma ação pendente de `unassign`.

**2. Atualizar renderização (linhas 228-249)**

Quando `isAssignedToThisTeacher`:
- Mostrar botão "Remover" em vez de badge estático
- Ao clicar, adicionar `pendingChange` com `action: 'unassign'`

```tsx
{isAssignedToThisTeacher && !isPending ? (
  <Button
    size="sm"
    variant="outline"
    className="h-7 text-xs text-destructive hover:text-destructive"
    onClick={() => handleUnassign(subject.id)}
    disabled={isSaving}
  >
    Remover
  </Button>
) : isPendingUnassign ? (
  <Badge variant="destructive" className="text-xs">
    A remover
  </Badge>
) : !isPending && (
  // ... botão Atribuir/Substituir existente
)}
```

**3. Adicionar handler handleUnassign**

```tsx
const handleUnassign = (classSubjectId: string) => {
  const filteredChanges = pendingChanges.filter(p => p.classSubjectId !== classSubjectId);
  setPendingChanges([
    ...filteredChanges,
    {
      classSubjectId,
      action: 'unassign',
      previousTeacherId: teacher.id
    }
  ]);
};
```

**4. Atualizar cálculo de horas locais**

Considerar ações de `unassign` no cálculo.

---

## Resumo das Mudanças

| Local | Antes | Depois |
|-------|-------|--------|
| Card - Disciplinas | `teacher.subjects.length` (cadastradas) | `classSubjects.filter(cs => cs.teacher_id === teacher.id).length` (atribuídas) |
| Card - Carga | `teacher.current_hours` (banco) | Calculado dinamicamente |
| Diálogo - Já atribuído | Badge estática | Botão "Remover" clicável |
| Diálogo - Pending | Só assign | assign + unassign |

---

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/mapping/MappingTeachers.tsx` | Corrigir contagem de disciplinas e carga horária |
| `src/components/mapping/TeacherAssociationDialog.tsx` | Adicionar toggle para remover atribuição |

