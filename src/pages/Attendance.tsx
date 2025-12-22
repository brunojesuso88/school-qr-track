import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Attendance = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedClass, setSelectedClass] = useState('all');
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, [currentDate, selectedClass]);

  const fetchData = async () => {
    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd');

    let studentQuery = supabase.from('students').select('*').eq('status', 'active');
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Attendance Calendar</h1>
            <p className="text-muted-foreground">View and track attendance patterns</p>
          </div>
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              {format(currentDate, 'MMMM yyyy')}
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
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
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
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-success/40" /> 90%+ Present</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-warning/40" /> 70-89%</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-destructive/40" /> &lt;70%</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Attendance;
