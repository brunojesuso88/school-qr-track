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
import { Plus, Edit2, Trash2, GraduationCap, Search, Users, Upload, FileText, Loader2, CheckCircle2, AlertCircle, ImagePlus } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { classSchema } from '@/lib/validations';
import { useAuth } from '@/contexts/AuthContext';
import ClassAttendanceDialog from '@/components/ClassAttendanceDialog';
import { format } from 'date-fns';

const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10MB

interface ClassItem {
  id: string;
  name: string;
  shift: string;
  description: string | null;
  status: string;
  photo_url: string | null;
  created_at: string;
}

interface ExtractedStudent {
  full_name: string;
  birth_date: string | null;
  guardian_name: string;
  guardian_phone: string;
  class: string;
  shift: string;
  selected?: boolean;
}

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
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
  const [classesWithAttendance, setClassesWithAttendance] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  
  // PDF Import state
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importingClass, setImportingClass] = useState<ClassItem | null>(null);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [extractedStudents, setExtractedStudents] = useState<ExtractedStudent[]>([]);
  const [isSavingStudents, setIsSavingStudents] = useState(false);
  const [attendanceClass, setAttendanceClass] = useState<string | null>(null);
  
  // Photo upload state
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    shift: 'morning',
    description: '',
    photo_url: '' as string | null,
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

  const handleImportClick = (classItem: ClassItem) => {
    setImportingClass(classItem);
    setExtractedStudents([]);
    setIsImportDialogOpen(true);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !importingClass) return;

    if (file.type !== 'application/pdf') {
      toast.error('Por favor, selecione um arquivo PDF');
      return;
    }

    // Validate file size
    if (file.size > MAX_PDF_SIZE) {
      toast.error('PDF muito grande. Tamanho máximo: 10MB');
      return;
    }

    setIsProcessingPdf(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = (event.target?.result as string)?.split(',')[1];
        if (!base64) {
          toast.error('Erro ao ler o arquivo');
          setIsProcessingPdf(false);
          return;
        }

        try {
          const { data, error } = await supabase.functions.invoke('parse-students-pdf', {
            body: { 
              pdfBase64: base64, 
              className: importingClass.name,
              shift: importingClass.shift 
            }
          });

          if (error) throw error;
          
          if (data.success && data.students?.length > 0) {
            setExtractedStudents(data.students.map((s: ExtractedStudent) => ({ ...s, selected: true })));
            toast.success(`${data.count} aluno(s) encontrado(s) no documento`);
          } else {
            toast.error(data.error || 'Nenhum aluno encontrado no documento');
          }
        } catch (err: any) {
          console.error('Error processing PDF:', err);
          toast.error(err.message || 'Erro ao processar PDF');
        } finally {
          setIsProcessingPdf(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Error reading file:', err);
      toast.error('Erro ao ler o arquivo');
      setIsProcessingPdf(false);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleStudentSelection = (index: number) => {
    setExtractedStudents(prev => 
      prev.map((s, i) => i === index ? { ...s, selected: !s.selected } : s)
    );
  };

  const toggleAllStudents = (selected: boolean) => {
    setExtractedStudents(prev => prev.map(s => ({ ...s, selected })));
  };

  const generateStudentId = (fullName: string, birthDate: string | null) => {
    const nameParts = fullName.trim().split(' ');
    const initials = nameParts.length >= 2 
      ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
      : nameParts[0].substring(0, 2).toUpperCase();
    
    const datePart = birthDate 
      ? birthDate.replace(/-/g, '').substring(2)
      : new Date().getTime().toString().slice(-6);
    
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${initials}${datePart}${random}`;
  };

  const handleSaveStudents = async () => {
    const selectedStudents = extractedStudents.filter(s => s.selected);
    if (selectedStudents.length === 0) {
      toast.error('Selecione pelo menos um aluno para cadastrar');
      return;
    }

    setIsSavingStudents(true);
    try {
      const studentsToInsert = selectedStudents.map(student => ({
        full_name: student.full_name,
        birth_date: student.birth_date || null,
        guardian_name: student.guardian_name || 'Responsável',
        guardian_phone: student.guardian_phone || '00000000000',
        class: student.class,
        shift: student.shift as 'morning' | 'afternoon' | 'evening',
        student_id: generateStudentId(student.full_name, student.birth_date),
        status: 'active'
      }));

      const { error } = await supabase.from('students').insert(studentsToInsert);
      
      if (error) throw error;
      
      toast.success(`${selectedStudents.length} aluno(s) cadastrado(s) com sucesso!`);
      setIsImportDialogOpen(false);
      setExtractedStudents([]);
      fetchStudentCounts();
    } catch (err: any) {
      console.error('Error saving students:', err);
      toast.error(err.message || 'Erro ao cadastrar alunos');
    } finally {
      setIsSavingStudents(false);
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredClasses.map((classItem, index) => (
              <Card
                key={classItem.id}
                className="card-hover animate-fade-in overflow-hidden cursor-pointer"
                style={{ animationDelay: `${index * 30}ms` }}
                onClick={() => setAttendanceClass(classItem.name)}
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
                    {classesWithAttendance.has(classItem.name) ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 text-xs">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Frequência OK
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Frequência não realizada
                      </Badge>
                    )}
                  </div>

                  {classItem.description && (
                    <p className="text-sm text-muted-foreground mb-3">{classItem.description}</p>
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleImportClick(classItem)}
                    >
                      <Upload className="w-3 h-3" />
                    </Button>
                  </div>

                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(classItem)}>
                      <Edit2 className="w-3 h-3 mr-1" />
                      Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(classItem.id)}>
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
              <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-1">Nenhuma turma encontrada</h3>
              <p className="text-sm text-muted-foreground">
                {searchTerm ? 'Tente ajustar sua busca' : 'Adicione sua primeira turma'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* PDF Import Dialog */}
        <Dialog open={isImportDialogOpen} onOpenChange={(open) => {
          setIsImportDialogOpen(open);
          if (!open) {
            setImportingClass(null);
            setExtractedStudents([]);
          }
        }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Importar Alunos via PDF
              </DialogTitle>
              <DialogDescription>
                {importingClass && `Turma: ${importingClass.name} - ${getShiftLabel(importingClass.shift)}`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <input
                type="file"
                ref={fileInputRef}
                accept="application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />

              {extractedStudents.length === 0 ? (
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                  <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-medium mb-2">Selecione um arquivo PDF</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    O sistema irá utilizar IA para identificar e extrair os dados dos alunos
                  </p>
                  <Button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessingPdf}
                  >
                    {isProcessingPdf ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Selecionar PDF
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={extractedStudents.every(s => s.selected)}
                        onCheckedChange={(checked) => toggleAllStudents(!!checked)}
                      />
                      <span className="text-sm font-medium">
                        {extractedStudents.filter(s => s.selected).length} de {extractedStudents.length} selecionado(s)
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isProcessingPdf}
                    >
                      <Upload className="w-3 h-3 mr-2" />
                      Novo PDF
                    </Button>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10"></TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Data Nasc.</TableHead>
                          <TableHead>Responsável</TableHead>
                          {canViewGuardianPhone && <TableHead>Telefone</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {extractedStudents.map((student, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Checkbox
                                checked={student.selected}
                                onCheckedChange={() => toggleStudentSelection(index)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{student.full_name}</TableCell>
                            <TableCell>{student.birth_date || '-'}</TableCell>
                            <TableCell>{student.guardian_name || '-'}</TableCell>
                            {canViewGuardianPhone && <TableCell>{student.guardian_phone || '-'}</TableCell>}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsImportDialogOpen(false);
                        setExtractedStudents([]);
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleSaveStudents}
                      disabled={isSavingStudents || extractedStudents.filter(s => s.selected).length === 0}
                    >
                      {isSavingStudents ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Cadastrando...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Cadastrar Selecionados
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
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
