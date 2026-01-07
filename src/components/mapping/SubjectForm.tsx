import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSchoolMapping, MappingGlobalSubject } from "@/contexts/SchoolMappingContext";
import { useToast } from "@/hooks/use-toast";

interface SubjectFormProps {
  subject?: MappingGlobalSubject | null;
  onClose: () => void;
}

const SubjectForm = ({ subject, onClose }: SubjectFormProps) => {
  const { addGlobalSubject, updateGlobalSubject } = useSchoolMapping();
  const { toast } = useToast();
  
  const [name, setName] = useState(subject?.name || "");
  const [defaultWeeklyClasses, setDefaultWeeklyClasses] = useState(
    subject?.default_weekly_classes?.toString() || "4"
  );
  const [shift, setShift] = useState(subject?.shift || "morning");
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
        default_weekly_classes: parseInt(defaultWeeklyClasses),
        shift
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome da Disciplina *</Label>
        <Input
          id="name"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Ex: Matemática"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="shift">Turno Padrão *</Label>
        <Select value={shift} onValueChange={setShift}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="morning">Manhã</SelectItem>
            <SelectItem value="afternoon">Tarde</SelectItem>
            <SelectItem value="evening">Noite</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Salvando..." : subject ? "Salvar" : "Cadastrar"}
        </Button>
      </div>
    </form>
  );
};

export default SubjectForm;
