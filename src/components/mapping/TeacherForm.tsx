import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSchoolMapping, MappingTeacher } from "@/contexts/SchoolMappingContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import TeacherAvailabilitySection from "./TeacherAvailabilitySection";

interface TeacherFormProps {
  teacher?: MappingTeacher | null;
  onClose: () => void;
}

const TeacherForm = ({ teacher, onClose }: TeacherFormProps) => {
  const { globalSubjects, addTeacher, updateTeacher } = useSchoolMapping();
  const { toast } = useToast();
  
  const [name, setName] = useState(teacher?.name || "");
  const [email, setEmail] = useState(teacher?.email || "");
  const [phone, setPhone] = useState(teacher?.phone || "");
  const [maxWeeklyHours, setMaxWeeklyHours] = useState(teacher?.max_weekly_hours?.toString() || "20");
  const [subjects, setSubjects] = useState<string[]>(teacher?.subjects || []);
  const [notes, setNotes] = useState(teacher?.notes || "");
  const [loading, setLoading] = useState(false);
  const [detailedAvailability, setDetailedAvailability] = useState<{ day: number; period: number; available: boolean }[]>([]);

  const handleAvailabilityChange = useCallback((avail: { day: number; period: number; available: boolean }[]) => {
    setDetailedAvailability(avail);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // Derive availability from detailed grid or use default
      const derivedAvailability = detailedAvailability.length > 0 
        ? [...new Set(detailedAvailability.filter(a => a.available).map(a => {
            if (a.period <= 5) return "morning";
            if (a.period <= 10) return "afternoon";
            return "evening";
          }))]
        : ["morning", "afternoon", "evening"];

      const data = {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        max_weekly_hours: parseInt(maxWeeklyHours),
        subjects,
        availability: derivedAvailability,
        notes: notes.trim() || undefined
      };

      let teacherId = teacher?.id;
      
      if (teacher) {
        await updateTeacher(teacher.id, data);
      } else {
        const result = await addTeacher(data);
        teacherId = result?.id;
      }

      // Save detailed availability if we have a teacher ID
      if (teacherId && detailedAvailability.length > 0) {
        // Delete existing availability
        await supabase.from('teacher_availability').delete().eq('teacher_id', teacherId);
        
        // Insert new availability
        const inserts = detailedAvailability.map(a => ({
          teacher_id: teacherId,
          day_of_week: a.day,
          period_number: a.period,
          available: a.available
        }));
        
        await supabase.from('teacher_availability').insert(inserts);
      }

      toast({ title: teacher ? "Professor atualizado com sucesso" : "Professor cadastrado com sucesso" });
      onClose();
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleSubject = (subjectId: string) => {
    setSubjects(prev => 
      prev.includes(subjectId) 
        ? prev.filter(id => id !== subjectId)
        : [...prev, subjectId]
    );
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
        <Label>Disciplinas que leciona</Label>
        {globalSubjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma disciplina cadastrada
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
            {globalSubjects.map(subject => (
              <div key={subject.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`subject-${subject.id}`}
                  checked={subjects.includes(subject.id)}
                  onCheckedChange={() => toggleSubject(subject.id)}
                />
                <Label htmlFor={`subject-${subject.id}`} className="font-normal text-sm">
                  {subject.name}
                </Label>
              </div>
            ))}
          </div>
        )}
      </div>

      <TeacherAvailabilitySection 
        teacherId={teacher?.id} 
        onChange={handleAvailabilityChange} 
      />

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

      <div className="flex justify-end gap-2 pt-4">
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
