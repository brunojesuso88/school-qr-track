import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { Search, FileText, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StudentPhoto } from '@/components/StudentPhoto';
import { Badge } from '@/components/ui/badge';
import { differenceInYears, parse } from 'date-fns';

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
}

const AEE = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [filterShift, setFilterShift] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state for AEE info
  const [formData, setFormData] = useState({
    aee_cid_code: '',
    aee_cid_description: '',
    aee_uses_medication: false,
    aee_medication_name: '',
    aee_literacy_status: 'no',
    aee_adapted_activities: false,
  });

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('id, full_name, student_id, class, shift, photo_url, status, birth_date, has_medical_report, aee_cid_code, aee_cid_description, aee_uses_medication, aee_medication_name, aee_literacy_status, aee_adapted_activities')
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
    setFormData({
      aee_cid_code: student.aee_cid_code || '',
      aee_cid_description: student.aee_cid_description || '',
      aee_uses_medication: student.aee_uses_medication || false,
      aee_medication_name: student.aee_medication_name || '',
      aee_literacy_status: student.aee_literacy_status || 'no',
      aee_adapted_activities: student.aee_adapted_activities || false,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedStudent) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('students')
        .update({
          aee_cid_code: formData.aee_cid_code || null,
          aee_cid_description: formData.aee_cid_description || null,
          aee_uses_medication: formData.aee_uses_medication,
          aee_medication_name: formData.aee_uses_medication ? formData.aee_medication_name : null,
          aee_literacy_status: formData.aee_literacy_status,
          aee_adapted_activities: formData.aee_adapted_activities,
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
                  "card-hover animate-fade-in overflow-hidden border-2 border-amber-500/30",
                  student.status === 'inactive' && "border-red-500/50 opacity-75"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <StudentPhoto
                      photoUrl={student.photo_url}
                      fullName={student.full_name}
                      status={student.status}
                      size="md"
                    />
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

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => openStudentDialog(student)}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Informações do Laudo
                  </Button>
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

      {/* AEE Info Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-600" />
              Informações do Laudo
            </DialogTitle>
            {selectedStudent && (
              <DialogDescription>
                {selectedStudent.full_name} - {selectedStudent.class}
              </DialogDescription>
            )}
          </DialogHeader>

          {selectedStudent && (
            <div className="space-y-6 py-4">
              {/* Age - Read only */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">Idade</Label>
                <p className="font-medium text-lg">
                  {calculateAge(selectedStudent.birth_date) !== null
                    ? `${calculateAge(selectedStudent.birth_date)} anos`
                    : 'Data de nascimento não informada'}
                </p>
              </div>

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
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AEE;
