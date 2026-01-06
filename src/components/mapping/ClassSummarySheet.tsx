import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, User } from "lucide-react";
import { MappingTeacher, MappingClass, MappingClassSubject } from "@/contexts/SchoolMappingContext";

const SHIFT_LABELS: Record<string, string> = {
  morning: "Manhã",
  afternoon: "Tarde",
  evening: "Noite"
};

interface ClassSummarySheetProps {
  classData: MappingClass | null;
  teachers: MappingTeacher[];
  classSubjects: MappingClassSubject[];
  onClose: () => void;
}

const ClassSummarySheet: React.FC<ClassSummarySheetProps> = ({
  classData,
  teachers,
  classSubjects,
  onClose
}) => {
  if (!classData) return null;

  const subjects = classSubjects.filter(cs => cs.class_id === classData.id);
  
  const getTeacherById = (id: string) => teachers.find(t => t.id === id);

  // Calculate workload
  const assignedHours = subjects
    .filter(s => s.teacher_id)
    .reduce((acc, s) => acc + s.weekly_classes, 0);
  const totalHours = (classData as any).weekly_hours || (classData.shift === 'evening' ? 25 : 30);
  const progressPercent = totalHours > 0 ? (assignedHours / totalHours) * 100 : 0;

  const subjectsWithoutTeacher = subjects.filter(s => !s.teacher_id);
  const subjectsWithTeacher = subjects.filter(s => s.teacher_id);

  return (
    <Sheet open={!!classData} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-3">
            <SheetTitle className="text-left">{classData.name}</SheetTitle>
            <Badge variant="outline">
              {SHIFT_LABELS[classData.shift] || classData.shift}
            </Badge>
          </div>
        </SheetHeader>

        <div className="space-y-6">
          {/* Student count */}
          {classData.student_count && (
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {classData.student_count} alunos
              </span>
            </div>
          )}

          {/* Workload Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Carga Horária</span>
              <span>
                {assignedHours}h / {totalHours}h atribuídas
              </span>
            </div>
            <Progress value={Math.min(progressPercent, 100)} />
            <p className="text-xs text-muted-foreground">
              {subjects.length} disciplinas • {subjectsWithTeacher.length} com professor
            </p>
          </div>

          {/* Warning for missing teachers */}
          {subjectsWithoutTeacher.length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  {subjectsWithoutTeacher.length} disciplina(s) sem professor
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  {subjectsWithoutTeacher.map(s => s.subject_name).join(", ")}
                </p>
              </div>
            </div>
          )}

          <Separator />

          {/* Subjects with teachers */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Disciplinas e Professores</p>
            
            {subjects.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhuma disciplina cadastrada
              </p>
            ) : (
              <div className="space-y-2">
                {subjects.map((subject) => {
                  const teacher = subject.teacher_id ? getTeacherById(subject.teacher_id) : null;
                  
                  return (
                    <div 
                      key={subject.id} 
                      className={`p-3 rounded-lg border ${teacher ? 'bg-muted/30' : 'bg-muted/10 border-dashed'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{subject.subject_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {subject.weekly_classes} aulas/semana
                          </p>
                        </div>
                        {teacher ? (
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: teacher.color }}
                            />
                            <span className="text-sm">{teacher.name}</span>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Sem professor
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ClassSummarySheet;
