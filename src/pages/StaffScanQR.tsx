import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { QrCode, Camera, CheckCircle2, XCircle, Loader2, LogOut, Users, UserCheck, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ThemeToggle } from '@/components/ThemeToggle';
import logoEscola from "@/assets/logo-escola.jpg";

interface DailyStats {
  totalPresent: number;
  myRegistrations: number;
  lastCheckInTime: string | null;
}

const StaffScanQR = () => {
  const [scanResult, setScanResult] = useState<string>('');
  const [lastScanned, setLastScanned] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanMode, setScanMode] = useState<'usb' | 'camera'>('usb');
  const [dailyStats, setDailyStats] = useState<DailyStats>({
    totalPresent: 0,
    myRegistrations: 0,
    lastCheckInTime: null
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const { user, signOut } = useAuth();

  const fetchDailyStats = useCallback(async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    
    try {
      // Total attendances today
      const { count: totalPresent } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('date', today)
        .eq('status', 'present');
      
      // My registrations
      const { count: myRegistrations } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('date', today)
        .eq('recorded_by', user?.id);
      
      // Last check-in
      const { data: lastRecord } = await supabase
        .from('attendance')
        .select('time')
        .eq('date', today)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      setDailyStats({
        totalPresent: totalPresent || 0,
        myRegistrations: myRegistrations || 0,
        lastCheckInTime: lastRecord?.time ? lastRecord.time.substring(0, 5) : null
      });
    } catch (error) {
      console.error('Error fetching daily stats:', error);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      fetchDailyStats();
    }
  }, [user?.id, fetchDailyStats]);

  // Realtime subscription for instant stats updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('attendance-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'attendance'
        },
        (payload) => {
          console.log('New attendance record detected:', payload);
          fetchDailyStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchDailyStats]);

  // Focus input for USB scanner
  useEffect(() => {
    if (scanMode === 'usb' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [scanMode]);

  const processQRCode = useCallback(async (qrCode: string) => {
    if (isProcessing || !qrCode.trim()) return;
    
    // Check if it's a weekend
    const today = new Date();
    const dayOfWeek = today.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      toast.error('A escola não funciona aos sábados e domingos');
      setLastScanned({ 
        error: true, 
        message: 'Não é possível registrar presença nos finais de semana' 
      });
      return;
    }
    
    setIsProcessing(true);
    setScanResult('');

    try {
      // Find student by QR code
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('qr_code', qrCode.trim())
        .maybeSingle();

      if (studentError) throw studentError;

      if (!student) {
        toast.error('Aluno não encontrado');
        setLastScanned({ error: true, message: 'QR Code inválido' });
        return;
      }

      const today = format(new Date(), 'yyyy-MM-dd');
      const currentTime = format(new Date(), 'HH:mm:ss');

      // Check if already registered today
      const { data: existing } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', student.id)
        .eq('date', today)
        .maybeSingle();

      if (existing) {
        toast.info(`${student.full_name} já registrado hoje`);
        setLastScanned({ student, alreadyCheckedIn: true, time: existing.time });
        return;
      }

      // Record attendance
      const { error: attendanceError } = await supabase
        .from('attendance')
        .insert({
          student_id: student.id,
          date: today,
          time: currentTime,
          status: 'present',
          recorded_by: user?.id,
        });

      if (attendanceError) throw attendanceError;

      toast.success(`${student.full_name} registrado!`);
      setLastScanned({ student, success: true, time: currentTime });
      
      // Update stats after successful scan
      await fetchDailyStats();

    } catch (error) {
      console.error('Error processing QR:', error);
      toast.error('Falha ao processar presença');
      setLastScanned({ error: true, message: 'Erro no processamento' });
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, user?.id]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setScanResult(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && scanResult) {
      processQRCode(scanResult);
      setScanResult('');
    }
  };

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Simple Header */}
      <header className="bg-card border-b border-border px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={logoEscola} 
              alt="Logo CEPANS" 
              className="w-10 h-10 rounded-lg object-cover"
            />
            <div>
              <h1 className="font-semibold text-sm">CEPANS</h1>
              <p className="text-xs text-muted-foreground">Leitor de Presença</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto p-4 space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Registro de Presença</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>

        {/* Daily Stats Cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 text-center">
              <Users className="w-5 h-5 text-primary mx-auto mb-1" />
              <p className="text-2xl font-bold text-primary">{dailyStats.totalPresent}</p>
              <p className="text-xs text-muted-foreground">Presenças Hoje</p>
            </CardContent>
          </Card>
          
          <Card className="bg-chart-2/10 border-chart-2/20">
            <CardContent className="p-4 text-center">
              <UserCheck className="w-5 h-5 text-chart-2 mx-auto mb-1" />
              <p className="text-2xl font-bold text-chart-2">{dailyStats.myRegistrations}</p>
              <p className="text-xs text-muted-foreground">Registros Meus</p>
            </CardContent>
          </Card>
          
          <Card className="bg-muted/50">
            <CardContent className="p-4 text-center">
              <Clock className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
              <p className="text-2xl font-bold">{dailyStats.lastCheckInTime || '--:--'}</p>
              <p className="text-xs text-muted-foreground">Último Check-in</p>
            </CardContent>
          </Card>
        </div>

        {/* Scan Mode Toggle */}
        <div className="flex justify-center gap-2">
          <Button
            variant={scanMode === 'usb' ? 'default' : 'outline'}
            onClick={() => setScanMode('usb')}
            size="sm"
          >
            <QrCode className="w-4 h-4 mr-2" />
            Scanner USB
          </Button>
          <Button
            variant={scanMode === 'camera' ? 'default' : 'outline'}
            onClick={() => setScanMode('camera')}
            size="sm"
          >
            <Camera className="w-4 h-4 mr-2" />
            Câmera
          </Button>
        </div>

        {/* Scanner Area */}
        <Card className="overflow-hidden">
          <CardContent className="p-8">
            {scanMode === 'usb' ? (
              <div className="text-center space-y-6">
                <div className={`w-32 h-32 mx-auto rounded-2xl flex items-center justify-center ${
                  isProcessing ? 'bg-primary/20 animate-pulse' : 'bg-primary/10'
                }`}>
                  {isProcessing ? (
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                  ) : (
                    <QrCode className="w-12 h-12 text-primary" />
                  )}
                </div>
                
                <div>
                  <h3 className="font-medium text-lg">Scanner USB Pronto</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Escaneie o QR code do aluno com o leitor
                  </p>
                </div>

                <input
                  ref={inputRef}
                  type="text"
                  value={scanResult}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  className="opacity-0 absolute -z-10"
                  autoFocus
                />

                <Button 
                  variant="outline" 
                  onClick={() => inputRef.current?.focus()}
                  size="sm"
                >
                  Clique aqui se o scanner não responder
                </Button>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <div className="aspect-square max-w-sm mx-auto bg-muted rounded-xl flex items-center justify-center">
                  <div className="text-center">
                    <Camera className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Scanner por câmera em breve</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Last Scan Result */}
        {lastScanned && (
          <Card className={`animate-in fade-in slide-in-from-bottom-4 ${
            lastScanned.error ? 'border-destructive' : 
            lastScanned.alreadyCheckedIn ? 'border-warning' : 'border-success border-2'
          }`}>
            <CardContent className="p-6">
              {lastScanned.student && lastScanned.success ? (
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="relative">
                    {lastScanned.student.photo_url ? (
                      <img 
                        src={lastScanned.student.photo_url} 
                        alt={lastScanned.student.full_name}
                        className="w-32 h-32 rounded-full object-cover border-4 border-success shadow-lg"
                      />
                    ) : (
                      <div className="w-32 h-32 rounded-full bg-success/20 border-4 border-success flex items-center justify-center shadow-lg">
                        <span className="text-4xl font-bold text-success">
                          {lastScanned.student.full_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="absolute -bottom-2 -right-2 bg-success rounded-full p-2 shadow-lg">
                      <CheckCircle2 className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-2xl text-success">{lastScanned.student.full_name}</h3>
                    <p className="text-muted-foreground mt-1">
                      {lastScanned.student.class} • Entrada às {lastScanned.time}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  {lastScanned.student && lastScanned.alreadyCheckedIn ? (
                    <>
                      <div className="relative">
                        {lastScanned.student.photo_url ? (
                          <img 
                            src={lastScanned.student.photo_url} 
                            alt={lastScanned.student.full_name}
                            className="w-20 h-20 rounded-full object-cover border-2 border-warning"
                          />
                        ) : (
                          <div className="w-20 h-20 rounded-full bg-warning/20 border-2 border-warning flex items-center justify-center">
                            <span className="text-2xl font-bold text-warning">
                              {lastScanned.student.full_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{lastScanned.student.full_name}</h3>
                        <p className="text-sm text-warning font-medium">
                          Já registrado hoje às {lastScanned.time}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {lastScanned.student.class}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="p-3 rounded-full bg-destructive/10">
                        <XCircle className="w-8 h-8 text-destructive" />
                      </div>
                      <div>
                        <h3 className="font-medium text-destructive">{lastScanned.message}</h3>
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default StaffScanQR;
