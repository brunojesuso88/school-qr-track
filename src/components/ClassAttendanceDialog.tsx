import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Student {
  id: string;
  full_name: string;
}

interface AttendanceRecord {
  studentId: string;
  status: 'present' | 'absent';
}

interface ClassAttendanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className: string;
  onSuccess?: () => void;
}

const ClassAttendanceDialog = ({ open, onOpenChange, className, onSuccess }: ClassAttendanceDialogProps) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent'>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const todayDisplay = format(today, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  useEffect(() => {
    if (open && className) {
      fetchStudentsAndAttendance();
    }
  }, [open, className]);

  const fetchStudentsAndAttendance = async () => {
    setLoading(true);
    try {
      // Fetch students and existing attendance in parallel
      const [studentsRes, attendanceRes] = await Promise.all([
        supabase
          .from('students')
          .select('id, full_name')
          .eq('class', className)
          .eq('status', 'active')
          .order('full_name'),
        supabase
          .from('attendance')
          .select('student_id, status')
          .eq('date', todayStr)
      ]);

      if (studentsRes.error) throw studentsRes.error;

      const studentsList = studentsRes.data || [];
      setStudents(studentsList);

      // Build attendance map - default all to present
      const attendanceMap: Record<string, 'present' | 'absent'> = {};
      const existingMap = new Map<string, string>();

      if (attendanceRes.data) {
        attendanceRes.data.forEach(a => {
          existingMap.set(a.student_id, a.status);
        });
      }

      studentsList.forEach(s => {
        const existing = existingMap.get(s.id);
        attendanceMap[s.id] = (existing === 'absent' ? 'absent' : 'present');
      });

      setAttendance(attendanceMap);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar alunos');
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = (studentId: string) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: prev[studentId] === 'present' ? 'absent' : 'present',
    }));
  };

  const handleSave = async () => {
    if ([0, 6].includes(new Date().getDay())) {
      toast.error('Não é possível registrar frequência nos finais de semana.');
      return;
    }
    setSaving(true);
    try {
      const records = students.map(s => ({
        student_id: s.id,
        date: todayStr,
        status: attendance[s.id] || 'present',
        time: format(new Date(), 'HH:mm:ss'),
      }));

      // Use upsert with unique constraint on student_id + date
      const { error } = await supabase
        .from('attendance')
        .upsert(records, { onConflict: 'student_id,date' });

      if (error) throw error;

      toast.success(`Chamada registrada para ${students.length} aluno(s)`);
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving attendance:', error);
      toast.error(error.message || 'Erro ao salvar chamada');
    } finally {
      setSaving(false);
    }
  };

  const presentCount = Object.values(attendance).filter(s => s === 'present').length;
  const absentCount = Object.values(attendance).filter(s => s === 'absent').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Chamada - {className}
          </DialogTitle>
          <DialogDescription>{todayDisplay}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 text-sm py-2 border-b">
          <span className="flex items-center gap-1 text-emerald-600">
            <CheckCircle2 className="w-4 h-4" /> {presentCount} presentes
          </span>
          <span className="flex items-center gap-1 text-red-500">
            <XCircle className="w-4 h-4" /> {absentCount} ausentes
          </span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : students.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum aluno ativo nesta turma</p>
          ) : (
            students.map(student => {
              const status = attendance[student.id] || 'present';
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
                      className={status === 'present' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}
                      onClick={() => status !== 'present' && toggleStatus(student.id)}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      P
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={status === 'absent' ? 'default' : 'outline'}
                      className={status === 'absent' ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
                      onClick={() => status !== 'absent' && toggleStatus(student.id)}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" />
                      A
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {!loading && students.length > 0 && (
          <div className="pt-3 border-t">
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Chamada'
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ClassAttendanceDialog;
