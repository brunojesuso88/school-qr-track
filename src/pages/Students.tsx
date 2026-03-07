import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { Plus, Search, QrCode, Edit2, Trash2, Download, User, CalendarIcon, FileText, Upload, Camera } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { StudentReportModal } from '@/components/StudentReportModal';
import { studentSchema, occurrenceSchema, formatPhone } from '@/lib/validations';
import { useAuth } from '@/contexts/AuthContext';
import { StudentPhoto } from '@/components/StudentPhoto';
import { useSignedPhotoUrl, clearPhotoUrlCache } from '@/hooks/useSignedPhotoUrl';

interface Student {
  id: string;
  full_name: string;
  student_id: string;
  class: string;
  shift: string;
  guardian_name: string;
  guardian_phone: string;
  photo_url: string | null;
  qr_code: string;
  status: string;
  created_at: string;
  birth_date: string | null;
  has_medical_report: boolean;
  medical_report_details: string | null;
}

interface ClassItem {
  id: string;
  name: string;
  shift: string;
}

interface Occurrence {
  id: string;
  student_id: string;
  type: string;
  description: string | null;
  date: string;
  end_date: string | null;
  teacher_name: string | null;
  created_at: string;
}

const OCCURRENCE_TYPES = [
  { value: 'early_leave', label: 'Saída Antecipada' },
  { value: 'illness', label: 'Doença' },
  { value: 'medical_certificate', label: 'Atestado Médico' },
  { value: 'late_arrival', label: 'Atraso' },
  { value: 'discipline', label: 'Ocorrência Disciplinar' },
  { value: 'other', label: 'Outros' },
];

