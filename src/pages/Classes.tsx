import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, GraduationCap, Search, Users, Loader2, ImagePlus, CalendarIcon, Download, BookOpen } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { classSchema } from '@/lib/validations';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { GradesImportDialog } from '@/components/grades/GradesImportDialog';
import ClassAttendanceDialog from '@/components/ClassAttendanceDialog';
import ClassSummaryDialog from '@/components/ClassSummaryDialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';


interface ClassItem {
  id: string;
  name: string;
  shift: string;
  series?: string | null;
  description: string | null;
  status: string;
  photo_url: string | null;
  created_at: string;
  location?: string;
  mapping_class_id?: string | null;
}


const normalizeName = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const ClassPhoto = ({ photoUrl, className: name }: { photoUrl: string | null; className: string }) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!photoUrl) return;
    supabase.storage.from('class-photos').createSignedUrl(photoUrl, 3600).then(({ data }) => {
      if (data?.signedUrl) setSignedUrl(data.signedUrl);
    });
  }, [photoUrl]);

  if (signedUrl) {
    return <img src={signedUrl} alt={name} className="w-12 h-12 rounded-full object-cover border" />;
  }
  return (
    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
      <GraduationCap className="w-6 h-6 text-primary" />
    </div>
  );
};

const Classes = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { userRole } = useAuth();
  const canViewGuardianPhone = userRole === 'admin' || userRole === 'direction';
  const canManageGrades = userRole === 'admin' || userRole === 'direction';
  // Professor não pode excluir turmas (também bloqueado por RLS no backend)
  const canDeleteClasses = userRole === 'admin' || userRole === 'direction';
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
  const [classesWithAttendance, setClassesWithAttendance] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  
  const [attendanceClass, setAttendanceClass] = useState<string | null>(null);
  const [summaryClass, setSummaryClass] = useState<string | null>(null);

  // Boletim / notas
  const [gradesClass, setGradesClass] = useState<ClassItem | null>(null);
  
  // Photo upload state
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    shift: 'morning',
    description: '',
    photo_url: '' as string | null,
    location: 'sede' as 'sede' | 'salas_fora',
  });

  useEffect(() => {
    fetchClasses();
    fetchStudentCounts();
    fetchAttendanceStatus();
  }, []);

  const fetchClasses = async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .order('name');

      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      console.error('Error fetching classes:', error);
      toast.error('Falha ao carregar turmas');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentCounts = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('class')
        .eq('status', 'active');

      if (error) throw error;
      
      const counts: Record<string, number> = {};
      data?.forEach(student => {
        counts[student.class] = (counts[student.class] || 0) + 1;
      });
      setStudentCounts(counts);
    } catch (error) {
      console.error('Error fetching student counts:', error);
    }
  };

  const fetchAttendanceStatus = async () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('student_id, students!inner(class)')
        .eq('date', todayStr);

      if (error) throw error;

      const classSet = new Set<string>();
      data?.forEach((a: any) => {
        if (a.students?.class) classSet.add(a.students.class);
      });
      setClassesWithAttendance(classSet);
    } catch (error) {
      console.error('Error fetching attendance status:', error);
    }
  };

  const handleViewStudents = (className: string) => {
    navigate(`/students?class=${encodeURIComponent(className)}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form data with Zod
    const validationData = {
      name: formData.name.trim(),
      description: formData.description?.trim() || null,
      shift: formData.shift as 'morning' | 'afternoon' | 'evening',
    };

    const validation = classSchema.safeParse(validationData);
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast.error(firstError.message);
      return;
    }

    try {
      if (editingClass) {
        const { error } = await supabase
          .from('classes')
          .update({
            name: validationData.name,
            shift: validationData.shift,
            description: validationData.description,
            photo_url: formData.photo_url,
            location: formData.location,
          })
          .eq('id', editingClass.id);

        if (error) throw error;
        toast.success('Turma atualizada com sucesso');
      } else {
        const { error } = await supabase
          .from('classes')
          .insert({
            name: validationData.name,
            shift: validationData.shift,
            description: validationData.description,
            location: formData.location,
          });

        if (error) throw error;
        toast.success('Turma criada com sucesso');
      }

      setIsDialogOpen(false);
      setEditingClass(null);
      resetForm();
      fetchClasses();
    } catch (error: any) {
      console.error('Error saving class:', error);
      if (error.message?.includes('duplicate') || error.code === '23505') {
        toast.error('Já existe uma turma com esse nome');
      } else {
        toast.error('Falha ao salvar turma');
      }
    }
  };

  const handleEdit = async (classItem: ClassItem) => {
    setEditingClass(classItem);
    setFormData({
      name: classItem.name,
      shift: classItem.shift,
      description: classItem.description || '',
      photo_url: classItem.photo_url || null,
      location: (classItem.location === 'salas_fora' ? 'salas_fora' : 'sede'),
    });
    // Load existing photo preview
    if (classItem.photo_url) {
      const { data } = await supabase.storage.from('class-photos').createSignedUrl(classItem.photo_url, 3600);
      setPhotoPreview(data?.signedUrl || null);
    } else {
      setPhotoPreview(null);
    }
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!canDeleteClasses) {
      toast.error('Acesso negado: apenas administração e direção podem excluir turmas.');
      return;
    }
    if (!confirm('Tem certeza que deseja excluir esta turma?')) return;

    try {
      const { error } = await supabase.from('classes').delete().eq('id', id);
      if (error) throw error;
      toast.success('Turma excluída');
      fetchClasses();
    } catch (error) {
      console.error('Error deleting class:', error);
      toast.error('Falha ao excluir turma');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      shift: 'morning',
      description: '',
      photo_url: null,
      location: 'sede',
    });
    setPhotoPreview(null);
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingClass) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande. Máximo: 5MB');
      return;
    }

    setUploadingPhoto(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${editingClass.id}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('class-photos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: signedData } = await supabase.storage
        .from('class-photos')
        .createSignedUrl(fileName, 3600);

      setPhotoPreview(signedData?.signedUrl || null);
      setFormData(prev => ({ ...prev, photo_url: fileName }));
      toast.success('Foto carregada');
    } catch (err: any) {
      console.error('Error uploading photo:', err);
      toast.error('Erro ao enviar foto');
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const getShiftLabel = (shift: string) => {
    const shifts: Record<string, string> = {
      morning: 'Manhã',
      afternoon: 'Tarde',
      evening: 'Noite',
    };
    return shifts[shift] || shift;
  };

  const filteredClasses = classes.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );


  const handleDownloadAbsentStudents = async (className: string) => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const todayDisplay = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('student_id, students!inner(full_name, class)')
        .eq('date', todayStr)
        .eq('status', 'absent');

      if (error) throw error;

      const absentStudents = (data || [])
        .filter((a: any) => a.students?.class === className)
        .map((a: any) => a.students.full_name as string);

      if (absentStudents.length === 0) {
        toast.info('Nenhum aluno faltoso nesta turma hoje');
        return;
      }

      // Generate JPEG via canvas
      const lineHeight = 32;
      const padding = 40;
      const headerHeight = 100;
      const canvasHeight = headerHeight + absentStudents.length * lineHeight + padding * 2;
      const canvasWidth = 600;

      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d')!;

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Title
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(`Alunos Faltosos - ${className}`, padding, padding + 24);

      // Date
      ctx.fillStyle = '#666666';
      ctx.font = '14px sans-serif';
      ctx.fillText(todayDisplay, padding, padding + 50);

      // Separator
      ctx.strokeStyle = '#e0e0e0';
      ctx.beginPath();
      ctx.moveTo(padding, headerHeight);
      ctx.lineTo(canvasWidth - padding, headerHeight);
      ctx.stroke();

      // Student list
      ctx.fillStyle = '#333333';
      ctx.font = '16px sans-serif';
      absentStudents.forEach((name, i) => {
        const y = headerHeight + 20 + i * lineHeight;
        ctx.fillText(`${i + 1}. ${name}`, padding, y + 16);
      });

      // Download
      const link = document.createElement('a');
      link.download = `faltosos_${className.replace(/\s/g, '_')}_${todayStr}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();

      toast.success(`${absentStudents.length} aluno(s) faltoso(s) exportado(s)`);
    } catch (err) {
      console.error('Error downloading absent students:', err);
      toast.error('Erro ao gerar lista de faltosos');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Turmas</h1>
            <p className="text-muted-foreground">Gerencie as turmas da escola</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingClass(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nova Turma
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingClass ? 'Editar Turma' : 'Nova Turma'}</DialogTitle>
                <DialogDescription>
                  {editingClass ? 'Atualize as informações da turma' : 'Preencha os dados da turma'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Turma</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: 9º Ano A"
                    required
                  />
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
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição (opcional)</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Ex: Sala 12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Localização</Label>
                  <Select
                    value={formData.location}
                    onValueChange={(value) => setFormData({ ...formData, location: value as 'sede' | 'salas_fora' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sede">Sede</SelectItem>
                      <SelectItem value="salas_fora">Salas Foras</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editingClass && (
                  <div className="space-y-2">
                    <Label>Foto da Turma</Label>
                    <input
                      type="file"
                      ref={photoInputRef}
                      accept="image/*"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                    <div className="flex items-center gap-3">
                      {(photoPreview || formData.photo_url) && (
                        <img
                          src={photoPreview || ''}
                          alt="Foto da turma"
                          className="w-16 h-16 rounded-lg object-cover border"
                        />
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => photoInputRef.current?.click()}
                        disabled={uploadingPhoto}
                      >
                        {uploadingPhoto ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando...</>
                        ) : (
                          <><ImagePlus className="w-4 h-4 mr-2" />{formData.photo_url ? 'Trocar Foto' : 'Adicionar Foto'}</>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
                <Button type="submit" className="w-full">
                  {editingClass ? 'Atualizar Turma' : 'Criar Turma'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar turma..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Classes Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-12 bg-muted rounded-lg mb-4" />
                  <div className="h-4 bg-muted rounded mb-2" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredClasses.length > 0 ? (
          <div className="space-y-8">
            {(['sede', 'salas_fora'] as const).map((loc) => {
              const group = filteredClasses.filter((c) => (c.location || 'sede') === loc);
              if (group.length === 0) return null;
              const title = loc === 'sede' ? 'SEDE' : 'SALAS FORAS';
              return (
                <div key={loc} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{title}</h2>
                    <Badge variant="outline">{group.length}</Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {group.map((classItem, index) => (
              <Card
                key={classItem.id}
                className="card-hover animate-fade-in overflow-hidden cursor-pointer"
                style={{ animationDelay: `${index * 30}ms` }}
                onClick={() => setSummaryClass(classItem.name)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <ClassPhoto photoUrl={classItem.photo_url} className={classItem.name} />
                      <div>
                        <h3 className="font-medium">{classItem.name}</h3>
                        <p className="text-xs text-muted-foreground">{getShiftLabel(classItem.shift)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Attendance badge */}
                  <div className="mb-3">
                    {(() => {
                      const isWeekend = [0, 6].includes(new Date().getDay());
                      if (isWeekend) {
                        return (
                          <Badge variant="secondary" className="text-xs">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Frequência indisponível: final de semana
                          </Badge>
                        );
                      }
                      return classesWithAttendance.has(classItem.name) ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 text-xs">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Frequência OK
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Frequência não realizada
                        </Badge>
                      );
                    })()}
                  </div>

                  <div className="flex gap-2 mb-3" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      disabled={[0, 6].includes(new Date().getDay())}
                      className={cn(
                        "flex-1",
                        [0, 6].includes(new Date().getDay())
                          ? "bg-muted text-muted-foreground"
                          : classesWithAttendance.has(classItem.name)
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                            : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                      )}
                      onClick={() => {
                        if (![0, 6].includes(new Date().getDay())) {
                          setAttendanceClass(classItem.name);
                        }
                      }}
                    >
                      <CalendarIcon className="w-3 h-3 mr-2" />
                      {[0, 6].includes(new Date().getDay()) ? 'Indisponível: final de semana' : 'Frequência Diária'}
                    </Button>
                  </div>

                  {/* Absent students download */}
                  {!([0, 6].includes(new Date().getDay())) && classesWithAttendance.has(classItem.name) && (
                    <div className="flex gap-2 mb-3" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={() => handleDownloadAbsentStudents(classItem.name)}
                      >
                        <Download className="w-3 h-3 mr-2" />
                        Alunos Faltosos
                      </Button>
                    </div>
                  )}

                  <div className="flex gap-2 mb-3" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleViewStudents(classItem.name)}
                    >
                      <Users className="w-3 h-3 mr-2" />
                      Ver Alunos ({studentCounts[classItem.name] || 0})
                    </Button>
                  </div>

                  {canManageGrades && (
                    <div className="flex gap-2 mb-3" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setGradesClass(classItem)}
                      >
                        <BookOpen className="w-3 h-3 mr-2" />
                        Inserir boletim da turma
                      </Button>
                    </div>
                  )}

                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(classItem)}>
                      <Edit2 className="w-3 h-3 mr-1" />
                      Editar
                    </Button>
                    {canDeleteClasses && (
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(classItem.id)}>
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-1">Nenhuma turma encontrada</h3>
              <p className="text-sm text-muted-foreground">
                {searchTerm ? 'Tente ajustar sua busca' : 'Adicione sua primeira turma'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Class Summary Dialog */}
        <ClassSummaryDialog
          open={!!summaryClass}
          onOpenChange={(open) => !open && setSummaryClass(null)}
          className={summaryClass}
        />

        {/* Importação de boletim / notas */}
        <GradesImportDialog
          open={!!gradesClass}
          onOpenChange={(open) => !open && setGradesClass(null)}
          classItem={gradesClass}
          onImported={() => { fetchClasses(); fetchStudentCounts(); }}
        />

        {/* Attendance Dialog */}
        <ClassAttendanceDialog
          open={!!attendanceClass}
          onOpenChange={(open) => !open && setAttendanceClass(null)}
          className={attendanceClass || ''}
          onSuccess={() => { fetchStudentCounts(); fetchAttendanceStatus(); }}
        />
      </div>
    </DashboardLayout>
  );
};

export default Classes;
