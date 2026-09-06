/**
 * Medalhas de desempenho — configuração POR ESCOLA.
 *
 * As disciplinas oferecidas vêm EXCLUSIVAMENTE da matriz curricular da escola
 * ativa (`curriculum_matrix_subjects`), referenciadas por ID estrutural.
 * Alterar/excluir medalha nunca apaga notas nem snapshots: só muda a
 * configuração da disputa (o recálculo é sempre explícito).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Medal, Pencil, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useActiveSchoolId, useSchoolScopeKey } from '@/contexts/SchoolContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import { fetchSchoolMedals, MedalDefinitionRecord } from '@/lib/medals/definitions';
import { AcademicMedal } from '@/components/students/AcademicMedal';
import { classSeriesLabel, parseSeriesValue, seriesSortIndex } from '@/lib/series';

interface MatrixComponentOption {
  id: string;
  name: string;
  series: string;
}

const emptyForm = { name: '', symbol: '🏅', description: '', active: true };

const MedalsSettings = () => {
  const activeSchoolId = useActiveSchoolId();
  const schoolScopeKey = useSchoolScopeKey();
  const { can } = usePermissions();
  const canEdit = can('ira.configure');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [medals, setMedals] = useState<MedalDefinitionRecord[]>([]);
  const [components, setComponents] = useState<MatrixComponentOption[]>([]);
  const [matrixName, setMatrixName] = useState<string>('');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MedalDefinitionRecord | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selection, setSelection] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!activeSchoolId) {
      setMedals([]); setComponents([]); setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: schoolRow, error: schoolErr } = await supabase
        .from('schools')
        .select('curriculum_matrix_id, curriculum_matrices!schools_curriculum_matrix_id_fkey(name)')
        .eq('id', activeSchoolId)
        .maybeSingle();
      if (schoolErr) throw schoolErr;
      const matrixId = (schoolRow as { curriculum_matrix_id: string | null } | null)?.curriculum_matrix_id ?? null;
      setMatrixName(
        ((schoolRow as { curriculum_matrices?: { name: string } | null } | null)?.curriculum_matrices?.name) ?? '',
      );

      const [compRes, list] = await Promise.all([
        matrixId
          ? supabase.from('curriculum_matrix_subjects')
            .select('id, series, mapping_global_subjects(name)')
            .eq('school_id', activeSchoolId)
            .eq('matrix_id', matrixId)
          : Promise.resolve({ data: [], error: null }),
        fetchSchoolMedals(activeSchoolId),
      ]);
      if (compRes.error) throw compRes.error;
      const options = ((compRes.data || []) as unknown as {
        id: string; series: string; mapping_global_subjects: { name: string } | null;
      }[])
        .map((r) => ({ id: r.id, series: r.series, name: r.mapping_global_subjects?.name ?? '' }))
        .filter((r) => r.name)
        .sort((a, b) => seriesSortIndex(parseSeriesValue(a.series) ?? '1')
          - seriesSortIndex(parseSeriesValue(b.series) ?? '1')
          || a.name.localeCompare(b.name));
      setComponents(options);
      setMedals(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível carregar as medalhas.');
    } finally {
      setLoading(false);
    }
  }, [activeSchoolId, schoolScopeKey]);

  useEffect(() => { load(); }, [load]);

  const componentsBySeries = useMemo(() => {
    const map = new Map<string, MatrixComponentOption[]>();
    components.forEach((c) => map.set(c.series, [...(map.get(c.series) || []), c]));
    return [...map.entries()];
  }, [components]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setSelection(new Set());
    setOpen(true);
  };

  const openEdit = (medal: MedalDefinitionRecord) => {
    setEditing(medal);
    setForm({
      name: medal.name,
      symbol: medal.symbol,
      description: medal.description ?? '',
      active: medal.active,
    });
    setSelection(new Set(medal.subjects.map((s) => s.matrixSubjectId)));
    setOpen(true);
  };

  const toggle = (id: string, checked: boolean) =>
    setSelection((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });

  const handleSave = async () => {
    if (!activeSchoolId) return;
    if (!form.name.trim()) {
      toast.error('Informe o nome da medalha.');
      return;
    }
    if (selection.size === 0) {
      toast.error('Selecione ao menos uma disciplina da matriz da escola.');
      return;
    }
    setSaving(true);
    try {
      let medalId = editing?.id ?? '';
      if (editing) {
        const { error } = await supabase.from('medal_definitions').update({
          name: form.name.trim(),
          symbol: form.symbol.trim() || '🏅',
          description: form.description.trim() || null,
          active: form.active,
        }).eq('school_id', activeSchoolId).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('medal_definitions').insert({
          school_id: activeSchoolId,
          name: form.name.trim(),
          symbol: form.symbol.trim() || '🏅',
          description: form.description.trim() || null,
          active: form.active,
          sort_order: medals.length,
        }).select('id').single();
        if (error) throw error;
        medalId = (data as { id: string }).id;
      }

      // Vínculos: apaga apenas as associações (notas e snapshots ficam intactos).
      const { error: delErr } = await supabase.from('medal_definition_subjects')
        .delete().eq('school_id', activeSchoolId).eq('medal_id', medalId);
      if (delErr) throw delErr;
      const { error: insErr } = await supabase.from('medal_definition_subjects').insert(
        [...selection].map((matrixSubjectId) => ({
          school_id: activeSchoolId,
          medal_id: medalId,
          matrix_subject_id: matrixSubjectId,
        })),
      );
      if (insErr) throw insErr;

      toast.success(editing ? 'Medalha atualizada.' : 'Medalha criada.');
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar a medalha.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (medal: MedalDefinitionRecord) => {
    if (!activeSchoolId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('medal_definitions')
        .delete().eq('school_id', activeSchoolId).eq('id', medal.id);
      if (error) throw error;
      toast.success(`${medal.name} removida. Notas e resultados já registrados foram preservados.`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível remover a medalha.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Medal className="w-4 h-4" />
              Medalhas de desempenho
            </CardTitle>
            <CardDescription>
              Cada medalha premia o melhor aluno da série nas disciplinas escolhidas.
              As disciplinas vêm da matriz curricular da escola
              {matrixName ? ` (${matrixName})` : ''}.
            </CardDescription>
          </div>
          {canEdit && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" />
              Nova medalha
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && (
          <div className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>
        )}

        {!loading && components.length === 0 && (
          <Alert>
            <AlertDescription className="text-xs">
              A escola ainda não tem uma matriz curricular com disciplinas. Defina a matriz da escola
              antes de configurar as medalhas.
            </AlertDescription>
          </Alert>
        )}

        {!loading && medals.length === 0 && components.length > 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhuma medalha configurada. Crie a primeira para começar a premiar os melhores alunos.
          </p>
        )}

        {!loading && medals.map((medal) => (
          <div key={medal.id} className="rounded-md border p-3 flex flex-col sm:flex-row gap-3">
            <AcademicMedal areaId={medal.id} size={34} symbol={medal.symbol} />
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{medal.name}</p>
                {!medal.active && <Badge variant="outline">inativa</Badge>}
                <Badge variant="secondary">{medal.subjects.length} disciplina(s)</Badge>
              </div>
              {medal.description && <p className="text-xs text-muted-foreground">{medal.description}</p>}
              <p className="text-xs text-muted-foreground">
                {medal.subjects.map((s) => s.name).join(', ') || 'Nenhuma disciplina vinculada'}
              </p>
            </div>
            {canEdit && (
              <div className="flex items-start gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(medal)} disabled={saving}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDelete(medal)} disabled={saving}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            )}
          </div>
        ))}

        <p className="text-xs text-muted-foreground">
          Alterações aqui não apagam notas nem resultados já calculados. Use “Atualizar IRA” para
          aplicar a nova configuração às condecorações.
        </p>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-2xl"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar medalha' : 'Nova medalha'}</DialogTitle>
            <DialogDescription>
              Escolha o nome, o símbolo e as disciplinas da matriz da escola que compõem a medalha.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
              <div className="space-y-2">
                <Label htmlFor="medal-name">Nome</Label>
                <Input id="medal-name" value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex.: Linguagens" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="medal-symbol">Símbolo</Label>
                <Input id="medal-symbol" value={form.symbol} maxLength={4}
                  onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="medal-desc">Descrição (opcional)</Label>
              <Textarea id="medal-desc" rows={2} value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.active}
                onCheckedChange={(c) => setForm((f) => ({ ...f, active: !!c }))} />
              Medalha ativa (participa das condecorações)
            </label>

            <div className="space-y-2">
              <Label>Disciplinas da matriz da escola ({selection.size} selecionada(s))</Label>
              <ScrollArea className="h-64 rounded-md border p-3">
                <div className="space-y-4">
                  {componentsBySeries.map(([series, list]) => (
                    <div key={series} className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {classSeriesLabel(parseSeriesValue(series)) || series}
                      </p>
                      {list.map((c) => (
                        <label key={c.id} className="flex items-center gap-2 text-sm">
                          <Checkbox checked={selection.has(c.id)}
                            onCheckedChange={(checked) => toggle(c.id, !!checked)} />
                          {c.name}
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar medalha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default MedalsSettings;
