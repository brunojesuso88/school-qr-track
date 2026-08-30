import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GraduationCap, ChevronDown, Info, AlertTriangle } from 'lucide-react';
import { useStudentGrades } from '@/hooks/useStudentGrades';
import { useClassIdByName } from '@/hooks/useClassId';
import { describePeriods, formatGrade, formatIra } from '@/lib/ira';
import { IRABreakdown } from './IRABreakdown';
import { cn } from '@/lib/utils';

interface StudentGradesTabProps {
  studentId: string;
  className: string;
}

export const StudentGradesTab = ({ studentId, className }: StudentGradesTabProps) => {
  const { classId, loading: loadingClass } = useClassIdByName(className);
  const { data, gradeMap, ira, iraPeriods, loading, error } = useStudentGrades(studentId, classId);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const selectedPeriodIds = new Set(iraPeriods.map((p) => p.id));

  if (loadingClass || loading) {
    return (
      <div className="space-y-3">
        <div className="h-20 bg-muted animate-pulse rounded-lg" />
        <div className="h-40 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="w-4 h-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (data.subjects.length === 0) {
    return (
      <div className="text-center py-12">
        <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
        <p className="text-muted-foreground">Nenhum boletim importado para esta turma</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Use “Inserir boletim da turma” na tela de Turmas para importar as notas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* IRA */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs text-muted-foreground">Índice de Rendimento Acadêmico</p>
              <p className={cn('text-3xl font-bold', ira?.status === 'ok' ? 'text-primary' : 'text-muted-foreground')}>
                IRA: {formatIra(ira?.value ?? null)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Baseado em: {describePeriods(iraPeriods.map((p) => ({ id: p.id, label: p.label })))}
                {iraPeriods.length > 1 && ' (média dos períodos por disciplina)'}
              </p>
              {ira && ira.missingGradeCount > 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  {ira.missingGradeCount} disciplina(s) selecionada(s) sem nota — consideradas 0,00 no IRA
                </p>
              )}
            </div>
            <Collapsible open={showBreakdown} onOpenChange={setShowBreakdown}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm">
                  Ver composição
                  <ChevronDown className={cn('w-4 h-4 ml-2 transition-transform', showBreakdown && 'rotate-180')} />
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          </div>

          {ira && ira.status !== 'ok' && (
            <Alert className="mt-3">
              <Info className="w-4 h-4" />
              <AlertDescription className="text-xs">{ira.reason}</AlertDescription>
            </Alert>
          )}

          {showBreakdown && ira && (
            <div className="mt-4 pt-4 border-t">
              <IRABreakdown ira={ira} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notas por disciplina e período */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap className="w-4 h-4" />
            Notas por disciplina
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="py-2 pr-3">Disciplina</th>
                  {data.periods.map((p) => (
                    <th
                      key={p.id}
                      className={cn(
                        'py-2 px-2 text-center whitespace-nowrap',
                        selectedPeriodIds.has(p.id) && 'text-primary font-semibold',
                      )}
                    >
                      {p.label}
                      {selectedPeriodIds.has(p.id) && <span className="ml-1 text-[10px]">(IRA)</span>}
                    </th>
                  ))}
                  <th className="py-2 pl-2 text-center">Peso IRA</th>
                </tr>
              </thead>
              <tbody>
                {data.subjects.map((subject) => {
                  const mapped = subject.mapping_class_subject_id
                    ? data.currentWeeklyClasses[subject.mapping_class_subject_id]
                    : undefined;
                  const weekly = mapped
                    ?? subject.weekly_classes
                    ?? data.matrixWeeklyByKey?.[canonicalSubjectKey(subject.name)]
                    ?? null;
                  return (
                    <tr key={subject.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium">
                        {subject.name}
                        {!subject.include_in_ira && (
                          <Badge variant="outline" className="ml-2 text-[10px]">fora do IRA</Badge>
                        )}
                      </td>
                      {data.periods.map((period) => {
                        const grade = gradeMap.get(`${subject.id}||${period.id}`);
                        const lowConfidence = grade?.flags?.includes('low_confidence');
                        return (
                          <td key={period.id} className="py-2 px-2 text-center">
                            {grade && grade.value != null ? (
                              <span className={cn('font-medium', lowConfidence && 'text-amber-600')}>
                                {formatGrade(grade.value)}
                                {grade.source === 'manual' && <span className="text-[10px] text-muted-foreground ml-1">(m)</span>}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-2 pl-2 text-center text-muted-foreground">
                        {weekly != null ? `${weekly} aula(s)` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            “—” = Não informado no boletim. “(m)” = nota corrigida manualmente na revisão da importação.
            Colunas marcadas com “(IRA)” são os períodos usados no cálculo; disciplinas selecionadas sem nota
            nesses períodos entram como 0,00 apenas no IRA.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};