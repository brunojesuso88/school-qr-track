import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  Download, 
  FileSpreadsheet, 
  Users, 
  Calendar,
  Loader2 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

const DataExport = () => {
  const { userRole } = useAuth();
  const canViewGuardianPhone = userRole === 'admin' || userRole === 'direction';
  const [exportingStudents, setExportingStudents] = useState(false);
  const [exportingAttendance, setExportingAttendance] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: format(new Date(), 'yyyy-MM-01'),
    end: format(new Date(), 'yyyy-MM-dd')
  });

  const downloadCSV = (data: string, filename: string) => {
    const blob = new Blob(['\ufeff' + data], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  const exportStudents = async () => {
    setExportingStudents(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .select('student_id, full_name, class, shift, guardian_name, guardian_phone, status')
        .order('full_name');

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error('Nenhum aluno encontrado');
        return;
      }

      const headers = canViewGuardianPhone 
        ? ['Matrícula', 'Nome Completo', 'Turma', 'Turno', 'Responsável', 'Telefone', 'Status']
        : ['Matrícula', 'Nome Completo', 'Turma', 'Turno', 'Responsável', 'Status'];
      const shiftLabels: Record<string, string> = {
        morning: 'Manhã',
        afternoon: 'Tarde',
        evening: 'Noite'
      };

      const rows = data.map(s => canViewGuardianPhone 
        ? [
            s.student_id,
            s.full_name,
            s.class,
            shiftLabels[s.shift] || s.shift,
            s.guardian_name,
            s.guardian_phone,
            s.status === 'active' ? 'Ativo' : 'Inativo'
          ]
        : [
            s.student_id,
            s.full_name,
            s.class,
            shiftLabels[s.shift] || s.shift,
            s.guardian_name,
            s.status === 'active' ? 'Ativo' : 'Inativo'
          ]
      );

      const csv = [headers, ...rows].map(row => row.join(';')).join('\n');
      downloadCSV(csv, `alunos_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      toast.success('Lista de alunos exportada!');
    } catch (error) {
      console.error('Error exporting students:', error);
      toast.error('Erro ao exportar alunos');
    } finally {
      setExportingStudents(false);
    }
  };

  const exportAttendance = async () => {
    setExportingAttendance(true);
    try {
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id, student_id, full_name, class');

      if (studentsError) throw studentsError;

      const { data: attendance, error: attendanceError } = await supabase
        .from('attendance')
        .select('student_id, date, time, status')
        .gte('date', dateRange.start)
        .lte('date', dateRange.end)
        .order('date', { ascending: false });

      if (attendanceError) throw attendanceError;

      if (!attendance || attendance.length === 0) {
        toast.error('Nenhum registro de presença encontrado no período');
        return;
      }

      const studentMap = new Map(students?.map(s => [s.id, s]) || []);
      
      const headers = ['Data', 'Matrícula', 'Nome', 'Turma', 'Hora', 'Status'];
      const statusLabels: Record<string, string> = {
        present: 'Presente',
        absent: 'Ausente',
        late: 'Atrasado',
        justified: 'Justificado'
      };

      const rows = attendance.map(a => {
        const student = studentMap.get(a.student_id);
        return [
          format(new Date(a.date), 'dd/MM/yyyy'),
          student?.student_id || '-',
          student?.full_name || 'Aluno não encontrado',
          student?.class || '-',
          a.time || '-',
          statusLabels[a.status] || a.status
        ];
      });

      const csv = [headers, ...rows].map(row => row.join(';')).join('\n');
      downloadCSV(csv, `frequencia_${dateRange.start}_${dateRange.end}.csv`);
      toast.success('Relatório de frequência exportado!');
    } catch (error) {
      console.error('Error exporting attendance:', error);
      toast.error('Erro ao exportar frequência');
    } finally {
      setExportingAttendance(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Exportar Lista de Alunos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Exporte a lista completa de alunos cadastrados no sistema em formato CSV.
          </p>
          <Button onClick={exportStudents} disabled={exportingStudents}>
            {exportingStudents ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Exportar Alunos (CSV)
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Exportar Relatório de Frequência
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Exporte os registros de frequência de um período específico.
          </p>
          
          <div className="grid gap-4 sm:grid-cols-2 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="startDate">Data Inicial</Label>
              <Input
                id="startDate"
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Data Final</Label>
              <Input
                id="endDate"
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              />
            </div>
          </div>

          <Button onClick={exportAttendance} disabled={exportingAttendance}>
            {exportingAttendance ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Exportar Frequência (CSV)
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default DataExport;
