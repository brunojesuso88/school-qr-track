import { useState, useMemo } from 'react';
import { TimetableProvider, useTimetable } from '@/contexts/TimetableContext';
import { SchoolMappingProvider, useSchoolMapping } from '@/contexts/SchoolMappingContext';
import TimetableLayout from '@/components/timetable/TimetableLayout';
import QualityBadge from '@/components/timetable/QualityBadge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Wand2, Loader2, History, CheckCircle2, AlertCircle, Info, Zap, Scale, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const SHIFT_LABELS: Record<string, string> = {
  morning: 'Manhã',
  afternoon: 'Tarde',
  evening: 'Noite',
};

const GenerateContent = () => {
  const { rules, history, loading: timetableLoading, generateTimetable, clearEntries } = useTimetable();
  const { classes, teachers, classSubjects, loading: mappingLoading } = useSchoolMapping();
  
  const { teacherAvailability } = useTimetable();
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastResult, setLastResult] = useState<{ success: boolean; message: string } | null>(null);
  const [generationLevel, setGenerationLevel] = useState<'light' | 'moderate' | 'strict'>('moderate');

  const loading = timetableLoading || mappingLoading;

  const activeRules = rules.filter(r => r.is_active);
  
  // Count teachers with REAL availability configured
  const teachersWithAvailabilityCount = useMemo(() => {
    const teacherIdsWithAvailability = new Set(teacherAvailability.map(a => a.teacher_id));
    return teacherIdsWithAvailability.size;
  }, [teacherAvailability]);

  // Get classes for generation
  const classesForGeneration = useMemo(() => {
    return classes.filter(c => selectedClassIds.includes(c.id));
  }, [classes, selectedClassIds]);

  // Group classes by shift
  const classesByShift = useMemo(() => {
    const groups: Record<string, typeof classes> = {};
    classes.forEach(c => {
      if (!groups[c.shift]) groups[c.shift] = [];
      groups[c.shift].push(c);
    });
    return groups;
  }, [classes]);

  const toggleClass = (classId: string) => {
    setSelectedClassIds(prev =>
      prev.includes(classId)
        ? prev.filter(id => id !== classId)
        : [...prev, classId]
    );
  };

  const toggleShiftGroup = (shift: string) => {
    const shiftClassIds = (classesByShift[shift] || []).map(c => c.id);
    const allSelected = shiftClassIds.every(id => selectedClassIds.includes(id));
    setSelectedClassIds(prev =>
      allSelected
        ? prev.filter(id => !shiftClassIds.includes(id))
        : [...new Set([...prev, ...shiftClassIds])]
    );
  };

  const selectAll = () => {
    if (selectedClassIds.length === classes.length) {
      setSelectedClassIds([]);
    } else {
      setSelectedClassIds(classes.map(c => c.id));
    }
  };

  const handleGenerate = async () => {
    if (classesForGeneration.length === 0) {
      toast.error('Selecione ao menos uma turma');
      return;
    }

    setIsGenerating(true);
    setLastResult(null);

    try {
      const classIds = classesForGeneration.map(c => c.id);
      
      // Edge function handles deletion of non-locked entries internally
      const result = await generateTimetable(classIds, generationLevel);
      setLastResult(result);
      
      if (result.success) {
        toast.success('Horário gerado com sucesso!');
      }
    } catch (error) {
      toast.error('Erro ao gerar horário');
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading) {
    return (
      <TimetableLayout title="Gerar Horário" description="Geração automática com IA">
        <div className="space-y-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </TimetableLayout>
    );
  }

  const canGenerate = classesForGeneration.length > 0 && teachersWithAvailabilityCount > 0 && classSubjects.length > 0;

  return (
    <TimetableLayout title="Gerar Horário" description="Geração automática com IA">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Prerequisites */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Pré-requisitos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {teachers.length > 0 ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span className="text-sm">
                    {teachers.length} professores cadastrados
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {teachersWithAvailabilityCount > 0 ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span className="text-sm">
                    {teachersWithAvailabilityCount} professores com disponibilidade configurada
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {classes.length > 0 ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span className="text-sm">
                    {classes.length} turmas cadastradas
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {classSubjects.length > 0 ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span className="text-sm">
                    {classSubjects.length} disciplinas distribuídas nas turmas
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="text-sm">
                    {activeRules.length} regras ativas
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Class Selection */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Selecionar Turmas</CardTitle>
                <Button variant="outline" size="sm" onClick={selectAll}>
                  {selectedClassIds.length === classes.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                </Button>
              </div>
              <CardDescription>
                Escolha as turmas individuais ou por grupo de turno
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(classesByShift).map(([shift, shiftClasses]) => {
                  const shiftClassIds = shiftClasses.map(c => c.id);
                  const allSelected = shiftClassIds.every(id => selectedClassIds.includes(id));
                  const someSelected = shiftClassIds.some(id => selectedClassIds.includes(id));
                  
                  return (
                    <div key={shift} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`shift-group-${shift}`}
                            checked={allSelected}
                            onCheckedChange={() => toggleShiftGroup(shift)}
                            className={someSelected && !allSelected ? "opacity-60" : ""}
                          />
                          <Label htmlFor={`shift-group-${shift}`} className="font-medium cursor-pointer">
                            {SHIFT_LABELS[shift] || shift}
                          </Label>
                          <span className="text-xs text-muted-foreground">
                            ({shiftClasses.length} turmas)
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 ml-6">
                        {shiftClasses.map(cls => (
                          <div
                            key={cls.id}
                            className="flex items-center space-x-2 p-2 rounded-lg border hover:bg-muted transition-colors"
                          >
                            <Checkbox
                              id={`class-${cls.id}`}
                              checked={selectedClassIds.includes(cls.id)}
                              onCheckedChange={() => toggleClass(cls.id)}
                            />
                            <Label htmlFor={`class-${cls.id}`} className="font-normal cursor-pointer text-sm">
                              {cls.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {selectedClassIds.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-sm text-muted-foreground">
                      {selectedClassIds.length} turma(s) selecionada(s)
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Generation Level */}
          <Card>
            <CardHeader>
              <CardTitle>Nível de Geração</CardTitle>
              <CardDescription>Escolha o nível de otimização do horário</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                <button
                  onClick={() => setGenerationLevel('light')}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    generationLevel === 'light'
                      ? 'border-green-500 bg-green-500/10 ring-1 ring-green-500/30'
                      : 'border-border hover:border-green-500/50 hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-lg bg-green-500/20">
                      <Zap className="h-4 w-4 text-green-500" />
                    </div>
                    <span className="font-semibold text-sm">Leve</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Rápida. Evita conflitos básicos e garante carga horária. Sem otimização pedagógica.
                  </p>
                </button>

                <button
                  onClick={() => setGenerationLevel('moderate')}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    generationLevel === 'moderate'
                      ? 'border-yellow-500 bg-yellow-500/10 ring-1 ring-yellow-500/30'
                      : 'border-border hover:border-yellow-500/50 hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-lg bg-yellow-500/20">
                      <Scale className="h-4 w-4 text-yellow-500" />
                    </div>
                    <span className="font-semibold text-sm">Moderada</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Equilibrada. Distribuição pedagógica, limita consecutivas, respeita disponibilidade.
                  </p>
                </button>

                <button
                  onClick={() => setGenerationLevel('strict')}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    generationLevel === 'strict'
                      ? 'border-red-500 bg-red-500/10 ring-1 ring-red-500/30'
                      : 'border-border hover:border-red-500/50 hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-lg bg-red-500/20">
                      <Shield className="h-4 w-4 text-red-500" />
                    </div>
                    <span className="font-semibold text-sm">Rigorosa</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Máxima. Zero janelas, sequência pedagógica ideal, otimização global. Mais lenta.
                  </p>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Generate Button */}
          <Card>
            <CardContent className="pt-6">
              <Button
                size="lg"
                className="w-full"
                onClick={handleGenerate}
                disabled={!canGenerate || isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Gerando horário ({generationLevel === 'light' ? 'Leve' : generationLevel === 'strict' ? 'Rigorosa' : 'Moderada'})...
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-5 w-5" />
                    Gerar Horário com IA
                  </>
                )}
              </Button>

              {!canGenerate && (
                <p className="text-sm text-muted-foreground text-center mt-2">
                  Configure todos os pré-requisitos para gerar o horário
                </p>
              )}
            </CardContent>
          </Card>

          {/* Result */}
          {lastResult && (
            <Alert variant={lastResult.success ? 'default' : 'destructive'}>
              {lastResult.success ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertTitle>
                {lastResult.success ? 'Horário Gerado!' : 'Erro na Geração'}
              </AlertTitle>
              <AlertDescription>
                {lastResult.message}
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* History */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico
            </CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma geração realizada
              </p>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {history.map(item => (
                    <div 
                      key={item.id} 
                      className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(item.generated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                        {item.quality_score !== null && (
                          <QualityBadge score={item.quality_score} size="sm" showLabel={false} />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          item.status === 'approved' 
                            ? 'bg-success/10 text-success' 
                            : item.status === 'archived'
                              ? 'bg-muted text-muted-foreground'
                              : 'bg-warning/10 text-warning'
                        }`}>
                          {item.status === 'approved' ? 'Aprovado' : item.status === 'archived' ? 'Arquivado' : 'Rascunho'}
                        </span>
                        {item.conflicts_count > 0 && (
                          <span className="text-xs text-destructive">
                            {item.conflicts_count} conflitos
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </TimetableLayout>
  );
};

const TimetableGenerate = () => {
  return (
    <SchoolMappingProvider>
      <TimetableProvider>
        <GenerateContent />
      </TimetableProvider>
    </SchoolMappingProvider>
  );
};

export default TimetableGenerate;
