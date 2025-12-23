import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { QrCode, Camera, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const ScanQR = () => {
  const [scanResult, setScanResult] = useState<string>('');
  const [lastScanned, setLastScanned] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanMode, setScanMode] = useState<'usb' | 'camera'>('usb');
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  // Focus input for USB scanner
  useEffect(() => {
    if (scanMode === 'usb' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [scanMode]);

  const processQRCode = useCallback(async (qrCode: string) => {
    if (isProcessing || !qrCode.trim()) return;
    
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
        toast.error('Student not found');
        setLastScanned({ error: true, message: 'Invalid QR Code' });
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
        toast.info(`${student.full_name} already checked in today`);
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

      toast.success(`${student.full_name} checked in!`);
      setLastScanned({ student, success: true, time: currentTime });

    } catch (error) {
      console.error('Error processing QR:', error);
      toast.error('Failed to process attendance');
      setLastScanned({ error: true, message: 'Processing error' });
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

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Scan Attendance</h1>
          <p className="text-muted-foreground mt-1">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>

        {/* Scan Mode Toggle */}
        <div className="flex justify-center gap-2">
          <Button
            variant={scanMode === 'usb' ? 'default' : 'outline'}
            onClick={() => setScanMode('usb')}
          >
            <QrCode className="w-4 h-4 mr-2" />
            USB Scanner
          </Button>
          <Button
            variant={scanMode === 'camera' ? 'default' : 'outline'}
            onClick={() => setScanMode('camera')}
          >
            <Camera className="w-4 h-4 mr-2" />
            Camera
          </Button>
        </div>

        {/* Scanner Area */}
        <Card className="overflow-hidden">
          <CardContent className="p-8">
            {scanMode === 'usb' ? (
              <div className="text-center space-y-6">
                <div className={`w-32 h-32 mx-auto rounded-2xl flex items-center justify-center ${
                  isProcessing ? 'bg-primary/20 scan-pulse' : 'bg-primary/10'
                }`}>
                  {isProcessing ? (
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                  ) : (
                    <QrCode className="w-12 h-12 text-primary" />
                  )}
                </div>
                
                <div>
                  <h3 className="font-medium text-lg">USB Scanner Ready</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Scan a student QR code with the Eyoyo scanner
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
                >
                  Click here if scanner not responding
                </Button>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <div className="aspect-square max-w-sm mx-auto bg-muted rounded-xl flex items-center justify-center">
                  <div className="text-center">
                    <Camera className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Camera scanning coming soon</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Last Scan Result */}
        {lastScanned && (
          <Card className={`animate-success-pop ${
            lastScanned.error ? 'border-destructive' : 
            lastScanned.alreadyCheckedIn ? 'border-warning' : 'border-success border-2'
          }`}>
            <CardContent className="p-6">
              {lastScanned.student && lastScanned.success ? (
                // Success state - show prominent photo, name, and checkmark
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
                // Error or already checked in states
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
      </div>
    </DashboardLayout>
  );
};

export default ScanQR;
