import { useState } from 'react';
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

const GenerateContent = () => {
  const { rules, history, loading: timetableLoading, generateTimetable, clearEntries } = useTimetable();
  const { classes, teachers, classSubjects, loading: mappingLoading } = useSchoolMapping();
  
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastResult, setLastResult] = useState<{ success: boolean; message: string } | null>(null);

  const loading = timetableLoading || mappingLoading;

  const activeRules = rules.filter(r => r.is_active);
  const teachersWithAvailability = teachers.filter(t => t.availability && t.availability.length > 0);

  const toggleClass = (classId: string) => {
    setSelectedClasses(prev => 
      prev.includes(classId)
        ? prev.filter(id => id !== classId)
        : [...prev, classId]
    );
  };

  const selectAllClasses = () => {
    if (selectedClasses.length === classes.length) {
      setSelectedClasses([]);
    } else {
      setSelectedClasses(classes.map(c => c.id));
    }
  };

  const handleGenerate = async () => {
    if (selectedClasses.length === 0) {
      toast.error('Selecione ao menos uma turma');
      return;
    }

    setIsGenerating(true);
    setLastResult(null);

    try {
      // Clear existing entries for selected classes
      for (const classId of selectedClasses) {
        await clearEntries(classId);
      }

      const result = await generateTimetable(selectedClasses);
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

  const canGenerate = selectedClasses.length > 0 && teachersWithAvailability.length > 0 && classSubjects.length > 0;

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

          {/* Class Selection */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Selecionar Turmas</CardTitle>
                <Button variant="outline" size="sm" onClick={selectAllClasses}>
                  {selectedClasses.length === classes.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                </Button>
              </div>
              <CardDescription>
                Escolha as turmas para gerar o horário
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {classes.map(cls => (
                    <div
                      key={cls.id}
                      className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted"
                    >
                      <Checkbox
                        id={`class-${cls.id}`}
                        checked={selectedClasses.includes(cls.id)}
                        onCheckedChange={() => toggleClass(cls.id)}
                      />
                      <Label htmlFor={`class-${cls.id}`} className="font-normal cursor-pointer flex-1">
                        <span className="font-medium">{cls.name}</span>
                        <span className="text-xs text-muted-foreground ml-1">
                          ({cls.shift === 'morning' ? 'M' : cls.shift === 'afternoon' ? 'T' : 'N'})
                        </span>
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
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
