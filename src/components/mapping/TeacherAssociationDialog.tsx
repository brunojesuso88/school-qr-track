import { useState } from "react";
import { Book, ArrowRightLeft, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSchoolMapping, MappingTeacher, MappingClass, MappingClassSubject } from "@/contexts/SchoolMappingContext";
import { useToast } from "@/hooks/use-toast";

interface PendingChange {
  classSubjectId: string;
  action: 'assign' | 'unassign';
  previousTeacherId?: string | null;
}

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
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  if (!teacher) return null;

  // Verifica se há alteração pendente para uma disciplina
  const getPendingChange = (classSubjectId: string): PendingChange | undefined => {
    return pendingChanges.find(p => p.classSubjectId === classSubjectId);
  };

  // Obtém o teacher_id local (considerando alterações pendentes)
  const getLocalTeacherId = (classSubjectId: string): string | null | undefined => {
    const pending = getPendingChange(classSubjectId);
    if (pending) {
      return pending.action === 'assign' ? teacher.id : null;
    }
    return classSubjects.find(cs => cs.id === classSubjectId)?.teacher_id;
  };

  // Calcula a carga horária local (considerando alterações pendentes)
  const getLocalCurrentHours = (): number => {
    let hours = teacher.current_hours;
    
    pendingChanges.forEach(change => {
      const cs = classSubjects.find(c => c.id === change.classSubjectId);
      if (!cs) return;
      
      if (change.action === 'assign') {
        hours += cs.weekly_classes;
      } else if (change.action === 'unassign' && change.previousTeacherId === teacher.id) {
        hours -= cs.weekly_classes;
      }
    });
    
    return Math.max(0, hours);
  };

  const handleAssignOrReplace = (classSubjectId: string, currentTeacherId?: string | null) => {
    // Remove qualquer alteração pendente anterior para esta disciplina
    const filteredChanges = pendingChanges.filter(p => p.classSubjectId !== classSubjectId);
    
    // Adiciona a nova alteração
    setPendingChanges([
      ...filteredChanges,
      {
        classSubjectId,
        action: 'assign',
        previousTeacherId: currentTeacherId
      }
    ]);
  };

  const handleUnassign = (classSubjectId: string) => {
    const filteredChanges = pendingChanges.filter(p => p.classSubjectId !== classSubjectId);
    setPendingChanges([
      ...filteredChanges,
      {
        classSubjectId,
        action: 'unassign',
        previousTeacherId: teacher.id
      }
    ]);
  };

  const handleSaveAll = async () => {
    if (pendingChanges.length === 0) {
      handleClose();
      return;
    }

    setIsSaving(true);
    try {
      for (const change of pendingChanges) {
        if (change.action === 'unassign' && change.previousTeacherId) {
          await unassignTeacher(change.classSubjectId);
        }
        if (change.action === 'assign') {
          // Se tinha professor anterior, desatribui primeiro
          if (change.previousTeacherId) {
            await unassignTeacher(change.classSubjectId);
          }
          await assignTeacher(change.classSubjectId, teacher.id);
        }
      }
      
      toast({ 
        title: "Atribuições salvas", 
        description: `${pendingChanges.length} alteração(ões) salva(s) com sucesso.`
      });
      setPendingChanges([]);
      onClose();
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setPendingChanges([]);
    onClose();
  };

  const localCurrentHours = getLocalCurrentHours();

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

  // Verificar se atribuição excederia carga horária (usando horas locais)
  const wouldExceedHours = (weeklyClasses: number, classSubjectId: string) => {
    // Se já está pendente como atribuição, não conta novamente
    const pending = getPendingChange(classSubjectId);
    if (pending?.action === 'assign') {
      return false;
    }
    return localCurrentHours + weeklyClasses > teacher.max_weekly_hours;
  };

  // Obter disciplinas de uma turma
  const getClassSubjects = (classId: string) => {
    return classSubjects.filter(cs => cs.class_id === classId);
  };

  // Obter nome do professor atual (considerando estado local)
  const getTeacherName = (classSubjectId: string) => {
    const localTeacherId = getLocalTeacherId(classSubjectId);
    if (!localTeacherId) return null;
    return teachers.find(t => t.id === localTeacherId)?.name;
  };

  // Obter nome do professor original do banco
  const getOriginalTeacherName = (teacherId?: string | null) => {
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
                  const pending = getPendingChange(subject.id);
                  const localTeacherId = getLocalTeacherId(subject.id);
                  const localTeacherName = getTeacherName(subject.id);
                  const originalTeacherName = getOriginalTeacherName(subject.teacher_id);
                  const isAssignedToThisTeacher = localTeacherId === teacher.id;
                  const exceeds = wouldExceedHours(subject.weekly_classes, subject.id);
                  const canAssign = isAvailable && !isAssignedToThisTeacher && !exceeds;
                  const isPending = pending?.action === 'assign';

                  const isPendingUnassign = pending?.action === 'unassign';

                  return (
                    <div 
                      key={subject.id} 
                      className={`flex items-center justify-between py-1.5 px-2 rounded ${
                        isPending 
                          ? 'bg-primary/10 border border-primary/30' 
                          : isPendingUnassign
                            ? 'bg-destructive/10 border border-destructive/30'
                            : 'bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{subject.subject_name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({subject.weekly_classes}h)
                        </span>
                        {isPending ? (
                          <Badge variant="default" className="text-xs bg-primary">
                            <Check className="h-3 w-3 mr-1" />
                            Pendente
                          </Badge>
                        ) : isPendingUnassign ? (
                          <Badge variant="destructive" className="text-xs">
                            A remover
                          </Badge>
                        ) : (
                          localTeacherName && !isAssignedToThisTeacher && (
                            <Badge variant="secondary" className="text-xs">
                              {localTeacherName}
                            </Badge>
                          )
                        )}
                      </div>

                      {isAssignedToThisTeacher && !isPending && !isPendingUnassign ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={() => handleUnassign(subject.id)}
                          disabled={isSaving}
                        >
                          Remover
                        </Button>
                      ) : !isPending && !isPendingUnassign && (
                        <Button
                          size="sm"
                          variant={originalTeacherName ? "outline" : "default"}
                          disabled={!canAssign || isSaving}
                          onClick={() => handleAssignOrReplace(subject.id, subject.teacher_id)}
                          className="h-7 text-xs"
                        >
                          {originalTeacherName ? (
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
    <Dialog open={!!teacher} onOpenChange={() => handleClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0 pb-2">
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
              ({localCurrentHours}h / {teacher.max_weekly_hours}h)
            </span>
            {pendingChanges.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {pendingChanges.length} pendente(s)
              </Badge>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="h-[calc(85vh-200px)] pr-4">
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

        <DialogFooter className="flex-shrink-0 pt-4 gap-2 sm:gap-0 border-t mt-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSaving}
          >
            {pendingChanges.length > 0 ? "Descartar" : "Fechar"}
          </Button>
          {pendingChanges.length > 0 && (
            <Button
              onClick={handleSaveAll}
              disabled={isSaving}
            >
              {isSaving ? "Salvando..." : `Salvar (${pendingChanges.length})`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TeacherAssociationDialog;
