import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, QrCode, Check, X, AlertCircle, Loader2 } from "lucide-react";

interface ScanResult {
  type: 'success' | 'warning' | 'error';
  message: string;
  studentName?: string;
  studentClass?: string;
}

const MobileScanQR = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [todayCount, setTodayCount] = useState(0);

  // Fetch today's attendance count
  useEffect(() => {
    const fetchTodayCount = async () => {
      const today = new Date().toISOString().split('T')[0];
      const { count } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('date', today);
      
      setTodayCount(count || 0);
    };
    
    fetchTodayCount();
  }, [scanResult]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const processQRCode = useCallback(async (qrCode: string) => {
    if (isProcessing || !qrCode.trim()) return;

    setIsProcessing(true);
    setScanResult(null);

    try {
      // Find student by QR code
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id, full_name, class, student_id')
        .eq('qr_code', qrCode.trim())
        .single();

      if (studentError || !student) {
        setScanResult({
          type: 'error',
          message: 'QR Code não encontrado',
        });
        return;
      }

      // Check if already checked in today
      const today = new Date().toISOString().split('T')[0];
      const { data: existingAttendance } = await supabase
        .from('attendance')
        .select('id')
        .eq('student_id', student.id)
        .eq('date', today)
        .single();

      if (existingAttendance) {
        setScanResult({
          type: 'warning',
          message: 'Aluno já registrado hoje',
          studentName: student.full_name,
          studentClass: student.class,
        });
        return;
      }

      // Record attendance
      const currentTime = new Date().toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      });

      const { error: insertError } = await supabase
        .from('attendance')
        .insert({
          student_id: student.id,
          date: today,
          time: currentTime,
          status: 'present',
          recorded_by: user?.id,
        });

      if (insertError) {
        throw insertError;
      }

      setScanResult({
        type: 'success',
        message: 'Presença registrada!',
        studentName: student.full_name,
        studentClass: student.class,
      });

      toast({
        title: "Presença registrada",
        description: `${student.full_name} - ${student.class}`,
      });

    } catch (error) {
      console.error('Error processing QR code:', error);
      setScanResult({
        type: 'error',
        message: 'Erro ao processar QR Code',
      });
    } finally {
      setIsProcessing(false);
      setInputValue("");
      inputRef.current?.focus();
    }
  }, [isProcessing, user?.id, toast]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      processQRCode(inputValue);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pt-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/mobile-home")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-foreground">Escanear QR Code</h1>
            <p className="text-xs text-muted-foreground">
              {todayCount} presenças hoje
            </p>
          </div>
        </div>

        {/* Scanner Area */}
        <Card className="mb-6 overflow-hidden">
          <CardContent className="p-0">
            <div className={`relative bg-gradient-to-br from-primary/10 to-primary/5 p-8 flex flex-col items-center justify-center min-h-[200px] ${isProcessing ? 'scan-pulse' : ''}`}>
              <div className="w-24 h-24 border-4 border-primary rounded-2xl flex items-center justify-center mb-4">
                {isProcessing ? (
                  <Loader2 className="h-10 w-10 text-primary animate-spin" />
                ) : (
                  <QrCode className="h-10 w-10 text-primary" />
                )}
              </div>
              <p className="text-sm text-muted-foreground text-center">
                {isProcessing ? 'Processando...' : 'Aproxime o leitor do QR Code'}
              </p>
              
              {/* Hidden input for USB scanner */}
              <Input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                className="absolute opacity-0 pointer-events-none"
                autoComplete="off"
                disabled={isProcessing}
              />
            </div>
          </CardContent>
        </Card>

        {/* Manual focus button */}
        <Button 
          variant="outline" 
          className="w-full mb-6"
          onClick={() => inputRef.current?.focus()}
        >
          Ativar leitor
        </Button>

        {/* Scan Result */}
        {scanResult && (
          <Card className={`animate-fade-in border-2 ${
            scanResult.type === 'success' ? 'border-success' : 
            scanResult.type === 'warning' ? 'border-warning' : 
            'border-destructive'
          }`}>
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-full ${
                  scanResult.type === 'success' ? 'bg-success' : 
                  scanResult.type === 'warning' ? 'bg-warning' : 
                  'bg-destructive'
                }`}>
                  {scanResult.type === 'success' ? (
                    <Check className="h-6 w-6 text-white" />
                  ) : scanResult.type === 'warning' ? (
                    <AlertCircle className="h-6 w-6 text-white" />
                  ) : (
                    <X className="h-6 w-6 text-white" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={`font-semibold ${
                    scanResult.type === 'success' ? 'text-success' : 
                    scanResult.type === 'warning' ? 'text-warning' : 
                    'text-destructive'
                  }`}>
                    {scanResult.message}
                  </p>
                  {scanResult.studentName && (
                    <div className="mt-2">
                      <p className="text-foreground font-medium">{scanResult.studentName}</p>
                      <p className="text-sm text-muted-foreground">{scanResult.studentClass}</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MobileScanQR;
