import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { FileText, Search, CalendarIcon, Printer, ArrowRight, ArrowLeft, Eye } from 'lucide-react';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { z } from 'zod';

interface Student {
  id: string;
  full_name: string;
  student_id: string;
  class: string;
  shift: string;
  birth_date: string | null;
  guardian_name: string;
  guardian_phone: string;
}

const declarationSchema = z.object({
  guardianName: z.string().min(3, 'Nome do responsável muito curto'),
  guardianRG: z.string().min(5, 'RG inválido'),
  guardianCPF: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{11}$/, 'CPF inválido'),
  guardianAddress: z.string().min(10, 'Endereço muito curto'),
  studentId: z.string().min(1, 'Selecione um aluno'),
  schoolYear: z.string().min(4, 'Ano letivo inválido'),
  location: z.string().min(3, 'Local inválido'),
  signerName: z.string().min(3, 'Nome do assinante muito curto'),
  signerPhone: z.string().min(10, 'Telefone inválido'),
});

const Declarations = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [step, setStep] = useState<'select' | 'form' | 'preview'>('select');
  const [schoolSettings, setSchoolSettings] = useState<{ name: string; address: string }>({ name: '', address: '' });

  const [formData, setFormData] = useState({
    studentId: '',
    studentName: '',
    studentBirthDate: '',
    studentClass: '',
    guardianName: '',
    guardianRG: '',
    guardianCPF: '',
    guardianAddress: '',
    guardianPhone: '',
    schoolName: '',
    schoolAddress: '',
    schoolYear: new Date().getFullYear().toString(),
    location: '',
    declarationDate: new Date(),
    signerName: '',
    signerPhone: '',
  });

  useEffect(() => {
    fetchStudents();
    fetchSchoolSettings();
  }, []);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('id, full_name, student_id, class, shift, birth_date, guardian_name, guardian_phone')
        .eq('status', 'active')
        .order('full_name');

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast.error('Falha ao carregar alunos');
    }
  };

  const fetchSchoolSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['school_name', 'school_address']);

      if (error) throw error;
      
      const settings = (data || []).reduce((acc, item) => {
        if (item.key === 'school_name') {
          acc.name = typeof item.value === 'string' ? item.value : String(item.value || '');
        } else if (item.key === 'school_address') {
          acc.address = typeof item.value === 'string' ? item.value : String(item.value || '');
        }
        return acc;
      }, { name: '', address: '' });
      
      setSchoolSettings(settings);
      setFormData(prev => ({
        ...prev,
        schoolName: settings.name,
        schoolAddress: settings.address,
      }));
    } catch (error) {
      console.error('Error fetching school settings:', error);
    }
  };

  const handleStudentSelect = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const birthDateFormatted = student.birth_date 
      ? format(parse(student.birth_date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy')
      : '';

    setFormData(prev => ({
      ...prev,
      studentId: student.id,
      studentName: student.full_name,
      studentBirthDate: birthDateFormatted,
      studentClass: student.class,
      guardianName: student.guardian_name,
      guardianPhone: student.guardian_phone,
      schoolName: schoolSettings.name,
      schoolAddress: schoolSettings.address,
    }));
    setStep('form');
  };

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  };

  const handleFormChange = (field: string, value: string | Date) => {
    if (field === 'guardianCPF') {
      value = formatCPF(value as string);
    } else if (field === 'signerPhone') {
      value = formatPhone(value as string);
    }
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateAndPreview = () => {
    try {
      declarationSchema.parse({
        guardianName: formData.guardianName,
        guardianRG: formData.guardianRG,
        guardianCPF: formData.guardianCPF,
        guardianAddress: formData.guardianAddress,
        studentId: formData.studentId,
        schoolYear: formData.schoolYear,
        location: formData.location,
        signerName: formData.signerName,
        signerPhone: formData.signerPhone,
      });
      setStep('preview');
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      }
    }
  };

  const generatePDF = () => {
    const dateFormatted = format(formData.declarationDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR });

    const content = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Declaração Escolar - ${formData.studentName}</title>
        <style>
          @page { 
            size: A4; 
            margin: 25mm 20mm; 
          }
          * { 
            box-sizing: border-box; 
            margin: 0; 
            padding: 0; 
          }
          body { 
            font-family: 'Times New Roman', Times, serif;
            font-size: 14px;
            line-height: 1.8;
            color: #000;
            padding: 0;
          }
          .container {
            max-width: 100%;
          }
          h1 { 
            text-align: center; 
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 40px;
            text-decoration: underline;
          }
          .content { 
            text-align: justify; 
            margin: 25px 0;
            text-indent: 50px;
          }
          .content strong {
            text-transform: uppercase;
          }
          .location-date {
            margin-top: 50px;
            text-align: right;
          }
          .signature { 
            margin-top: 80px;
            text-align: center;
          }
          .signature-line {
            border-top: 1px solid #000;
            width: 350px;
            margin: 0 auto 10px;
          }
          .signature p {
            margin: 5px 0;
          }
          .footer-note {
            margin-top: 60px;
            font-size: 11px;
            text-align: center;
            color: #666;
          }
          @media print {
            body { 
              print-color-adjust: exact; 
              -webkit-print-color-adjust: exact; 
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>DECLARAÇÃO ESCOLAR</h1>
          
          <p class="content">
            Eu, <strong>${formData.guardianName}</strong>, portador(a) do RG nº 
            <strong>${formData.guardianRG}</strong> e CPF nº <strong>${formData.guardianCPF}</strong>, 
            residente à <strong>${formData.guardianAddress}</strong>, declaro que sou 
            responsável pela educação do(a) aluno(a) <strong>${formData.studentName}</strong>, 
            nascido(a) em <strong>${formData.studentBirthDate}</strong>, matriculado(a) na 
            <strong>${formData.schoolName}</strong> situada à <strong>${formData.schoolAddress}</strong>.
          </p>
          
          <p class="content">
            O(A) aluno(a) encontra-se regularmente matriculado(a) no 
            <strong>${formData.studentClass}</strong> e frequenta as aulas conforme o 
            calendário escolar vigente.
          </p>
          
          <p class="content">
            Esta declaração é emitida para fins de cadastro e/ou atualização no 
            Programa Bolsa Família do Governo Federal, conforme solicitado.
          </p>
          
          <p class="content">
            Atesto que, conforme os dados disponíveis, <strong>${formData.studentName}</strong> 
            possui frequência escolar compatível com as exigências do referido programa.
          </p>
          
          <p class="content">
            Esta declaração é válida para o ano letivo de <strong>${formData.schoolYear}</strong> 
            e pode ser utilizada para os fins a que se destina.
          </p>
          
          <p class="content">
            Por ser verdade, firmo a presente declaração.
          </p>
          
          <p class="location-date">
            <strong>${formData.location}</strong>, ${dateFormatted}
          </p>
          
          <div class="signature">
            <div class="signature-line"></div>
            <p><strong>${formData.signerName}</strong></p>
            <p>Responsável pela Declaração</p>
            <p>Telefone: ${formData.signerPhone}</p>
          </div>

          <p class="footer-note">
            Documento gerado pelo Sistema EDUNEXUS em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}
          </p>
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
    
    toast.success('Declaração gerada com sucesso!');
  };

  const resetForm = () => {
    setFormData({
      studentId: '',
      studentName: '',
      studentBirthDate: '',
      studentClass: '',
      guardianName: '',
      guardianRG: '',
      guardianCPF: '',
      guardianAddress: '',
      guardianPhone: '',
      schoolName: schoolSettings.name,
      schoolAddress: schoolSettings.address,
      schoolYear: new Date().getFullYear().toString(),
      location: '',
      declarationDate: new Date(),
      signerName: '',
      signerPhone: '',
    });
    setStep('select');
  };

  const filteredStudents = students.filter(student =>
    student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.student_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold flex items-center justify-center gap-2">
            <FileText className="h-6 w-6" />
            Declarações
          </h1>
          <p className="text-muted-foreground mt-1">
            Gere declarações escolares para o Bolsa Família
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4 py-4">
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors",
            step === 'select' ? 'bg-primary text-primary-foreground' : 'bg-muted'
          )}>
            <span className="w-6 h-6 rounded-full bg-background text-foreground flex items-center justify-center text-xs">1</span>
            Aluno
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors",
            step === 'form' ? 'bg-primary text-primary-foreground' : 'bg-muted'
          )}>
            <span className="w-6 h-6 rounded-full bg-background text-foreground flex items-center justify-center text-xs">2</span>
            Dados
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors",
            step === 'preview' ? 'bg-primary text-primary-foreground' : 'bg-muted'
          )}>
            <span className="w-6 h-6 rounded-full bg-background text-foreground flex items-center justify-center text-xs">3</span>
            Gerar
          </div>
        </div>

        {/* Step 1: Select Student */}
        {step === 'select' && (
          <Card>
            <CardHeader>
              <CardTitle>Selecione o Aluno</CardTitle>
              <CardDescription>
                Escolha o aluno para gerar a declaração
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="grid gap-2 max-h-96 overflow-y-auto">
                {filteredStudents.map(student => (
                  <div
                    key={student.id}
                    onClick={() => handleStudentSelect(student.id)}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <div>
                      <h4 className="font-medium">{student.full_name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {student.class} • ID: {student.student_id}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>

              {filteredStudents.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum aluno encontrado
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Form */}
        {step === 'form' && (
          <Card>
            <CardHeader>
              <CardTitle>Dados da Declaração</CardTitle>
              <CardDescription>
                Preencha os dados complementares
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Student Info (Read-only) */}
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground">Dados do Aluno</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Nome</Label>
                    <p className="font-medium">{formData.studentName}</p>
                  </div>
                  <div>
                    <Label className="text-xs">Turma</Label>
                    <p className="font-medium">{formData.studentClass}</p>
                  </div>
                  <div>
                    <Label className="text-xs">Data de Nascimento</Label>
                    <p className="font-medium">{formData.studentBirthDate || 'Não informado'}</p>
                  </div>
                </div>
              </div>

              {/* Guardian Info */}
              <div className="space-y-4">
                <h4 className="font-medium">Dados do Responsável</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="guardianName">Nome Completo *</Label>
                    <Input
                      id="guardianName"
                      value={formData.guardianName}
                      onChange={(e) => handleFormChange('guardianName', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guardianRG">RG *</Label>
                    <Input
                      id="guardianRG"
                      value={formData.guardianRG}
                      onChange={(e) => handleFormChange('guardianRG', e.target.value)}
                      placeholder="Ex: 1234567-8"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guardianCPF">CPF *</Label>
                    <Input
                      id="guardianCPF"
                      value={formData.guardianCPF}
                      onChange={(e) => handleFormChange('guardianCPF', e.target.value)}
                      placeholder="000.000.000-00"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="guardianAddress">Endereço Completo *</Label>
                    <Input
                      id="guardianAddress"
                      value={formData.guardianAddress}
                      onChange={(e) => handleFormChange('guardianAddress', e.target.value)}
                      placeholder="Rua, número, bairro, cidade - UF"
                    />
                  </div>
                </div>
              </div>

              {/* School Info */}
              <div className="space-y-4">
                <h4 className="font-medium">Dados da Escola</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="schoolName">Nome da Escola</Label>
                    <Input
                      id="schoolName"
                      value={formData.schoolName}
                      onChange={(e) => handleFormChange('schoolName', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="schoolAddress">Endereço da Escola</Label>
                    <Input
                      id="schoolAddress"
                      value={formData.schoolAddress}
                      onChange={(e) => handleFormChange('schoolAddress', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Declaration Info */}
              <div className="space-y-4">
                <h4 className="font-medium">Dados da Declaração</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="schoolYear">Ano Letivo *</Label>
                    <Input
                      id="schoolYear"
                      value={formData.schoolYear}
                      onChange={(e) => handleFormChange('schoolYear', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data da Declaração *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.declarationDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.declarationDate ? (
                            format(formData.declarationDate, "dd/MM/yyyy")
                          ) : (
                            "Selecione uma data"
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={formData.declarationDate}
                          onSelect={(date) => date && handleFormChange('declarationDate', date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Local *</Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) => handleFormChange('location', e.target.value)}
                      placeholder="Cidade - UF"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signerName">Nome do Assinante *</Label>
                    <Input
                      id="signerName"
                      value={formData.signerName}
                      onChange={(e) => handleFormChange('signerName', e.target.value)}
                      placeholder="Nome de quem assina"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signerPhone">Telefone para Contato *</Label>
                    <Input
                      id="signerPhone"
                      value={formData.signerPhone}
                      onChange={(e) => handleFormChange('signerPhone', e.target.value)}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={resetForm}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
                <Button onClick={validateAndPreview}>
                  <Eye className="h-4 w-4 mr-2" />
                  Visualizar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Preview */}
        {step === 'preview' && (
          <Card>
            <CardHeader>
              <CardTitle>Conferência dos Dados</CardTitle>
              <CardDescription>
                Verifique os dados antes de gerar a declaração
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="border rounded-lg p-6 space-y-4 bg-white text-black">
                <h2 className="text-xl font-bold text-center underline">DECLARAÇÃO ESCOLAR</h2>
                
                <p className="text-justify leading-relaxed" style={{ textIndent: '2em' }}>
                  Eu, <strong className="uppercase">{formData.guardianName}</strong>, portador(a) do RG nº{' '}
                  <strong>{formData.guardianRG}</strong> e CPF nº <strong>{formData.guardianCPF}</strong>,{' '}
                  residente à <strong>{formData.guardianAddress}</strong>, declaro que sou responsável
                  pela educação do(a) aluno(a) <strong className="uppercase">{formData.studentName}</strong>,{' '}
                  nascido(a) em <strong>{formData.studentBirthDate}</strong>, matriculado(a) na{' '}
                  <strong>{formData.schoolName}</strong> situada à <strong>{formData.schoolAddress}</strong>.
                </p>

                <p className="text-justify leading-relaxed" style={{ textIndent: '2em' }}>
                  O(A) aluno(a) encontra-se regularmente matriculado(a) no <strong>{formData.studentClass}</strong> e
                  frequenta as aulas conforme o calendário escolar vigente.
                </p>

                <p className="text-justify leading-relaxed" style={{ textIndent: '2em' }}>
                  Esta declaração é emitida para fins de cadastro e/ou atualização no Programa Bolsa Família
                  do Governo Federal, conforme solicitado.
                </p>

                <p className="text-right mt-8">
                  <strong>{formData.location}</strong>, {format(formData.declarationDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>

                <div className="text-center mt-12">
                  <div className="border-t border-black w-64 mx-auto pt-2">
                    <p className="font-bold">{formData.signerName}</p>
                    <p className="text-sm">Telefone: {formData.signerPhone}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep('form')}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Editar
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={resetForm}>
                    Nova Declaração
                  </Button>
                  <Button onClick={generatePDF}>
                    <Printer className="h-4 w-4 mr-2" />
                    Gerar PDF
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Declarations;
