import { useState } from "react";
import { Users, GraduationCap, BookOpen, AlertTriangle, CheckCircle2, Clock, Download, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { SchoolMappingProvider, useSchoolMapping } from "@/contexts/SchoolMappingContext";
import { Skeleton } from "@/components/ui/skeleton";
import SchoolMappingLayout from "@/components/mapping/SchoolMappingLayout";
import { useToast } from "@/hooks/use-toast";

const SHIFT_LABELS: Record<string, string> = {
  morning: "Manhã",
  afternoon: "Tarde",
  evening: "Noite"
};

const MappingSummaryContent = () => {
  const { teachers, globalSubjects, classes, classSubjects, loading } = useSchoolMapping();
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  const downloadCSV = (content: string, filename: string) => {
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportMapping = async () => {
    setExporting(true);
    try {
      const shifts = ['morning', 'afternoon', 'evening'] as const;
      const date = new Date().toISOString().split('T')[0];
      let filesGenerated = 0;
      
      for (const shift of shifts) {
        const shiftClasses = classes.filter(c => c.shift === shift);
        if (shiftClasses.length === 0) continue;
        
        // Get all unique subjects for this shift
        const shiftSubjects = new Set<string>();
        shiftClasses.forEach(c => {
          classSubjects
            .filter(cs => cs.class_id === c.id)
            .forEach(cs => shiftSubjects.add(cs.subject_name));
        });
        
        const subjectList = Array.from(shiftSubjects).sort();
        
        // Header row
        const header = ['Turma', ...subjectList];
        
        // Data rows
        const rows = shiftClasses.map(c => {
          const row = [c.name];
          subjectList.forEach(subjectName => {
            const cs = classSubjects.find(
              x => x.class_id === c.id && x.subject_name === subjectName
            );
            if (cs) {
              const teacher = teachers.find(t => t.id === cs.teacher_id);
              row.push(teacher 
                ? `${teacher.name} (${cs.weekly_classes})` 
                : `- (${cs.weekly_classes})`
              );
            } else {
              row.push('-');
            }
          });
          return row;
        });
        
        const csv = [header, ...rows].map(r => r.join(';')).join('\n');
        downloadCSV(csv, `mapeamento_${SHIFT_LABELS[shift]}_${date}.csv`);
        filesGenerated++;
      }
      
      if (filesGenerated > 0) {
        toast({ 
          title: "Exportação concluída", 
          description: `${filesGenerated} arquivo(s) CSV gerado(s).` 
        });
      } else {
        toast({ 
          title: "Nenhum dado", 
          description: "Não há turmas cadastradas para exportar.",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({ 
        title: "Erro na exportação", 
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <SchoolMappingLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
        </div>
      </SchoolMappingLayout>
    );
  }

  // Calculate statistics
  const totalWeeklyHours = teachers.reduce((acc, t) => acc + t.max_weekly_hours, 0);
  const usedWeeklyHours = teachers.reduce((acc, t) => acc + t.current_hours, 0);
  const assignedSubjects = classSubjects.filter(cs => cs.teacher_id).length;
  const totalClassSubjects = classSubjects.length;
  
  const overloadedTeachers = teachers.filter(t => t.current_hours >= t.max_weekly_hours * 0.8);
  const availableTeachers = teachers.filter(t => t.current_hours < t.max_weekly_hours * 0.5);
  
  const incompleteClasses = classes.filter(c => {
    const subjects = classSubjects.filter(cs => cs.class_id === c.id);
    return subjects.some(s => !s.teacher_id);
  });

  const classesByShift = {
    morning: classes.filter(c => c.shift === 'morning').length,
    afternoon: classes.filter(c => c.shift === 'afternoon').length,
    evening: classes.filter(c => c.shift === 'evening').length
  };

  const getClassWeeklyHours = (classData: any) => {
    return classData.weekly_hours || (classData.shift === 'evening' ? 25 : 30);
  };

  const getClassAssignedHours = (classId: string) => {
    return classSubjects
      .filter(cs => cs.class_id === classId && cs.teacher_id)
      .reduce((acc, cs) => acc + cs.weekly_classes, 0);
  };

  return (
    <SchoolMappingLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Resumo Geral</h1>
            <p className="text-muted-foreground">Visão consolidada para conferência da direção</p>
          </div>
          <Button onClick={exportMapping} disabled={exporting || classes.length === 0}>
            {exporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Exportar CSV
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Professores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{teachers.length}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {overloadedTeachers.length} com alta carga • {availableTeachers.length} disponíveis
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                Turmas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{classes.length}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {classesByShift.morning} manhã • {classesByShift.afternoon} tarde • {classesByShift.evening} noite
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Disciplinas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{globalSubjects.length}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {assignedSubjects} atribuídas / {totalClassSubjects} total
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Workload Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Distribuição de Carga Horária
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Horas distribuídas</span>
                <span>{usedWeeklyHours}h / {totalWeeklyHours}h disponíveis</span>
              </div>
              <Progress value={totalWeeklyHours > 0 ? (usedWeeklyHours / totalWeeklyHours) * 100 : 0} />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Disciplinas atribuídas</span>
                <span>{assignedSubjects} / {totalClassSubjects}</span>
              </div>
              <Progress value={totalClassSubjects > 0 ? (assignedSubjects / totalClassSubjects) * 100 : 0} />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Teachers with alerts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Professores com Alta Carga ({overloadedTeachers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {overloadedTeachers.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Todos os professores estão com carga adequada
                </div>
              ) : (
                <div className="space-y-3">
                  {overloadedTeachers.map(teacher => {
                    const percent = (teacher.current_hours / teacher.max_weekly_hours) * 100;
                    return (
                      <div key={teacher.id} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: teacher.color }}
                            />
                            <span className="text-sm font-medium">{teacher.name}</span>
                          </div>
                          <span className="text-xs text-amber-500 font-medium">
                            {teacher.current_hours}h / {teacher.max_weekly_hours}h
                          </span>
                        </div>
                        <Progress value={Math.min(percent, 100)} className="h-1.5 [&>div]:bg-amber-500" />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Incomplete classes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Turmas Incompletas ({incompleteClasses.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {incompleteClasses.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Todas as turmas estão completas
                </div>
              ) : (
                <div className="space-y-3">
                  {incompleteClasses.slice(0, 5).map(classData => {
                    const subjects = classSubjects.filter(cs => cs.class_id === classData.id);
                    const missing = subjects.filter(s => !s.teacher_id);
                    const totalHours = getClassWeeklyHours(classData);
                    const assignedHours = getClassAssignedHours(classData.id);
                    
                    return (
                      <div key={classData.id} className="p-3 rounded-lg bg-muted/30 border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{classData.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {SHIFT_LABELS[classData.shift]}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {assignedHours}h / {totalHours}h • {missing.length} disciplina(s) sem professor
                        </div>
                        <div className="text-xs text-amber-500 mt-1">
                          {missing.map(s => s.subject_name).join(", ")}
                        </div>
                      </div>
                    );
                  })}
                  {incompleteClasses.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center">
                      + {incompleteClasses.length - 5} turma(s) adicionais
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Detailed Class List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Todas as Turmas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {classes.map(classData => {
                const subjects = classSubjects.filter(cs => cs.class_id === classData.id);
                const assignedCount = subjects.filter(s => s.teacher_id).length;
                const totalHours = getClassWeeklyHours(classData);
                const assignedHours = getClassAssignedHours(classData.id);
                const isComplete = assignedCount === subjects.length && subjects.length > 0;
                
                return (
                  <div 
                    key={classData.id} 
                    className={`p-3 rounded-lg border ${isComplete ? 'bg-green-500/5 border-green-500/20' : 'bg-muted/30'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{classData.name}</span>
                      <div className="flex items-center gap-1">
                        {isComplete && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                        <Badge variant="outline" className="text-xs">
                          {SHIFT_LABELS[classData.shift]}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Carga: {assignedHours}h / {totalHours}h</span>
                        <span>{assignedCount}/{subjects.length} disc.</span>
                      </div>
                      <Progress 
                        value={totalHours > 0 ? (assignedHours / totalHours) * 100 : 0} 
                        className="h-1.5"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </SchoolMappingLayout>
  );
};

const MappingSummary = () => {
  return (
    <SchoolMappingProvider>
      <MappingSummaryContent />
    </SchoolMappingProvider>
  );
};

export default MappingSummary;
