import { useState } from "react";
import { User, X, AlertTriangle, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SchoolMappingProvider, useSchoolMapping, MappingClass } from "@/contexts/SchoolMappingContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import SchoolMappingLayout from "@/components/mapping/SchoolMappingLayout";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const SHIFT_LABELS: Record<string, string> = {
  morning: "Manhã",
  afternoon: "Tarde",
  evening: "Noite"
};

interface PendingChange {
  classSubjectId: string;
  action: 'assign' | 'unassign';
  newTeacherId?: string;
  previousTeacherId?: string | null;
}

const MappingDistributionContent = () => {
  const { teachers, classes, classSubjects, globalSubjects, assignTeacher, unassignTeacher, loading } = useSchoolMapping();
  const { toast } = useToast();
  const [selectedClass, setSelectedClass] = useState<MappingClass | null>(null);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const getTeacherById = (id: string) => teachers.find(t => t.id === id);

  const getClassSubjects = (classId: string) => 
    classSubjects.filter(cs => cs.class_id === classId);

  const getClassStats = (classId: string) => {
    const subjects = getClassSubjects(classId);
    const total = subjects.length;
    const assigned = subjects.filter(s => s.teacher_id).length;
    return { total, assigned, percent: total > 0 ? (assigned / total) * 100 : 0 };
  };

  const getEligibleTeachers = (subjectName: string, classShift: string) => {
    return teachers.filter(teacher => {
      const hasShift = teacher.availability.includes(classShift);
      return hasShift;
    });
  };

  const getOverloadThreshold = (maxHours: number) => maxHours === 20 ? 13 : 26;

  // Get the effective teacher for a class subject, considering pending changes
  const getEffectiveTeacher = (classSubjectId: string, originalTeacherId: string | null | undefined) => {
    const pending = pendingChanges.find(p => p.classSubjectId === classSubjectId);
    if (pending) {
      if (pending.action === 'unassign') return null;
      if (pending.action === 'assign') return pending.newTeacherId;
    }
    return originalTeacherId;
  };

  // Calculate teacher hours considering pending changes
  const getTeacherEffectiveHours = (teacherId: string) => {
    let hours = 0;
    
    // Calculate from actual assignments
    classSubjects.forEach(cs => {
      const effectiveTeacher = getEffectiveTeacher(cs.id, cs.teacher_id);
      if (effectiveTeacher === teacherId) {
        hours += cs.weekly_classes;
      }
    });
    
    return hours;
  };

  const handleAssign = (classSubjectId: string, teacherId: string, previousTeacherId?: string | null) => {
    const filtered = pendingChanges.filter(p => p.classSubjectId !== classSubjectId);
    setPendingChanges([
      ...filtered,
      { classSubjectId, action: 'assign', newTeacherId: teacherId, previousTeacherId }
    ]);
  };

  const handleUnassign = (classSubjectId: string, currentTeacherId: string) => {
    const filtered = pendingChanges.filter(p => p.classSubjectId !== classSubjectId);
    setPendingChanges([
      ...filtered,
      { classSubjectId, action: 'unassign', previousTeacherId: currentTeacherId }
    ]);
  };

  const handleCancelPending = (classSubjectId: string) => {
    setPendingChanges(pendingChanges.filter(p => p.classSubjectId !== classSubjectId));
  };

  const handleSaveAll = async () => {
    if (pendingChanges.length === 0) return;
    
    setIsSaving(true);
    try {
      for (const change of pendingChanges) {
        if (change.action === 'unassign') {
          await unassignTeacher(change.classSubjectId);
        } else if (change.action === 'assign' && change.newTeacherId) {
          if (change.previousTeacherId) {
            await unassignTeacher(change.classSubjectId);
          }
          await assignTeacher(change.classSubjectId, change.newTeacherId);
        }
      }
      toast({ 
        title: "Atribuições salvas", 
        description: `${pendingChanges.length} alteração(ões) aplicada(s)` 
      });
      setPendingChanges([]);
      setSelectedClass(null);
    } catch (error: any) {
      toast({ 
        title: "Erro ao salvar", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseDialog = () => {
    if (pendingChanges.length > 0) {
      // Discard changes
      setPendingChanges([]);
    }
    setSelectedClass(null);
  };

  if (loading) {
    return (
      <SchoolMappingLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
        </div>
      </SchoolMappingLayout>
    );
  }

  return (
    <SchoolMappingLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Distribuição</h1>
          <p className="text-muted-foreground">Clique em uma turma para atribuir professores às disciplinas</p>
        </div>

        {classes.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Nenhuma turma cadastrada</p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((classData) => {
              const stats = getClassStats(classData.id);
              
              return (
                <Card 
                  key={classData.id}
                  className="cursor-pointer hover:shadow-md transition-shadow group"
                  onClick={() => setSelectedClass(classData)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{classData.name}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {SHIFT_LABELS[classData.shift] || classData.shift}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Disciplinas atribuídas</span>
                      <span className="font-medium">{stats.assigned}/{stats.total}</span>
                    </div>
                    <Progress 
                      value={stats.percent} 
                      className={cn(
                        "h-2",
                        stats.percent === 100 && "[&>div]:bg-green-500"
                      )} 
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Class Assignment Dialog */}
      <Dialog 
        open={!!selectedClass} 
        onOpenChange={(open) => {
          if (!open) handleCloseDialog();
        }}
        modal={true}
      >
        <DialogContent 
          className="max-w-2xl max-h-[90vh] flex flex-col"
          onInteractOutside={(e) => {
            const isPointerEvent = e.type === 'pointerdown' || e.type === 'pointerup';
            if (!isPointerEvent) {
              e.preventDefault();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{selectedClass?.name}</span>
              {selectedClass && (
                <Badge variant="outline">
                  {SHIFT_LABELS[selectedClass.shift] || selectedClass.shift}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {selectedClass && (
            <>
              <ScrollArea className="h-[calc(85vh-200px)] pr-4">
                <div className="space-y-3">
                  {getClassSubjects(selectedClass.id).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhuma disciplina cadastrada nesta turma
                    </p>
                  ) : (
                    getClassSubjects(selectedClass.id).map((subject) => {
                      const effectiveTeacherId = getEffectiveTeacher(subject.id, subject.teacher_id);
                      const effectiveTeacher = effectiveTeacherId ? getTeacherById(effectiveTeacherId) : null;
                      const pending = pendingChanges.find(p => p.classSubjectId === subject.id);
                      const isPendingAssign = pending?.action === 'assign';
                      const isPendingUnassign = pending?.action === 'unassign';
                      
                      return (
                        <div 
                          key={subject.id}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg border",
                            isPendingAssign && "bg-primary/5 border-primary/30",
                            isPendingUnassign && "bg-destructive/5 border-destructive/30",
                            !pending && effectiveTeacher && "bg-muted/30",
                            !pending && !effectiveTeacher && "bg-muted/10 border-dashed"
                          )}
                        >
                          <div className="flex-1">
                            <p className="font-medium text-sm">{subject.subject_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {subject.weekly_classes} aulas/semana
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Show current/pending teacher */}
                            {effectiveTeacher && !isPendingUnassign && (
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: effectiveTeacher.color }}
                                />
                                <span className="text-sm font-medium">{effectiveTeacher.name}</span>
                                {isPendingAssign && (
                                  <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                                    Pendente
                                  </Badge>
                                )}
                              </div>
                            )}

                            {/* Pending unassign indicator */}
                            {isPendingUnassign && (
                              <Badge variant="destructive" className="text-xs">
                                A remover
                              </Badge>
                            )}

                            {/* Actions */}
                            {pending ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => handleCancelPending(subject.id)}
                                disabled={isSaving}
                              >
                                Cancelar
                              </Button>
                            ) : effectiveTeacher ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => handleUnassign(subject.id, effectiveTeacher.id)}
                                disabled={isSaving}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            ) : (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    disabled={isSaving}
                                  >
                                    <User className="h-3 w-3 mr-1" />
                                    Atribuir
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent 
                                  className="w-80 p-0" 
                                  align="end"
                                  onWheel={(e) => e.stopPropagation()}
                                >
                                  <div className="p-2 border-b">
                                    <p className="text-sm font-medium">Selecionar professor</p>
                                  </div>
                                  <ScrollArea className="h-[250px]" onWheel={(e) => e.stopPropagation()}>
                                    <div className="p-2 space-y-1">
                                      {getEligibleTeachers(subject.subject_name, selectedClass.shift).length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center py-4">
                                          Nenhum professor disponível
                                        </p>
                                      ) : (
                                        getEligibleTeachers(subject.subject_name, selectedClass.shift).map((teacher) => {
                                          const effectiveHours = getTeacherEffectiveHours(teacher.id);
                                          const wouldExceed = effectiveHours + subject.weekly_classes > teacher.max_weekly_hours;
                                          const isOverloaded = effectiveHours >= getOverloadThreshold(teacher.max_weekly_hours);
                                          const progressPercent = (effectiveHours / teacher.max_weekly_hours) * 100;

                                          return (
                                            <button
                                              key={teacher.id}
                                              className={cn(
                                                "w-full p-2 rounded-md text-left transition-colors",
                                                wouldExceed 
                                                  ? "opacity-50 cursor-not-allowed" 
                                                  : "hover:bg-muted cursor-pointer"
                                              )}
                                              onClick={() => {
                                                if (!wouldExceed) {
                                                  handleAssign(subject.id, teacher.id, subject.teacher_id);
                                                }
                                              }}
                                              disabled={wouldExceed}
                                            >
                                              <div className="flex items-center gap-2">
                                                <div 
                                                  className="w-3 h-3 rounded-full"
                                                  style={{ backgroundColor: teacher.color }}
                                                />
                                                <div className="flex-1 min-w-0">
                                                  <div className="flex items-center gap-1 flex-wrap">
                                                    <span className="font-medium text-sm truncate">{teacher.name}</span>
                                                    {isOverloaded && (
                                                      <AlertTriangle className="h-3 w-3 text-amber-500" />
                                                    )}
                                                  </div>
                                                  <div className="flex items-center gap-2 mt-0.5">
                                                    <Progress 
                                                      value={progressPercent} 
                                                      className="h-1 flex-1" 
                                                    />
                                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                                      {effectiveHours}h/{teacher.max_weekly_hours}h
                                                    </span>
                                                  </div>
                                                </div>
                                              </div>
                                              {wouldExceed && (
                                                <p className="text-[10px] text-destructive mt-1">
                                                  Excederia carga máxima
                                                </p>
                                              )}
                                            </button>
                                          );
                                        })
                                      )}
                                    </div>
                                  </ScrollArea>
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>

              <DialogFooter className="border-t pt-4 mt-4">
                <Button
                  variant="outline"
                  onClick={handleCloseDialog}
                  disabled={isSaving}
                >
                  {pendingChanges.length > 0 ? 'Descartar' : 'Fechar'}
                </Button>
                {pendingChanges.length > 0 && (
                  <Button
                    onClick={handleSaveAll}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Salvando...' : `Salvar (${pendingChanges.length})`}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </SchoolMappingLayout>
  );
};

const MappingDistribution = () => {
  return (
    <SchoolMappingProvider>
      <MappingDistributionContent />
    </SchoolMappingProvider>
  );
};

export default MappingDistribution;
