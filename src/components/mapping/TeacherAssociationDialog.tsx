import { useState } from "react";
import { Book, ArrowRightLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSchoolMapping, MappingTeacher, MappingClass, MappingClassSubject } from "@/contexts/SchoolMappingContext";
import { useToast } from "@/hooks/use-toast";

interface TeacherAssociationDialogProps {
  teacher: MappingTeacher | null;
  onClose: () => void;
}

const SHIFT_LABELS: Record<string, string> = {
  morning: "Manhã",
  afternoon: "Tarde",
  evening: "Noite"
};

const TeacherAssociationDialog = ({ teacher, onClose }: TeacherAssociationDialogProps) => {
  const { classes, classSubjects, teachers, assignTeacher, unassignTeacher } = useSchoolMapping();
  const { toast } = useToast();
  const [isAssigning, setIsAssigning] = useState(false);

  if (!teacher) return null;

  const handleAssignOrReplace = async (classSubjectId: string, currentTeacherId?: string | null) => {
    setIsAssigning(true);
    try {
      // Se já tem professor, remove primeiro
      if (currentTeacherId) {
        await unassignTeacher(classSubjectId);
      }
      // Atribui o novo professor
      await assignTeacher(classSubjectId, teacher.id);
      toast({ 
        title: currentTeacherId ? "Professor substituído" : "Disciplina atribuída",
        description: `${teacher.name} foi atribuído com sucesso.`
      });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsAssigning(false);
    }
  };

  // Agrupar turmas por turno
  const shiftGroups = {
    morning: classes.filter(c => c.shift === 'morning'),
    afternoon: classes.filter(c => c.shift === 'afternoon'),
    evening: classes.filter(c => c.shift === 'evening')
  };

  // Verificar se o professor está disponível no turno
  const isAvailableInShift = (shift: string) => {
    return teacher.availability.includes(shift);
  };

  // Verificar se atribuição excederia carga horária
  const wouldExceedHours = (weeklyClasses: number) => {
    return teacher.current_hours + weeklyClasses > teacher.max_weekly_hours;
  };

  // Obter disciplinas de uma turma
  const getClassSubjects = (classId: string) => {
    return classSubjects.filter(cs => cs.class_id === classId);
  };

  // Obter nome do professor atual
  const getTeacherName = (teacherId?: string | null) => {
    if (!teacherId) return null;
    return teachers.find(t => t.id === teacherId)?.name;
  };

  const renderShiftSection = (shift: string, shiftClasses: MappingClass[]) => {
    if (shiftClasses.length === 0) return null;
    
    const isAvailable = isAvailableInShift(shift);

    return (
      <div key={shift} className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm uppercase text-muted-foreground">
            {SHIFT_LABELS[shift]}
          </h3>
          {!isAvailable && (
            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
              Indisponível
            </Badge>
          )}
        </div>

        {shiftClasses.map(cls => {
          const subjects = getClassSubjects(cls.id);
          if (subjects.length === 0) return null;

          return (
            <div key={cls.id} className="border rounded-lg p-3 space-y-2">
              <h4 className="font-medium text-sm">{cls.name}</h4>
              
              <div className="space-y-1">
                {subjects.map(subject => {
                  const currentTeacherName = getTeacherName(subject.teacher_id);
                  const isAssignedToThisTeacher = subject.teacher_id === teacher.id;
                  const exceeds = wouldExceedHours(subject.weekly_classes);
                  const canAssign = isAvailable && !isAssignedToThisTeacher && !exceeds;

                  return (
                    <div 
                      key={subject.id} 
                      className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{subject.subject_name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({subject.weekly_classes}h)
                        </span>
                        {currentTeacherName && !isAssignedToThisTeacher && (
                          <Badge variant="secondary" className="text-xs">
                            {currentTeacherName}
                          </Badge>
                        )}
                      </div>

                      {isAssignedToThisTeacher ? (
                        <Badge variant="default" className="text-xs">
                          Já atribuído
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant={currentTeacherName ? "outline" : "default"}
                          disabled={!canAssign || isAssigning}
                          onClick={() => handleAssignOrReplace(subject.id, subject.teacher_id)}
                          className="h-7 text-xs"
                        >
                          {currentTeacherName ? (
                            <>
                              <ArrowRightLeft className="h-3 w-3 mr-1" />
                              Substituir
                            </>
                          ) : (
                            "Atribuir"
                          )}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const hasAnySubjects = classSubjects.length > 0;

  return (
    <Dialog open={!!teacher} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Book className="h-5 w-5" />
            Associar disciplinas
          </DialogTitle>
          <div className="flex items-center gap-2 pt-1">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: teacher.color }}
            />
            <span className="font-medium">{teacher.name}</span>
            <span className="text-sm text-muted-foreground">
              ({teacher.current_hours}h / {teacher.max_weekly_hours}h)
            </span>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[calc(85vh-140px)] pr-4">
          {!hasAnySubjects ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhuma disciplina cadastrada nas turmas.</p>
              <p className="text-sm">Adicione disciplinas às turmas primeiro.</p>
            </div>
          ) : (
            <div className="space-y-6 pb-4">
              {renderShiftSection('morning', shiftGroups.morning)}
              {renderShiftSection('afternoon', shiftGroups.afternoon)}
              {renderShiftSection('evening', shiftGroups.evening)}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default TeacherAssociationDialog;
