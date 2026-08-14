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

interface ClassRow {
  id: string;
  name: string;
  shift: string;
  mapping_class_id: string | null;
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
}

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const IRASettings = () => {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [mappingClasses, setMappingClasses] = useState<MappingClassRow[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [periodId, setPeriodId] = useState<string>('');
  const [useFinal, setUseFinal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingClass, setLoadingClass] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedClass = useMemo(() => classes.find((c) => c.id === selectedClassId) ?? null, [classes, selectedClassId]);

  useEffect(() => {
    (async () => {
      const [classesRes, mappingRes] = await Promise.all([
        supabase.from('classes').select('id, name, shift, mapping_class_id').order('name'),
        supabase.from('mapping_classes').select('id, name, shift').order('name'),
      ]);
      setClasses((classesRes.data || []) as unknown as ClassRow[]);
      setMappingClasses((mappingRes.data || []) as unknown as MappingClassRow[]);
      setLoading(false);
    })();
  }, []);

  const loadClassData = useCallback(async (classId: string) => {
    setLoadingClass(true);
    const [subjRes, perRes, settingsRes] = await Promise.all([
      supabase.from('grade_subjects').select('id, name, weekly_classes, include_in_ira, custom_ira_weight, mapping_class_subject_id').eq('class_id', classId).order('sort_order'),
      supabase.from('grade_periods').select('id, label, kind').eq('class_id', classId).order('sort_order'),
      supabase.from('ira_settings').select('*').eq('class_id', classId).maybeSingle(),
    ]);
    setSubjects((subjRes.data || []) as unknown as SubjectRow[]);
    setPeriods((perRes.data || []) as unknown as PeriodRow[]);
    const settings = settingsRes.data as { ira_period_id: string | null; use_final_grade: boolean } | null;
    setPeriodId(settings?.ira_period_id ?? '');
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

  const updateSubject = async (subject: SubjectRow, patch: Partial<SubjectRow>) => {
    setSubjects((prev) => prev.map((s) => (s.id === subject.id ? { ...s, ...patch } : s)));
    const { error } = await supabase.from('grade_subjects').update(patch as never).eq('id', subject.id);
    if (error) {
      toast.error('Não foi possível salvar a alteração.');
      loadClassData(selectedClassId);
    }
  };

  const savePeriodSettings = async () => {
    if (!selectedClassId) return;
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('ira_settings').upsert({
      class_id: selectedClassId,
      ira_period_id: useFinal ? null : (periodId || null),
      use_final_grade: useFinal,
      updated_by: userData?.user?.id ?? null,
    }, { onConflict: 'class_id' });
    setSaving(false);
    if (error) {
      toast.error('Não foi possível salvar a configuração.');
      return;
    }
    toast.success('Configuração do IRA salva. O IRA é recalculado automaticamente.');
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
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              <div className="space-y-2">
                <Label>Nota usada no IRA</Label>
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={useFinal ? 'final' : periodId} onValueChange={(v) => {
                    if (v === 'final') { setUseFinal(true); setPeriodId(''); }
                    else { setUseFinal(false); setPeriodId(v); }
                  }}>
                    <SelectTrigger className="max-w-xs"><SelectValue placeholder="Selecione o período" /></SelectTrigger>
                    <SelectContent>
                      {hasFinalPeriod && <SelectItem value="final">Nota Final do boletim</SelectItem>}
                      {periods.filter((p) => p.kind !== 'final').map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={savePeriodSettings} disabled={saving}>
                    {saving && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
                    Salvar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Todas as notas de todos os períodos continuam preservadas — a configuração apenas define qual delas entra no IRA.
                </p>
              </div>

              <Alert>
                <Info className="w-4 h-4" />
                <AlertTitle className="text-sm">Regra das notas não lançadas</AlertTitle>
                <AlertDescription className="text-xs">
                  Quando a nota do período selecionado estiver em branco no boletim, ela será considerada
                  <strong> 0,00 </strong>no cálculo do IRA até que a nota seja lançada. A nota original do boletim
                  não é alterada: na aba “Notas” a célula vazia continua aparecendo como “— (não informado)”.
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
                              Participa do IRA · nota em branco no período escolhido = 0,00 no cálculo
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
    </div>
  );
};

export default IRASettings;