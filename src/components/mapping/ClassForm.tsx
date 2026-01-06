import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSchoolMapping, MappingClass } from "@/contexts/SchoolMappingContext";
import { useToast } from "@/hooks/use-toast";

interface ClassFormProps {
  classData?: MappingClass | null;
  onClose: () => void;
}

const ClassForm = ({ classData, onClose }: ClassFormProps) => {
  const { addClass, updateClass } = useSchoolMapping();
  const { toast } = useToast();
  
  const [name, setName] = useState(classData?.name || "");
  const [shift, setShift] = useState(classData?.shift || "morning");
  const [studentCount, setStudentCount] = useState(classData?.student_count?.toString() || "");
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
        shift,
        student_count: studentCount ? parseInt(studentCount) : undefined
      };

      if (classData) {
        await updateClass(classData.id, data);
        toast({ title: "Turma atualizada com sucesso" });
      } else {
        await addClass(data);
        toast({ title: "Turma cadastrada com sucesso" });
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
        <Label htmlFor="name">Nome da Turma *</Label>
        <Input
          id="name"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Ex: 6º Ano A"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="shift">Turno *</Label>
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

      <div className="space-y-2">
        <Label htmlFor="studentCount">Quantidade de Alunos</Label>
        <Input
          id="studentCount"
          type="number"
          value={studentCount}
          onChange={e => setStudentCount(e.target.value)}
          placeholder="Ex: 30"
          min="0"
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Salvando..." : classData ? "Salvar" : "Cadastrar"}
        </Button>
      </div>
    </form>
  );
};

export default ClassForm;
