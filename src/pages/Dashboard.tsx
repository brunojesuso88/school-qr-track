import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCheck, UserX, Clock, TrendingUp, Calendar } from 'lucide-react';
import { format } from 'date-fns';
interface Stats {
  totalStudents: number;
  presentToday: number;
  absentToday: number;
  attendanceRate: number;
}
const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalStudents: 0,
    presentToday: 0,
    absentToday: 0,
    attendanceRate: 0
  });
  const [recentAttendance, setRecentAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetchDashboardData();
  }, []);
  const fetchDashboardData = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      // Fetch total students
      const {
        count: totalStudents
      } = await supabase.from('students').select('*', {
        count: 'exact',
        head: true
      }).eq('status', 'active');

      // Fetch today's attendance
      const {
        data: todayAttendance
      } = await supabase.from('attendance').select('*, students(full_name, class)').eq('date', today).order('created_at', {
        ascending: false
      });
      const presentToday = todayAttendance?.filter(a => a.status === 'present').length || 0;
      const absentToday = (totalStudents || 0) - presentToday;
      const attendanceRate = totalStudents ? Math.round(presentToday / totalStudents * 100) : 0;
      setStats({
        totalStudents: totalStudents || 0,
        presentToday,
        absentToday,
        attendanceRate
      });
      setRecentAttendance(todayAttendance?.slice(0, 5) || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };
  const statCards = [{
    title: 'Total Students',
    value: stats.totalStudents,
    icon: Users,
    description: 'Active students',
    color: 'text-primary',
    bgColor: 'bg-primary/10'
  }, {
    title: 'Present Today',
    value: stats.presentToday,
    icon: UserCheck,
    description: 'Checked in',
    color: 'text-success',
    bgColor: 'bg-success/10'
  }, {
    title: 'Absent Today',
    value: stats.absentToday,
    icon: UserX,
    description: 'Not checked in',
    color: 'text-destructive',
    bgColor: 'bg-destructive/10'
  }, {
    title: 'Attendance Rate',
    value: `${stats.attendanceRate}%`,
    icon: TrendingUp,
    description: 'Today',
    color: 'text-primary',
    bgColor: 'bg-accent'
  }];
  return <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">PAINEL</h1>
          <p className="text-muted-foreground mt-1">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => <Card key={stat.title} className="card-hover animate-fade-in" style={{
          animationDelay: `${index * 50}ms`
        }}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-3xl font-semibold mt-1">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                  </div>
                  <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>)}
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="animate-fade-in" style={{
          animationDelay: '200ms'
        }}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Recent Check-ins
              </CardTitle>
              <CardDescription>Latest attendance records today</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? <div className="space-y-3">
                  {[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}
                </div> : recentAttendance.length > 0 ? <div className="space-y-3">
                  {recentAttendance.map(record => <div key={record.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">
                            {record.students?.full_name?.[0] || '?'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{record.students?.full_name}</p>
                          <p className="text-xs text-muted-foreground">{record.students?.class}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs px-2 py-1 rounded-full ${record.status === 'present' ? 'status-present' : 'status-absent'}`}>
                          {record.status}
                        </span>
                        <p className="text-xs text-muted-foreground mt-1">{record.time}</p>
                      </div>
                    </div>)}
                </div> : <div className="text-center py-8">
                  <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No attendance records today</p>
                </div>}
            </CardContent>
          </Card>

          <Card className="animate-fade-in" style={{
          animationDelay: '250ms'
        }}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Quick Actions
              </CardTitle>
              <CardDescription>Common tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <a href="/scan" className="flex items-center gap-3 p-4 bg-primary/5 hover:bg-primary/10 rounded-xl transition-colors group">
                <div className="p-3 rounded-lg gradient-primary text-primary-foreground">
                  <QrCodeIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium group-hover:text-primary transition-colors">Scan QR Code</p>
                  <p className="text-sm text-muted-foreground">Record student attendance</p>
                </div>
              </a>
              <a href="/students" className="flex items-center gap-3 p-4 bg-muted/50 hover:bg-muted rounded-xl transition-colors group">
                <div className="p-3 rounded-lg bg-secondary">
                  <Users className="w-5 h-5 text-secondary-foreground" />
                </div>
                <div>
                  <p className="font-medium group-hover:text-primary transition-colors">Manage Students</p>
                  <p className="text-sm text-muted-foreground">Add or edit student records</p>
                </div>
              </a>
              <a href="/attendance" className="flex items-center gap-3 p-4 bg-muted/50 hover:bg-muted rounded-xl transition-colors group">
                <div className="p-3 rounded-lg bg-secondary">
                  <Calendar className="w-5 h-5 text-secondary-foreground" />
                </div>
                <div>
                  <p className="font-medium group-hover:text-primary transition-colors">View Attendance</p>
                  <p className="text-sm text-muted-foreground">Calendar and reports</p>
                </div>
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>;
};
const QrCodeIcon = ({
  className
}: {
  className?: string;
}) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="3" height="3" />
    <rect x="18" y="14" width="3" height="3" />
    <rect x="14" y="18" width="3" height="3" />
    <rect x="18" y="18" width="3" height="3" />
  </svg>;
export default Dashboard;