

# Plano: Ajustar Cards de Professores e Adicionar Duplicar Turma

## Resumo das Alterações

1. **Cards de Professores**: Ajustar layout para ser mais compacto como os cards de turmas e disciplinas (2 colunas)
2. **Duplicar Turma**: Adicionar botao de duplicar em cada card de turma

---

## Fase 1: Ajustar Cards de Professores

**Arquivo**: `src/pages/mapping/MappingTeachers.tsx`

### Alteracoes:

1. **Mudar grid para 2 colunas**:
   - De: `grid gap-4`
   - Para: `grid gap-4 md:grid-cols-2`

2. **Simplificar layout do card**:
   - Remover a barra colorida do topo (manter apenas um indicador menor)
   - Reduzir espacamento interno
   - Tornar o layout mais horizontal e compacto

3. **Estrutura proposta do card** (similar ao de turmas):
```typescript
<Card className="cursor-pointer hover:shadow-md transition-shadow">
  <CardContent className="p-4">
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-2 flex-1">
        <div className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: teacher.color }}
          />
          <h3 className="font-semibold">{teacher.name}</h3>
          {isOverloaded && (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          )}
        </div>
        
        <div className="flex gap-2 flex-wrap">
          {teacher.availability.map(shift => (
            <Badge key={shift} variant="outline" className="text-xs">
              {SHIFT_LABELS[shift]}
            </Badge>
          ))}
          <Badge variant="secondary" className="text-xs">
            {getSubjectNames(teacher.subjects).length} disciplinas
          </Badge>
        </div>
        
        {/* Carga horaria */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Carga horaria</span>
            <span>{teacher.current_hours}h / {teacher.max_weekly_hours}h</span>
          </div>
          <Progress value={progressPercent} className="h-1.5" />
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="ghost" size="icon" onClick={(e) => handleEdit(e, teacher)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="text-destructive" onClick={(e) => handleDeleteClick(e, teacher)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  </CardContent>
</Card>
```

---

## Fase 2: Adicionar Duplicar Turma

**Arquivo**: `src/pages/mapping/MappingClasses.tsx`

### Alteracoes:

1. **Adicionar icone Copy/CopyPlus no import**:
```typescript
import { Plus, Pencil, Trash2, BookOpen, Copy } from "lucide-react";
```

2. **Adicionar estado para turma sendo duplicada**:
```typescript
const [duplicatingClass, setDuplicatingClass] = useState<MappingClass | null>(null);
```

3. **Adicionar funcao de duplicar**:
```typescript
const handleDuplicate = async (e: React.MouseEvent, classData: MappingClass) => {
  e.stopPropagation();
  try {
    // Criar nova turma com nome modificado
    const newClassName = `${classData.name} (Copia)`;
    
    // Adicionar a turma
    const { data: newClass, error: classError } = await supabase
      .from('mapping_classes')
      .insert({
        name: newClassName,
        shift: classData.shift,
        student_count: classData.student_count,
        weekly_hours: classData.weekly_hours
      })
      .select('id')
      .single();
    
    if (classError) throw classError;
    
    // Copiar disciplinas da turma original (sem atribuicao de professor)
    const originalSubjects = classSubjects.filter(cs => cs.class_id === classData.id);
    
    if (originalSubjects.length > 0) {
      const newSubjects = originalSubjects.map(cs => ({
        class_id: newClass.id,
        subject_name: cs.subject_name,
        weekly_classes: cs.weekly_classes,
        teacher_id: null // Nao copiar atribuicao de professor
      }));
      
      const { error: subjectsError } = await supabase
        .from('mapping_class_subjects')
        .insert(newSubjects);
      
      if (subjectsError) throw subjectsError;
    }
    
    toast({ title: "Turma duplicada com sucesso", description: `Nova turma: ${newClassName}` });
    await refreshData();
  } catch (error: any) {
    toast({ title: "Erro ao duplicar turma", description: error.message, variant: "destructive" });
  }
};
```

4. **Adicionar botao de duplicar no card**:
```typescript
<div className="flex gap-2">
  <Button 
    variant="ghost" 
    size="icon"
    onClick={(e) => handleManageSubjects(e, classData)}
  >
    <BookOpen className="h-4 w-4" />
  </Button>
  <Button 
    variant="ghost" 
    size="icon"
    onClick={(e) => handleDuplicate(e, classData)}
    title="Duplicar turma"
  >
    <Copy className="h-4 w-4" />
  </Button>
  <Button variant="ghost" size="icon" onClick={(e) => handleEdit(e, classData)}>
    <Pencil className="h-4 w-4" />
  </Button>
  <Button variant="ghost" size="icon" className="text-destructive" onClick={(e) => handleDeleteClick(e, classData)}>
    <Trash2 className="h-4 w-4" />
  </Button>
</div>
```

5. **Adicionar import do supabase e funcao refreshData**:
```typescript
import { supabase } from "@/integrations/supabase/client";

const { classes, classSubjects, teachers, deleteClass, loading, refreshData } = useSchoolMapping();
```

---

## Arquivos Afetados

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/mapping/MappingTeachers.tsx` | Ajustar layout dos cards para 2 colunas e formato compacto |
| `src/pages/mapping/MappingClasses.tsx` | Adicionar botao e logica de duplicar turma |

---

## Secao Tecnica

### Logica de Duplicacao

A funcao de duplicar turma:
1. Cria uma nova turma com o nome original + " (Copia)"
2. Copia todas as disciplinas da turma original
3. NAO copia as atribuicoes de professores (teacher_id = null)
4. Atualiza a lista apos duplicacao

### Layout dos Cards

O novo layout dos professores segue o padrao de turmas e disciplinas:
- Grid de 2 colunas em telas medias+
- Indicador de cor do professor como circulo pequeno ao lado do nome
- Badges compactos para turnos e quantidade de disciplinas
- Progress bar menor (h-1.5)
- Botoes de acao agrupados a direita

