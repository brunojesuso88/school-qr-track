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
  
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState(classFromUrl || 'all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [occurrencesStudent, setOccurrencesStudent] = useState<Student | null>(null);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [isOccurrenceDialogOpen, setIsOccurrenceDialogOpen] = useState(false);
  const [zoomPhotoStudent, setZoomPhotoStudent] = useState<Student | null>(null);
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 30 }, (_, i) => currentYear - 3 - i);
  const months = [
    { value: '01', label: 'Janeiro' },
    { value: '02', label: 'Fevereiro' },
    { value: '03', label: 'Março' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Maio' },
    { value: '06', label: 'Junho' },
    { value: '07', label: 'Julho' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' },
  ];
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));

  const getBirthDate = (): Date | undefined => {
    if (birthDay && birthMonth && birthYear) {
      return new Date(parseInt(birthYear), parseInt(birthMonth) - 1, parseInt(birthDay));
    }
    return undefined;
  };

  const [formData, setFormData] = useState({
    full_name: '',
    class: '',
    shift: 'morning',
    guardian_name: '',
    guardian_phone: '',
    status: 'active',
  });

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [occurrenceForm, setOccurrenceForm] = useState({
    type: '',
    description: '',
    date: new Date(),
  });

  useEffect(() => {
    fetchStudents();
    fetchClasses();
  }, []);

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

  const generateStudentId = (fullName: string, birthDate: Date | undefined): string => {
    if (!fullName || !birthDate) return '';
    
    const nameParts = fullName.trim().split(' ');
    const initials = nameParts
      .filter(part => part.length > 0)
      .map(part => part[0].toUpperCase())
      .join('');
    
    const dateStr = format(birthDate, 'ddMMyyyy');
    return `${initials}${dateStr}`;
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

    const { data, error } = await supabase.storage
      .from('student-photos')
      .upload(fileName, photoFile, { upsert: true });

    if (error) {
      console.error('Error uploading photo:', error);
      throw error;
    }

    const { data: urlData } = supabase.storage
      .from('student-photos')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const birthDate = getBirthDate();
    if (!birthDate) {
      toast.error('Data de nascimento é obrigatória');
      return;
    }

    const studentId = generateStudentId(formData.full_name, birthDate);

    try {
      setIsUploadingPhoto(true);
      let photoUrl: string | null = null;

      if (editingStudent) {
        // Upload new photo if selected
        if (photoFile) {
          photoUrl = await uploadPhoto(editingStudent.id);
        }

        const updateData: any = {
          full_name: formData.full_name,
          class: formData.class,
          shift: formData.shift as 'morning' | 'afternoon' | 'evening',
          guardian_name: formData.guardian_name,
          guardian_phone: formData.guardian_phone,
          status: formData.status,
          student_id: studentId,
          birth_date: format(birthDate, 'yyyy-MM-dd'),
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
            full_name: formData.full_name,
            class: formData.class,
            shift: formData.shift as 'morning' | 'afternoon' | 'evening',
            guardian_name: formData.guardian_name,
            guardian_phone: formData.guardian_phone,
            status: formData.status,
            student_id: studentId,
            birth_date: format(birthDate, 'yyyy-MM-dd'),
            qr_code: qrCode,
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

    try {
      const { error } = await supabase
        .from('occurrences')
        .insert({
          student_id: occurrencesStudent.id,
          type: occurrenceForm.type,
          description: occurrenceForm.description || null,
          date: format(occurrenceForm.date, 'yyyy-MM-dd'),
        });

      if (error) throw error;
      toast.success('Ocorrência registrada com sucesso');
      setIsOccurrenceDialogOpen(false);
      setOccurrenceForm({ type: '', description: '', date: new Date() });
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
    });
    setPhotoPreview(student.photo_url);
    setPhotoFile(null);
    if (student.birth_date) {
      const parsed = parse(student.birth_date, 'yyyy-MM-dd', new Date());
      setBirthDay(String(parsed.getDate()).padStart(2, '0'));
      setBirthMonth(String(parsed.getMonth() + 1).padStart(2, '0'));
      setBirthYear(String(parsed.getFullYear()));
    } else {
      setBirthDay('');
      setBirthMonth('');
      setBirthYear('');
    }
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
    });
    setBirthDay('');
    setBirthMonth('');
    setBirthYear('');
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
    return matchesSearch && matchesClass;
  });

  const uniqueClasses = [...new Set(students.map((s) => s.class))];

  const getOccurrenceTypeLabel = (type: string) => {
    return OCCURRENCE_TYPES.find(t => t.value === type)?.label || type;
  };

  // Auto-generate student ID when name or birth date changes
  const generatedStudentId = generateStudentId(formData.full_name, getBirthDate());

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
                  <Label>Data de Nascimento</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Select value={birthDay} onValueChange={setBirthDay}>
                      <SelectTrigger>
                        <SelectValue placeholder="Dia" />
                      </SelectTrigger>
                      <SelectContent>
                        {days.map((day) => (
                          <SelectItem key={day} value={day}>{day}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={birthMonth} onValueChange={setBirthMonth}>
                      <SelectTrigger>
                        <SelectValue placeholder="Mês" />
                      </SelectTrigger>
                      <SelectContent>
                        {months.map((month) => (
                          <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={birthYear} onValueChange={setBirthYear}>
                      <SelectTrigger>
                        <SelectValue placeholder="Ano" />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((year) => (
                          <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
                    Gerado a partir do nome e data de nascimento
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
                <div className="space-y-2">
                  <Label htmlFor="guardian_phone">Telefone do Responsável (WhatsApp)</Label>
                  <Input
                    id="guardian_phone"
                    type="tel"
                    value={formData.guardian_phone}
                    onChange={(e) => setFormData({ ...formData, guardian_phone: e.target.value })}
                    placeholder="+55 11 99999-9999"
                    required
                  />
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
                  {uniqueClasses.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
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
                  "card-hover animate-fade-in overflow-hidden",
                  student.status === 'inactive' && "border-red-500/50"
                )}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div 
                        className={cn(
                          "w-14 h-14 rounded-full flex items-center justify-center overflow-hidden border-2 cursor-pointer transition-transform hover:scale-105",
                          student.status === 'active' ? "border-green-500 bg-green-500/10" : "border-red-500 bg-red-500/10"
                        )}
                        onClick={() => student.photo_url && setZoomPhotoStudent(student)}
                      >
                        {student.photo_url ? (
                          <img
                            src={student.photo_url}
                            alt={student.full_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className={cn(
                            "w-7 h-7",
                            student.status === 'active' ? "text-green-600" : "text-red-600"
                          )} />
                        )}
                      </div>
                      <div>
                        <h3 className="font-medium text-sm">{student.full_name}</h3>
                        <p className="text-xs text-muted-foreground">{student.student_id}</p>
                      </div>
                    </div>
                    <span className={cn(
                      "text-xs px-2 py-1 rounded-full font-medium",
                      student.status === 'active' 
                        ? 'bg-green-500/10 text-green-600' 
                        : 'bg-red-500/10 text-red-600'
                    )}>
                      {student.status === 'active' ? 'Ativo' : 'Desistente'}
                    </span>
                  </div>

                  <div className="text-xs space-y-1 text-muted-foreground mb-4">
                    <p><span className="font-medium text-foreground">Turma:</span> {student.class}</p>
                    <p><span className="font-medium text-foreground">Turno:</span> {student.shift === 'morning' ? 'Manhã' : student.shift === 'afternoon' ? 'Tarde' : 'Noite'}</p>
                    <p><span className="font-medium text-foreground">Responsável:</span> {student.guardian_name}</p>
                    {student.birth_date && (
                      <p><span className="font-medium text-foreground">Nascimento:</span> {format(parse(student.birth_date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy')}</p>
                    )}
                  </div>

                  <div className="flex gap-2 flex-wrap">
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
                    <Card key={occurrence.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                                {getOccurrenceTypeLabel(occurrence.type)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {format(parse(occurrence.date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy')}
                              </span>
                            </div>
                            {occurrence.description && (
                              <p className="text-sm text-muted-foreground">{occurrence.description}</p>
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
              <div className="space-y-2">
                <Label>Tipo de Ocorrência</Label>
                <Select
                  value={occurrenceForm.type}
                  onValueChange={(value) => setOccurrenceForm({ ...occurrenceForm, type: value })}
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
                <Label>Data</Label>
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
              <div className="space-y-2">
                <Label>Descrição (opcional)</Label>
                <Textarea
                  value={occurrenceForm.description}
                  onChange={(e) => setOccurrenceForm({ ...occurrenceForm, description: e.target.value })}
                  placeholder="Detalhes da ocorrência..."
                  rows={3}
                />
              </div>
              <Button type="submit" className="w-full" disabled={!occurrenceForm.type}>
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
                <div className={cn(
                  "w-64 h-64 rounded-full overflow-hidden border-4",
                  zoomPhotoStudent.status === 'active' ? "border-green-500" : "border-red-500"
                )}>
                  <img
                    src={zoomPhotoStudent.photo_url}
                    alt={zoomPhotoStudent.full_name}
                    className="w-full h-full object-cover"
                  />
                </div>
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
      </div>
    </DashboardLayout>
  );
};

export default Students;
