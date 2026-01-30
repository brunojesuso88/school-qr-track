
# Plano: Simplificar Professores e Disciplinas

## Visao Geral

1. **Professores**: Remover o campo `subjects` do cadastro de professores e remover o indicativo de disciplinas no card
2. **Disciplinas**: Remover o campo `shift` (turno padrao) das disciplinas, tornando-as disponiveis para todos os turnos

---

## Parte 1: Alteracoes em Professores

### Arquivo: `src/pages/mapping/MappingTeachers.tsx`

**Linha 165-173**: Remover o badge de disciplinas do card do professor

Remover:
```tsx
<Badge variant="secondary" className="text-xs">
  {getAssignedSubjectsCount(teacher.id)} disciplinas
</Badge>
```

**Linha 33-37**: Remover funcao `getSubjectNames` (nao sera mais necessaria)

---

### Arquivo: `src/components/mapping/TeacherForm.tsx`

**Linha 57**: Remover referencia a `subjects` no objeto data

Alterar de:
```tsx
const data = {
  name: name.trim(),
  email: email.trim() || undefined,
  phone: phone.trim() || undefined,
  max_weekly_hours: parseInt(maxWeeklyHours),
  subjects: teacher?.subjects || [],  // REMOVER ESTA LINHA
  availability: derivedAvailability,
  notes: notes.trim() || undefined
};
```

Para:
```tsx
const data = {
  name: name.trim(),
  email: email.trim() || undefined,
  phone: phone.trim() || undefined,
  max_weekly_hours: parseInt(maxWeeklyHours),
  availability: derivedAvailability,
  notes: notes.trim() || undefined
};
```

---

### Arquivo: `src/contexts/SchoolMappingContext.tsx`

**Linha 17**: Remover `subjects` da interface `MappingTeacher`

Alterar de:
```tsx
export interface MappingTeacher {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  subjects: string[];  // REMOVER
  max_weekly_hours: number;
  current_hours: number;
  color: string;
  availability: string[];
  notes?: string;
  created_at: string;
  updated_at: string;
}
```

---

## Parte 2: Alteracoes em Disciplinas

### Arquivo: `src/components/mapping/SubjectForm.tsx`

**Linhas 22, 38, 68-80**: Remover campo de turno do formulario

Remover:
- Estado `shift` (linha 22)
- Propriedade `shift` do objeto data (linha 38)
- Componente Select do turno (linhas 68-80)

Formulario simplificado:
```tsx
const SubjectForm = ({ subject, onClose }: SubjectFormProps) => {
  const { addGlobalSubject, updateGlobalSubject } = useSchoolMapping();
  const { toast } = useToast();
  
  const [name, setName] = useState(subject?.name || "");
  const [defaultWeeklyClasses, setDefaultWeeklyClasses] = useState(
    subject?.default_weekly_classes?.toString() || "4"
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const data = {
        name: name.trim(),
        default_weekly_classes: parseInt(defaultWeeklyClasses)
      };

      if (subject) {
        await updateGlobalSubject(subject.id, data);
        toast({ title: "Disciplina atualizada com sucesso" });
      } else {
        await addGlobalSubject(data);
        toast({ title: "Disciplina cadastrada com sucesso" });
      }
      onClose();
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ... form JSX sem campo de turno
};
```

---

### Arquivo: `src/pages/mapping/MappingSubjects.tsx`

**Linhas 2, 14-18, 49-58, 141-158**: Remover agrupamento por turno

Alteracoes:
- Remover imports de icones de turno: `Sun, Sunset, Moon`
- Remover `SHIFT_CONFIG`
- Remover logica de agrupamento por turno
- Exibir todas as disciplinas em uma lista simples (grid)

Layout simplificado:
```tsx
{/* Subjects List - sem agrupamento */}
{globalSubjects.length > 0 && (
  <div className="grid gap-4 md:grid-cols-2">
    {globalSubjects.map(renderSubjectCard)}
  </div>
)}
```

---

### Arquivo: `src/contexts/SchoolMappingContext.tsx`

**Linha 31**: Remover `shift` da interface `MappingGlobalSubject`

Alterar de:
```tsx
export interface MappingGlobalSubject {
  id: string;
  name: string;
  default_weekly_classes: number;
  shift: string;  // REMOVER
  created_at: string;
}
```

---

## Resumo das Alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| `src/contexts/SchoolMappingContext.tsx` | Remover `subjects` de MappingTeacher e `shift` de MappingGlobalSubject |
| `src/pages/mapping/MappingTeachers.tsx` | Remover badge de disciplinas do card |
| `src/components/mapping/TeacherForm.tsx` | Remover campo subjects do data |
| `src/components/mapping/SubjectForm.tsx` | Remover campo de turno do formulario |
| `src/pages/mapping/MappingSubjects.tsx` | Remover agrupamento por turno |

---

## Observacao Importante

Os campos `subjects` em `mapping_teachers` e `shift` em `mapping_global_subjects` continuarao existindo no banco de dados, mas nao serao mais utilizados na interface. Isso evita a necessidade de migracao de dados e mantem compatibilidade com registros existentes.
