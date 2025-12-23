import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCheck, UserX, Clock, TrendingUp, TrendingDown, Calendar, AlertTriangle } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Stats {
  totalStudents: number;
  presentToday: number;
  absentToday: number;
  attendanceRate: number;
}

interface TrendData {
  label: string;
  rate: number;
  present: number;
  absent: number;
}

interface ClassAbsence {
  className: string;
  absentCount: number;
  total: number;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    totalStudents: 0,
    presentToday: 0,
    absentToday: 0,
    attendanceRate: 0
  });
  const [recentAttendance, setRecentAttendance] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [classAbsences, setClassAbsences] = useState<ClassAbsence[]>([]);
  const [loading, setLoading] = useState(true);
  const [previousRate, setPreviousRate] = useState<number | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

      // Fetch total students
      const { count: totalStudents } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Fetch today's attendance
      const { data: todayAttendance } = await supabase
        .from('attendance')
        .select('*, students(id, full_name, class, photo_url)')
        .eq('date', today)
        .order('created_at', { ascending: false });

      // Fetch yesterday's attendance for comparison
      const { data: yesterdayAttendance } = await supabase
        .from('attendance')
        .select('status')
        .eq('date', yesterday);

      const presentToday = todayAttendance?.filter(a => a.status === 'present').length || 0;
      const absentToday = (totalStudents || 0) - presentToday;
      const attendanceRate = totalStudents ? Math.round((presentToday / totalStudents) * 100) : 0;

      // Calculate yesterday's rate for comparison
      if (yesterdayAttendance && yesterdayAttendance.length > 0) {
        const yesterdayPresent = yesterdayAttendance.filter(a => a.status === 'present').length;
        const yesterdayRate = Math.round((yesterdayPresent / (totalStudents || 1)) * 100);
        setPreviousRate(yesterdayRate);
      }

      setStats({
        totalStudents: totalStudents || 0,
        presentToday,
        absentToday,
        attendanceRate
      });

      setRecentAttendance(todayAttendance?.slice(0, 5) || []);

      // Fetch trend data for the last 7 days
      await fetchTrendData();

      // Fetch class absences
      await fetchClassAbsences(today);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrendData = async () => {
    const trends: TrendData[] = [];
    
    const { data: studentsData } = await supabase
      .from('students')
      .select('id')
      .eq('status', 'active');
    
    const studentIds = studentsData?.map(s => s.id) || [];
    
    if (studentIds.length === 0) {
      setTrendData([]);
      return;
    }

    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
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

    setTrendData(trends);
  };

  const fetchClassAbsences = async (today: string) => {
    // Get all students with their classes
    const { data: students } = await supabase
      .from('students')
      .select('id, class')
      .eq('status', 'active');

    if (!students) return;

    // Get today's attendance
    const { data: attendance } = await supabase
      .from('attendance')
      .select('student_id, status')
      .eq('date', today);

    // Group by class
    const classMap: Record<string, { absent: number; total: number }> = {};
    
    students.forEach(student => {
      if (!classMap[student.class]) {
        classMap[student.class] = { absent: 0, total: 0 };
      }
      classMap[student.class].total++;
      
      const studentAttendance = attendance?.find(a => a.student_id === student.id);
      if (!studentAttendance || studentAttendance.status === 'absent') {
        classMap[student.class].absent++;
      }
    });

    // Convert to array and sort by absences
    const sorted = Object.entries(classMap)
      .map(([className, data]) => ({
        className,
        absentCount: data.absent,
        total: data.total
      }))
      .sort((a, b) => b.absentCount - a.absentCount)
      .slice(0, 3);

    setClassAbsences(sorted);
  };

  const handleCardClick = (type: 'students' | 'present' | 'absent' | 'rate') => {
    switch (type) {
      case 'students':
        navigate('/students');
        break;
      case 'present':
        navigate('/attendance?status=present&date=today');
        break;
      case 'absent':
        navigate('/attendance?status=absent&date=today');
        break;
      case 'rate':
        navigate('/attendance');
        break;
    }
  };

  const getRateTrend = () => {
    if (previousRate === null) return null;
    const diff = stats.attendanceRate - previousRate;
    if (diff > 0) return { icon: TrendingUp, text: `+${diff}%`, color: 'text-success' };
    if (diff < 0) return { icon: TrendingDown, text: `${diff}%`, color: 'text-destructive' };
    return null;
  };

  const rateTrend = getRateTrend();

  const statCards = [
    {
      title: 'Total de Alunos',
      value: stats.totalStudents,
      icon: Users,
      description: 'Alunos ativos',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      onClick: () => handleCardClick('students')
    },
    {
      title: 'Presentes Hoje',
      value: stats.presentToday,
      icon: UserCheck,
      description: 'Check-in realizado',
      color: 'text-success',
      bgColor: 'bg-success/10',
      onClick: () => handleCardClick('present')
    },
    {
      title: 'Ausentes Hoje',
      value: stats.absentToday,
      icon: UserX,
      description: 'Sem check-in',
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      onClick: () => handleCardClick('absent'),
      alert: stats.absentToday > 0 && stats.attendanceRate < 70
    },
    {
      title: 'Taxa de Frequência',
      value: `${stats.attendanceRate}%`,
      icon: TrendingUp,
      description: 'Hoje',
      color: stats.attendanceRate >= 70 ? 'text-success' : 'text-destructive',
      bgColor: 'bg-accent',
      onClick: () => handleCardClick('rate'),
      trend: rateTrend
    }
  ];

  const formatTime = (time: string | null) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    return `${hours}:${minutes}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">PAINEL</h1>
          <p className="text-muted-foreground mt-1">
            {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => (
            <Card
              key={stat.title}
              className="card-hover animate-fade-in cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]"
              style={{ animationDelay: `${index * 50}ms` }}
              onClick={stat.onClick}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-3xl font-semibold mt-1">{stat.value}</p>
                      {stat.trend && (
                        <div className={`flex items-center gap-1 text-xs ${stat.trend.color}`}>
                          <stat.trend.icon className="w-3 h-3" />
                          <span>{stat.trend.text}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                  </div>
                  <div className={`p-3 rounded-xl ${stat.bgColor} relative`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                    {stat.alert && (
                      <AlertTriangle className="w-3 h-3 text-destructive absolute -top-1 -right-1" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts and Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Trend Chart */}
          <Card className="animate-fade-in" style={{ animationDelay: '200ms' }}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Tendência de Frequência
              </CardTitle>
              <CardDescription>Últimos 7 dias</CardDescription>
            </CardHeader>
            <CardContent>
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis domain={[0, 100]} className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [`${value}%`, 'Taxa']}
                    />
                    <Area
                      type="monotone"
                      dataKey="rate"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#colorRate)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  Sem dados de frequência
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Check-ins */}
          <Card className="animate-fade-in" style={{ animationDelay: '250ms' }}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Check-ins Recentes
              </CardTitle>
              <CardDescription>Últimos registros de hoje</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : recentAttendance.length > 0 ? (
                <div className="space-y-3">
                  {recentAttendance.map(record => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                      onClick={() => navigate(`/students?search=${encodeURIComponent(record.students?.full_name || '')}`)}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="w-9 h-9">
                          <AvatarImage src={record.students?.photo_url || ''} alt={record.students?.full_name} />
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {record.students?.full_name?.[0] || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{record.students?.full_name}</p>
                          <p className="text-xs text-muted-foreground">{record.students?.class}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          record.status === 'present' ? 'status-present' : 'status-absent'
                        }`}>
                          {record.status === 'present' ? 'Presente' : 'Ausente'}
                        </span>
                        <p className="text-xs text-muted-foreground mt-1">{formatTime(record.time)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum registro de frequência hoje</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Classes with Most Absences */}
          <Card className="animate-fade-in" style={{ animationDelay: '300ms' }}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Turmas com Mais Ausências
              </CardTitle>
              <CardDescription>Top 3 turmas hoje</CardDescription>
            </CardHeader>
            <CardContent>
              {classAbsences.length > 0 ? (
                <div className="space-y-3">
                  {classAbsences.map((item, index) => (
                    <div
                      key={item.className}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                      onClick={() => navigate(`/attendance?class=${encodeURIComponent(item.className)}&date=today`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                          index === 0 ? 'bg-destructive/20 text-destructive' : 'bg-muted-foreground/20 text-muted-foreground'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{item.className}</p>
                          <p className="text-xs text-muted-foreground">{item.total} alunos</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-destructive">{item.absentCount}</p>
                        <p className="text-xs text-muted-foreground">ausentes</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <UserCheck className="w-10 h-10 text-success mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Todas as turmas com boa frequência</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="animate-fade-in" style={{ animationDelay: '350ms' }}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Ações Rápidas
              </CardTitle>
              <CardDescription>Tarefas comuns</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <a
                href="/scan"
                className="flex items-center gap-3 p-4 bg-primary/5 hover:bg-primary/10 rounded-xl transition-colors group"
              >
                <div className="p-3 rounded-lg gradient-primary text-primary-foreground">
                  <QrCodeIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium group-hover:text-primary transition-colors">Escanear QR Code</p>
                  <p className="text-sm text-muted-foreground">Registrar frequência do aluno</p>
                </div>
              </a>
              <a
                href="/students"
                className="flex items-center gap-3 p-4 bg-muted/50 hover:bg-muted rounded-xl transition-colors group"
              >
                <div className="p-3 rounded-lg bg-secondary">
                  <Users className="w-5 h-5 text-secondary-foreground" />
                </div>
                <div>
                  <p className="font-medium group-hover:text-primary transition-colors">Gerenciar Alunos</p>
                  <p className="text-sm text-muted-foreground">Adicionar ou editar registros</p>
                </div>
              </a>
              <a
                href="/attendance"
                className="flex items-center gap-3 p-4 bg-muted/50 hover:bg-muted rounded-xl transition-colors group"
              >
                <div className="p-3 rounded-lg bg-secondary">
                  <Calendar className="w-5 h-5 text-secondary-foreground" />
                </div>
                <div>
                  <p className="font-medium group-hover:text-primary transition-colors">Ver Frequência</p>
                  <p className="text-sm text-muted-foreground">Calendário e relatórios</p>
                </div>
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

const QrCodeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="3" height="3" />
    <rect x="18" y="14" width="3" height="3" />
    <rect x="14" y="18" width="3" height="3" />
    <rect x="18" y="18" width="3" height="3" />
  </svg>
);

export default Dashboard;
