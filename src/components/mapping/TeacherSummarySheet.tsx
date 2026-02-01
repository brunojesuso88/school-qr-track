import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { MappingTeacher, MappingClass, MappingClassSubject } from "@/contexts/SchoolMappingContext";
import { supabase } from "@/integrations/supabase/client";

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

interface AvailabilitySummary {
  morning: number;
  afternoon: number;
  evening: number;
  morningTotal: number;
  afternoonTotal: number;
  eveningTotal: number;
}

const TeacherSummarySheet: React.FC<TeacherSummarySheetProps> = ({
  teacher,
  classes,
  classSubjects,
  globalSubjects,
  onClose
}) => {
  const [availability, setAvailability] = useState<AvailabilitySummary | null>(null);

  useEffect(() => {
    const loadAvailability = async () => {
      if (!teacher?.id) {
        setAvailability(null);
        return;
      }
      
      const { data } = await supabase
        .from("teacher_availability")
        .select("*")
        .eq("teacher_id", teacher.id);
      
      if (data && data.length > 0) {
        let morning = 0, afternoon = 0, evening = 0;
        let morningTotal = 0, afternoonTotal = 0, eveningTotal = 0;
        
        data.forEach(row => {
          if (row.period_number <= 6) {
            morningTotal++;
            if (row.available) morning++;
          } else if (row.period_number <= 12) {
            afternoonTotal++;
            if (row.available) afternoon++;
          } else {
            eveningTotal++;
            if (row.available) evening++;
          }
        });
        
        setAvailability({
          morning,
          afternoon,
          evening,
          morningTotal,
          afternoonTotal,
          eveningTotal
        });
      } else {
        setAvailability(null);
      }
    };
    
    loadAvailability();
  }, [teacher?.id]);

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

          <Separator />

          {/* Disponibilidade por Turno */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Disponibilidade por Turno</p>
            
            {availability ? (
              <div className="grid grid-cols-3 gap-2">
                {availability.morningTotal > 0 && (
                  <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
                    <p className="text-xs text-muted-foreground">Manhã</p>
                    <p className="text-sm font-medium text-green-600">
                      {availability.morning}/{availability.morningTotal}
                    </p>
                  </div>
                )}
                {availability.afternoonTotal > 0 && (
                  <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
                    <p className="text-xs text-muted-foreground">Tarde</p>
                    <p className="text-sm font-medium text-green-600">
                      {availability.afternoon}/{availability.afternoonTotal}
                    </p>
                  </div>
                )}
                {availability.eveningTotal > 0 && (
                  <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
                    <p className="text-xs text-muted-foreground">Noite</p>
                    <p className="text-sm font-medium text-green-600">
                      {availability.evening}/{availability.eveningTotal}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-2 text-center">
                Nenhuma disponibilidade configurada
              </p>
            )}
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
