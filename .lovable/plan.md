

# Plano: Remover Disponibilidade por Turno dos Professores

## Visao Geral

Remover o conceito de disponibilidade por turno dos professores. Todos os professores estarao automaticamente disponiveis para todos os turnos, simplificando o sistema.

---

## Alteracoes Necessarias

### 1. Interface MappingTeacher (SchoolMappingContext.tsx)

**Linha 20**: Remover o campo `availability` da interface

```tsx
// ANTES
export interface MappingTeacher {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  max_weekly_hours: number;
  current_hours: number;
  color: string;
  availability: string[];  // REMOVER
  notes?: string;
  created_at: string;
  updated_at: string;
}
```

---

### 2. TeacherForm.tsx

**Linhas 10, 27, 29-31, 43-50, 57, 145-148**: Remover tudo relacionado a disponibilidade

Remover:
- Import do `TeacherAvailabilitySection`
- Estado `detailedAvailability`
- Funcao `handleAvailabilityChange`
- Logica `derivedAvailability`
- Campo `availability` do objeto data
- Componente `TeacherAvailabilitySection` do JSX

---

### 3. MappingTeachers.tsx

**Linhas 18-22, 159-165**: Remover exibicao de disponibilidade no card

Remover:
- Constante `SHIFT_LABELS`
- Bloco de badges de disponibilidade no card do professor

---

### 4. TeacherSummarySheet.tsx

**Linhas 8-12, 94-104**: Remover secao de disponibilidade

Remover:
- Constante `SHIFT_LABELS` (manter apenas para uso de turma)
- Secao "Disponibilidade" do sheet

---

### 5. MappingDistribution.tsx

**Linhas 48-53**: Simplificar filtro de professores elegiveis

Alterar de:
```tsx
const getEligibleTeachers = (subjectName: string, classShift: string) => {
  return teachers.filter(teacher => {
    const hasShift = teacher.availability.includes(classShift);
    return hasShift;
  });
};
```

Para:
```tsx
const getEligibleTeachers = (subjectName: string, classShift: string) => {
  // Todos os professores estao disponiveis para todos os turnos
  return teachers;
};
```

---

## Resumo das Alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| `src/contexts/SchoolMappingContext.tsx` | Remover `availability` da interface MappingTeacher |
| `src/components/mapping/TeacherForm.tsx` | Remover componente TeacherAvailabilitySection e logica relacionada |
| `src/pages/mapping/MappingTeachers.tsx` | Remover badges de disponibilidade do card |
| `src/components/mapping/TeacherSummarySheet.tsx` | Remover secao de disponibilidade |
| `src/pages/mapping/MappingDistribution.tsx` | Remover filtro por turno na lista de professores |

---

## Observacao Importante

O campo `availability` continuara existindo no banco de dados, mas nao sera mais utilizado na interface. Isso evita a necessidade de migracao de dados e mantem compatibilidade com registros existentes.

