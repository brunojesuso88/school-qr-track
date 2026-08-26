import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { CLASS_SERIES_OPTIONS, HighSchoolSeries, classSeriesLabel, parseSeriesValue } from '@/lib/series';
import { matrixWeeklyTotal } from '@/lib/curriculumMatrixCore';
import {
  ClassCurriculumState, describePlan, humanizeCurriculumError, inspectClassCurriculum, isPlanInSync,
  syncClassCurriculum,
} from '@/lib/classCurriculum/sync';


interface Props {
  classId: string;
  /** Liberado apenas quando a turma tem série definida e está sincronizada com a matriz. */
  onReadyChange: (ready: boolean) => void;
  onSynced?: () => void;
}

/**
 * Etapa OBRIGATÓRIA antes de importar um boletim: garantir que a turma tem série
 * e que suas disciplinas de notas herdam a matriz curricular oficial da série.
 */
export const ClassCurriculumGate = ({ classId, onReadyChange, onSynced }: Props) => {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [series, setSeries] = useState<HighSchoolSeries | ''>('');
  const [state, setState] = useState<ClassCurriculumState | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('classes').select('series').eq('id', classId).maybeSingle();
      if (error) throw error;
      const parsed = parseSeriesValue((data as { series?: string | null } | null)?.series ?? null);
      setSeries(parsed ?? '');
      const next = parsed ? await inspectClassCurriculum(classId, parsed) : null;
      setState(next);
      onReadyChange(Boolean(next && isPlanInSync(next.plan)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao verificar a matriz curricular da turma.');
      onReadyChange(false);
    } finally {
      setLoading(false);
    }
  }, [classId, onReadyChange]);

  useEffect(() => { load(); }, [load]);

  const handleSeriesChange = async (value: string) => {
    const parsed = parseSeriesValue(value);
    if (!parsed) return;
    setSeries(parsed);
    setSyncing(true);
    onReadyChange(false);
    try {
      const next = await inspectClassCurriculum(classId, parsed);
      setState(next);
    } finally {
      setSyncing(false);
    }
  };

  const handleSync = async () => {
    if (!series) return;
    setSyncing(true);
    try {
      const result = await syncClassCurriculum(classId, series);
      setState(result);
      onReadyChange(isPlanInSync(result.plan));
      const c = result.applied;
      toast.success(
        `Matriz do ${classSeriesLabel(series)} aplicada: ${c.created} criada(s), ${c.reused} reaproveitada(s), ` +
        `${c.updated} atualizada(s), ${c.consolidated} consolidada(s), ${c.excludedLegacy} legada(s) fora do IRA.`,
      );
      onSynced?.();
    } catch (e) {
      console.error('[ClassCurriculumGate] falha ao sincronizar', e);
      toast.error(humanizeCurriculumError(e));
      onReadyChange(false);
      await load();
    } finally {
      setSyncing(false);
    }
  };


  if (loading) {
    return (
      <div className="rounded-lg border p-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Verificando a matriz curricular da turma…
      </div>
    );
  }

  const inSync = Boolean(state && isPlanInSync(state.plan));
  const weeklyTotal = state ? matrixWeeklyTotal(state.matrix) : 0;

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Label className="text-sm font-medium">Série da turma e matriz curricular</Label>
        {inSync ? (
          <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-600/40">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Sincronizada
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-600/40">
            <AlertTriangle className="w-3 h-3 mr-1" /> Sincronização pendente
          </Badge>
        )}
      </div>

      <Select value={series} onValueChange={handleSeriesChange} disabled={syncing}>
        <SelectTrigger className="h-8 text-xs w-full sm:w-[320px]">
          <SelectValue placeholder="Selecione a série (obrigatório)" />
        </SelectTrigger>
        <SelectContent>
          {CLASS_SERIES_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!series && (
        <Alert>
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle className="text-sm">Série obrigatória</AlertTitle>
          <AlertDescription className="text-xs">
            Defina a série para que a turma herde as disciplinas oficiais da matriz curricular
            (1º ano = 28 aulas/semana; 2º e 3º anos = 30 aulas/semana). O boletim só pode ser importado depois disso.
          </AlertDescription>
        </Alert>
      )}

      {state && (
        <>
          <p className="text-[11px] text-muted-foreground">
            Matriz oficial do {classSeriesLabel(state.series)}: {state.matrix.length} componentes ·{' '}
            {weeklyTotal} aulas/semana. {describePlan(state.plan)}.
          </p>

          {!inSync && (
            <div className="space-y-2">
              {state.plan.gradeCreate.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Serão criadas: {state.plan.gradeCreate.map((g) => g.name).join(', ')}.
                </p>
              )}
              {state.plan.gradeEquivalentDuplicates.length > 0 && (
                <div className="text-[11px] text-sky-700 dark:text-sky-400 space-y-0.5">
                  <p>Disciplinas equivalentes encontradas. As nomenclaturas históricas serão consolidadas sem perda de notas:</p>
                  {state.plan.gradeEquivalentDuplicates.flatMap((group) =>
                    group.duplicates.map((d) => (
                      <p key={d.id} className="pl-2">
                        {d.name} → {group.canonicalName}
                        {d.hasGrades ? ' (com notas)' : ''}
                      </p>
                    )),
                  )}
                </div>
              )}
              {state.plan.gradeLegacy.length > 0 && (
                <p className="text-[11px] text-amber-600">
                  Fora da matriz da série (histórico preservado, oculto nas notas e no IRA):{' '}
                  {state.plan.gradeLegacy.map((g) => `${g.name}${g.hasGrades ? ' (com notas)' : ''}`).join(', ')}.
                </p>
              )}
              <Button size="sm" onClick={handleSync} disabled={syncing || !series}>
                {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                {state.plan.gradeEquivalentDuplicates.length > 0
                  ? 'Consolidar e sincronizar matriz'
                  : 'Aplicar matriz oficial da série'}
              </Button>
            </div>
          )}

        </>
      )}
    </div>
  );
};
