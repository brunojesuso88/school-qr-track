import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import ManualAttendanceModal from '@/components/ManualAttendanceModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, startOfMonth, endOfMonth, subMonths, subWeeks, subDays, startOfYear, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, FileDown, Users, UserCheck, UserX, Percent, TrendingUp, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

interface Student {
  id: string;
  full_name: string;
  class: string;
  shift: string;
}

interface AttendanceRecord {
  id: string;
  student_id: string;
  date: string;
  status: string;
}

interface TrendData {
  label: string;
  rate: number;
  present: number;
  absent: number;
}

type TrendPeriod = 'week' | 'month' | '6months' | 'year';

const Attendance = () => {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Read URL parameters
  const urlStatus = searchParams.get('status');
  const urlDate = searchParams.get('date');
  const urlClass = searchParams.get('class');
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedClass, setSelectedClass] = useState(urlClass || 'all');
  const [selectedShift, setSelectedShift] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState(urlStatus || 'all');
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>('6months');
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [deletingAttendance, setDeletingAttendance] = useState<string | null>(null);
  const [isFilteredByUrl, setIsFilteredByUrl] = useState(false);

  // Apply URL filters on mount
  useEffect(() => {
    if (urlStatus || urlDate === 'today' || urlClass) {
      setIsFilteredByUrl(true);
      if (urlDate === 'today') {
        setCurrentDate(new Date());
      }
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [currentDate, selectedClass, selectedShift, selectedStudent, selectedStatus]);

  useEffect(() => {
    fetchTrendData();
  }, [currentDate, selectedClass, selectedShift, selectedStudent, trendPeriod]);

  const clearUrlFilters = () => {
    setSearchParams({});
    setSelectedStatus('all');
    setSelectedClass('all');
    setIsFilteredByUrl(false);
  };

  const fetchData = async () => {
    // If filtering by "today", use today's date only
    const isToday = urlDate === 'today' || isFilteredByUrl;
    const today = format(new Date(), 'yyyy-MM-dd');
    const start = isToday ? today : format(startOfMonth(currentDate), 'yyyy-MM-dd');
    const end = isToday ? today : format(endOfMonth(currentDate), 'yyyy-MM-dd');

    // Fetch all students for the filter dropdown
    const { data: allStudentsData } = await supabase
      .from('students')
      .select('id, full_name, class, shift')
      .eq('status', 'active')
      .order('full_name');
    setAllStudents(allStudentsData || []);

    let studentQuery = supabase.from('students').select('id, full_name, class, shift').eq('status', 'active');
    if (selectedClass !== 'all') {
      studentQuery = studentQuery.eq('class', selectedClass);
    }
    if (selectedShift !== 'all') {
      studentQuery = studentQuery.eq('shift', selectedShift as 'morning' | 'afternoon' | 'evening');
    }
    const { data: studentsData } = await studentQuery.order('full_name');
    
    // Filter by student if selected
    const filteredStudents = selectedStudent !== 'all' 
      ? studentsData?.filter(s => s.id === selectedStudent) || []
      : studentsData || [];
    
    setStudents(filteredStudents);

    const studentIds = filteredStudents.map(s => s.id);
    if (studentIds.length > 0) {
      let attendanceQuery = supabase
        .from('attendance')
        .select('*')
        .in('student_id', studentIds)
        .gte('date', start)
        .lte('date', end);
      
      // Apply status filter if set
      if (selectedStatus !== 'all') {
        attendanceQuery = attendanceQuery.eq('status', selectedStatus as 'present' | 'absent' | 'justified');
      }
      
      const { data: attendance } = await attendanceQuery;
      setAttendanceData(attendance || []);
    } else {
      setAttendanceData([]);
    }

    const { data: classStudents } = await supabase.from('students').select('class').eq('status', 'active');
    const uniqueClasses = [...new Set(classStudents?.map(s => s.class) || [])].filter(c => c && c.trim() !== '');
    setClasses(uniqueClasses);
  };

  const fetchTrendData = async () => {
    const trends: TrendData[] = [];
    
    // Get students based on filters
    let studentQuery = supabase.from('students').select('id').eq('status', 'active');
    if (selectedClass !== 'all') {
      studentQuery = studentQuery.eq('class', selectedClass);
    }
    if (selectedShift !== 'all') {
      studentQuery = studentQuery.eq('shift', selectedShift as 'morning' | 'afternoon' | 'evening');
    }
    const { data: studentsData } = await studentQuery;
    
    // Filter by student if selected
    const studentIds = selectedStudent !== 'all'
      ? [selectedStudent]
      : studentsData?.map(s => s.id) || [];

    if (studentIds.length === 0) {
      setTrendData([]);
      return;
    }

    // Define periods based on selection
    if (trendPeriod === 'week') {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = subDays(currentDate, i);
        const dateStr = format(date, 'yyyy-MM-dd');

        const { data: attendance } = await supabase
          .from('attendance')
          .select('status')
          .in('student_id', studentIds)
          .eq('date', dateStr);

        const present = attendance?.filter(a => a.status === 'present').length || 0;
        const absent = attendance?.filter(a => a.status === 'absent').length || 0;
        const total = attendance?.length || 0;
        const rate = total > 0 ? (present / total) * 100 : 0;

        trends.push({
          label: format(date, 'EEE', { locale: ptBR }),
          rate: Math.round(rate * 10) / 10,
          present,
          absent
        });
      }
    } else if (trendPeriod === 'month') {
      // Last 4 weeks
      for (let i = 3; i >= 0; i--) {
        const weekStart = startOfWeek(subWeeks(currentDate, i), { weekStartsOn: 0 });
        const weekEnd = endOfWeek(subWeeks(currentDate, i), { weekStartsOn: 0 });

        const { data: attendance } = await supabase
          .from('attendance')
          .select('status')
          .in('student_id', studentIds)
          .gte('date', format(weekStart, 'yyyy-MM-dd'))
          .lte('date', format(weekEnd, 'yyyy-MM-dd'));

        const present = attendance?.filter(a => a.status === 'present').length || 0;
        const absent = attendance?.filter(a => a.status === 'absent').length || 0;
        const total = attendance?.length || 0;
        const rate = total > 0 ? (present / total) * 100 : 0;

        trends.push({
          label: `Sem ${4 - i}`,
          rate: Math.round(rate * 10) / 10,
          present,
          absent
        });
      }
    } else if (trendPeriod === '6months') {
      // Last 6 months
      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(currentDate, i);
        const start = format(startOfMonth(monthDate), 'yyyy-MM-dd');
        const end = format(endOfMonth(monthDate), 'yyyy-MM-dd');

        const { data: attendance } = await supabase
          .from('attendance')
          .select('status')
          .in('student_id', studentIds)
          .gte('date', start)
          .lte('date', end);

        const present = attendance?.filter(a => a.status === 'present').length || 0;
        const absent = attendance?.filter(a => a.status === 'absent').length || 0;
        const total = attendance?.length || 0;
        const rate = total > 0 ? (present / total) * 100 : 0;

        trends.push({
          label: format(monthDate, 'MMM', { locale: ptBR }),
          rate: Math.round(rate * 10) / 10,
          present,
          absent
        });
      }
    } else if (trendPeriod === 'year') {
      // Full year - 12 months
      for (let i = 11; i >= 0; i--) {
        const monthDate = subMonths(currentDate, i);
        const start = format(startOfMonth(monthDate), 'yyyy-MM-dd');
        const end = format(endOfMonth(monthDate), 'yyyy-MM-dd');

        const { data: attendance } = await supabase
          .from('attendance')
          .select('status')
          .in('student_id', studentIds)
          .gte('date', start)
          .lte('date', end);

        const present = attendance?.filter(a => a.status === 'present').length || 0;
        const absent = attendance?.filter(a => a.status === 'absent').length || 0;
        const total = attendance?.length || 0;
        const rate = total > 0 ? (present / total) * 100 : 0;

        trends.push({
          label: format(monthDate, 'MMM', { locale: ptBR }),
          rate: Math.round(rate * 10) / 10,
          present,
          absent
        });
      }
    }

    setTrendData(trends);
  };

  const getStudentStats = (studentId: string) => {
    const studentAttendance = attendanceData.filter(a => a.student_id === studentId);
    const presentCount = studentAttendance.filter(a => a.status === 'present').length;
    const absentCount = studentAttendance.filter(a => a.status === 'absent').length;
    const justifiedCount = studentAttendance.filter(a => a.status === 'justified').length;
    const total = studentAttendance.length;
    const rate = total > 0 ? (presentCount / total) * 100 : 0;
    return { presentCount, absentCount, justifiedCount, total, rate };
  };

  const getTotalStats = () => {
    const totalPresent = attendanceData.filter(a => a.status === 'present').length;
    const totalAbsent = attendanceData.filter(a => a.status === 'absent').length;
    const totalJustified = attendanceData.filter(a => a.status === 'justified').length;
    const total = attendanceData.length;
    const overallRate = total > 0 ? (totalPresent / total) * 100 : 0;
    return { totalPresent, totalAbsent, totalJustified, total, overallRate };
  };

  const getShiftLabel = (shift: string) => {
    switch (shift) {
      case 'morning': return 'Manhã';
      case 'afternoon': return 'Tarde';
      case 'evening': return 'Noite';
      default: return shift;
    }
  };

  const generatePDF = (type: 'student' | 'class' | 'shift', studentId?: string) => {
    const stats = getTotalStats();
    const monthYear = format(currentDate, 'MMMM yyyy', { locale: ptBR });
    
    let title = '';
    let content = '';
    let filteredStudents = students;

    if (type === 'student' && studentId) {
      const student = students.find(s => s.id === studentId);
      if (!student) return;
      title = `Relatório de Frequência - ${student.full_name}`;
      filteredStudents = [student];
    } else if (type === 'class' && selectedClass !== 'all') {
      title = `Relatório de Frequência - Turma ${selectedClass}`;
    } else if (type === 'shift' && selectedShift !== 'all') {
      title = `Relatório de Frequência - Turno ${getShiftLabel(selectedShift)}`;
    } else {
      title = 'Relatório de Frequência Geral';
    }

    content = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    h1 { color: #333; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; }
    h2 { color: #555; margin-top: 20px; }
    .info { margin: 15px 0; color: #666; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
    th { background: #f5f5f5; font-weight: bold; }
    .good { color: #16a34a; }
    .warning { color: #ea580c; }
    .danger { color: #dc2626; }
    .summary { background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
    .summary-item { text-align: center; }
    .summary-value { font-size: 24px; font-weight: bold; }
    .summary-label { color: #666; font-size: 14px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p class="info">Período: ${monthYear}</p>
  
  <div class="summary">
    <div class="summary-grid">
      <div class="summary-item">
        <div class="summary-value">${filteredStudents.length}</div>
        <div class="summary-label">Total de Alunos</div>
      </div>
      <div class="summary-item">
        <div class="summary-value good">${stats.totalPresent}</div>
        <div class="summary-label">Presenças</div>
      </div>
      <div class="summary-item">
        <div class="summary-value danger">${stats.totalAbsent}</div>
        <div class="summary-label">Faltas</div>
      </div>
      <div class="summary-item">
        <div class="summary-value ${stats.overallRate >= 70 ? 'good' : 'danger'}">${stats.overallRate.toFixed(1)}%</div>
        <div class="summary-label">Taxa Geral</div>
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Aluno</th>
        <th>Turma</th>
        <th>Turno</th>
        <th>Presenças</th>
        <th>Faltas</th>
        <th>Justificadas</th>
        <th>Frequência</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${filteredStudents.map(student => {
        const studentStats = getStudentStats(student.id);
        const statusClass = studentStats.rate >= 70 ? 'good' : 'danger';
        const status = studentStats.rate >= 70 ? 'Regular' : 'Atenção';
        return `
          <tr>
            <td>${student.full_name}</td>
            <td>${student.class}</td>
            <td>${getShiftLabel(student.shift)}</td>
            <td class="good">${studentStats.presentCount}</td>
            <td class="danger">${studentStats.absentCount}</td>
            <td>${studentStats.justifiedCount}</td>
            <td class="${statusClass}">${studentStats.total > 0 ? studentStats.rate.toFixed(1) + '%' : '-'}</td>
            <td class="${statusClass}">${studentStats.total > 0 ? status : '-'}</td>
          </tr>
        `;
      }).join('')}
    </tbody>
  </table>

  <p class="info" style="margin-top: 30px;">Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
</body>
</html>
    `;

    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) {
      win.onload = () => {
        win.print();
      };
    }
  };

  const handleDeleteAttendance = async (studentId: string) => {
    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd');

    const { error } = await supabase
      .from('attendance')
      .delete()
      .eq('student_id', studentId)
      .gte('date', start)
      .lte('date', end);

    if (error) {
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir a frequência do aluno.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Frequência excluída',
        description: 'A frequência do mês foi excluída com sucesso.',
      });
      fetchData();
      fetchTrendData();
    }
    setDeletingAttendance(null);
  };

  const stats = getTotalStats();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Frequência</h1>
            <p className="text-muted-foreground">Acompanhe a frequência dos alunos</p>
          </div>
          <ManualAttendanceModal onSuccess={() => { fetchData(); fetchTrendData(); }} />
        </div>

        {/* Active Filters Banner */}
        {isFilteredByUrl && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">Filtros ativos:</span>
                  {urlStatus === 'present' && (
                    <Badge variant="secondary" className="bg-success/20 text-success">
                      Presentes
                    </Badge>
                  )}
                  {urlStatus === 'absent' && (
                    <Badge variant="secondary" className="bg-destructive/20 text-destructive">
                      Ausentes
                    </Badge>
                  )}
                  {urlDate === 'today' && (
                    <Badge variant="secondary">
                      Hoje ({format(new Date(), 'dd/MM/yyyy')})
                    </Badge>
                  )}
                  {urlClass && (
                    <Badge variant="secondary">
                      Turma: {urlClass}
                    </Badge>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={clearUrlFilters} className="gap-1">
                  <X className="w-4 h-4" />
                  Limpar filtros
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="min-w-[140px] text-center font-medium">
                  {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                </span>
                <Button variant="outline" size="icon" onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Todas as Turmas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Turmas</SelectItem>
                  {classes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={selectedShift} onValueChange={setSelectedShift}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="Todos os Turnos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Turnos</SelectItem>
                  <SelectItem value="morning">Manhã</SelectItem>
                  <SelectItem value="afternoon">Tarde</SelectItem>
                  <SelectItem value="evening">Noite</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="Todos os Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="present">Presentes</SelectItem>
                  <SelectItem value="absent">Ausentes</SelectItem>
                  <SelectItem value="justified">Justificados</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Todos os Alunos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Alunos</SelectItem>
                  {allStudents.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{students.length}</p>
                <p className="text-xs text-muted-foreground">Alunos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <UserCheck className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.totalPresent}</p>
                <p className="text-xs text-muted-foreground">Presenças</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <UserX className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{stats.totalAbsent}</p>
                <p className="text-xs text-muted-foreground">Faltas</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Percent className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className={`text-2xl font-bold ${stats.overallRate >= 70 ? 'text-green-600' : 'text-red-600'}`}>
                  {stats.overallRate.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">Frequência</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Trend Chart */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Tendência de Frequência
              </CardTitle>
              <Select value={trendPeriod} onValueChange={(v) => setTrendPeriod(v as TrendPeriod)}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Última Semana</SelectItem>
                  <SelectItem value="month">Último Mês</SelectItem>
                  <SelectItem value="6months">Últimos 6 Meses</SelectItem>
                  <SelectItem value="year">Ano Inteiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {trendData.length > 0 ? (
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="label" 
                      tick={{ fontSize: 12 }} 
                      tickLine={false}
                      axisLine={false}
                      className="fill-muted-foreground"
                    />
                    <YAxis 
                      domain={[0, 100]} 
                      tick={{ fontSize: 12 }} 
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}%`}
                      className="fill-muted-foreground"
                    />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload as TrendData;
                          return (
                            <div className="bg-popover border rounded-lg shadow-lg p-3">
                              <p className="font-medium capitalize">{data.label}</p>
                              <p className={`text-sm ${data.rate >= 70 ? 'text-green-600' : 'text-red-600'}`}>
                                Frequência: {data.rate}%
                              </p>
                              <p className="text-sm text-green-600">Presenças: {data.present}</p>
                              <p className="text-sm text-red-600">Faltas: {data.absent}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="rate" 
                      stroke="#4f46e5" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorRate)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                <p>Nenhum dado disponível para exibir o gráfico</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Export Buttons */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileDown className="w-4 h-4" />
              Gerar Relatório PDF
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => generatePDF('class')}>
                <FileDown className="w-4 h-4 mr-2" />
                {selectedClass !== 'all' ? `Turma ${selectedClass}` : 'Todas as Turmas'}
              </Button>
              {selectedShift !== 'all' && (
                <Button variant="outline" size="sm" onClick={() => generatePDF('shift')}>
                  <FileDown className="w-4 h-4 mr-2" />
                  Turno {getShiftLabel(selectedShift)}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Student Attendance Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Relatório de Frequência</CardTitle>
          </CardHeader>
          <CardContent>
            {students.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Aluno</TableHead>
                      <TableHead className="hidden sm:table-cell">Turma</TableHead>
                      <TableHead className="hidden sm:table-cell">Turno</TableHead>
                      <TableHead className="text-center">Presenças</TableHead>
                      <TableHead className="text-center">Faltas</TableHead>
                      <TableHead className="text-center">Frequência</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map(student => {
                      const studentStats = getStudentStats(student.id);
                      const isGood = studentStats.rate >= 70;

                      return (
                        <TableRow key={student.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{student.full_name}</p>
                              <p className="text-xs text-muted-foreground sm:hidden">
                                {student.class} • {getShiftLabel(student.shift)}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">{student.class}</TableCell>
                          <TableCell className="hidden sm:table-cell">{getShiftLabel(student.shift)}</TableCell>
                          <TableCell className="text-center">
                            <span className="text-green-600 font-medium">{studentStats.presentCount}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-red-600 font-medium">{studentStats.absentCount}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`font-medium ${isGood ? 'text-green-600' : 'text-red-600'}`}>
                              {studentStats.total > 0 ? `${studentStats.rate.toFixed(1)}%` : '-'}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            {studentStats.total > 0 ? (
                              <Badge variant={isGood ? 'default' : 'destructive'} className={isGood ? 'bg-green-500' : ''}>
                                {isGood ? 'Regular' : 'Atenção'}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => generatePDF('student', student.id)}
                              >
                                <FileDown className="w-4 h-4" />
                              </Button>
                              {studentStats.total > 0 && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      className="text-red-600 hover:text-red-700 hover:bg-red-100"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Excluir Frequência</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Tem certeza que deseja excluir todos os registros de frequência de <strong>{student.full_name}</strong> do mês de <strong>{format(currentDate, 'MMMM yyyy', { locale: ptBR })}</strong>?
                                        <br /><br />
                                        Esta ação não pode ser desfeita.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction 
                                        onClick={() => handleDeleteAttendance(student.id)}
                                        className="bg-red-600 hover:bg-red-700"
                                      >
                                        Excluir
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Nenhum aluno encontrado</p>
                <p className="text-sm">Ajuste os filtros ou adicione alunos</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Attendance;