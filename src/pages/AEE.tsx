import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Search, FileText, Users, Camera, Paperclip, FileDown, Trash2, Eye, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StudentPhoto } from '@/components/StudentPhoto';
import { Badge } from '@/components/ui/badge';
import { differenceInYears, parse } from 'date-fns';
import { useSchoolName } from '@/hooks/useSchoolName';
import { PEIForm, PEIData, emptyPEI, InterventionRow, PerformanceLevel } from '@/components/aee/PEIForm';

interface Student {
  id: string;
  full_name: string;
  student_id: string;
  class: string;
  shift: string;
  photo_url: string | null;
  status: string;
  birth_date: string | null;
  has_medical_report: boolean;
  aee_cid_code: string | null;
  aee_cid_description: string | null;
  aee_uses_medication: boolean;
  aee_medication_name: string | null;
  aee_literacy_status: string | null;
  aee_adapted_activities: boolean;
  aee_adaptation_suggestions: string | null;
  aee_laudo_attachment_url: string | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
}

interface TeacherInfo {
  id: string;
  name: string;
  color: string;
  subject: string;
}

const AEE = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [filterShift, setFilterShift] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('teachers');
  const [teachers, setTeachers] = useState<TeacherInfo[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [zoomPhotoStudent, setZoomPhotoStudent] = useState<Student | null>(null);
  const [laudoFile, setLaudoFile] = useState<File | null>(null);
  const [isUploadingLaudo, setIsUploadingLaudo] = useState(false);
  const [laudoSignedUrl, setLaudoSignedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  const { schoolName } = useSchoolName();

  const [formData, setFormData] = useState({
    aee_cid_code: '',
    aee_cid_description: '',
    aee_uses_medication: false,
    aee_medication_name: '',
    aee_literacy_status: 'no',
    aee_adapted_activities: false,
    aee_adaptation_suggestions: '',
  });

  const [peiData, setPeiData] = useState<PEIData>(emptyPEI);
  const [peiLoading, setPeiLoading] = useState(false);
  const [peiSaving, setPeiSaving] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('id, full_name, student_id, class, shift, photo_url, status, birth_date, has_medical_report, aee_cid_code, aee_cid_description, aee_uses_medication, aee_medication_name, aee_literacy_status, aee_adapted_activities, aee_adaptation_suggestions, aee_laudo_attachment_url, guardian_name, guardian_phone')
        .eq('has_medical_report', true)
        .order('full_name');

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error fetching AEE students:', error);
      toast.error('Falha ao carregar alunos');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentTeachers = async (studentClass: string) => {
    setLoadingTeachers(true);
    try {
      // 1. Find the mapping class by name
      const { data: mappingClass, error: classError } = await supabase
        .from('mapping_classes')
        .select('id')
        .eq('name', studentClass)
        .maybeSingle();

      if (classError) throw classError;
      if (!mappingClass) {
        setTeachers([]);
        return;
      }

      // 2. Get class subjects with teachers
      const { data: classSubjects, error: subjectsError } = await supabase
        .from('mapping_class_subjects')
        .select(`
          subject_name,
          teacher_id,
          mapping_teachers (
            id,
            name,
            color
          )
        `)
        .eq('class_id', mappingClass.id)
        .not('teacher_id', 'is', null);

      if (subjectsError) throw subjectsError;

      // Group subjects by teacher
      const teacherMap = new Map<string, TeacherInfo>();
      
      classSubjects?.forEach((cs: any) => {
        if (cs.mapping_teachers) {
          const teacherId = cs.mapping_teachers.id;
          if (teacherMap.has(teacherId)) {
            const existing = teacherMap.get(teacherId)!;
            existing.subject += `, ${cs.subject_name}`;
          } else {
            teacherMap.set(teacherId, {
              id: cs.mapping_teachers.id,
              name: cs.mapping_teachers.name,
              color: cs.mapping_teachers.color,
              subject: cs.subject_name,
            });
          }
        }
      });

      setTeachers(Array.from(teacherMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Error fetching teachers:', error);
      toast.error('Falha ao carregar professores');
    } finally {
      setLoadingTeachers(false);
    }
  };

  const fetchLaudoSignedUrl = async (fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('aee-documents')
        .createSignedUrl(fileName, 3600);
      
      if (error) throw error;
      setLaudoSignedUrl(data.signedUrl);
    } catch (error) {
      console.error('Error getting signed URL:', error);
    }
  };

  const calculateAge = (birthDate: string | null): number | null => {
    if (!birthDate) return null;
    const parsed = parse(birthDate, 'yyyy-MM-dd', new Date());
    return differenceInYears(new Date(), parsed);
  };

  const getShiftLabel = (shift: string) => {
    const labels: Record<string, string> = {
      morning: 'Manhã',
      afternoon: 'Tarde',
      evening: 'Noite',
    };
    return labels[shift] || shift;
  };

  const getLiteracyLabel = (status: string | null) => {
    const labels: Record<string, string> = {
      no: 'Não',
      yes: 'Sim',
      in_process: 'Em processo',
    };
    return labels[status || 'no'] || 'Não informado';
  };

  const uniqueClasses = [...new Set(students.map(s => s.class))].filter(c => c && c.trim() !== '').sort();

  const filteredStudents = students.filter(student => {
    const matchesSearch = 
      student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.student_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = filterClass === 'all' || student.class === filterClass;
    const matchesShift = filterShift === 'all' || student.shift === filterShift;
    return matchesSearch && matchesClass && matchesShift;
  });

  const openStudentDialog = (student: Student) => {
    setSelectedStudent(student);
    setIsEditMode(false); // Always open in view mode
    setTeachers([]);
    setLaudoFile(null);
    setLaudoSignedUrl(null);
    setActiveTab('teachers');
    setIsDialogOpen(true);
    
    // Fetch teachers for this student's class
    fetchStudentTeachers(student.class);
    
    // Fetch laudo signed URL if exists
    if (student.aee_laudo_attachment_url) {
      fetchLaudoSignedUrl(student.aee_laudo_attachment_url);
    }
  };

  const openEditMode = (student: Student) => {
    setSelectedStudent(student);
    setIsEditMode(true); // Open in edit mode
    setFormData({
      aee_cid_code: student.aee_cid_code || '',
      aee_cid_description: student.aee_cid_description || '',
      aee_uses_medication: student.aee_uses_medication || false,
      aee_medication_name: student.aee_medication_name || '',
      aee_literacy_status: student.aee_literacy_status || 'no',
      aee_adapted_activities: student.aee_adapted_activities || false,
      aee_adaptation_suggestions: student.aee_adaptation_suggestions || '',
    });
    setTeachers([]);
    setLaudoFile(null);
    setLaudoSignedUrl(null);
    setActiveTab('pei');
    setIsDialogOpen(true);
    
    // Fetch teachers for this student's class
    fetchStudentTeachers(student.class);
    
    // Fetch laudo signed URL if exists
    if (student.aee_laudo_attachment_url) {
      fetchLaudoSignedUrl(student.aee_laudo_attachment_url);
    }

    // Load PEI data
    loadPEI(student);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Tipo de arquivo não permitido. Use JPG, PNG, WEBP ou PDF.');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Arquivo muito grande. Máximo 10MB.');
        return;
      }
      setLaudoFile(file);
    }
  };

  const uploadLaudoDocument = async () => {
    if (!laudoFile || !selectedStudent) return null;

    setIsUploadingLaudo(true);
    try {
      // Delete old file if exists
      if (selectedStudent.aee_laudo_attachment_url) {
        await supabase.storage
          .from('aee-documents')
          .remove([selectedStudent.aee_laudo_attachment_url]);
      }

      const fileExt = laudoFile.name.split('.').pop();
      const fileName = `${selectedStudent.id}-laudo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('aee-documents')
        .upload(fileName, laudoFile);

      if (uploadError) throw uploadError;

      return fileName;
    } catch (error) {
      console.error('Error uploading laudo:', error);
      toast.error('Falha ao enviar documento do laudo');
      return null;
    } finally {
      setIsUploadingLaudo(false);
    }
  };

  const handleDeleteLaudo = async () => {
    if (!selectedStudent?.aee_laudo_attachment_url) return;

    try {
      await supabase.storage
        .from('aee-documents')
        .remove([selectedStudent.aee_laudo_attachment_url]);

      await supabase
        .from('students')
        .update({ aee_laudo_attachment_url: null })
        .eq('id', selectedStudent.id);

      setSelectedStudent({ ...selectedStudent, aee_laudo_attachment_url: null });
      setLaudoSignedUrl(null);
      toast.success('Documento do laudo removido');
      fetchStudents();
    } catch (error) {
      console.error('Error deleting laudo:', error);
      toast.error('Falha ao remover documento');
    }
  };

  const handleSave = async () => {
    if (!selectedStudent) return;

    setIsSaving(true);
    try {
      let laudoUrl = selectedStudent.aee_laudo_attachment_url;
      
      // Upload new laudo if selected
      if (laudoFile) {
        const newUrl = await uploadLaudoDocument();
        if (newUrl) {
          laudoUrl = newUrl;
        }
      }

      const { error } = await supabase
        .from('students')
        .update({
          aee_cid_code: formData.aee_cid_code || null,
          aee_cid_description: formData.aee_cid_description || null,
          aee_uses_medication: formData.aee_uses_medication,
          aee_medication_name: formData.aee_uses_medication ? formData.aee_medication_name : null,
          aee_literacy_status: formData.aee_literacy_status,
          aee_adapted_activities: formData.aee_adapted_activities,
          aee_adaptation_suggestions: formData.aee_adaptation_suggestions || null,
          aee_laudo_attachment_url: laudoUrl,
        })
        .eq('id', selectedStudent.id);

      if (error) throw error;

      toast.success('Informações do laudo atualizadas com sucesso');
      setIsDialogOpen(false);
      fetchStudents();
    } catch (error) {
      console.error('Error saving AEE info:', error);
      toast.error('Falha ao salvar informações');
    } finally {
      setIsSaving(false);
    }
  };

  const loadPEI = async (student: Student) => {
    setPeiLoading(true);
    try {
      const { data, error } = await supabase
        .from('student_pei')
        .select('*')
        .eq('student_id', student.id)
        .maybeSingle();
      if (error) throw error;

      if (data) {
        setPeiData({
          enrollment_number: data.enrollment_number || '',
          aee_teacher: data.aee_teacher || '',
          coordination: data.coordination || '',
          elaboration_date: data.elaboration_date || new Date().toISOString().split('T')[0],
          legal_guardian: data.legal_guardian || student.guardian_name || '',
          contact: data.contact || '',
          email: data.email || '',
          phone: data.phone || student.guardian_phone || '',
          functional_profile: data.functional_profile || '',
          potentialities: data.potentialities || '',
          learning_barriers: data.learning_barriers || '',
          evaluation_criteria: data.evaluation_criteria || '',
          performance_levels: {
            linguagem: ((data.performance_levels as any)?.linguagem || '') as PerformanceLevel,
            matematica: ((data.performance_levels as any)?.matematica || '') as PerformanceLevel,
            ciencias_natureza: ((data.performance_levels as any)?.ciencias_natureza || '') as PerformanceLevel,
            ciencias_humanas: ((data.performance_levels as any)?.ciencias_humanas || '') as PerformanceLevel,
          },
          intervention_plan: Array.isArray(data.intervention_plan)
            ? (data.intervention_plan as unknown as InterventionRow[])
            : [],
          discipline_adaptations: {
            portugues_humanas: (data.discipline_adaptations as any)?.portugues_humanas || '',
            matematica_exatas: (data.discipline_adaptations as any)?.matematica_exatas || '',
            ciencias_humanas: (data.discipline_adaptations as any)?.ciencias_humanas || '',
          },
        });
      } else {
        setPeiData({
          ...emptyPEI,
          enrollment_number: student.student_id,
          legal_guardian: student.guardian_name || '',
          phone: student.guardian_phone || '',
        });
      }
    } catch (error) {
      console.error('Error loading PEI:', error);
      toast.error('Falha ao carregar PEI');
    } finally {
      setPeiLoading(false);
    }
  };

  const handleSavePEI = async () => {
    if (!selectedStudent) return;
    setPeiSaving(true);
    try {
      const payload = {
        student_id: selectedStudent.id,
        birth_date_snapshot: selectedStudent.birth_date,
        shift_snapshot: selectedStudent.shift,
        enrollment_number: peiData.enrollment_number || null,
        aee_teacher: peiData.aee_teacher || null,
        coordination: peiData.coordination || null,
        elaboration_date: peiData.elaboration_date || null,
        legal_guardian: peiData.legal_guardian || null,
        contact: peiData.contact || null,
        email: peiData.email || null,
        phone: peiData.phone || null,
        functional_profile: peiData.functional_profile || null,
        potentialities: peiData.potentialities || null,
        learning_barriers: peiData.learning_barriers || null,
        evaluation_criteria: peiData.evaluation_criteria || null,
        performance_levels: peiData.performance_levels as any,
        intervention_plan: peiData.intervention_plan as any,
        discipline_adaptations: peiData.discipline_adaptations as any,
      };

      const { error } = await supabase
        .from('student_pei')
        .upsert(payload, { onConflict: 'student_id' });
      if (error) throw error;
      toast.success('PEI salvo com sucesso');
    } catch (error) {
      console.error('Error saving PEI:', error);
      toast.error('Falha ao salvar PEI');
    } finally {
      setPeiSaving(false);
    }
  };

  const exportAEEReport = (student: Student) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Popup bloqueado. Permita popups para exportar o relatório.');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Relatório AEE - ${student.full_name}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: Arial, sans-serif; 
            padding: 40px; 
            max-width: 800px; 
            margin: 0 auto;
            color: #333;
          }
          .header { 
            text-align: center; 
            margin-bottom: 30px; 
            padding-bottom: 20px;
            border-bottom: 2px solid #eee;
          }
          .header h1 { 
            font-size: 24px;
            color: #d97706;
            margin-bottom: 5px;
          }
          .header h2 { 
            font-size: 20px;
            margin-bottom: 10px;
          }
          .header p { 
            font-size: 14px;
            color: #666;
          }
          .section { 
            margin-bottom: 25px; 
          }
          .section h3 { 
            font-size: 16px;
            border-bottom: 1px solid #ccc; 
            padding-bottom: 8px; 
            margin-bottom: 15px;
            color: #444;
          }
          .section p { 
            margin-bottom: 8px;
            font-size: 14px;
            line-height: 1.6;
          }
          .section p strong { 
            color: #333;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 10px;
          }
          td, th { 
            border: 1px solid #ddd; 
            padding: 10px; 
            text-align: left;
            font-size: 14px;
          }
          th { 
            background-color: #f5f5f5; 
            font-weight: bold;
          }
          .footer { 
            margin-top: 40px; 
            text-align: center;
            font-size: 12px;
            color: #888;
            padding-top: 20px;
            border-top: 1px solid #eee;
          }
          .suggestions-box {
            background-color: #fef3c7;
            border: 1px solid #fcd34d;
            border-radius: 8px;
            padding: 15px;
            margin-top: 10px;
          }
          .school-name {
            font-size: 18px;
            font-weight: bold;
            color: #333;
            margin-bottom: 10px;
          }
          @media print {
            body { padding: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <p class="school-name">${schoolName || 'EDUNEXUS'}</p>
          <h1>Relatório AEE</h1>
          <h2>${student.full_name}</h2>
          <p>Turma: ${student.class} | Turno: ${getShiftLabel(student.shift)} | ID: ${student.student_id}</p>
        </div>
        
        <div class="section">
          <h3>Informações do Aluno</h3>
          <p><strong>Idade:</strong> ${calculateAge(student.birth_date) !== null ? `${calculateAge(student.birth_date)} anos` : 'Não informada'}</p>
          <p><strong>Status:</strong> ${student.status === 'active' ? 'Ativo' : 'Inativo'}</p>
        </div>
        
        <div class="section">
          <h3>Informações do Laudo</h3>
          <p><strong>CID:</strong> ${student.aee_cid_code || 'Não informado'}${student.aee_cid_description ? ` - ${student.aee_cid_description}` : ''}</p>
          <p><strong>Medicação:</strong> ${student.aee_uses_medication ? `Sim - ${student.aee_medication_name || 'Nome não informado'}` : 'Não'}</p>
          <p><strong>Alfabetizado:</strong> ${getLiteracyLabel(student.aee_literacy_status)}</p>
          <p><strong>Atividades Adaptadas:</strong> ${student.aee_adapted_activities ? 'Sim' : 'Não'}</p>
        </div>
        
        ${student.aee_adaptation_suggestions ? `
        <div class="section">
          <h3>Sugestões de Adaptações</h3>
          <div class="suggestions-box">
            <p>${student.aee_adaptation_suggestions.replace(/\n/g, '<br>')}</p>
          </div>
        </div>
        ` : ''}
        
        <div class="section">
          <h3>Professores da Turma ${student.class}</h3>
          ${teachers.length > 0 ? `
          <table>
            <tr><th>Professor</th><th>Disciplina(s)</th></tr>
            ${teachers.map(t => `<tr><td>${t.name}</td><td>${t.subject}</td></tr>`).join('')}
          </table>
          ` : '<p>Nenhum professor vinculado à turma no mapeamento escolar.</p>'}
        </div>
        
        <p class="footer">
          Relatório gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
        
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Sistema AEE</h1>
            <p className="text-muted-foreground text-sm">
              Atendimento Educacional Especializado - Alunos com Laudo
            </p>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="w-5 h-5" />
            <span className="text-sm font-medium">{students.length} alunos com laudo</span>
          </div>
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
            {filteredStudents.map((student) => (
              <Card
                key={student.id}
                className={cn(
                  "card-hover animate-fade-in overflow-hidden border-2 border-amber-500/30 cursor-pointer",
                  student.status === 'inactive' && "border-red-500/50 opacity-75"
                )}
                onClick={() => openStudentDialog(student)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div onClick={(e) => { e.stopPropagation(); setZoomPhotoStudent(student); }}>
                      <StudentPhoto
                        photoUrl={student.photo_url}
                        fullName={student.full_name}
                        status={student.status}
                        size="md"
                        className="cursor-zoom-in"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{student.full_name}</h3>
                      <p className="text-xs text-muted-foreground">{student.student_id}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {student.class}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {getShiftLabel(student.shift)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                      Laudo
                    </Badge>
                    {student.aee_cid_code && (
                      <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/30">
                        CID: {student.aee_cid_code}
                      </Badge>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={(e) => { e.stopPropagation(); openEditMode(student); }}
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        fetchStudentTeachers(student.class).then(() => exportAEEReport(student));
                      }}
                      title="Exportar PDF"
                    >
                      <FileDown className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                Nenhum aluno encontrado
              </h3>
              <p className="text-sm text-muted-foreground">
                {searchTerm || filterClass !== 'all' || filterShift !== 'all'
                  ? 'Tente ajustar os filtros de busca'
                  : 'Não há alunos com laudo cadastrados no sistema'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Expanded Student Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedStudent && (
            <>
              {/* Student Header */}
              <div className="flex items-center gap-4 pb-4 border-b">
                <div 
                  className="cursor-zoom-in" 
                  onClick={() => setZoomPhotoStudent(selectedStudent)}
                >
                  <StudentPhoto
                    photoUrl={selectedStudent.photo_url}
                    fullName={selectedStudent.full_name}
                    status={selectedStudent.status}
                    size="lg"
                    className="border-2 border-amber-500/30"
                  />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-foreground">{selectedStudent.full_name}</h2>
                  <p className="text-sm text-muted-foreground">ID: {selectedStudent.student_id}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <Badge variant="outline">{selectedStudent.class}</Badge>
                    <Badge variant="secondary">{getShiftLabel(selectedStudent.shift)}</Badge>
                    {calculateAge(selectedStudent.birth_date) !== null && (
                      <Badge variant="outline">{calculateAge(selectedStudent.birth_date)} anos</Badge>
                    )}
                    <Badge 
                      variant={selectedStudent.status === 'active' ? 'default' : 'destructive'}
                      className={selectedStudent.status === 'active' ? 'bg-green-500' : ''}
                    >
                      {selectedStudent.status === 'active' ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="teachers">Professores</TabsTrigger>
                  <TabsTrigger value="laudo">Informações do Laudo</TabsTrigger>
                </TabsList>

                {/* Teachers Tab */}
                <TabsContent value="teachers" className="mt-4">
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground">
                      Professores da Turma {selectedStudent.class}
                    </h3>
                    {loadingTeachers ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="animate-pulse flex items-center gap-3 p-3 bg-muted rounded-lg">
                            <div className="w-8 h-8 bg-muted-foreground/20 rounded-full" />
                            <div className="flex-1">
                              <div className="h-4 bg-muted-foreground/20 rounded w-32 mb-1" />
                              <div className="h-3 bg-muted-foreground/20 rounded w-48" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : teachers.length > 0 ? (
                      <div className="space-y-2">
                        {teachers.map((teacher) => (
                          <div 
                            key={teacher.id} 
                            className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border"
                          >
                            <div 
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-sm"
                              style={{ backgroundColor: teacher.color }}
                            >
                              {teacher.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground">{teacher.name}</p>
                              <p className="text-sm text-muted-foreground truncate">{teacher.subject}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">
                          Nenhum professor vinculado a esta turma no mapeamento escolar.
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Laudo Tab */}
                <TabsContent value="laudo" className="mt-4">
                  {!isEditMode ? (
                    /* View Mode - Read Only */
                    <div className="space-y-4">
                      {/* CID */}
                      <div>
                        <Label className="text-muted-foreground text-sm">CID</Label>
                        <p className="font-medium">
                          {selectedStudent.aee_cid_code 
                            ? `${selectedStudent.aee_cid_code}${selectedStudent.aee_cid_description ? ` - ${selectedStudent.aee_cid_description}` : ''}`
                            : 'Não informado'}
                        </p>
                      </div>

                      {/* Medication */}
                      <div>
                        <Label className="text-muted-foreground text-sm">Uso de Medicação</Label>
                        <p className="font-medium">
                          {selectedStudent.aee_uses_medication 
                            ? `Sim${selectedStudent.aee_medication_name ? ` - ${selectedStudent.aee_medication_name}` : ''}`
                            : 'Não'}
                        </p>
                      </div>

                      {/* Literacy */}
                      <div>
                        <Label className="text-muted-foreground text-sm">Alfabetização</Label>
                        <p className="font-medium">{getLiteracyLabel(selectedStudent.aee_literacy_status)}</p>
                      </div>

                      {/* Adapted Activities */}
                      <div>
                        <Label className="text-muted-foreground text-sm">Atividades Adaptadas</Label>
                        <p className="font-medium">{selectedStudent.aee_adapted_activities ? 'Sim' : 'Não'}</p>
                      </div>

                      {/* Adaptation Suggestions */}
                      {selectedStudent.aee_adaptation_suggestions && (
                        <div>
                          <Label className="text-muted-foreground text-sm">Sugestões de Adaptações</Label>
                          <div className="mt-1 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                            <p className="text-sm whitespace-pre-wrap">{selectedStudent.aee_adaptation_suggestions}</p>
                          </div>
                        </div>
                      )}

                      {/* Laudo Document */}
                      {selectedStudent.aee_laudo_attachment_url && (
                        <div>
                          <Label className="text-muted-foreground text-sm">Documento do Laudo</Label>
                          <div className="mt-1">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => laudoSignedUrl && window.open(laudoSignedUrl, '_blank')}
                              disabled={!laudoSignedUrl}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Visualizar Documento
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Edit Mode */
                    <div className="space-y-6">
                      {/* CID */}
                      <div className="space-y-4">
                        <Label className="text-base font-medium">CID</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label htmlFor="cid_code" className="text-sm text-muted-foreground">Código</Label>
                            <Input
                              id="cid_code"
                              placeholder="Ex: F84.0"
                              value={formData.aee_cid_code}
                              onChange={(e) => setFormData({ ...formData, aee_cid_code: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="cid_description" className="text-sm text-muted-foreground">Descrição</Label>
                            <Input
                              id="cid_description"
                              placeholder="Ex: Autismo Infantil"
                              value={formData.aee_cid_description}
                              onChange={(e) => setFormData({ ...formData, aee_cid_description: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Medication */}
                      <div className="space-y-3">
                        <Label className="text-base font-medium">Faz uso de medicação</Label>
                        <RadioGroup
                          value={formData.aee_uses_medication ? 'yes' : 'no'}
                          onValueChange={(value) => setFormData({ 
                            ...formData, 
                            aee_uses_medication: value === 'yes',
                            aee_medication_name: value === 'no' ? '' : formData.aee_medication_name
                          })}
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="no" id="med_no" />
                            <Label htmlFor="med_no" className="font-normal cursor-pointer">Não</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="yes" id="med_yes" />
                            <Label htmlFor="med_yes" className="font-normal cursor-pointer">Sim</Label>
                          </div>
                        </RadioGroup>
                        {formData.aee_uses_medication && (
                          <div className="ml-6 space-y-2">
                            <Label htmlFor="medication_name" className="text-sm text-muted-foreground">Qual?</Label>
                            <Input
                              id="medication_name"
                              placeholder="Nome da medicação"
                              value={formData.aee_medication_name}
                              onChange={(e) => setFormData({ ...formData, aee_medication_name: e.target.value })}
                            />
                          </div>
                        )}
                      </div>

                      {/* Literacy */}
                      <div className="space-y-3">
                        <Label className="text-base font-medium">É alfabetizado</Label>
                        <RadioGroup
                          value={formData.aee_literacy_status}
                          onValueChange={(value) => setFormData({ ...formData, aee_literacy_status: value })}
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="no" id="lit_no" />
                            <Label htmlFor="lit_no" className="font-normal cursor-pointer">Não</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="yes" id="lit_yes" />
                            <Label htmlFor="lit_yes" className="font-normal cursor-pointer">Sim</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="in_process" id="lit_process" />
                            <Label htmlFor="lit_process" className="font-normal cursor-pointer">Em processo</Label>
                          </div>
                        </RadioGroup>
                      </div>

                      {/* Adapted Activities */}
                      <div className="space-y-3">
                        <Label className="text-base font-medium">Atividades e provas adaptadas</Label>
                        <RadioGroup
                          value={formData.aee_adapted_activities ? 'yes' : 'no'}
                          onValueChange={(value) => setFormData({ ...formData, aee_adapted_activities: value === 'yes' })}
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="no" id="adapt_no" />
                            <Label htmlFor="adapt_no" className="font-normal cursor-pointer">Não</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="yes" id="adapt_yes" />
                            <Label htmlFor="adapt_yes" className="font-normal cursor-pointer">Sim</Label>
                          </div>
                        </RadioGroup>
                      </div>

                      {/* Adaptation Suggestions */}
                      <div className="space-y-2">
                        <Label htmlFor="adaptation_suggestions" className="text-base font-medium">
                          Sugestões de Adaptações
                        </Label>
                        <Textarea
                          id="adaptation_suggestions"
                          placeholder="Descreva sugestões de adaptações para este aluno..."
                          value={formData.aee_adaptation_suggestions}
                          onChange={(e) => setFormData({ ...formData, aee_adaptation_suggestions: e.target.value })}
                          rows={4}
                          className="resize-none"
                        />
                      </div>

                      {/* Laudo Document Upload */}
                      <div className="space-y-3">
                        <Label className="text-base font-medium">Documento do Laudo</Label>
                        
                        {/* Existing document preview */}
                        {(selectedStudent.aee_laudo_attachment_url || laudoFile) && (
                          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                            <FileText className="w-8 h-8 text-amber-600" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {laudoFile?.name || selectedStudent.aee_laudo_attachment_url?.split('/').pop()}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {laudoFile ? 'Novo arquivo selecionado' : 'Documento anexado'}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              {laudoSignedUrl && !laudoFile && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => window.open(laudoSignedUrl, '_blank')}
                                  title="Visualizar"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (laudoFile) {
                                    setLaudoFile(null);
                                  } else {
                                    handleDeleteLaudo();
                                  }
                                }}
                                title="Remover"
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Upload buttons */}
                        <div className="flex gap-2">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*,.pdf"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                          <input
                            ref={cameraInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => cameraInputRef.current?.click()}
                            className="flex-1"
                          >
                            <Camera className="w-4 h-4 mr-2" />
                            Tirar Foto
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-1"
                          >
                            <Paperclip className="w-4 h-4 mr-2" />
                            Anexar Arquivo
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Formatos aceitos: JPG, PNG, WEBP, PDF (máx. 10MB)
                        </p>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <DialogFooter className="mt-6">
                {!isEditMode ? (
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Fechar
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => setIsEditMode(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving || isUploadingLaudo}>
                      {isSaving || isUploadingLaudo ? 'Salvando...' : 'Salvar'}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Photo Zoom Dialog */}
      <Dialog open={!!zoomPhotoStudent} onOpenChange={() => setZoomPhotoStudent(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{zoomPhotoStudent?.full_name}</DialogTitle>
            <DialogDescription>{zoomPhotoStudent?.student_id}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {zoomPhotoStudent && (
              <StudentPhoto
                photoUrl={zoomPhotoStudent.photo_url}
                fullName={zoomPhotoStudent.full_name}
                status={zoomPhotoStudent.status}
                size="xl"
                className="border-4"
              />
            )}
            <div className="flex items-center gap-2">
              <Badge 
                variant={zoomPhotoStudent?.status === 'active' ? 'default' : 'destructive'}
                className={zoomPhotoStudent?.status === 'active' ? 'bg-green-500' : ''}
              >
                {zoomPhotoStudent?.status === 'active' ? 'Ativo' : 'Inativo'}
              </Badge>
              <Badge variant="outline">{zoomPhotoStudent?.class}</Badge>
              <Badge variant="secondary">{getShiftLabel(zoomPhotoStudent?.shift || '')}</Badge>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AEE;
