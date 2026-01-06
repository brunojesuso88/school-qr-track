import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useSchoolMapping, MappingClass } from "@/contexts/SchoolMappingContext";
import { useToast } from "@/hooks/use-toast";

interface ClassSubjectsDialogProps {
  classData: MappingClass;
  onClose: () => void;
}

const ClassSubjectsDialog = ({ classData, onClose }: ClassSubjectsDialogProps) => {
  const { globalSubjects, classSubjects, addClassSubject, deleteClassSubject } = useSchoolMapping();
  const { toast } = useToast();
  
  const [selectedSubject, setSelectedSubject] = useState("");
  const [weeklyClasses, setWeeklyClasses] = useState("4");
  const [loading, setLoading] = useState(false);

  const classSubjectsList = classSubjects.filter(cs => cs.class_id === classData.id);
  
  const availableSubjects = globalSubjects.filter(
    gs => !classSubjectsList.some(cs => cs.subject_name === gs.name)
  );

  const handleAdd = async () => {
    if (!selectedSubject) {
      toast({ title: "Selecione uma disciplina", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      await addClassSubject({
        class_id: classData.id,
        subject_name: selectedSubject,
        weekly_classes: parseInt(weeklyClasses)
      });
      setSelectedSubject("");
      setWeeklyClasses("4");
      toast({ title: "Disciplina adicionada" });
    } catch (error: any) {
      toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteClassSubject(id);
      toast({ title: "Disciplina removida" });
    } catch (error: any) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Disciplinas - {classData.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add Subject Form */}
          <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
            <div className="space-y-2">
              <Label>Adicionar Disciplina</Label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma disciplina" />
                </SelectTrigger>
                <SelectContent>
                  {availableSubjects.length === 0 ? (
                    <div className="py-2 px-3 text-sm text-muted-foreground">
                      Todas as disciplinas já foram adicionadas
                    </div>
                  ) : (
                    availableSubjects.map(subject => (
                      <SelectItem key={subject.id} value={subject.name}>
                        {subject.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-2">
                <Label>Aulas/Semana</Label>
                <Input
                  type="number"
                  value={weeklyClasses}
                  onChange={e => setWeeklyClasses(e.target.value)}
                  min="1"
                  max="10"
                />
              </div>
              <Button onClick={handleAdd} disabled={loading || !selectedSubject}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>
          </div>

          {/* Subjects List */}
          <div className="space-y-2">
            <Label>Disciplinas da Turma</Label>
            {classSubjectsList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma disciplina adicionada
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {classSubjectsList.map(subject => (
                  <div 
                    key={subject.id}
                    className="flex items-center justify-between p-2 rounded border"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{subject.subject_name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {subject.weekly_classes} aulas
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDelete(subject.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClassSubjectsDialog;