const Students = () => {
  const [searchParams] = useSearchParams();
  const classFromUrl = searchParams.get('class');
  const { userRole } = useAuth();
  const canViewGuardianPhone = userRole === 'admin' || userRole === 'direction';
  
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState(classFromUrl || 'all');
  const [filterShift, setFilterShift] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [occurrencesStudent, setOccurrencesStudent] = useState<Student | null>(null);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [isOccurrenceDialogOpen, setIsOccurrenceDialogOpen] = useState(false);
  const [zoomPhotoStudent, setZoomPhotoStudent] = useState<Student | null>(null);
  const [reportStudent, setReportStudent] = useState<Student | null>(null);

  const currentYear = new Date().getFullYear();

  const [formData, setFormData] = useState({
    full_name: '',
    class: '',
    shift: 'morning',
    guardian_name: '',
    guardian_phone: '',
    status: 'active',
    has_medical_report: false,
    medical_report_details: '',
  });

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [occurrenceForm, setOccurrenceForm] = useState({
    type: '',
    description: '',
    date: new Date(),
    endDate: null as Date | null,
  });
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);

  useEffect(() => {
    fetchStudents();
    fetchClasses();
    fetchCurrentUserName();
  }, []);

  const fetchCurrentUserName = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        setCurrentUserName(data?.full_name || user.email || null);
      }
    } catch (error) {
      console.error('Error fetching current user name:', error);
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

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('full_name');

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast.error('Falha ao carregar alunos');
    } finally {
      setLoading(false);
    }
  };

  const fetchOccurrences = async (studentId: string) => {
    try {
      const { data, error } = await supabase
        .from('occurrences')
        .select('*')
        .eq('student_id', studentId)
        .order('date', { ascending: false });

      if (error) throw error;
      setOccurrences(data || []);
    } catch (error) {
      console.error('Error fetching occurrences:', error);
      toast.error('Falha ao carregar ocorrências');
    }
  };

  const generateStudentId = (fullName: string, className: string, shift: string): string => {
    if (!fullName || !className) return '';
    const initials = fullName.trim().split(' ').filter(p => p.length > 0).map(p => p[0].toUpperCase()).join('');
    const shiftCode = shift === 'morning' ? 'M' : shift === 'afternoon' ? 'T' : 'N';
    return `${initials}-${className}-${shiftCode}`;
  };

  const generateQRCode = () => {
    return `STU-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('A foto deve ter no máximo 5MB');
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadPhoto = async (studentId: string): Promise<string | null> => {
    if (!photoFile) return null;

    const fileExt = photoFile.name.split('.').pop();
    const fileName = `${studentId}-${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from('student-photos')
      .upload(fileName, photoFile, { upsert: true });

    if (error) {
      toast.error('Erro ao fazer upload da foto');
      throw error;
    }

    // Clear cache to force refresh of signed URLs
    clearPhotoUrlCache();

    // Return just the filename - we'll use signed URLs to access it
    return fileName;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form data with Zod
    const validationData = {
      full_name: formData.full_name.trim(),
      guardian_name: formData.guardian_name.trim(),
      guardian_phone: formatPhone(formData.guardian_phone),
      class: formData.class,
      shift: formData.shift as 'morning' | 'afternoon' | 'evening',
      status: formData.status,
      has_medical_report: formData.has_medical_report,
      medical_report_details: formData.has_medical_report ? formData.medical_report_details : null,
    };

    const validation = studentSchema.safeParse(validationData);
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast.error(firstError.message);
      return;
    }

    const studentId = generateStudentId(formData.full_name, formData.class, formData.shift);

    try {
      setIsUploadingPhoto(true);
      let photoUrl: string | null = null;

      if (editingStudent) {
        // Upload new photo if selected
        if (photoFile) {
          photoUrl = await uploadPhoto(editingStudent.id);
        }

        const updateData: any = {
          full_name: validationData.full_name,
          class: validationData.class,
          shift: validationData.shift,
          guardian_name: validationData.guardian_name,
          guardian_phone: validationData.guardian_phone,
          status: validationData.status,
          student_id: studentId,
          
          has_medical_report: validationData.has_medical_report,
          medical_report_details: validationData.medical_report_details,
        };

        if (photoUrl) {
          updateData.photo_url = photoUrl;
        }

        const { error } = await supabase
          .from('students')
          .update(updateData)
          .eq('id', editingStudent.id);

        if (error) throw error;
        toast.success('Aluno atualizado com sucesso');
      } else {
        const qrCode = generateQRCode();
        
        // First create the student to get the ID
        const { data: newStudent, error: insertError } = await supabase
          .from('students')
          .insert({
            full_name: validationData.full_name,
            class: validationData.class,
            shift: validationData.shift,
            guardian_name: validationData.guardian_name,
            guardian_phone: validationData.guardian_phone,
            status: validationData.status,
            student_id: studentId,
            
            qr_code: qrCode,
            has_medical_report: validationData.has_medical_report,
            medical_report_details: validationData.medical_report_details,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Upload photo if selected
        if (photoFile && newStudent) {
          photoUrl = await uploadPhoto(newStudent.id);
          if (photoUrl) {
            await supabase
              .from('students')
              .update({ photo_url: photoUrl })
              .eq('id', newStudent.id);
          }
        }

        toast.success('Aluno cadastrado com sucesso');
      }

      setIsDialogOpen(false);
      setEditingStudent(null);
      resetForm();
      fetchStudents();
    } catch (error: any) {
      console.error('Error saving student:', error);
      if (error.message?.includes('duplicate')) {
        toast.error('ID do aluno já existe');
      } else {
        toast.error('Falha ao salvar aluno');
      }
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleAddOccurrence = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!occurrencesStudent) return;

    // Validate occurrence form data
    const occurrenceData = {
      type: occurrenceForm.type,
      description: occurrenceForm.description || null,
      date: occurrenceForm.date,
    };

    const validation = occurrenceSchema.safeParse(occurrenceData);
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast.error(firstError.message);
      return;
    }

    // For medical certificate, validate end date
    if (occurrenceForm.type === 'medical_certificate' && occurrenceForm.endDate) {
      if (occurrenceForm.endDate < occurrenceForm.date) {
        toast.error('A data final deve ser posterior à data inicial');
        return;
      }
    }

    try {
      const insertData: any = {
        student_id: occurrencesStudent.id,
        type: occurrenceForm.type,
        description: occurrenceForm.description?.substring(0, 1000) || null,
        date: format(occurrenceForm.date, 'yyyy-MM-dd'),
        teacher_name: currentUserName,
      };

      // Add end_date for medical certificate
      if (occurrenceForm.type === 'medical_certificate' && occurrenceForm.endDate) {
        insertData.end_date = format(occurrenceForm.endDate, 'yyyy-MM-dd');
      }

      const { error } = await supabase
        .from('occurrences')
        .insert(insertData);

      if (error) throw error;
      toast.success('Ocorrência registrada com sucesso');
      setIsOccurrenceDialogOpen(false);
      setOccurrenceForm({ type: '', description: '', date: new Date(), endDate: null });
      fetchOccurrences(occurrencesStudent.id);
    } catch (error) {
      console.error('Error adding occurrence:', error);
      toast.error('Falha ao registrar ocorrência');
    }
  };

  const handleDeleteOccurrence = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta ocorrência?')) return;

    try {
      const { error } = await supabase.from('occurrences').delete().eq('id', id);
      if (error) throw error;
      toast.success('Ocorrência excluída');
      if (occurrencesStudent) {
        fetchOccurrences(occurrencesStudent.id);
      }
    } catch (error) {
      console.error('Error deleting occurrence:', error);
      toast.error('Falha ao excluir ocorrência');
    }
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      full_name: student.full_name,
      class: student.class,
      shift: student.shift,
      guardian_name: student.guardian_name,
      guardian_phone: student.guardian_phone,
      status: student.status || 'active',
      has_medical_report: student.has_medical_report || false,
      medical_report_details: student.medical_report_details || '',
    });
    setPhotoPreview(student.photo_url);
    setPhotoFile(null);
    
    setIsDialogOpen(true);
  };

  const handleViewOccurrences = (student: Student) => {
    setOccurrencesStudent(student);
    fetchOccurrences(student.id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este aluno?')) return;

    try {
      const { error } = await supabase.from('students').delete().eq('id', id);
      if (error) throw error;
      toast.success('Aluno excluído');
      fetchStudents();
    } catch (error) {
      console.error('Error deleting student:', error);
      toast.error('Falha ao excluir aluno');
    }
  };

  const resetForm = () => {
    setFormData({
      full_name: '',
      class: '',
      shift: 'morning',
      guardian_name: '',
      guardian_phone: '',
      status: 'active',
      has_medical_report: false,
      medical_report_details: '',
    });
    
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const downloadQRCode = (student: Student) => {
    const svg = document.getElementById(`qr-${student.id}`);
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = 300;
      canvas.height = 350;
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 50, 20, 200, 200);
        ctx.fillStyle = '#000000';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(student.full_name, 150, 250);
        ctx.fillText(student.student_id, 150, 275);
        ctx.fillText(student.class, 150, 300);
      }
      
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `qr-${student.student_id}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.student_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = filterClass === 'all' || student.class === filterClass;
    const matchesShift = filterShift === 'all' || student.shift === filterShift;
    return matchesSearch && matchesClass && matchesShift;
  });

  const uniqueClasses = [...new Set(students.map((s) => s.class))];

  const getOccurrenceTypeLabel = (type: string) => {
    return OCCURRENCE_TYPES.find(t => t.value === type)?.label || type;
  };

  // Auto-generate student ID when name, class or shift changes
  const generatedStudentId = generateStudentId(formData.full_name, formData.class, formData.shift);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Alunos</h1>
            <p className="text-muted-foreground">Gerenciar registros de alunos e QR codes</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingStudent(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Aluno
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingStudent ? 'Editar Aluno' : 'Cadastrar Novo Aluno'}</DialogTitle>
                <DialogDescription>
                  {editingStudent ? 'Atualizar informações do aluno' : 'Preencha os dados do aluno abaixo'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                {/* Photo Upload */}
                <div className="space-y-2">
                  <Label>Foto do Aluno</Label>
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-20 h-20 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-dashed border-border cursor-pointer hover:border-primary transition-colors"
                      onClick={() => photoInputRef.current?.click()}
                    >
                      {photoPreview ? (
                        <img
                          src={photoPreview}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Camera className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoSelect}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => photoInputRef.current?.click()}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {photoPreview ? 'Alterar Foto' : 'Upload Foto'}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-1">
                        JPG, PNG ou GIF. Máximo 5MB.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Status Toggle */}
                <div className="space-y-2">
                  <Label>Status do Aluno</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={formData.status === 'active' ? 'default' : 'outline'}
                      className={cn(
                        "flex-1",
                        formData.status === 'active' && "bg-green-600 hover:bg-green-700 text-white"
                      )}
                      onClick={() => setFormData({ ...formData, status: 'active' })}
                    >
                      Ativo
                    </Button>
                    <Button
                      type="button"
                      variant={formData.status === 'inactive' ? 'default' : 'outline'}
                      className={cn(
                        "flex-1",
                        formData.status === 'inactive' && "bg-red-600 hover:bg-red-700 text-white"
                      )}
                      onClick={() => setFormData({ ...formData, status: 'inactive' })}
                    >
                      Desistente
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="full_name">Nome Completo</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="student_id">ID do Aluno (gerado automaticamente)</Label>
                  <Input
                    id="student_id"
                    value={generatedStudentId}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Gerado a partir do nome, turma e turno
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="class">Turma</Label>
                    <Select
                      value={formData.class}
                      onValueChange={(value) => {
                        const selectedClass = classes.find(c => c.name === value);
                        setFormData({ 
                          ...formData, 
                          class: value,
                          shift: selectedClass?.shift || formData.shift
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a turma" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((c) => (
                          <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shift">Turno</Label>
                    <Select
                      value={formData.shift}
                      onValueChange={(value) => setFormData({ ...formData, shift: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="morning">Manhã</SelectItem>
                        <SelectItem value="afternoon">Tarde</SelectItem>
                        <SelectItem value="evening">Noite</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guardian_name">Nome do Responsável</Label>
                  <Input
                    id="guardian_name"
                    value={formData.guardian_name}
                    onChange={(e) => setFormData({ ...formData, guardian_name: e.target.value })}
                    required
                  />
                </div>
                {canViewGuardianPhone && (
                  <div className="space-y-2">
                    <Label htmlFor="guardian_phone">Telefone do Responsável (WhatsApp) - Opcional</Label>
                    <Input
                      id="guardian_phone"
                      type="tel"
                      value={formData.guardian_phone}
                      onChange={(e) => setFormData({ ...formData, guardian_phone: e.target.value })}
                      placeholder="+55 11 99999-9999"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Aluno com Laudo</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={!formData.has_medical_report ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        "flex-1",
                        !formData.has_medical_report && "bg-muted-foreground hover:bg-muted-foreground/90"
                      )}
                      onClick={() => setFormData({ ...formData, has_medical_report: false, medical_report_details: '' })}
                    >
                      Não
                    </Button>
                    <Button
                      type="button"
                      variant={formData.has_medical_report ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        "flex-1",
                        formData.has_medical_report && "bg-amber-500 hover:bg-amber-600"
                      )}
                      onClick={() => setFormData({ ...formData, has_medical_report: true })}
                    >
                      Sim
                    </Button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isUploadingPhoto}>
                  {isUploadingPhoto ? 'Salvando...' : editingStudent ? 'Atualizar Aluno' : 'Cadastrar Aluno'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterClass} onValueChange={setFilterClass}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Todas as Turmas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Turmas</SelectItem>
                  {uniqueClasses.filter((c) => c && c.trim() !== '').map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterShift} onValueChange={setFilterShift}>
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
            </div>
          </CardContent>
        </Card>

        {/* Students Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-32 bg-muted rounded-lg mb-4" />
                  <div className="h-4 bg-muted rounded mb-2" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredStudents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredStudents.map((student, index) => (
              <Card
                key={student.id}
                className={cn(
                  "card-hover animate-fade-in overflow-hidden cursor-pointer",
                  student.status === 'inactive' && "border-red-500/50",
                  student.has_medical_report && "border-2 border-amber-500 ring-2 ring-amber-500/20"
                )}
                style={{ animationDelay: `${index * 30}ms` }}
                onClick={() => setReportStudent(student)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div onClick={(e) => { e.stopPropagation(); student.photo_url && setZoomPhotoStudent(student); }}>
                        <StudentPhoto
                          photoUrl={student.photo_url}
                          fullName={student.full_name}
                          status={student.status}
                          size="md"
                          className={student.photo_url ? "cursor-zoom-in" : ""}
                        />
                      </div>
                      <div>
                        <h3 className="font-medium text-sm">
                          {student.full_name}
                        </h3>
                        <p className="text-xs text-muted-foreground">{student.student_id}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={cn(
                        "text-xs px-2 py-1 rounded-full font-medium",
                        student.status === 'active' 
                          ? 'bg-green-500/10 text-green-600' 
                          : 'bg-red-500/10 text-red-600'
                      )}>
                        {student.status === 'active' ? 'Ativo' : 'Desistente'}
                      </span>
                      {student.has_medical_report && (
                        <span className="text-xs px-2 py-1 rounded-full font-medium bg-amber-500/10 text-amber-600">
                          Laudo
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-xs space-y-1 text-muted-foreground mb-4">
                    <p><span className="font-medium text-foreground">Turma:</span> {student.class}</p>
                    <p><span className="font-medium text-foreground">Turno:</span> {student.shift === 'morning' ? 'Manhã' : student.shift === 'afternoon' ? 'Tarde' : 'Noite'}</p>
                    <p><span className="font-medium text-foreground">Responsável:</span> {student.guardian_name}</p>
                    {student.birth_date && (
                      <p><span className="font-medium text-foreground">Nascimento:</span> {format(parse(student.birth_date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy')}</p>
                    )}
                  </div>

                  <div className="flex gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setSelectedStudent(student)}
                    >
                      <QrCode className="w-3 h-3 mr-1" />
                      QR
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewOccurrences(student)}
                    >
                      <FileText className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(student)}>
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(student.id)}>
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <User className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-1">Nenhum aluno encontrado</h3>
              <p className="text-sm text-muted-foreground">
                {searchTerm || filterClass !== 'all'
                  ? 'Tente ajustar os filtros'
                  : 'Adicione seu primeiro aluno para começar'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* QR Code Modal */}
        <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
          <DialogContent className="max-w-sm text-center">
            <DialogHeader>
              <DialogTitle>QR Code do Aluno</DialogTitle>
              <DialogDescription>{selectedStudent?.full_name}</DialogDescription>
            </DialogHeader>
            {selectedStudent && (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="p-4 bg-card border rounded-xl">
                  <QRCodeSVG
                    id={`qr-${selectedStudent.id}`}
                    value={selectedStudent.qr_code}
                    size={180}
                    level="H"
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{selectedStudent.student_id}</p>
                  <p>{selectedStudent.class}</p>
                </div>
                <Button onClick={() => downloadQRCode(selectedStudent)}>
                  <Download className="w-4 h-4 mr-2" />
                  Baixar QR Code
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Occurrences Modal */}
        <Dialog open={!!occurrencesStudent} onOpenChange={() => setOccurrencesStudent(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Ocorrências - {occurrencesStudent?.full_name}</DialogTitle>
              <DialogDescription>
                Registro de ocorrências do aluno
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <Button onClick={() => setIsOccurrenceDialogOpen(true)} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Nova Ocorrência
              </Button>

              {occurrences.length > 0 ? (
                <div className="space-y-3">
                  {occurrences.map((occurrence) => (
                    <Card key={occurrence.id} className={cn(
                      occurrence.type === 'medical_certificate' && "border-purple-500/50 bg-purple-500/5"
                    )}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={cn(
                                "text-xs px-2 py-1 rounded-full font-medium",
                                occurrence.type === 'medical_certificate' 
                                  ? "bg-purple-500/20 text-purple-600" 
                                  : "bg-primary/10 text-primary"
                              )}>
                                {getOccurrenceTypeLabel(occurrence.type)}
                              </span>
                              <span className={cn(
                                "text-xs",
                                occurrence.type === 'medical_certificate' 
                                  ? "text-purple-600 font-medium" 
                                  : "text-muted-foreground"
                              )}>
                                {format(parse(occurrence.date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy')}
                                {occurrence.end_date && (
                                  <> a {format(parse(occurrence.end_date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy')}</>
                                )}
                              </span>
                            </div>
                            {occurrence.description && (
                              <p className="text-sm text-muted-foreground">{occurrence.description}</p>
                            )}
                            {occurrence.teacher_name && (
                              <p className="text-xs text-muted-foreground/70">
                                Por: {occurrence.teacher_name}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteOccurrence(occurrence.id)}
                          >
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma ocorrência registrada</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Occurrence Dialog */}
        <Dialog open={isOccurrenceDialogOpen} onOpenChange={setIsOccurrenceDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Nova Ocorrência</DialogTitle>
              <DialogDescription>
                Registrar nova ocorrência para {occurrencesStudent?.full_name}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddOccurrence} className="space-y-4 mt-4">
              {/* Teacher Name Display */}
              {currentUserName && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Registrado por: <strong>{currentUserName}</strong></span>
                </div>
              )}
              <div className="space-y-2">
                <Label>Tipo de Ocorrência</Label>
                <Select
                  value={occurrenceForm.type}
                  onValueChange={(value) => setOccurrenceForm({ ...occurrenceForm, type: value, endDate: value === 'medical_certificate' ? occurrenceForm.endDate : null })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {OCCURRENCE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{occurrenceForm.type === 'medical_certificate' ? 'Data Inicial' : 'Data'}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(occurrenceForm.date, "PPP", { locale: ptBR })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={occurrenceForm.date}
                      onSelect={(date) => date && setOccurrenceForm({ ...occurrenceForm, date })}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              {/* End Date for Medical Certificate */}
              {occurrenceForm.type === 'medical_certificate' && (
                <div className="space-y-2">
                  <Label>Data Final do Atestado</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {occurrenceForm.endDate 
                          ? format(occurrenceForm.endDate, "PPP", { locale: ptBR })
                          : <span className="text-muted-foreground">Selecione a data final</span>
                        }
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={occurrenceForm.endDate || undefined}
                        onSelect={(date) => date && setOccurrenceForm({ ...occurrenceForm, endDate: date })}
                        initialFocus
                        disabled={(date) => date < occurrenceForm.date}
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
              <div className="space-y-2">
                <Label>Descrição (opcional)</Label>
                <Textarea
                  value={occurrenceForm.description}
                  onChange={(e) => setOccurrenceForm({ ...occurrenceForm, description: e.target.value })}
                  placeholder="Detalhes da ocorrência..."
                  rows={3}
                />
              </div>
              <Button type="submit" className="w-full" disabled={!occurrenceForm.type || (occurrenceForm.type === 'medical_certificate' && !occurrenceForm.endDate)}>
                Registrar Ocorrência
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Photo Zoom Modal */}
        <Dialog open={!!zoomPhotoStudent} onOpenChange={() => setZoomPhotoStudent(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{zoomPhotoStudent?.full_name}</DialogTitle>
              <DialogDescription>{zoomPhotoStudent?.student_id}</DialogDescription>
            </DialogHeader>
            {zoomPhotoStudent?.photo_url && (
              <div className="flex flex-col items-center gap-4 py-4">
                <StudentPhoto
                  photoUrl={zoomPhotoStudent.photo_url}
                  fullName={zoomPhotoStudent.full_name}
                  status={zoomPhotoStudent.status}
                  size="xl"
                  className="border-4"
                />
                <span className={cn(
                  "text-sm px-3 py-1.5 rounded-full font-medium",
                  zoomPhotoStudent.status === 'active' 
                    ? 'bg-green-500/10 text-green-600' 
                    : 'bg-red-500/10 text-red-600'
                )}>
                  {zoomPhotoStudent.status === 'active' ? 'Ativo' : 'Desistente'}
                </span>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Student Report Modal */}
        <StudentReportModal 
          student={reportStudent} 
          onClose={() => setReportStudent(null)} 
        />
      </div>
    </DashboardLayout>
  );
};

export default Students;
