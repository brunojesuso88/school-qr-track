import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MappingTeacher, MappingClass, MappingClassSubject } from "@/contexts/SchoolMappingContext";
import { supabase } from "@/integrations/supabase/client";
import TeacherAvailabilityGrid from "@/components/timetable/TeacherAvailabilityGrid";

const SHIFT_LABELS: Record<string, string> = {
  morning: "Manhã",
  afternoon: "Tarde",
  evening: "Noite"
};

const SHIFT_CONFIG = [
  { key: "morning", label: "Manhã", offset: 0, range: [1, 6] },
  { key: "afternoon", label: "Tarde", offset: 6, range: [7, 12] },
  { key: "evening", label: "Noite", offset: 12, range: [13, 18] },
];

interface TeacherSummarySheetProps {
  teacher: MappingTeacher | null;
  classes: MappingClass[];
  classSubjects: MappingClassSubject[];
  globalSubjects: { id: string; name: string }[];
  onClose: () => void;
}

interface AvailabilityRow {
  day_of_week: number;
  period_number: number;
  available: boolean;
}

const TeacherSummarySheet: React.FC<TeacherSummarySheetProps> = ({
  teacher,
  classes,
  classSubjects,
  globalSubjects,
  onClose
}) => {
  const [rawAvailability, setRawAvailability] = useState<AvailabilityRow[]>([]);

  useEffect(() => {
    const loadAvailability = async () => {
      if (!teacher?.id) {
        setRawAvailability([]);
        return;
      }
      
      const { data } = await supabase
        .from("teacher_availability")
        .select("*")
        .eq("teacher_id", teacher.id);
      
      setRawAvailability(data || []);
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

  // Group by class
  const subjectsByClass = teacherSubjects.reduce((acc, cs) => {
    const className = getClassName(cs.class_id);
    if (!acc[className]) {
      acc[className] = { shift: getClassShift(cs.class_id), subjects: [] };
    }
    acc[className].subjects.push(cs);
    return acc;
  }, {} as Record<string, { shift: string; subjects: MappingClassSubject[] }>);

  // Calcular horas reais dinamicamente
  const realHours = classSubjects
    .filter(cs => cs.teacher_id === teacher.id)
    .reduce((sum, cs) => sum + cs.weekly_classes, 0);

  const progressPercent = (realHours / teacher.max_weekly_hours) * 100;
  const isOverloaded = realHours >= teacher.max_weekly_hours * 0.8;

  // Build availability grids per shift
  const shiftsWithData = SHIFT_CONFIG.filter(sc => 
    rawAvailability.some(r => r.period_number >= sc.range[0] && r.period_number <= sc.range[1])
  );

  const getGridDataForShift = (offset: number, range: [number, number]) => {
    return rawAvailability
      .filter(r => r.period_number >= range[0] && r.period_number <= range[1])
      .map(r => ({
        day: r.day_of_week,
        period: r.period_number - offset,
        available: r.available
      }));
  };

  // Summary counts per shift
  const getShiftSummary = (range: [number, number]) => {
    const rows = rawAvailability.filter(r => r.period_number >= range[0] && r.period_number <= range[1]);
    const total = rows.length;
    const available = rows.filter(r => r.available).length;
    return { available, total };
  };

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
                {realHours}h / {teacher.max_weekly_hours}h
              </span>
            </div>
            <Progress 
              value={Math.min(progressPercent, 100)} 
              className={isOverloaded ? "[&>div]:bg-amber-500" : ""}
            />
          </div>

          <Separator />

          {/* Disponibilidade detalhada por turno */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Disponibilidade por Turno</p>
            
            {shiftsWithData.length > 0 ? (
              <>
                {/* Summary badges */}
                <div className="grid grid-cols-3 gap-2">
                  {shiftsWithData.map(sc => {
                    const summary = getShiftSummary(sc.range as [number, number]);
                    return (
                      <div key={sc.key} className="p-2 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
                        <p className="text-xs text-muted-foreground">{sc.label}</p>
                        <p className="text-sm font-medium text-green-600">
                          {summary.available}/{summary.total}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Tabs with availability grids */}
                <Tabs defaultValue={shiftsWithData[0]?.key}>
                  <TabsList className="w-full">
                    {shiftsWithData.map(sc => (
                      <TabsTrigger key={sc.key} value={sc.key} className="flex-1 text-xs">
                        {sc.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {shiftsWithData.map(sc => (
                    <TabsContent key={sc.key} value={sc.key}>
                      <TeacherAvailabilityGrid
                        availability={getGridDataForShift(sc.offset, sc.range as [number, number])}
                        onChange={() => {}}
                        readOnly
                      />
                    </TabsContent>
                  ))}
                </Tabs>
              </>
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
