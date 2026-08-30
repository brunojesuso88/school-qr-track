import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { localDateKey, isWeekend } from '@/lib/attendance/dailyStatus';

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
}

const DailyClassAttendanceDialog = ({ open, onOpenChange, className, shift, onSaved }: Props) => {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent'>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const today = new Date();
  const todayKey = localDateKey(today);
  const todayLabel = format(today, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  useEffect(() => {
    if (!open || !className) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [studentsRes, attendanceRes] = await Promise.all([
          supabase
            .from('students')
            .select('id, full_name')
            .eq('class', className)
            .eq('status', 'active')
            .order('full_name'),
          supabase.from('attendance').select('student_id, status').eq('date', todayKey),
        ]);
        if (studentsRes.error) throw studentsRes.error;
        if (cancelled) return;

        const list = studentsRes.data || [];
        const existing = new Map<string, string>();
        (attendanceRes.data || []).forEach((a) => existing.set(a.student_id, a.status));

        const map: Record<string, 'present' | 'absent'> = {};
        list.forEach((s) => {
          map[s.id] = existing.get(s.id) === 'absent' ? 'absent' : 'present';
        });

        setStudents(list);
        setAttendance(map);
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
  }, [open, className, todayKey]);

  const setStatus = (studentId: string, status: 'present' | 'absent') => {
    setAttendance((prev) => ({ ...prev, [studentId]: status }));
  };

  const presentCount = students.filter((s) => (attendance[s.id] ?? 'present') === 'present').length;
  const absentCount = students.length - presentCount;

  const handleSave = async () => {
    setSaving(true);
    try {
      const time = format(new Date(), 'HH:mm:ss');
      const records = students.map((s) => ({
        student_id: s.id,
        date: todayKey,
        status: attendance[s.id] ?? 'present',
        time,
        recorded_by: user?.id ?? null,
      }));

      if (records.length > 0) {
        const { error: attErr } = await supabase
          .from('attendance')
          .upsert(records, { onConflict: 'student_id,date' });
        if (attErr) throw attErr;
      }

      const { error: closeErr } = await supabase.from('daily_attendance_closures').upsert(
        {
          class_name: className,
          date: todayKey,
          shift: shift ?? null,
          student_count: students.length,
          present_count: presentCount,
          absent_count: absentCount,
          closed_by: user?.id ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'class_name,date' },
      );
      if (closeErr) throw closeErr;

      toast.success(`Frequência de ${className} registrada (${presentCount}P / ${absentCount}A)`);
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
            Frequência diária — {className}
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
