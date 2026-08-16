import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Calculator, AlertTriangle, Link2, Info } from 'lucide-react';
import { isAutoWeightEligible, resolveWeight, weightForWeeklyClasses } from '@/lib/ira';
import { cn } from '@/lib/utils';
import IraRankingExport from '@/components/settings/IraRankingExport';
import { useAuth } from '@/contexts/AuthContext';
import {
  CLASS_SERIES_OPTIONS, HighSchoolSeries, classSeriesLabel, detectClassSeries, parseClassSeries,
} from '@/lib/iraRanking';
import {
  fetchCurriculumMatrix, findMatrixWeeklyDivergences, selectMissingMatrixSubjects,
} from '@/lib/curriculumMatrix';

interface ClassRow {
  id: string;
  name: string;
  shift: string;
  mapping_class_id: string | null;
  /** Série estruturada do Ensino Médio ('1' | '2' | '3') ou null quando não definida. */
  series: string | null;
}

interface MappingClassRow {
  id: string;
  name: string;
  shift: string;
}

interface SubjectRow {
  id: string;
  name: string;
  weekly_classes: number | null;
  include_in_ira: boolean;
  custom_ira_weight: number | null;
  mapping_class_subject_id: string | null;
}

interface PeriodRow {
  id: string;
  label: string;
  kind: string;
  normalized_label?: string;
}

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const IRASettings = () => {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const { userRole } = useAuth();
  const canEditSeries = userRole === 'admin' || userRole === 'direction';
  const [savingSeries, setSavingSeries] = useState(false);
  const [applyingMatrix, setApplyingMatrix] = useState(false);
  const [mappingClasses, setMappingClasses] = useState<MappingClassRow[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [selectedPeriodIds, setSelectedPeriodIds] = useState<string[]>([]);
  const [useFinal, setUseFinal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingClass, setLoadingClass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applyingAll, setApplyingAll] = useState(false);
  /** class_id -> possui boletim importado (grade_subjects) */
  const [classesWithGrades, setClassesWithGrades] = useState<Set<string>>(new Set());
  /** class_id -> possui configuração de IRA salva */
  const [configuredClasses, setConfiguredClasses] = useState<Set<string>>(new Set());

  const selectedClass = useMemo(() => classes.find((c) => c.id === selectedClassId) ?? null, [classes, selectedClassId]);

  useEffect(() => {
    (async () => {
      const [classesRes, mappingRes, subjRes, settingsRes] = await Promise.all([
        supabase.from('classes').select('id, name, shift, mapping_class_id, series').order('name'),
        supabase.from('mapping_classes').select('id, name, shift').order('name'),
        supabase.from('grade_subjects').select('class_id'),
        supabase.from('ira_settings').select('class_id'),
      ]);
      setClasses((classesRes.data || []) as unknown as ClassRow[]);
      setMappingClasses((mappingRes.data || []) as unknown as MappingClassRow[]);
      setClassesWithGrades(new Set(((subjRes.data || []) as { class_id: string }[]).map((r) => r.class_id)));
      setConfiguredClasses(new Set(((settingsRes.data || []) as { class_id: string }[]).map((r) => r.class_id)));
      setLoading(false);
    })();
  }, []);

  const loadClassData = useCallback(async (classId: string) => {
    setLoadingClass(true);
    const [subjRes, perRes, settingsRes] = await Promise.all([
      supabase.from('grade_subjects').select('id, name, weekly_classes, include_in_ira, custom_ira_weight, mapping_class_subject_id').eq('class_id', classId).order('sort_order'),
      supabase.from('grade_periods').select('id, label, kind, normalized_label').eq('class_id', classId).order('sort_order'),
      supabase.from('ira_settings').select('*').eq('class_id', classId).maybeSingle(),
    ]);
    setSubjects((subjRes.data || []) as unknown as SubjectRow[]);
    setPeriods((perRes.data || []) as unknown as PeriodRow[]);
    const settings = settingsRes.data as {
      ira_period_id: string | null;
      ira_period_ids: string[] | null;
      use_final_grade: boolean;
    } | null;
    const ids = settings?.ira_period_ids && settings.ira_period_ids.length > 0
      ? settings.ira_period_ids
      : settings?.ira_period_id ? [settings.ira_period_id] : [];
    setSelectedPeriodIds(ids);
    setUseFinal(settings?.use_final_grade ?? false);
    setLoadingClass(false);
  }, []);

  useEffect(() => {
    if (selectedClassId) loadClassData(selectedClassId);
  }, [selectedClassId, loadClassData]);

  const suggestedMapping = useMemo(() => {
    if (!selectedClass || selectedClass.mapping_class_id) return null;
    return mappingClasses.find(
      (m) => normalize(m.name) === normalize(selectedClass.name) && m.shift === selectedClass.shift,
    ) ?? mappingClasses.find((m) => normalize(m.name) === normalize(selectedClass.name)) ?? null;
  }, [selectedClass, mappingClasses]);

  const confirmMapping = async (mappingClassId: string) => {
    if (!selectedClass) return;
    setSaving(true);
    const { error } = await supabase.from('classes').update({ mapping_class_id: mappingClassId }).eq('id', selectedClass.id);
    setSaving(false);
    if (error) {
      toast.error('Não foi possível vincular a turma.');
      return;
    }
    setClasses((prev) => prev.map((c) => (c.id === selectedClass.id ? { ...c, mapping_class_id: mappingClassId } : c)));
    toast.success('Turma vinculada ao mapeamento escolar.');
    await syncWeeklyClasses(mappingClassId);
  };

  const syncWeeklyClasses = async (mappingClassId: string) => {
    if (!selectedClassId) return;
    const { data } = await supabase
      .from('mapping_class_subjects')
      .select('id, subject_name, weekly_classes')
      .eq('class_id', mappingClassId);
    const mapping = (data || []) as { id: string; subject_name: string; weekly_classes: number }[];
    if (mapping.length === 0 || subjects.length === 0) return;

    const updates = subjects.map((s) => {
      const match = mapping.find((m) => normalize(m.subject_name) === normalize(s.name));
      if (!match) return null;
      return { id: s.id, mapping_class_subject_id: match.id, weekly_classes: match.weekly_classes };
    }).filter(Boolean) as { id: string; mapping_class_subject_id: string; weekly_classes: number }[];

    await Promise.all(updates.map((u) =>
      supabase.from('grade_subjects')
        .update({ mapping_class_subject_id: u.mapping_class_subject_id, weekly_classes: u.weekly_classes })
        .eq('id', u.id)));
    if (updates.length > 0) {
      toast.success(`${updates.length} disciplina(s) sincronizada(s) com a carga semanal atual.`);
      loadClassData(selectedClassId);
    }
  };

  /** Salva a série estruturada da turma (apenas Admin/Direção). */
  const saveSeries = async (value: HighSchoolSeries) => {
    if (!selectedClass) return;
    setSavingSeries(true);
    const { error } = await supabase.from('classes').update({ series: value } as never).eq('id', selectedClass.id);
    setSavingSeries(false);
    if (error) {
      toast.error('Não foi possível salvar a série da turma.');
      return;
    }
    setClasses((prev) => prev.map((c) => (c.id === selectedClass.id ? { ...c, series: value } : c)));
    toast.success(`Série definida: ${classSeriesLabel(value)}.`);
  };

  /**
   * Herança da matriz curricular OFICIAL da série (`curriculum_matrix_subjects`):
   * cria no mapeamento da turma os componentes da série que ainda não existem, com a
   * carga semanal DAQUELA SÉRIE. Nunca remove nem sobrescreve disciplinas existentes —
   * divergências de carga são apenas relatadas.
   */
  const applySeriesMatrix = async () => {
    if (!selectedClass?.mapping_class_id) return;
    const series = parseClassSeries(selectedClass.series);
    if (!series) {
      toast.error('Defina a série da turma antes de aplicar a matriz padrão.');
      return;
    }
    setApplyingMatrix(true);
    try {
      const [matrix, { data: existing }] = await Promise.all([
        fetchCurriculumMatrix(series),
        supabase.from('mapping_class_subjects')
          .select('subject_name, weekly_classes').eq('class_id', selectedClass.mapping_class_id),
      ]);
      const label = classSeriesLabel(series);
      const rows = (existing || []) as { subject_name: string; weekly_classes: number | null }[];
      // Só ADICIONA o que falta: disciplinas extras e cargas horárias da turma são preservadas.
      const missing = selectMissingMatrixSubjects(matrix, rows);
      const divergences = findMatrixWeeklyDivergences(matrix, rows);
      if (divergences.length > 0) {
        toast.warning(
          `${divergences.length} disciplina(s) com carga diferente da matriz de ${label} — ` +
          'a configuração atual da turma foi preservada: ' +
          divergences.slice(0, 4).map((d) => `${d.name} (${d.current ?? '—'} ≠ ${d.expected})`).join(', '),
        );
      }
      if (missing.length === 0) {
        toast.info('A matriz da turma já contém todas as disciplinas padrão da série.');
        return;
      }
      const { error } = await supabase.from('mapping_class_subjects').insert(
        missing.map((c) => ({
          class_id: selectedClass.mapping_class_id as string,
          subject_name: c.name,
          weekly_classes: c.weekly_classes,
        })),
      );
      if (error) throw error;
      toast.success(`${missing.length} disciplina(s) da matriz de ${label} adicionada(s) à turma.`);
      loadClassData(selectedClassId);
    } catch (e) {
      toast.error('Não foi possível aplicar a matriz padrão da série.');
    } finally {
      setApplyingMatrix(false);
    }
  };

  const updateSubject = async (subject: SubjectRow, patch: Partial<SubjectRow>) => {
    setSubjects((prev) => prev.map((s) => (s.id === subject.id ? { ...s, ...patch } : s)));
    const { error } = await supabase.from('grade_subjects').update(patch as never).eq('id', subject.id);
    if (error) {
      toast.error('Não foi possível salvar a alteração.');
      loadClassData(selectedClassId);
    }
  };

  const togglePeriod = (id: string, checked: boolean) => {
    setUseFinal(false);
    setSelectedPeriodIds((prev) => (checked ? [...new Set([...prev, id])] : prev.filter((p) => p !== id)));
  };

  const orderedSelectedPeriods = useMemo(
    () => periods.filter((p) => selectedPeriodIds.includes(p.id)),
    [periods, selectedPeriodIds],
  );

  const savePeriodSettings = async () => {
    if (!selectedClassId) return;
    if (!useFinal && selectedPeriodIds.length === 0) {
      toast.error('Selecione ao menos um período (ou a Nota Final) para o IRA.');
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const ids = useFinal ? [] : selectedPeriodIds;
    const { error } = await supabase.from('ira_settings').upsert({
      class_id: selectedClassId,
      ira_period_ids: ids,
      ira_period_id: ids[0] ?? null,
      use_final_grade: useFinal,
      updated_by: userData?.user?.id ?? null,
    }, { onConflict: 'class_id' });
    setSaving(false);
    if (error) {
      toast.error('Não foi possível salvar a configuração.');
      return;
    }
    setConfiguredClasses((prev) => new Set([...prev, selectedClassId]));
    toast.success('Configuração do IRA salva. O IRA é recalculado automaticamente.');
  };

  /** Replica a configuração atual para TODAS as turmas com boletim, casando períodos por rótulo. */
  const applyToAllClasses = async () => {
    if (!selectedClassId) return;
    if (!useFinal && orderedSelectedPeriods.length === 0) {
      toast.error('Selecione ao menos um período antes de aplicar a todas as turmas.');
      return;
    }
    setApplyingAll(true);
    try {
      const targetIds = classes.map((c) => c.id).filter((id) => classesWithGrades.has(id));
      const { data: allPeriods, error: perErr } = await supabase
        .from('grade_periods')
        .select('id, class_id, label, kind, normalized_label')
        .in('class_id', targetIds);
      if (perErr) throw perErr;
      const rows = (allPeriods || []) as unknown as (PeriodRow & { class_id: string })[];
      const wantedLabels = orderedSelectedPeriods.map((p) => normalize(p.label));

      const { data: userData } = await supabase.auth.getUser();
      const payload: Record<string, unknown>[] = [];
      const skipped: string[] = [];
      targetIds.forEach((classId) => {
        const classPeriods = rows.filter((r) => r.class_id === classId);
        if (useFinal) {
          const hasFinal = classPeriods.some((p) => p.kind === 'final');
          if (!hasFinal) { skipped.push(classId); return; }
          payload.push({
            class_id: classId, ira_period_ids: [], ira_period_id: null,
            use_final_grade: true, updated_by: userData?.user?.id ?? null,
          });
          return;
        }
        const ids = wantedLabels
          .map((label) => classPeriods.find((p) => normalize(p.label) === label)?.id)
          .filter(Boolean) as string[];
        if (ids.length === 0) { skipped.push(classId); return; }
        payload.push({
          class_id: classId, ira_period_ids: ids, ira_period_id: ids[0],
          use_final_grade: false, updated_by: userData?.user?.id ?? null,
        });
      });

      if (payload.length === 0) {
        toast.error('Nenhuma turma compatível encontrada para aplicar a configuração.');
        return;
      }
      const { error } = await supabase.from('ira_settings').upsert(payload as never, { onConflict: 'class_id' });
      if (error) throw error;
      setConfiguredClasses((prev) => new Set([...prev, ...payload.map((p) => p.class_id as string)]));
      toast.success(
        `Configuração aplicada a ${payload.length} turma(s).` +
        (skipped.length > 0 ? ` ${skipped.length} turma(s) sem períodos equivalentes foram ignoradas.` : ''),
      );
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível aplicar a configuração a todas as turmas.');
    } finally {
      setApplyingAll(false);
    }
  };

  const hasFinalPeriod = periods.some((p) => p.kind === 'final');

  if (loading) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calculator className="w-4 h-4" />
            Configuração do IRA
          </CardTitle>
          <CardDescription>
            Escolha a turma, as disciplinas participantes e o período/nota usada no cálculo.
            Peso automático: 1 aula = 1, 2 aulas = 2, 4 aulas = 4. Alterações não apagam notas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-sm">
            <Label>Turma</Label>
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger><SelectValue placeholder="Selecione a turma" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {!classesWithGrades.has(c.id) && ' — sem boletim'}
                    {classesWithGrades.has(c.id) && !configuredClasses.has(c.id) && ' — IRA não configurado'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {classes.length} turma(s) cadastradas · {classesWithGrades.size} com boletim importado ·{' '}
              {[...classesWithGrades].filter((id) => configuredClasses.has(id)).length} com IRA configurado.
            </p>
          </div>

          {selectedClass && (
            <div className="flex items-center gap-2 text-sm">
              <Link2 className="w-4 h-4 text-muted-foreground" />
              {selectedClass.mapping_class_id ? (
                <span className="text-muted-foreground">
                  Vinculada ao mapeamento escolar:{' '}
                  <strong>{mappingClasses.find((m) => m.id === selectedClass.mapping_class_id)?.name ?? 'turma do mapeamento'}</strong>
                </span>
              ) : (
                <span className="text-amber-600">Turma sem vínculo com o mapeamento escolar</span>
              )}
            </div>
          )}

          {selectedClass && (
            <div className="rounded-md border p-3 space-y-2 max-w-md">
              <Label htmlFor="class-series">
                Série da turma <span className="text-destructive">*</span>
              </Label>
              <Select
                value={parseClassSeries(selectedClass.series) ?? undefined}
                onValueChange={(v) => saveSeries(v as HighSchoolSeries)}
                disabled={!canEditSeries || savingSeries}
              >
                <SelectTrigger id="class-series">
                  <SelectValue placeholder="Selecione a série do Ensino Médio" />
                </SelectTrigger>
                <SelectContent>
                  {CLASS_SERIES_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {parseClassSeries(selectedClass.series) ? (
                  <Badge variant="secondary">Série: {classSeriesLabel(parseClassSeries(selectedClass.series))}</Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-600 border-amber-500">Série não definida</Badge>
                )}
                {savingSeries && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
              </div>
              {!parseClassSeries(selectedClass.series) && (
                <p className="text-xs text-amber-600">
                  Turmas sem série não participam do Ranking do IRA.
                  {detectClassSeries(selectedClass.name)
                    ? ` Sugestão pelo nome da turma: ${classSeriesLabel(detectClassSeries(selectedClass.name))} — confirme escolhendo acima.`
                    : ''}
                </p>
              )}
              {!canEditSeries && (
                <p className="text-xs text-muted-foreground">
                  Apenas administração e direção podem alterar a série da turma.
                </p>
              )}
              {canEditSeries && parseClassSeries(selectedClass.series) && selectedClass.mapping_class_id && (
                <div className="space-y-1 pt-1">
                  <Button size="sm" variant="outline" onClick={applySeriesMatrix} disabled={applyingMatrix}>
                    {applyingMatrix && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                    Aplicar matriz padrão da série
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Adiciona à turma as disciplinas do catálogo vinculadas a esta série. Nada é removido ou
                    sobrescrito — a matriz serve de âncora na leitura dos boletins em PDF.
                  </p>
                </div>
              )}
            </div>
          )}

          {selectedClass && !selectedClass.mapping_class_id && (
            <Alert>
              <Info className="w-4 h-4" />
              <AlertTitle className="text-sm">Confirmar vínculo com o mapeamento escolar</AlertTitle>
              <AlertDescription className="text-xs space-y-2">
                {suggestedMapping ? (
                  <>
                    <p>
                      Sugestão por nome e turno: <strong>{suggestedMapping.name}</strong> ({suggestedMapping.shift}).
                      O vínculo só é criado após a sua confirmação.
                    </p>
                    <Button size="sm" disabled={saving} onClick={() => confirmMapping(suggestedMapping.id)}>
                      Confirmar vínculo
                    </Button>
                  </>
                ) : (
                  <div className="space-y-2">
                    <p>Nenhuma sugestão automática. Escolha manualmente a turma do mapeamento escolar:</p>
                    <Select onValueChange={confirmMapping}>
                      <SelectTrigger className="max-w-sm h-8"><SelectValue placeholder="Selecionar turma do mapeamento" /></SelectTrigger>
                      <SelectContent>
                        {mappingClasses.map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.name} — {m.shift}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {loadingClass && (
            <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>
          )}

          {selectedClassId && !loadingClass && subjects.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum boletim importado para esta turma. Importe um boletim em Turmas → “Inserir boletim da turma”.
            </p>
          )}

          {selectedClassId && !loadingClass && subjects.length > 0 && (
            <>
              <div className="space-y-3">
                <Label>Notas usadas no IRA (pode selecionar mais de um período)</Label>
                <div className="rounded-md border p-3 space-y-2">
                  {hasFinalPeriod && (
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={useFinal}
                        onCheckedChange={(checked) => {
                          setUseFinal(!!checked);
                          if (checked) setSelectedPeriodIds([]);
                        }}
                      />
                      Nota Final do boletim (ignora a seleção de bimestres)
                    </label>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {periods.filter((p) => p.kind !== 'final').map((p) => (
                      <label
                        key={p.id}
                        className={cn('flex items-center gap-2 text-sm', useFinal && 'opacity-50')}
                      >
                        <Checkbox
                          disabled={useFinal}
                          checked={selectedPeriodIds.includes(p.id)}
                          onCheckedChange={(checked) => togglePeriod(p.id, !!checked)}
                        />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={savePeriodSettings} disabled={saving}>
                    {saving && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
                    Salvar para esta turma
                  </Button>
                  <Button size="sm" variant="outline" onClick={applyToAllClasses} disabled={applyingAll}>
                    {applyingAll && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
                    Aplicar a todas as turmas
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Com mais de um período selecionado, a nota de cada disciplina é a{' '}
                  <strong>média aritmética</strong> dos períodos escolhidos
                  {orderedSelectedPeriods.length > 0 && !useFinal && (
                    <> ({orderedSelectedPeriods.map((p) => p.label).join(' + ')})</>
                  )}
                  . Todas as notas do boletim continuam preservadas — a configuração só define o que entra no IRA.
                  “Aplicar a todas as turmas” casa os períodos pelo rótulo (ex.: “1º Período”) em cada turma com boletim.
                </p>
              </div>

              <Alert>
                <Info className="w-4 h-4" />
                <AlertTitle className="text-sm">Regra das notas não lançadas</AlertTitle>
                <AlertDescription className="text-xs">
                  Quando a nota de um período selecionado estiver em branco no boletim, ela será considerada
                  <strong> 0,00 </strong>na média daquela disciplina até que a nota seja lançada. A nota original do
                  boletim não é alterada: na aba “Notas” a célula vazia continua aparecendo como “— (não informado)”.
                </AlertDescription>
              </Alert>

              <div className="rounded-md border divide-y">
                {subjects.map((subject) => {
                  const autoEligible = isAutoWeightEligible(subject.weekly_classes);
                  const { weight, source } = resolveWeight({
                    weeklyClasses: subject.weekly_classes,
                    customWeight: subject.custom_ira_weight,
                  });
                  return (
                    <div key={subject.id} className="p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Checkbox
                          checked={subject.include_in_ira}
                          onCheckedChange={(checked) => updateSubject(subject, { include_in_ira: !!checked })}
                        />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{subject.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Carga semanal: {subject.weekly_classes != null ? `${subject.weekly_classes} aula(s)` : 'não informada'}
                            {' · '}
                            Peso: {weight ?? '—'}
                            {source === 'custom' && ' (personalizado)'}
                          </p>
                          {subject.include_in_ira && (
                            <p className="text-[11px] text-amber-600 mt-0.5">
                              Participa do IRA · nota em branco em período selecionado = 0,00 no cálculo
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {autoEligible ? (
                          <Badge variant="outline">peso automático {weightForWeeklyClasses(subject.weekly_classes)}</Badge>
                        ) : (
                          <>
                            <Badge variant="secondary" className="bg-amber-500/15 text-amber-600 text-[11px]">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              carga fora de 1/2/4
                            </Badge>
                            <Input
                              type="number"
                              min={0}
                              step="0.5"
                              placeholder="peso"
                              className="h-8 w-20"
                              value={subject.custom_ira_weight ?? ''}
                              onChange={(e) => {
                                const raw = e.target.value;
                                updateSubject(subject, { custom_ira_weight: raw === '' ? null : Number(raw) });
                              }}
                            />
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Disciplinas com carga diferente de 1, 2 ou 4 aulas não entram automaticamente: informe um
                “peso personalizado” e marque “Participa do IRA” para incluí-las.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <IraRankingExport classes={classes} classesWithGrades={classesWithGrades} />
    </div>
  );
};

export default IRASettings;