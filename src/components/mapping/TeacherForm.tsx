import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSchoolMapping, MappingTeacher } from "@/contexts/SchoolMappingContext";
import { useToast } from "@/hooks/use-toast";

interface TeacherFormProps {
  teacher?: MappingTeacher | null;
  onClose: () => void;
}

const SHIFTS = [
  { id: "morning", label: "Manhã" },
  { id: "afternoon", label: "Tarde" },
  { id: "evening", label: "Noite" }
];

const TeacherForm = ({ teacher, onClose }: TeacherFormProps) => {
  const { globalSubjects, addTeacher, updateTeacher } = useSchoolMapping();
  const { toast } = useToast();
  
  const [name, setName] = useState(teacher?.name || "");
  const [email, setEmail] = useState(teacher?.email || "");
  const [phone, setPhone] = useState(teacher?.phone || "");
  const [maxWeeklyHours, setMaxWeeklyHours] = useState(teacher?.max_weekly_hours?.toString() || "20");
  const [subjects, setSubjects] = useState<string[]>(teacher?.subjects || []);
  const [availability, setAvailability] = useState<string[]>(teacher?.availability || []);
  const [notes, setNotes] = useState(teacher?.notes || "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }

    if (availability.length === 0) {
      toast({ title: "Selecione ao menos um turno", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const data = {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        max_weekly_hours: parseInt(maxWeeklyHours),
        subjects,
        availability,
        notes: notes.trim() || undefined
      };

      if (teacher) {
        await updateTeacher(teacher.id, data);
        toast({ title: "Professor atualizado com sucesso" });
      } else {
        await addTeacher(data);
        toast({ title: "Professor cadastrado com sucesso" });
      }
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

  const toggleShift = (shiftId: string) => {
    setAvailability(prev => 
      prev.includes(shiftId) 
        ? prev.filter(id => id !== shiftId)
        : [...prev, shiftId]
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
        <Label>Turnos Disponíveis *</Label>
        <div className="flex gap-4">
          {SHIFTS.map(shift => (
            <div key={shift.id} className="flex items-center space-x-2">
              <Checkbox
                id={`shift-${shift.id}`}
                checked={availability.includes(shift.id)}
                onCheckedChange={() => toggleShift(shift.id)}
              />
              <Label htmlFor={`shift-${shift.id}`} className="font-normal">
                {shift.label}
              </Label>
            </div>
          ))}
        </div>
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
