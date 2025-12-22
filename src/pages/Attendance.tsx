import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Student {
  id: string;
  full_name: string;
  class: string;
}

interface AttendanceRecord {
  id: string;
  student_id: string;
  date: string;
  status: string;
}

const Attendance = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedClass, setSelectedClass] = useState('all');
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, [currentDate, selectedClass]);

  const fetchData = async () => {
    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd');

    let studentQuery = supabase.from('students').select('id, full_name, class').eq('status', 'active');
    if (selectedClass !== 'all') {
      studentQuery = studentQuery.eq('class', selectedClass);
    }
    const { data: studentsData } = await studentQuery;
    setStudents(studentsData || []);

    const studentIds = studentsData?.map(s => s.id) || [];
    if (studentIds.length > 0) {
      const { data: attendance } = await supabase
        .from('attendance')
        .select('*')
        .in('student_id', studentIds)
        .gte('date', start)
        .lte('date', end);
      setAttendanceData(attendance || []);
    } else {
      setAttendanceData([]);
    }

    const { data: allStudents } = await supabase.from('students').select('class').eq('status', 'active');
    const uniqueClasses = [...new Set(allStudents?.map(s => s.class) || [])];
    setClasses(uniqueClasses);
  };

  const days = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  });

  const getAttendanceForDay = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return attendanceData.filter(a => a.date === dateStr);
  };

  const getDayStatus = (day: Date) => {
    const dayAttendance = getAttendanceForDay(day);
    if (dayAttendance.length === 0) return null;
    const presentCount = dayAttendance.filter(a => a.status === 'present').length;
    const rate = (presentCount / students.length) * 100;
    if (rate >= 90) return 'high';
    if (rate >= 70) return 'medium';
    return 'low';
  };

  // Calculate individual student attendance rate for the month
  const getStudentAttendanceRate = (studentId: string) => {
    const studentAttendance = attendanceData.filter(a => a.student_id === studentId);
    if (studentAttendance.length === 0) return 0;
    const presentCount = studentAttendance.filter(a => a.status === 'present').length;
    return (presentCount / studentAttendance.length) * 100;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Calendário de Frequência</h1>
            <p className="text-muted-foreground">Visualize e acompanhe os padrões de frequência</p>
          </div>
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Todas as Turmas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Turmas</SelectItem>
              {classes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
            </CardTitle>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array(days[0].getDay()).fill(null).map((_, i) => <div key={`empty-${i}`} />)}
              {days.map(day => {
                const status = getDayStatus(day);
                const isToday = isSameDay(day, new Date());
                const attendance = getAttendanceForDay(day);
                const presentCount = attendance.filter(a => a.status === 'present').length;

                return (
                  <div
                    key={day.toISOString()}
                    className={`aspect-square p-1 rounded-lg text-center flex flex-col items-center justify-center text-sm transition-colors ${
                      isToday ? 'ring-2 ring-primary' : ''
                    } ${
                      status === 'high' ? 'bg-success/20 text-success' :
                      status === 'medium' ? 'bg-warning/20 text-warning' :
                      status === 'low' ? 'bg-destructive/20 text-destructive' :
                      'hover:bg-muted'
                    }`}
                  >
                    <span className="font-medium">{format(day, 'd')}</span>
                    {attendance.length > 0 && (
                      <span className="text-[10px]">{presentCount}/{students.length}</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-center gap-6 mt-6 text-xs">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-success/40" /> 90%+ Presente</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-warning/40" /> 70-89%</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-destructive/40" /> &lt;70%</div>
            </div>
          </CardContent>
        </Card>

        {/* Individual Student Attendance Report */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Relatório Individual de Frequência
            </CardTitle>
          </CardHeader>
          <CardContent>
            {students.length > 0 ? (
              <>
                <div className="flex items-center gap-4 mb-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-success" />
                    <span>≥ 70% Frequência</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-destructive" />
                    <span>&lt; 70% Frequência</span>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Aluno</TableHead>
                      <TableHead>Turma</TableHead>
                      <TableHead className="text-center">Presenças</TableHead>
                      <TableHead className="text-center">Faltas</TableHead>
                      <TableHead className="text-center">Frequência</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map(student => {
                      const studentAttendance = attendanceData.filter(a => a.student_id === student.id);
                      const presentCount = studentAttendance.filter(a => a.status === 'present').length;
                      const absentCount = studentAttendance.filter(a => a.status === 'absent').length;
                      const rate = getStudentAttendanceRate(student.id);
                      const isGood = rate >= 70;

                      return (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium">{student.full_name}</TableCell>
                          <TableCell>{student.class}</TableCell>
                          <TableCell className="text-center">{presentCount}</TableCell>
                          <TableCell className="text-center">{absentCount}</TableCell>
                          <TableCell className="text-center font-medium">
                            {studentAttendance.length > 0 ? `${rate.toFixed(1)}%` : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {studentAttendance.length > 0 && (
                              <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                isGood 
                                  ? 'bg-success/20 text-success' 
                                  : 'bg-destructive/20 text-destructive'
                              }`}>
                                {isGood ? 'Regular' : 'Atenção'}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Nenhum aluno encontrado para a turma selecionada.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Attendance;
