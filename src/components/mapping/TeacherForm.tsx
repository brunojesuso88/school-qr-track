import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useSchoolMapping, MappingTeacher } from "@/contexts/SchoolMappingContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import TeacherAvailabilityGrid from "@/components/timetable/TeacherAvailabilityGrid";

interface TeacherFormProps {
  teacher?: MappingTeacher | null;
  onClose: () => void;
}

interface AvailabilityCell {
  day: number;
  period: number;
  available: boolean;
}

const SHIFT_OPTIONS = [
  { value: "morning", label: "Manhã" },
  { value: "afternoon", label: "Tarde" },
  { value: "evening", label: "Noite" }
];

const SHIFT_PERIOD_OFFSET: Record<string, number> = {
  morning: 0,
  afternoon: 6,
  evening: 12
};

const TeacherForm = ({ teacher, onClose }: TeacherFormProps) => {
  const { addTeacher, updateTeacher } = useSchoolMapping();
  const { toast } = useToast();
  
  const [name, setName] = useState(teacher?.name || "");
  const [email, setEmail] = useState(teacher?.email || "");
  const [phone, setPhone] = useState(teacher?.phone || "");
  const [maxWeeklyHours, setMaxWeeklyHours] = useState(teacher?.max_weekly_hours?.toString() || "20");
  const [notes, setNotes] = useState(teacher?.notes || "");
  const [loading, setLoading] = useState(false);
  
  // Availability states
  const [selectedShifts, setSelectedShifts] = useState<string[]>([]);
  const [currentShiftTab, setCurrentShiftTab] = useState<string>("morning");
  const [availabilityByShift, setAvailabilityByShift] = useState<Record<string, AvailabilityCell[]>>({
    morning: [],
    afternoon: [],
    evening: []
  });

  // Load existing availability when editing a teacher
  useEffect(() => {
    const loadAvailability = async () => {
      if (!teacher?.id) return;
      
      const { data } = await supabase
        .from("teacher_availability")
        .select("*")
        .eq("teacher_id", teacher.id);
      
      if (data && data.length > 0) {
        const byShift: Record<string, AvailabilityCell[]> = {
          morning: [],
          afternoon: [],
          evening: []
        };
        
        data.forEach(row => {
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
        
        // Determine which shifts have data
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

  const handleShiftToggle = (shift: string, checked: boolean) => {
    if (checked) {
      const newShifts = [...selectedShifts, shift];
      setSelectedShifts(newShifts);
      
      // Inicializar disponibilidade completa se estiver vazia
      if (!availabilityByShift[shift] || availabilityByShift[shift].length === 0) {
        const fullAvailability: AvailabilityCell[] = [];
        for (let day = 1; day <= 5; day++) {
          for (let period = 1; period <= 6; period++) {
            fullAvailability.push({ day, period, available: true });
          }
        }
        setAvailabilityByShift(prev => ({
          ...prev,
          [shift]: fullAvailability
        }));
      }
      
      if (selectedShifts.length === 0) {
        setCurrentShiftTab(shift);
      }
    } else {
      const newShifts = selectedShifts.filter(s => s !== shift);
      setSelectedShifts(newShifts);
      // If we removed the current tab, switch to another
      if (currentShiftTab === shift && newShifts.length > 0) {
        setCurrentShiftTab(newShifts[0]);
      }
    }
  };

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
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        max_weekly_hours: parseInt(maxWeeklyHours),
        notes: notes.trim() || undefined
      };

      let teacherId: string | undefined;

      if (teacher) {
        await updateTeacher(teacher.id, data);
        teacherId = teacher.id;
      } else {
        const result = await addTeacher(data);
        teacherId = result?.id;
      }

      // Save availability if we have a teacherId
      if (teacherId && selectedShifts.length > 0) {
        // Delete existing availability
        await supabase
          .from("teacher_availability")
          .delete()
          .eq("teacher_id", teacherId);
        
        // Build records for all selected shifts
        const records: { teacher_id: string; day_of_week: number; period_number: number; available: boolean }[] = [];
        
        for (const shift of selectedShifts) {
          const offset = SHIFT_PERIOD_OFFSET[shift];
          const availability = availabilityByShift[shift] || [];
          
          availability.forEach(cell => {
            records.push({
              teacher_id: teacherId!,
              day_of_week: cell.day,
              period_number: cell.period + offset,
              available: cell.available
            });
          });
        }
        
        if (records.length > 0) {
          await supabase.from("teacher_availability").insert(records);
        }
      } else if (teacherId && selectedShifts.length === 0) {
        // No shifts selected, clear availability
        await supabase
          .from("teacher_availability")
          .delete()
          .eq("teacher_id", teacherId);
      }

      toast({ title: teacher ? "Professor atualizado com sucesso" : "Professor cadastrado com sucesso" });
      onClose();
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome *</Label>
        <Input
          id="name"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Nome completo"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="email@escola.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input
            id="phone"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="(00) 00000-0000"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Carga Horária Semanal *</Label>
        <RadioGroup value={maxWeeklyHours} onValueChange={setMaxWeeklyHours}>
          <div className="flex gap-4">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="20" id="hours-20" />
              <Label htmlFor="hours-20" className="font-normal">20 horas</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="40" id="hours-40" />
              <Label htmlFor="hours-40" className="font-normal">40 horas</Label>
            </div>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label>Turnos Disponíveis</Label>
        <div className="flex gap-4">
          {SHIFT_OPTIONS.map(shift => (
            <div key={shift.value} className="flex items-center space-x-2">
              <Checkbox
                id={`shift-${shift.value}`}
                checked={selectedShifts.includes(shift.value)}
                onCheckedChange={(checked) => handleShiftToggle(shift.value, !!checked)}
              />
              <Label htmlFor={`shift-${shift.value}`} className="font-normal cursor-pointer">
                {shift.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {selectedShifts.length > 0 && (
        <div className="space-y-2">
          <Label>Disponibilidade por Horário</Label>
          
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

      <div className="space-y-2">
        <Label htmlFor="notes">Observações</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Observações adicionais..."
          rows={2}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4 sticky bottom-0 bg-background pb-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Salvando..." : teacher ? "Salvar" : "Cadastrar"}
        </Button>
      </div>
    </form>
  );
};

export default TeacherForm;
