import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Calendar, FileText, AlertCircle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { format, parse, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { StudentPhoto } from '@/components/StudentPhoto';

interface Student {
  id: string;
  full_name: string;
  student_id: string;
  class: string;
  shift: string;
  guardian_name: string;
  guardian_phone: string;
  photo_url: string | null;
  qr_code: string;
  status: string;
  created_at: string;
  birth_date: string | null;
  has_medical_report: boolean;
  medical_report_details: string | null;
}

interface Occurrence {
  id: string;
  type: string;
  description: string | null;
  date: string;
  created_at: string;
}

interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  justified: number;
  attendanceRate: number;
}

interface StudentReportModalProps {
  student: Student | null;
  onClose: () => void;
}

const OCCURRENCE_TYPES = [
  { value: 'early_leave', label: 'Saída Antecipada' },
  { value: 'illness', label: 'Doença' },
  { value: 'medical_certificate', label: 'Atestado Médico' },
  { value: 'late_arrival', label: 'Atraso' },
  { value: 'discipline', label: 'Ocorrência Disciplinar' },
  { value: 'other', label: 'Outros' },
];

export const StudentReportModal = ({ student, onClose }: StudentReportModalProps) => {
  const [loading, setLoading] = useState(true);
  const [monthlyAttendance, setMonthlyAttendance] = useState<AttendanceSummary | null>(null);
  const [yearlyAttendance, setYearlyAttendance] = useState<AttendanceSummary | null>(null);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);

  useEffect(() => {
    if (student) {
      fetchStudentData();
    }
  }, [student]);

  const fetchStudentData = async () => {
    if (!student) return;
    
    setLoading(true);
    try {
      const now = new Date();
      
      // Fetch monthly attendance
      const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');
      
      const { data: monthData } = await supabase
        .from('attendance')
        .select('status')
        .eq('student_id', student.id)
        .gte('date', monthStart)
        .lte('date', monthEnd);

      if (monthData) {
        const total = monthData.length;
        const present = monthData.filter(a => a.status === 'present').length;
        const absent = monthData.filter(a => a.status === 'absent').length;
        const justified = monthData.filter(a => a.status === 'justified').length;
        setMonthlyAttendance({
          total,
          present,
          absent,
          justified,
          attendanceRate: total > 0 ? (present / total) * 100 : 0
        });
      }

      // Fetch yearly attendance
      const yearStart = format(startOfYear(now), 'yyyy-MM-dd');
      const yearEnd = format(endOfYear(now), 'yyyy-MM-dd');
      
      const { data: yearData } = await supabase
        .from('attendance')
        .select('status')
        .eq('student_id', student.id)
        .gte('date', yearStart)
        .lte('date', yearEnd);

      if (yearData) {
        const total = yearData.length;
        const present = yearData.filter(a => a.status === 'present').length;
        const absent = yearData.filter(a => a.status === 'absent').length;
        const justified = yearData.filter(a => a.status === 'justified').length;
        setYearlyAttendance({
          total,
          present,
          absent,
          justified,
          attendanceRate: total > 0 ? (present / total) * 100 : 0
        });
      }

      // Fetch occurrences
      const { data: occData } = await supabase
        .from('occurrences')
        .select('*')
        .eq('student_id', student.id)
        .order('date', { ascending: false });

      setOccurrences(occData || []);
    } catch {
      // Error loading data - user will see empty state
    } finally {
      setLoading(false);
    }
  };

  const getOccurrenceTypeLabel = (type: string) => {
    return OCCURRENCE_TYPES.find(t => t.value === type)?.label || type;
  };

  const getAttendanceColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600';
    if (rate >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const getAttendanceBgColor = (rate: number) => {
    if (rate >= 80) return 'bg-green-500';
    if (rate >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  };

  if (!student) return null;

  return (
    <Dialog open={!!student} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <StudentPhoto
              photoUrl={student.photo_url}
              fullName={student.full_name}
              status={student.status}
              size="lg"
            />
            <div>
              <DialogTitle className="text-xl">{student.full_name}</DialogTitle>
              <DialogDescription className="flex items-center gap-2 mt-1">
                <span>{student.student_id}</span>
                <span>•</span>
                <span>{student.class}</span>
                {student.has_medical_report && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                    Laudo
                  </Badge>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="attendance" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="attendance">
              <Calendar className="w-4 h-4 mr-2" />
              Frequência
            </TabsTrigger>
            <TabsTrigger value="occurrences">
              <FileText className="w-4 h-4 mr-2" />
              Ocorrências ({occurrences.length})
            </TabsTrigger>
            <TabsTrigger value="medical" disabled={!student.has_medical_report}>
              <AlertCircle className="w-4 h-4 mr-2" />
              Laudo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="attendance" className="mt-4 space-y-4">
            {loading ? (
              <div className="space-y-4">
                <div className="h-32 bg-muted animate-pulse rounded-lg" />
                <div className="h-32 bg-muted animate-pulse rounded-lg" />
              </div>
            ) : (
              <>
                {/* Monthly Summary */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Frequência do Mês Atual
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {monthlyAttendance && monthlyAttendance.total > 0 ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "text-4xl font-bold",
                            getAttendanceColor(monthlyAttendance.attendanceRate)
                          )}>
                            {monthlyAttendance.attendanceRate.toFixed(0)}%
                          </div>
                          <div className="flex-1">
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                              <div 
                                className={cn("h-full transition-all", getAttendanceBgColor(monthlyAttendance.attendanceRate))}
                                style={{ width: `${monthlyAttendance.attendanceRate}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="p-3 bg-green-500/10 rounded-lg">
                            <CheckCircle className="w-5 h-5 text-green-600 mx-auto mb-1" />
                            <div className="text-2xl font-bold text-green-600">{monthlyAttendance.present}</div>
                            <div className="text-xs text-muted-foreground">Presenças</div>
                          </div>
                          <div className="p-3 bg-red-500/10 rounded-lg">
                            <XCircle className="w-5 h-5 text-red-600 mx-auto mb-1" />
                            <div className="text-2xl font-bold text-red-600">{monthlyAttendance.absent}</div>
                            <div className="text-xs text-muted-foreground">Faltas</div>
                          </div>
                          <div className="p-3 bg-amber-500/10 rounded-lg">
                            <AlertCircle className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                            <div className="text-2xl font-bold text-amber-600">{monthlyAttendance.justified}</div>
                            <div className="text-xs text-muted-foreground">Justificadas</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm text-center py-4">
                        Nenhum registro de frequência neste mês
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Yearly Summary */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Frequência Anual ({new Date().getFullYear()})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {yearlyAttendance && yearlyAttendance.total > 0 ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "text-4xl font-bold",
                            getAttendanceColor(yearlyAttendance.attendanceRate)
                          )}>
                            {yearlyAttendance.attendanceRate.toFixed(0)}%
                          </div>
                          <div className="flex-1">
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                              <div 
                                className={cn("h-full transition-all", getAttendanceBgColor(yearlyAttendance.attendanceRate))}
                                style={{ width: `${yearlyAttendance.attendanceRate}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="p-3 bg-green-500/10 rounded-lg">
                            <CheckCircle className="w-5 h-5 text-green-600 mx-auto mb-1" />
                            <div className="text-2xl font-bold text-green-600">{yearlyAttendance.present}</div>
                            <div className="text-xs text-muted-foreground">Presenças</div>
                          </div>
                          <div className="p-3 bg-red-500/10 rounded-lg">
                            <XCircle className="w-5 h-5 text-red-600 mx-auto mb-1" />
                            <div className="text-2xl font-bold text-red-600">{yearlyAttendance.absent}</div>
                            <div className="text-xs text-muted-foreground">Faltas</div>
                          </div>
                          <div className="p-3 bg-amber-500/10 rounded-lg">
                            <AlertCircle className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                            <div className="text-2xl font-bold text-amber-600">{yearlyAttendance.justified}</div>
                            <div className="text-xs text-muted-foreground">Justificadas</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm text-center py-4">
                        Nenhum registro de frequência neste ano
                      </p>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="occurrences" className="mt-4">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : occurrences.length > 0 ? (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {occurrences.map((occurrence) => (
                  <Card key={occurrence.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-primary/10 text-primary">
                              {getOccurrenceTypeLabel(occurrence.type)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(parse(occurrence.date, 'yyyy-MM-dd', new Date()), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            </span>
                          </div>
                          {occurrence.description && (
                            <p className="text-sm text-muted-foreground mt-2">{occurrence.description}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">Nenhuma ocorrência registrada</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="medical" className="mt-4">
            {student.has_medical_report ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    Informações do Laudo Médico
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {student.medical_report_details ? (
                    <div className="prose prose-sm max-w-none">
                      <p className="text-foreground whitespace-pre-wrap">{student.medical_report_details}</p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Aluno possui laudo médico, mas não há descrição detalhada registrada.
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">Este aluno não possui laudo médico registrado</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
