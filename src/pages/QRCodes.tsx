import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { QrCode, Camera, CheckCircle2, XCircle, Loader2, Search, Download, FileText, Users } from 'lucide-react';
import { format } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';

interface Student {
  id: string;
  full_name: string;
  student_id: string;
  class: string;
  shift: string;
  qr_code: string;
  status: string;
  photo_url: string | null;
}

interface ClassItem {
  id: string;
  name: string;
  shift: string;
}

const QRCodes = () => {
  const [scanResult, setScanResult] = useState<string>('');
  const [lastScanned, setLastScanned] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanMode, setScanMode] = useState<'usb' | 'camera'>('usb');
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [selectedClassForExport, setSelectedClassForExport] = useState('');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  useEffect(() => {
    fetchStudents();
    fetchClasses();
  }, []);

  useEffect(() => {
    if (scanMode === 'usb' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [scanMode]);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('id, full_name, student_id, class, shift, qr_code, status, photo_url')
        .eq('status', 'active')
        .order('full_name');

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast.error('Falha ao carregar alunos');
    }
  };

  const fetchClasses = async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, shift')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      console.error('Error fetching classes:', error);
    }
  };

  const processQRCode = useCallback(async (qrCode: string) => {
    if (isProcessing || !qrCode.trim()) return;
    
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

      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const currentTime = format(new Date(), 'HH:mm:ss');

      const { data: existing } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', student.id)
        .eq('date', todayStr)
        .maybeSingle();

      if (existing) {
        toast.info(`${student.full_name} já registrou presença hoje`);
        setLastScanned({ student, alreadyCheckedIn: true, time: existing.time });
        return;
      }

      const { error: attendanceError } = await supabase
        .from('attendance')
        .insert({
          student_id: student.id,
          date: todayStr,
          time: currentTime,
          status: 'present',
          recorded_by: user?.id,
        });

      if (attendanceError) throw attendanceError;

      toast.success(`${student.full_name} registrado!`);
      setLastScanned({ student, success: true, time: currentTime });

    } catch (error) {
      console.error('Error processing QR:', error);
      toast.error('Falha ao processar presença');
      setLastScanned({ error: true, message: 'Erro de processamento' });
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

  const downloadQRCode = (student: Student) => {
    const svg = document.getElementById(`qr-${student.id}`);
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = 400;
      canvas.height = 500;
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.drawImage(img, 50, 30, 300, 300);
        
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(student.full_name, 200, 370);
        
        ctx.font = '14px Arial';
        ctx.fillStyle = '#555555';
        ctx.fillText(`ID: ${student.student_id}`, 200, 400);
        ctx.fillText(`Turma: ${student.class}`, 200, 425);
      }
      
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `qr-${student.student_id}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const generateClassQRCodesPDF = async () => {
    if (!selectedClassForExport) {
      toast.error('Selecione uma turma');
      return;
    }

    setIsGeneratingPDF(true);
    const classStudents = students.filter(s => s.class === selectedClassForExport);

    if (classStudents.length === 0) {
      toast.error('Nenhum aluno encontrado nesta turma');
      setIsGeneratingPDF(false);
      return;
    }

    try {
      // Generate QR codes as data URLs
      const qrCodes: { student: Student; dataUrl: string }[] = [];
      
      for (const student of classStudents) {
        const svg = document.getElementById(`export-qr-${student.id}`);
        if (svg) {
          const svgData = new XMLSerializer().serializeToString(svg);
          const dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
          qrCodes.push({ student, dataUrl });
        }
      }

      const content = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>QR Codes - Turma ${selectedClassForExport}</title>
          <style>
            @page { size: A4; margin: 15mm; }
            * { box-sizing: border-box; }
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              padding: 20px;
            }
            .header { 
              text-align: center; 
              margin-bottom: 20px;
              border-bottom: 2px solid #333;
              padding-bottom: 15px;
            }
            .header h1 { margin: 0 0 5px 0; font-size: 24px; }
            .header p { margin: 0; color: #666; }
            .grid { 
              display: grid; 
              grid-template-columns: repeat(2, 1fr); 
              gap: 20px;
            }
            .qr-card { 
              border: 2px solid #ddd; 
              border-radius: 8px;
              padding: 15px; 
              text-align: center;
              page-break-inside: avoid;
              background: #fff;
            }
            .qr-card img { 
              width: 150px; 
              height: 150px;
              display: block;
              margin: 0 auto;
            }
            .student-name { 
              font-weight: bold; 
              margin-top: 10px;
              font-size: 14px;
            }
            .student-info { 
              font-size: 11px; 
              color: #666;
              margin-top: 3px;
            }
            @media print {
              body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>QR Codes - Turma ${selectedClassForExport}</h1>
            <p>Total: ${classStudents.length} alunos | Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
          </div>
          <div class="grid">
            ${qrCodes.map(({ student, dataUrl }) => `
              <div class="qr-card">
                <img src="${dataUrl}" alt="QR Code ${student.full_name}" />
                <div class="student-name">${student.full_name}</div>
                <div class="student-info">ID: ${student.student_id}</div>
              </div>
            `).join('')}
          </div>
        </body>
        </html>
      `;
      
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(content);
        win.document.close();
        setTimeout(() => {
          win.print();
        }, 500);
      }
      
      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Erro ao gerar PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.student_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = filterClass === 'all' || student.class === filterClass;
    return matchesSearch && matchesClass;
  });

  const uniqueClasses = [...new Set(students.map(s => s.class))].sort();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">QR Codes</h1>
          <p className="text-muted-foreground mt-1">
            {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: undefined })}
          </p>
        </div>

        <Tabs defaultValue="scan" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="scan" className="flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              Escanear
            </TabsTrigger>
            <TabsTrigger value="students" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Alunos
            </TabsTrigger>
            <TabsTrigger value="byClass" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Por Turma
            </TabsTrigger>
          </TabsList>

          {/* Aba Escanear */}
          <TabsContent value="scan" className="mt-6">
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Scan Mode Toggle */}
              <div className="flex justify-center gap-2">
                <Button
                  variant={scanMode === 'usb' ? 'default' : 'outline'}
                  onClick={() => setScanMode('usb')}
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  Scanner USB
                </Button>
                <Button
                  variant={scanMode === 'camera' ? 'default' : 'outline'}
                  onClick={() => setScanMode('camera')}
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
                          Escaneie o QR Code do aluno com o scanner Eyoyo
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
                        Clique aqui se o scanner não responder
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center space-y-4">
                      <div className="aspect-square max-w-sm mx-auto bg-muted rounded-xl flex items-center justify-center">
                        <div className="text-center">
                          <Camera className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">Escaneamento por câmera em breve</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Last Scan Result */}
              {lastScanned && (
                <Card className={`animate-in fade-in-0 ${
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
            </div>
          </TabsContent>

          {/* Aba Alunos */}
          <TabsContent value="students" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>QR Codes Individuais</CardTitle>
                <CardDescription>
                  Gere e baixe o QR Code de cada aluno
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome ou ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={filterClass} onValueChange={setFilterClass}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Todas as turmas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as turmas</SelectItem>
                      {uniqueClasses.map(className => (
                        <SelectItem key={className} value={className}>
                          {className}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Students List */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredStudents.map(student => (
                    <Card key={student.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex flex-col items-center text-center space-y-3">
                          <div className="bg-white p-2 rounded-lg">
                            <QRCodeSVG
                              id={`qr-${student.id}`}
                              value={student.qr_code}
                              size={120}
                              level="H"
                            />
                          </div>
                          <div>
                            <h4 className="font-medium text-sm">{student.full_name}</h4>
                            <p className="text-xs text-muted-foreground">
                              {student.class} • ID: {student.student_id}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadQRCode(student)}
                            className="w-full"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Baixar QR
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {filteredStudents.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum aluno encontrado
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Por Turma */}
          <TabsContent value="byClass" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Exportar QR Codes por Turma</CardTitle>
                <CardDescription>
                  Gere um PDF com todos os QR codes de uma turma
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="flex-1 space-y-2">
                    <label className="text-sm font-medium">Selecione a Turma</label>
                    <Select value={selectedClassForExport} onValueChange={setSelectedClassForExport}>
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha uma turma" />
                      </SelectTrigger>
                      <SelectContent>
                        {uniqueClasses.map(className => (
                          <SelectItem key={className} value={className}>
                            {className} ({students.filter(s => s.class === className).length} alunos)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={generateClassQRCodesPDF}
                    disabled={!selectedClassForExport || isGeneratingPDF}
                  >
                    {isGeneratingPDF ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4 mr-2" />
                        Gerar PDF
                      </>
                    )}
                  </Button>
                </div>

                {/* Preview */}
                {selectedClassForExport && (
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-4">
                      Preview - {selectedClassForExport} ({students.filter(s => s.class === selectedClassForExport).length} alunos)
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {students
                        .filter(s => s.class === selectedClassForExport)
                        .map(student => (
                          <div key={student.id} className="text-center">
                            <div className="bg-white p-1 rounded border inline-block">
                              <QRCodeSVG
                                id={`export-qr-${student.id}`}
                                value={student.qr_code}
                                size={60}
                                level="H"
                              />
                            </div>
                            <p className="text-xs mt-1 truncate" title={student.full_name}>
                              {student.full_name.split(' ')[0]}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default QRCodes;
