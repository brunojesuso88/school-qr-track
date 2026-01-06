import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, X, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SchoolMappingProvider, useSchoolMapping, MappingTeacher } from "@/contexts/SchoolMappingContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const SHIFT_LABELS: Record<string, string> = {
  morning: "Manhã",
  afternoon: "Tarde",
  evening: "Noite"
};

const MappingDistributionContent = () => {
  const navigate = useNavigate();
  const { teachers, classes, classSubjects, globalSubjects, assignTeacher, unassignTeacher, loading } = useSchoolMapping();
  const { toast } = useToast();
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);

  const getTeacherById = (id: string) => teachers.find(t => t.id === id);
  
  const getSubjectName = (subjectName: string) => {
    const subject = globalSubjects.find(s => s.name === subjectName);
    return subject?.name || subjectName;
  };

  const getEligibleTeachers = (subjectName: string, classShift: string) => {
    const subject = globalSubjects.find(s => s.name === subjectName);
    if (!subject) return [];
    
    return teachers.filter(teacher => {
      const hasSubject = teacher.subjects.includes(subject.id);
      const hasShift = teacher.availability.includes(classShift);
      return hasSubject && hasShift;
    });
  };

  const getOverloadThreshold = (maxHours: number) => maxHours === 20 ? 13 : 26;

  const handleAssign = async (teacherId: string) => {
    if (!selectedSubjectId) return;
    setIsAssigning(true);
    try {
      await assignTeacher(selectedSubjectId, teacherId);
      toast({ title: "Professor atribuído com sucesso" });
      setSelectedSubjectId(null);
    } catch (error: any) {
      toast({ title: "Erro ao atribuir", description: error.message, variant: "destructive" });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleUnassign = async (classSubjectId: string) => {
    try {
      await unassignTeacher(classSubjectId);
      toast({ title: "Professor removido da disciplina" });
    } catch (error: any) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    }
  };

  const selectedClassSubject = classSubjects.find(cs => cs.id === selectedSubjectId);
  const selectedClass = selectedClassSubject ? classes.find(c => c.id === selectedClassSubject.class_id) : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 lg:grid-cols-2">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-64" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/school-mapping")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Distribuição</h1>
            <p className="text-muted-foreground">Atribua professores às disciplinas de cada turma</p>
          </div>
        </div>

        {classes.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Nenhuma turma cadastrada</p>
            <Button className="mt-4" onClick={() => navigate("/school-mapping/classes")}>
              Gerenciar Turmas
            </Button>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {classes.map((classData) => {
              const subjects = classSubjects.filter(cs => cs.class_id === classData.id);
              
              return (
                <Card key={classData.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{classData.name}</CardTitle>
                      <Badge variant="outline">
                        {SHIFT_LABELS[classData.shift] || classData.shift}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {subjects.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhuma disciplina cadastrada
                      </p>
                    ) : (
                      subjects.map((subject) => {
                        const teacher = subject.teacher_id ? getTeacherById(subject.teacher_id) : null;
                        
                        return (
                          <div 
                            key={subject.id}
                            className={cn(
                              "flex items-center justify-between p-3 rounded-lg border",
                              teacher ? "bg-muted/30" : "bg-muted/10 border-dashed"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex-1">
                                <p className="font-medium text-sm">
                                  {getSubjectName(subject.subject_name)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {subject.weekly_classes} aulas/semana
                                </p>
                              </div>
                            </div>

                            {teacher ? (
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: teacher.color }}
                                />
                                <span className="text-sm font-medium">{teacher.name}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => handleUnassign(subject.id)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedSubjectId(subject.id)}
                              >
                                <User className="h-3 w-3 mr-1" />
                                Atribuir
                              </Button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Assign Teacher Dialog */}
      <Dialog open={!!selectedSubjectId} onOpenChange={() => setSelectedSubjectId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Selecionar Professor</DialogTitle>
          </DialogHeader>
          
          {selectedClassSubject && selectedClass && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium">{selectedClass.name}</p>
                <p className="text-sm text-muted-foreground">
                  {getSubjectName(selectedClassSubject.subject_name)} - {selectedClassSubject.weekly_classes} aulas/semana
                </p>
              </div>

              <div className="space-y-2">
                {getEligibleTeachers(selectedClassSubject.subject_name, selectedClass.shift).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum professor disponível para esta disciplina e turno
                  </p>
                ) : (
                  getEligibleTeachers(selectedClassSubject.subject_name, selectedClass.shift).map((teacher) => {
                    const wouldExceed = teacher.current_hours + selectedClassSubject.weekly_classes > teacher.max_weekly_hours;
                    const isOverloaded = teacher.current_hours >= getOverloadThreshold(teacher.max_weekly_hours);
                    const progressPercent = (teacher.current_hours / teacher.max_weekly_hours) * 100;

                    return (
                      <button
                        key={teacher.id}
                        className={cn(
                          "w-full p-3 rounded-lg border text-left transition-colors",
                          wouldExceed 
                            ? "opacity-50 cursor-not-allowed" 
                            : "hover:bg-muted/50 cursor-pointer"
                        )}
                        onClick={() => !wouldExceed && handleAssign(teacher.id)}
                        disabled={wouldExceed || isAssigning}
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: teacher.color }}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{teacher.name}</span>
                              {isOverloaded && (
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Progress 
                                value={progressPercent} 
                                className="h-1.5 flex-1" 
                              />
                              <span className="text-xs text-muted-foreground">
                                {teacher.current_hours}h/{teacher.max_weekly_hours}h
                              </span>
                            </div>
                          </div>
                        </div>
                        {wouldExceed && (
                          <p className="text-xs text-destructive mt-2">
                            Excederia carga horária máxima
                          </p>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
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
