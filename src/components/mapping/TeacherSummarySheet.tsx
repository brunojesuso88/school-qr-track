import { X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { MappingTeacher, MappingClass, MappingClassSubject } from "@/contexts/SchoolMappingContext";

const SHIFT_LABELS: Record<string, string> = {
  morning: "Manhã",
  afternoon: "Tarde",
  evening: "Noite"
};

interface TeacherSummarySheetProps {
  teacher: MappingTeacher | null;
  classes: MappingClass[];
  classSubjects: MappingClassSubject[];
  globalSubjects: { id: string; name: string }[];
  onClose: () => void;
}

const TeacherSummarySheet: React.FC<TeacherSummarySheetProps> = ({
  teacher,
  classes,
  classSubjects,
  globalSubjects,
  onClose
}) => {
  if (!teacher) return null;

  const teacherSubjects = classSubjects.filter(cs => cs.teacher_id === teacher.id);
  
  const getClassName = (classId: string) => {
    return classes.find(c => c.id === classId)?.name || "Turma desconhecida";
  };

  const getClassShift = (classId: string) => {
    const classData = classes.find(c => c.id === classId);
    return classData ? SHIFT_LABELS[classData.shift] || classData.shift : "";
  };

  const getSubjectName = (subjectId: string) => {
    return globalSubjects.find(s => s.id === subjectId)?.name || subjectId;
  };

  // Group by class
  const subjectsByClass = teacherSubjects.reduce((acc, cs) => {
    const className = getClassName(cs.class_id);
    if (!acc[className]) {
      acc[className] = { shift: getClassShift(cs.class_id), subjects: [] };
    }
    acc[className].subjects.push(cs);
    return acc;
  }, {} as Record<string, { shift: string; subjects: MappingClassSubject[] }>);

  const progressPercent = (teacher.current_hours / teacher.max_weekly_hours) * 100;
  const isOverloaded = teacher.current_hours >= teacher.max_weekly_hours * 0.8;

  return (
    <Sheet open={!!teacher} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div 
              className="w-4 h-4 rounded-full shrink-0"
              style={{ backgroundColor: teacher.color }}
            />
            <SheetTitle className="text-left">{teacher.name}</SheetTitle>
          </div>
        </SheetHeader>

        <div className="space-y-6">
          {/* Contact Info */}
          {teacher.email && (
            <div>
              <p className="text-sm text-muted-foreground">{teacher.email}</p>
            </div>
          )}

          {/* Workload */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Carga Horária</span>
              <span className={isOverloaded ? "text-amber-500 font-medium" : ""}>
                {teacher.current_hours}h / {teacher.max_weekly_hours}h
              </span>
            </div>
            <Progress 
              value={Math.min(progressPercent, 100)} 
              className={isOverloaded ? "[&>div]:bg-amber-500" : ""}
            />
          </div>

          {/* Availability */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Disponibilidade</p>
            <div className="flex flex-wrap gap-1">
              {teacher.availability.map(shift => (
                <Badge key={shift} variant="outline" className="text-xs">
                  {SHIFT_LABELS[shift] || shift}
                </Badge>
              ))}
            </div>
          </div>

          {/* Subjects teacher can teach */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Disciplinas Cadastradas</p>
            <div className="flex flex-wrap gap-1">
              {teacher.subjects.map(subjectId => (
                <Badge key={subjectId} variant="secondary" className="text-xs">
                  {getSubjectName(subjectId)}
                </Badge>
              ))}
              {teacher.subjects.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma disciplina cadastrada</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Classes and subjects assigned */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Turmas e Disciplinas Atribuídas</p>
            
            {Object.keys(subjectsByClass).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhuma turma atribuída
              </p>
            ) : (
              <div className="space-y-3">
                {Object.entries(subjectsByClass).map(([className, data]) => (
                  <div key={className} className="p-3 rounded-lg bg-muted/30 border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{className}</span>
                      <Badge variant="outline" className="text-xs">
                        {data.shift}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      {data.subjects.map(subject => (
                        <div key={subject.id} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{subject.subject_name}</span>
                          <span>{subject.weekly_classes}h/sem</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          {teacher.notes && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium">Observações</p>
                <p className="text-sm text-muted-foreground">{teacher.notes}</p>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default TeacherSummarySheet;
