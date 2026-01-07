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
import { Wand2, Loader2, History, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const SHIFTS = [
  { id: 'morning', label: 'Manhã' },
  { id: 'afternoon', label: 'Tarde' },
  { id: 'evening', label: 'Noite' },
];

const GenerateContent = () => {
  const { rules, history, loading: timetableLoading, generateTimetable, clearEntries } = useTimetable();
  const { classes, teachers, classSubjects, loading: mappingLoading } = useSchoolMapping();
  
  const [selectedShifts, setSelectedShifts] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastResult, setLastResult] = useState<{ success: boolean; message: string } | null>(null);

  const loading = timetableLoading || mappingLoading;

  const activeRules = rules.filter(r => r.is_active);
  const teachersWithAvailability = teachers.filter(t => t.availability && t.availability.length > 0);

  // Get classes for selected shifts
  const classesForGeneration = useMemo(() => {
    if (selectedShifts.length === 0) return [];
    return classes.filter(c => selectedShifts.includes(c.shift));
  }, [classes, selectedShifts]);

  // Available shifts (only those with classes)
  const availableShifts = useMemo(() => {
    const shiftsWithClasses = new Set(classes.map(c => c.shift));
    return SHIFTS.filter(s => shiftsWithClasses.has(s.id));
  }, [classes]);

  const toggleShift = (shiftId: string) => {
    setSelectedShifts(prev => 
      prev.includes(shiftId)
        ? prev.filter(id => id !== shiftId)
        : [...prev, shiftId]
    );
  };

  const selectAllShifts = () => {
    if (selectedShifts.length === availableShifts.length) {
      setSelectedShifts([]);
    } else {
      setSelectedShifts(availableShifts.map(s => s.id));
    }
  };

  const handleGenerate = async () => {
    if (classesForGeneration.length === 0) {
      toast.error('Selecione ao menos um turno com turmas');
      return;
    }

    setIsGenerating(true);
    setLastResult(null);

    try {
      const classIds = classesForGeneration.map(c => c.id);
      
      // Clear existing entries for selected classes
      for (const classId of classIds) {
        await clearEntries(classId);
      }

      const result = await generateTimetable(classIds);
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

  const canGenerate = classesForGeneration.length > 0 && teachersWithAvailability.length > 0 && classSubjects.length > 0;

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
                  {teachersWithAvailability.length > 0 ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span className="text-sm">
                    {teachersWithAvailability.length} professores com disponibilidade configurada
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

          {/* Shift Selection */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Selecionar Turnos</CardTitle>
                <Button variant="outline" size="sm" onClick={selectAllShifts}>
                  {selectedShifts.length === availableShifts.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                </Button>
              </div>
              <CardDescription>
                Escolha os turnos para gerar o horário
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-4">
                  {availableShifts.map(shift => {
                    const shiftClasses = classes.filter(c => c.shift === shift.id);
                    return (
                      <div
                        key={shift.id}
                        className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted transition-colors"
                      >
                        <Checkbox
                          id={`shift-${shift.id}`}
                          checked={selectedShifts.includes(shift.id)}
                          onCheckedChange={() => toggleShift(shift.id)}
                        />
                        <Label htmlFor={`shift-${shift.id}`} className="font-normal cursor-pointer">
                          <span className="font-medium">{shift.label}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            ({shiftClasses.length} turmas)
                          </span>
                        </Label>
                      </div>
                    );
                  })}
                </div>

                {selectedShifts.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-sm text-muted-foreground mb-2">
                      Turmas selecionadas ({classesForGeneration.length}):
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {classesForGeneration.map(cls => (
                        <span 
                          key={cls.id}
                          className="px-2 py-1 text-xs rounded-md bg-muted"
                        >
                          {cls.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
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
                    Gerando horário...
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
