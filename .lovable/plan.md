

# Plano: Disponibilidade por Turno e Ajustes no Formulario de Professor

## Visao Geral

Adicionar seletor de turnos no formulario de edicao de professor para controlar quais turnos sao exibidos na grade de disponibilidade por horario. Ajustar as cores para verde (disponivel) e vermelho (indisponivel). Remover o indicativo "Disciplinas Atribuidas" do card de resumo do professor.

---

## Estrutura de Turnos e Horarios

Cada turno possui 6 horarios:
- **Manha**: Horarios 1-6
- **Tarde**: Horarios 1-6  
- **Noite**: Horarios 1-6

A tabela `teacher_availability` armazena a disponibilidade por `day_of_week` (1-5) e `period_number` (1-6). Para diferenciar turnos, usaremos periodos:
- Manha: period_number 1-6
- Tarde: period_number 7-12
- Noite: period_number 13-18

---

## Alteracoes Necessarias

### 1. TeacherForm.tsx - Adicionar Seletor de Turnos e Grid de Disponibilidade

**Adicionar imports e estados:**

```tsx
import { Checkbox } from "@/components/ui/checkbox";
import TeacherAvailabilityGrid from "@/components/timetable/TeacherAvailabilityGrid";
import { supabase } from "@/integrations/supabase/client";

// Estados adicionais
const [selectedShifts, setSelectedShifts] = useState<string[]>([]);
const [currentShiftTab, setCurrentShiftTab] = useState<string>("morning");
const [availabilityByShift, setAvailabilityByShift] = useState<Record<string, AvailabilityCell[]>>({
  morning: [],
  afternoon: [],
  evening: []
});
```

**Adicionar constantes de turnos:**

```tsx
const SHIFT_OPTIONS = [
  { value: "morning", label: "Manha" },
  { value: "afternoon", label: "Tarde" },
  { value: "evening", label: "Noite" }
];

const SHIFT_PERIOD_OFFSET = {
  morning: 0,
  afternoon: 6,
  evening: 12
};
```

**Carregar disponibilidade ao editar professor:**

```tsx
useEffect(() => {
  const loadAvailability = async () => {
    if (!teacher?.id) return;
    
    const { data } = await supabase
      .from("teacher_availability")
      .select("*")
      .eq("teacher_id", teacher.id);
    
    if (data) {
      // Converter para formato por turno
      const byShift: Record<string, AvailabilityCell[]> = {
        morning: [],
        afternoon: [],
        evening: []
      };
      
      data.forEach(row => {
        // Determinar turno pelo period_number
        if (row.period_number <= 6) {
          byShift.morning.push({
            day: row.day_of_week,
            period: row.period_number,
            available: row.available
          });
        } else if (row.period_number <= 12) {
          byShift.afternoon.push({
            day: row.day_of_week,
            period: row.period_number - 6,
            available: row.available
          });
        } else {
          byShift.evening.push({
            day: row.day_of_week,
            period: row.period_number - 12,
            available: row.available
          });
        }
      });
      
      setAvailabilityByShift(byShift);
      
      // Determinar turnos selecionados
      const shifts: string[] = [];
      if (byShift.morning.length > 0) shifts.push("morning");
      if (byShift.afternoon.length > 0) shifts.push("afternoon");
      if (byShift.evening.length > 0) shifts.push("evening");
      setSelectedShifts(shifts);
      if (shifts.length > 0) setCurrentShiftTab(shifts[0]);
    }
  };
  
  loadAvailability();
}, [teacher?.id]);
```

**Adicionar UI de selecao de turnos:**

```tsx
<div className="space-y-2">
  <Label>Turnos Disponiveis</Label>
  <div className="flex gap-4">
    {SHIFT_OPTIONS.map(shift => (
      <div key={shift.value} className="flex items-center space-x-2">
        <Checkbox
          id={`shift-${shift.value}`}
          checked={selectedShifts.includes(shift.value)}
          onCheckedChange={(checked) => {
            if (checked) {
              setSelectedShifts([...selectedShifts, shift.value]);
              if (selectedShifts.length === 0) {
                setCurrentShiftTab(shift.value);
              }
            } else {
              setSelectedShifts(selectedShifts.filter(s => s !== shift.value));
            }
          }}
        />
        <Label htmlFor={`shift-${shift.value}`} className="font-normal">
          {shift.label}
        </Label>
      </div>
    ))}
  </div>
</div>
```

**Adicionar Grid de Disponibilidade com Tabs por Turno:**

