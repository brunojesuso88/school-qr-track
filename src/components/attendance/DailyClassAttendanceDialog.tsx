import { useState, useEffect } from 'react';
import { useActiveSchoolId } from '@/contexts/SchoolContext';
import { assertActiveSchool } from '@/lib/schools/scope';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  localDateKey,
  mergeExistingStatuses,
  countMarks,
  buildAttendanceRecords,
  buildClosureRow,
  type AttendanceMark,
} from '@/lib/attendance/dailyStatus';

interface StudentRow {
  id: string;
  full_name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className: string;
  shift?: string | null;
  onSaved?: () => void;
  /** Rótulo do cabeçalho (a mesma chamada é acessada por Turmas e por Frequência). */
  title?: string;
}

const DailyClassAttendanceDialog = ({ open, onOpenChange, className, shift, onSaved, title }: Props) => {
  const activeSchoolId = useActiveSchoolId();
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceMark>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const today = new Date();
  const todayKey = localDateKey(today);
  const todayLabel = format(today, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  useEffect(() => {
    if (!open || !className) return;
    if (!activeSchoolId) {
      setStudents([]);
      setAttendance({});
      setLoading(false);
      return;
    }
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const studentsRes = await supabase
          .from('students')
          .select('id, full_name')
          .eq('school_id', activeSchoolId)
          .eq('class', className)
          .eq('status', 'active')
          .order('full_name');
        if (studentsRes.error) throw studentsRes.error;
        if (cancelled) return;

        const list = studentsRes.data || [];
        let existing: { student_id: string; status: string }[] = [];
        if (list.length > 0) {
          const attendanceRes = await supabase
            .from('attendance')
            .select('student_id, status')
            .eq('school_id', activeSchoolId)
            .eq('date', todayKey)
            .in('student_id', list.map((s) => s.id));
          if (attendanceRes.error) throw attendanceRes.error;
          existing = attendanceRes.data || [];
        }
        if (cancelled) return;

        setStudents(list);
        setAttendance(mergeExistingStatuses(list, existing));
      } catch (e) {
        if (!cancelled) setError('Não foi possível carregar os alunos desta turma.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [open, className, todayKey, activeSchoolId]);

  const setStatus = (studentId: string, status: AttendanceMark) => {
    setAttendance((prev) => ({ ...prev, [studentId]: status }));
  };

  const counts = countMarks(students, attendance);
  const presentCount = counts.present;
  const absentCount = counts.absent;


  const handleSave = async () => {
    setSaving(true);
    try {
      const time = format(new Date(), 'HH:mm:ss');
      const schoolId = assertActiveSchool(activeSchoolId);
      const records = buildAttendanceRecords(students, attendance, todayKey, time, user?.id ?? null, schoolId);

      if (records.length > 0) {
        const { error: attErr } = await supabase
          .from('attendance')
          .upsert(records, { onConflict: 'student_id,date' });
        if (attErr) throw attErr;
      }

      const { error: closeErr } = await supabase.from('daily_attendance_closures').upsert(
        buildClosureRow(
          className, todayKey, shift ?? null, counts, user?.id ?? null,
          new Date().toISOString(), schoolId,
        ),
        { onConflict: 'school_id,class_name,date' },
      );
      if (closeErr) throw closeErr;

      toast.success(
        `Frequência de ${className} registrada (${presentCount}P / ${absentCount}A)`,
      );
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar a frequência da turma');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            {title ?? 'Frequência diária'} — {className}
          </DialogTitle>
          <DialogDescription>{todayLabel}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 text-sm py-2 border-b shrink-0">
          <span className="flex items-center gap-1 text-emerald-600">
            <CheckCircle2 className="w-4 h-4" /> {presentCount} presentes
          </span>
          <span className="flex items-center gap-1 text-destructive">
            <XCircle className="w-4 h-4" /> {absentCount} ausentes
          </span>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-1 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="text-center text-sm text-destructive py-8">{error}</p>
          ) : students.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum aluno ativo nesta turma</p>
          ) : (
            students.map((student) => {
              const status = attendance[student.id] ?? 'present';
              return (
                <div
                  key={student.id}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <span className="text-sm font-medium truncate flex-1 mr-3">{student.full_name}</span>
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant={status === 'present' ? 'default' : 'outline'}
                      aria-pressed={status === 'present'}
                      onClick={() => setStatus(student.id, 'present')}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />P
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={status === 'absent' ? 'destructive' : 'outline'}
                      aria-pressed={status === 'absent'}
                      onClick={() => setStatus(student.id, 'absent')}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" />A
                    </Button>
                  </div>

                </div>
              );
            })
          )}
        </div>

        {!loading && !error && students.length > 0 && (
          <div className="pt-3 border-t shrink-0 bg-background">
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar frequência do dia'
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DailyClassAttendanceDialog;