```tsx
{selectedShifts.length > 0 && (
  <div className="space-y-2">
    <Label>Disponibilidade por Horario</Label>
    
    {selectedShifts.length > 1 && (
      <div className="flex gap-2 mb-2">
        {selectedShifts.map(shift => (
          <Button
            key={shift}
            type="button"
            variant={currentShiftTab === shift ? "default" : "outline"}
            size="sm"
            onClick={() => setCurrentShiftTab(shift)}
          >
            {SHIFT_OPTIONS.find(s => s.value === shift)?.label}
          </Button>
        ))}
      </div>
    )}
    
    <TeacherAvailabilityGrid
      availability={availabilityByShift[currentShiftTab] || []}
      onChange={(newAvailability) => {
        setAvailabilityByShift(prev => ({
          ...prev,
          [currentShiftTab]: newAvailability
        }));
      }}
    />
  </div>
)}
```

**Salvar disponibilidade no submit:**

```tsx
// No handleSubmit, apos salvar o professor:
if (teacher?.id || newTeacherId) {
  const teacherId = teacher?.id || newTeacherId;
  
  // Deletar disponibilidade existente
  await supabase
    .from("teacher_availability")
    .delete()
    .eq("teacher_id", teacherId);
  
  // Inserir nova disponibilidade
  const records: any[] = [];
  
  for (const shift of selectedShifts) {
    const offset = SHIFT_PERIOD_OFFSET[shift];
    const availability = availabilityByShift[shift] || [];
    
    availability.forEach(cell => {
      records.push({
        teacher_id: teacherId,
        day_of_week: cell.day,
        period_number: cell.period + offset,
        available: cell.available
      });
    });
  }
  
  if (records.length > 0) {
    await supabase.from("teacher_availability").insert(records);
  }
}
```

---

### 2. TeacherAvailabilityGrid.tsx - Ajustar Cores

**Alterar cores na legenda (linha 117-124):**

```tsx
// ANTES
<div className="w-4 h-4 rounded bg-success/20 border border-success/50" />
<div className="w-4 h-4 rounded bg-destructive/20 border border-destructive/50" />

// DEPOIS
<div className="w-4 h-4 rounded bg-green-500/20 border border-green-500" />
<div className="w-4 h-4 rounded bg-red-500/20 border border-red-500" />
```

**Alterar cores das celulas (linhas 169-179):**

```tsx
// ANTES
className={cn(
  "p-2 text-center border border-border transition-colors",
  available 
    ? "bg-success/10 hover:bg-success/20" 
    : "bg-destructive/10 hover:bg-destructive/20",
  ...
)}
{available ? (
  <Check className="w-4 h-4 mx-auto text-success" />
) : (
  <X className="w-4 h-4 mx-auto text-destructive" />
)}

// DEPOIS
className={cn(
  "p-2 text-center border border-border transition-colors",
  available 
    ? "bg-green-500/10 hover:bg-green-500/20" 
    : "bg-red-500/10 hover:bg-red-500/20",
  ...
)}
{available ? (
  <Check className="w-4 h-4 mx-auto text-green-500" />
) : (
  <X className="w-4 h-4 mx-auto text-red-500" />
)}
```

---

### 3. TeacherSummarySheet.tsx - Remover "Disciplinas Atribuidas"

**Remover linhas 95-101:**

```tsx
// REMOVER ESTE BLOCO:
{/* Assigned subjects count */}
<div className="space-y-2">
  <p className="text-sm font-medium">Disciplinas Atribuidas</p>
  <Badge variant="secondary">
    {teacherSubjects.length} disciplina(s)
  </Badge>
</div>
```

---

## Resumo das Alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/mapping/TeacherForm.tsx` | Adicionar seletor de turnos, tabs por turno e grid de disponibilidade |
| `src/components/timetable/TeacherAvailabilityGrid.tsx` | Alterar cores: verde para disponivel, vermelho para indisponivel |
| `src/components/mapping/TeacherSummarySheet.tsx` | Remover secao "Disciplinas Atribuidas" |

---

## Layout Visual do Formulario

```text
+------------------------------------------+
|  Nome *                                  |
|  [______________________________]        |
|                                          |
|  E-mail              Telefone            |
|  [______________]   [______________]     |
|                                          |
|  Carga Horaria Semanal *                 |
|  ( ) 20 horas   ( ) 40 horas             |
|                                          |
|  Turnos Disponiveis                      |
|  [x] Manha   [x] Tarde   [ ] Noite       |
|                                          |
|  Disponibilidade por Horario             |
|  [Manha] [Tarde]                         |
|  +-------+-----+-----+-----+-----+-----+ |
|  |       | Seg | Ter | Qua | Qui | Sex | |
|  | 1o    | [V] | [V] | [V] | [X] | [V] | |
|  | 2o    | [V] | [V] | [X] | [V] | [V] | |
|  | ...   | ... | ... | ... | ... | ... | |
|  +-------+-----+-----+-----+-----+-----+ |
|                                          |
|  Observacoes                             |
|  [______________________________]        |
|                                          |
|  [Cancelar]              [Salvar]        |
+------------------------------------------+

Legenda: [V] = Verde (disponivel)  [X] = Vermelho (indisponivel)
```

