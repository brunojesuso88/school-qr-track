import { useCallback, useEffect, useMemo, useState } from "react";
import { Library, Loader2, Pencil, Plus, Trash2, Download, RefreshCw, Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import DashboardLayout from "@/components/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useActiveSchoolId, useSchoolScopeKey } from "@/contexts/SchoolContext";
import { supabase } from "@/integrations/supabase/client";
import { CLASS_SERIES_OPTIONS, HighSchoolSeries, classSeriesLabel, parseSeriesValue, seriesShortLabel } from "@/lib/series";
import { matrixWeeklyTotal } from "@/lib/curriculumMatrixCore";
import {
  CurriculumMatrixRecord, MatrixComponentRow, countClassesUsingMatrix, createCurriculumMatrix,
  ensureCatalogSubject, fetchMatrixComponents, fetchSchoolMatrices, importMatrixComponents,
} from "@/lib/curriculumMatrices";
import { humanizeCurriculumError, syncClassCurriculum } from "@/lib/classCurriculum/sync";

const parseAliases = (value: string) =>
  [...new Set(value.split(/[\n;,]+/).map((a) => a.trim()).filter(Boolean))];

interface ClassOption {
  id: string;
  name: string;
  series: HighSchoolSeries | null;
  curriculum_matrix_id: string | null;
}

const SubjectsContent = () => {
  const { toast } = useToast();
  const { can } = usePermissions();
  const activeSchoolId = useActiveSchoolId();
  const schoolScopeKey = useSchoolScopeKey();
  /** Fonte autoritativa continua o banco/RLS: aqui apenas espelhamos `subjects.manage`. */
  const canEdit = can("subjects.manage");

  const [loading, setLoading] = useState(true);
  const [matrices, setMatrices] = useState<CurriculumMatrixRecord[]>([]);
  const [matrixId, setMatrixId] = useState<string>("");
  const [items, setItems] = useState<MatrixComponentRow[]>([]);
  const [series, setSeries] = useState<HighSchoolSeries>("1");
  const [saving, setSaving] = useState(false);

  // Componente (criar/editar)
  const [editing, setEditing] = useState<MatrixComponentRow | null>(null);
  const [creatingComponent, setCreatingComponent] = useState(false);
  const [form, setForm] = useState({ name: "", abbreviation: "", aliases: "", weekly: "1", ira: true });

  // Nova matriz
  const [creatingMatrix, setCreatingMatrix] = useState(false);
  const [matrixForm, setMatrixForm] = useState({ name: "", description: "", copyFrom: "none" });

  // Importar de outra matriz
  const [importOpen, setImportOpen] = useState(false);
  const [importSource, setImportSource] = useState<string>("");
  const [importRows, setImportRows] = useState<MatrixComponentRow[]>([]);
  const [importSelection, setImportSelection] = useState<Set<string>>(new Set());

  // Sincronizar com turmas
  const [syncOpen, setSyncOpen] = useState(false);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classSelection, setClassSelection] = useState<Set<string>>(new Set());

  const activeMatrix = useMemo(() => matrices.find((m) => m.id === matrixId) ?? null, [matrices, matrixId]);
  /** Matrizes de média simples (ex.: Matriz Integral) não usam carga semanal no IRA. */
  const arithmeticIra = activeMatrix?.ira_calculation_mode === "arithmetic";
  /** Matriz Original e matrizes padrão do sistema não podem ser excluídas. */
  const matrixProtected = !!activeMatrix && (activeMatrix.is_original || !!activeMatrix.system_key);

  const loadMatrices = useCallback(async () => {
    if (!activeSchoolId) { setMatrices([]); setItems([]); setLoading(false); return; }
    try {
      const list = await fetchSchoolMatrices(activeSchoolId);
      setMatrices(list);
      setMatrixId((current) => (list.some((m) => m.id === current) ? current : list[0]?.id ?? ""));
    } catch {
      toast({ title: "Não foi possível carregar as matrizes curriculares", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [activeSchoolId, toast]);

  const loadComponents = useCallback(async () => {
    if (!activeSchoolId || !matrixId) { setItems([]); return; }
    try {
      setItems(await fetchMatrixComponents(matrixId, activeSchoolId));
    } catch {
      toast({ title: "Não foi possível carregar os componentes da matriz", variant: "destructive" });
    }
  }, [activeSchoolId, matrixId, toast]);

  useEffect(() => { loadMatrices(); }, [loadMatrices, schoolScopeKey]);
  useEffect(() => { loadComponents(); }, [loadComponents]);

  const bySeries = useMemo(() => items.filter((i) => i.series === series), [items, series]);

  /* ---------------------------------- componentes --------------------------------- */

  const openEdit = (item: MatrixComponentRow) => {
    setCreatingComponent(false);
    setEditing(item);
    setForm({
      name: item.name,
      abbreviation: item.abbreviation ?? "",
      aliases: (item.aliases ?? []).join("\n"),
      weekly: String(item.weekly_classes),
      ira: item.include_in_ira,
    });
  };

  const openCreateComponent = () => {
    setEditing(null);
    setCreatingComponent(true);
    setForm({ name: "", abbreviation: "", aliases: "", weekly: "1", ira: true });
  };

  const handleSaveComponent = async () => {
    if (!activeSchoolId || !matrixId) return;
    const weekly = Number(form.weekly);
    if (!Number.isFinite(weekly) || weekly < 1) {
      toast({ title: "Carga semanal deve ser maior que zero", variant: "destructive" });
      return;
    }
    if (creatingComponent && !form.name.trim()) {
      toast({ title: "Informe o nome do componente", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const aliases = parseAliases(form.aliases);
      if (creatingComponent) {
        const subjectId = await ensureCatalogSubject({
          schoolId: activeSchoolId,
          name: form.name,
          abbreviation: form.abbreviation,
          aliases,
          series,
          weeklyClasses: weekly,
        });
        const { error } = await supabase.from("curriculum_matrix_subjects").insert({
          school_id: activeSchoolId,
          matrix_id: matrixId,
          subject_id: subjectId,
          series,
          weekly_classes: weekly,
          include_in_ira: form.ira,
        });
        if (error) throw error;
        toast({
          title: "Componente adicionado à matriz",
          description: "Sincronize as turmas desta matriz para que a disciplina apareça nas notas e no IRA.",
        });
      } else if (editing) {
        const [matrixRes, catalogRes] = await Promise.all([
          supabase.from("curriculum_matrix_subjects")
            .update({ weekly_classes: weekly, include_in_ira: form.ira })
            .eq("school_id", activeSchoolId)
            .eq("id", editing.id),
          supabase.from("mapping_global_subjects")
            .update({
              abbreviation: form.abbreviation.trim() ? form.abbreviation.trim() : null,
              aliases,
            })
            .eq("school_id", activeSchoolId)
            .eq("id", editing.subject_id),
        ]);
        if (matrixRes.error) throw matrixRes.error;
        if (catalogRes.error) throw catalogRes.error;
        toast({
          title: "Matriz curricular atualizada",
          description: "As turmas vinculadas ficaram com o IRA marcado como desatualizado. " +
            "Sincronize-as quando quiser aplicar a mudança.",
        });
      }
      setEditing(null);
      setCreatingComponent(false);
      await Promise.all([loadComponents(), loadMatrices()]);
    } catch (error: unknown) {
      toast({
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveComponent = async (item: MatrixComponentRow) => {
    if (!activeSchoolId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("curriculum_matrix_subjects")
        .delete()
        .eq("school_id", activeSchoolId)
        .eq("id", item.id);
      if (error) throw error;
      toast({
        title: `${item.name} removida da matriz`,
        description: "As notas já lançadas continuam preservadas. Sincronize as turmas desta matriz " +
          "para atualizar as disciplinas e o IRA.",
      });
      await Promise.all([loadComponents(), loadMatrices()]);
    } catch (error: unknown) {
      toast({
        title: "Erro ao remover",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  /* ----------------------------------- matrizes ----------------------------------- */

  const handleCreateMatrix = async () => {
    if (!activeSchoolId) return;
    setSaving(true);
    try {
      const id = await createCurriculumMatrix({
        schoolId: activeSchoolId,
        name: matrixForm.name,
        description: matrixForm.description,
        copyFromMatrixId: matrixForm.copyFrom !== "none" ? matrixForm.copyFrom : null,
      });
      toast({ title: "Matriz curricular criada" });
      setCreatingMatrix(false);
      setMatrixForm({ name: "", description: "", copyFrom: "none" });
      await loadMatrices();
      setMatrixId(id);
    } catch (error: unknown) {
      toast({
        title: "Erro ao criar matriz",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMatrix = async () => {
    if (!activeSchoolId || !activeMatrix || matrixProtected) return;
    setSaving(true);
    try {
      const linked = await countClassesUsingMatrix(activeMatrix.id, activeSchoolId);
      if (linked > 0) {
        toast({
          title: "Matriz em uso por turmas",
          description: `${linked} turma(s) usam esta matriz. Sincronize essas turmas com outra matriz antes de excluí-la.`,
          variant: "destructive",
        });
        return;
      }
      const { error } = await supabase
        .from("curriculum_matrices")
        .delete()
        .eq("school_id", activeSchoolId)
        .eq("id", activeMatrix.id);
      if (error) throw error;
      toast({ title: "Matriz curricular excluída" });
      setMatrixId("");
      await loadMatrices();
    } catch (error: unknown) {
      toast({
        title: "Erro ao excluir matriz",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  /* ------------------------- importar componentes de outra matriz ------------------ */

  const openImport = () => {
    setImportSource("");
    setImportRows([]);
    setImportSelection(new Set());
    setImportOpen(true);
  };

  const handleSelectImportSource = async (sourceId: string) => {
    if (!activeSchoolId) return;
    setImportSource(sourceId);
    setImportSelection(new Set());
    try {
      setImportRows(await fetchMatrixComponents(sourceId, activeSchoolId));
    } catch {
      toast({ title: "Não foi possível carregar a matriz de origem", variant: "destructive" });
    }
  };

  const handleImport = async () => {
    if (!activeSchoolId || !matrixId) return;
    const selected = importRows.filter((r) => importSelection.has(r.id));
    if (selected.length === 0) {
      toast({ title: "Selecione ao menos um componente", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const result = await importMatrixComponents({
        schoolId: activeSchoolId,
        targetMatrixId: matrixId,
        components: selected,
      });
      toast({
        title: `${result.imported} componente(s) importado(s)`,
        description: result.skipped > 0
          ? `${result.skipped} já existia(m) nesta matriz e foram mantidos como estavam.`
          : undefined,
      });
      setImportOpen(false);
      await Promise.all([loadComponents(), loadMatrices()]);
    } catch (error: unknown) {
      toast({
        title: "Erro ao importar componentes",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  /* ------------------------------ sincronizar com turmas -------------------------- */

  const loadClasses = useCallback(async () => {
    if (!activeSchoolId) return;
    const { data, error } = await supabase
      .from("classes")
      .select("id, name, series, curriculum_matrix_id")
      .eq("school_id", activeSchoolId)
      .order("name");
    if (error) {
      toast({ title: "Não foi possível carregar as turmas", variant: "destructive" });
      return;
    }
    setClasses(((data ?? []) as { id: string; name: string; series: string | null; curriculum_matrix_id: string | null }[])
      .map((c) => ({ ...c, series: parseSeriesValue(c.series) })));
  }, [activeSchoolId, toast]);

  const openSync = async () => {
    if (!activeSchoolId) return;
    setClassSelection(new Set());
    setSyncOpen(true);
    await loadClasses();
  };

  const handleSyncClasses = async () => {
    if (!activeSchoolId || !matrixId) return;
    const targets = classes.filter((c) => classSelection.has(c.id));
    if (targets.length === 0) {
      toast({ title: "Selecione ao menos uma turma", variant: "destructive" });
      return;
    }
    const withoutSeries = targets.filter((c) => !c.series);
    if (withoutSeries.length > 0) {
      toast({
        title: "Turmas sem série definida",
        description: `Defina a série de: ${withoutSeries.map((c) => c.name).join(", ")}.`,
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    let ok = 0;
    const failures: string[] = [];
    for (const target of targets) {
      try {
        await syncClassCurriculum(target.id, target.series as HighSchoolSeries, {
          schoolId: activeSchoolId,
          matrixId,
          persistSeries: false,
        });
        ok += 1;
      } catch (e) {
        failures.push(`${target.name}: ${humanizeCurriculumError(e)}`);
      }
    }
    setSaving(false);
    toast({
      title: `${ok} turma(s) sincronizada(s) com ${activeMatrix?.name ?? "a matriz"}`,
      description: failures.length > 0 ? failures.join(" · ") : "Notas já lançadas foram preservadas.",
      variant: failures.length > 0 ? "destructive" : undefined,
    });
    if (failures.length === 0) {
      setSyncOpen(false);
      setClassSelection(new Set());
    }
    // Recarrega a lista de turmas SEM reabrir o diálogo.
    await loadClasses();
    await loadMatrices();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Library className="h-6 w-6 text-primary" />
          Disciplinas — Matriz Curricular
        </h1>
        <p className="text-muted-foreground">
          Matrizes curriculares do Ensino Médio da escola, organizadas por série. Servem de referência
          para a leitura dos boletins e para o cálculo do IRA.
        </p>
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Matriz curricular</Label>
              <Select value={matrixId} onValueChange={setMatrixId}>
                <SelectTrigger className="w-full sm:w-[340px]">
                  <SelectValue placeholder="Selecione a matriz" />
                </SelectTrigger>
                <SelectContent>
                  {matrices.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}{m.is_original ? " (original)" : ""} · {m.components} componentes
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setCreatingMatrix(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Nova matriz curricular
                </Button>
                <Button size="sm" variant="outline" onClick={openImport} disabled={!matrixId || matrices.length < 2}>
                  <Download className="h-4 w-4 mr-2" /> Importar disciplinas de outra matriz
                </Button>
                <Button size="sm" variant="outline" onClick={openSync} disabled={!matrixId}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Sincronizar com turma(s)
                </Button>
                {activeMatrix && !matrixProtected && (
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={handleDeleteMatrix} disabled={saving}>
                    <Trash2 className="h-4 w-4 mr-2" /> Excluir matriz
                  </Button>
                )}
              </div>
            )}
          </div>
          {activeMatrix && (
            <CardDescription className="flex flex-wrap items-center gap-2">
              {activeMatrix.is_original && (
                <Badge variant="secondary" className="gap-1">
                  <Lock className="h-3 w-3" /> Matriz Original (protegida)
                </Badge>
              )}
              {!activeMatrix.is_original && activeMatrix.system_key && (
                <Badge variant="secondary" className="gap-1">
                  <Lock className="h-3 w-3" /> Matriz padrão do sistema (protegida)
                </Badge>
              )}
              <Badge variant="outline">
                {arithmeticIra
                  ? "IRA por média simples (todas as disciplinas pesam igual)"
                  : "IRA ponderado pela carga semanal"}
              </Badge>
              {activeMatrix.description && <span className="text-xs">{activeMatrix.description}</span>}
            </CardDescription>
          )}
        </CardHeader>
      </Card>

      <Tabs value={series} onValueChange={(v) => setSeries(v as HighSchoolSeries)}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          {CLASS_SERIES_OPTIONS.map((o) => (
            <TabsTrigger key={o.value} value={o.value}>{seriesShortLabel(o.value)}</TabsTrigger>
          ))}
        </TabsList>

        {CLASS_SERIES_OPTIONS.map((o) => (
          <TabsContent key={o.value} value={o.value} className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{o.label}</CardTitle>
                    <CardDescription className="flex flex-wrap items-center gap-2 mt-1">
                      <Badge variant="secondary">{bySeries.length} componentes</Badge>
                      <Badge variant="outline">{matrixWeeklyTotal(bySeries)} aulas/semana (total real)</Badge>
                    </CardDescription>
                  </div>
                  {canEdit && matrixId && (
                    <Button size="sm" variant="outline" onClick={openCreateComponent}>
                      <Plus className="h-4 w-4 mr-2" /> Adicionar componente
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0 sm:p-6 sm:pt-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Disciplina</TableHead>
                        <TableHead className="w-32 text-center">Carga semanal</TableHead>
                        <TableHead className="w-32 text-center">Participa do IRA</TableHead>
                        <TableHead>Nomes reconhecidos</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bySeries.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2 flex-wrap">
                              {item.name}
                              {item.abbreviation && (
                                <Badge variant="outline" className="font-mono text-xs">{item.abbreviation}</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{item.weekly_classes}</TableCell>
                          <TableCell className="text-center">
                            {item.include_in_ira
                              ? <Badge variant="secondary">Sim</Badge>
                              : <Badge variant="outline">Não</Badge>}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-sm">
                            {(item.aliases ?? []).length > 0 ? item.aliases.join(", ") : "—"}
                          </TableCell>
                          <TableCell>
                            {canEdit && (
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" onClick={() => openEdit(item)} aria-label={`Editar ${item.name}`}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost" size="icon" className="text-destructive"
                                  disabled={saving}
                                  onClick={() => handleRemoveComponent(item)}
                                  aria-label={`Remover ${item.name}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {bySeries.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            Nenhum componente cadastrado nesta série.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {!canEdit && (
        <p className="text-xs text-muted-foreground">
          Apenas administração e direção podem editar as matrizes curriculares.
        </p>
      )}

      {/* Componente: criar / editar */}
      <Dialog
        open={!!editing || creatingComponent}
        onOpenChange={(open) => { if (!open) { setEditing(null); setCreatingComponent(false); } }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{creatingComponent ? "Novo componente" : editing?.name}</DialogTitle>
            <DialogDescription>
              {classSeriesLabel(series)} · {activeMatrix?.name}. Nome, abreviação e nomes reconhecidos
              no boletim são a identidade da disciplina em toda a escola (valem para todas as matrizes);
              carga semanal e participação no IRA são configurações desta matriz nesta série.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {creatingComponent && (
              <div className="space-y-2">
                <Label htmlFor="subject-name">Nome do componente</Label>
                <Input id="subject-name" value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="abbr">Abreviação (vale para toda a escola)</Label>
              <Input id="abbr" value={form.abbreviation}
                onChange={(e) => setForm((f) => ({ ...f, abbreviation: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aliases">Nomes reconhecidos no boletim (um por linha · valem para toda a escola)</Label>
              <Textarea id="aliases" rows={5} value={form.aliases}
                onChange={(e) => setForm((f) => ({ ...f, aliases: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weekly">Carga semanal nesta série (somente nesta matriz)</Label>
              <Input id="weekly" type="number" min={1} value={form.weekly}
                onChange={(e) => setForm((f) => ({ ...f, weekly: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="ira" checked={form.ira}
                onCheckedChange={(v) => setForm((f) => ({ ...f, ira: v === true }))} />
              <Label htmlFor="ira" className="cursor-pointer">Participa do IRA (somente nesta matriz)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditing(null); setCreatingComponent(false); }}>
              Cancelar
            </Button>
            <Button onClick={handleSaveComponent} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nova matriz */}
      <Dialog open={creatingMatrix} onOpenChange={setCreatingMatrix}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova matriz curricular</DialogTitle>
            <DialogDescription>
              A matriz pertence apenas a esta escola e pode começar vazia ou reaproveitar os
              componentes de outra matriz da própria escola.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="matrix-name">Nome</Label>
              <Input id="matrix-name" value={matrixForm.name}
                onChange={(e) => setMatrixForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="matrix-desc">Descrição (opcional)</Label>
              <Textarea id="matrix-desc" rows={3} value={matrixForm.description}
                onChange={(e) => setMatrixForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Começar a partir de</Label>
              <Select value={matrixForm.copyFrom} onValueChange={(v) => setMatrixForm((f) => ({ ...f, copyFrom: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Matriz vazia</SelectItem>
                  {matrices.map((m) => (
                    <SelectItem key={m.id} value={m.id}>Copiar de: {m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreatingMatrix(false)}>Cancelar</Button>
            <Button onClick={handleCreateMatrix} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Criar matriz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Importar de outra matriz */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Importar disciplinas de outra matriz</DialogTitle>
            <DialogDescription>
              Somente matrizes desta escola. Componentes que já existirem em{" "}
              {activeMatrix?.name ?? "a matriz atual"} são mantidos como estão.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={importSource} onValueChange={handleSelectImportSource}>
              <SelectTrigger><SelectValue placeholder="Matriz de origem" /></SelectTrigger>
              <SelectContent>
                {matrices.filter((m) => m.id !== matrixId).map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {importRows.length > 0 && (
              <ScrollArea className="h-[300px] rounded-md border p-2">
                <div className="space-y-1">
                  {importRows.map((row) => (
                    <label key={row.id} className="flex items-center gap-2 text-sm py-1">
                      <Checkbox
                        checked={importSelection.has(row.id)}
                        onCheckedChange={(v) => setImportSelection((prev) => {
                          const next = new Set(prev);
                          if (v === true) next.add(row.id); else next.delete(row.id);
                          return next;
                        })}
                      />
                      <span className="flex-1">{row.name}</span>
                      <Badge variant="outline" className="text-[10px]">{seriesShortLabel(parseSeriesValue(row.series))}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{row.weekly_classes} aulas</Badge>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            )}
            {importRows.length > 0 && (
              <Button
                variant="ghost" size="sm"
                onClick={() => setImportSelection(new Set(importRows.map((r) => r.id)))}
              >
                Selecionar todos
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancelar</Button>
            <Button onClick={handleImport} disabled={saving || importSelection.size === 0}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Importar {importSelection.size > 0 ? `(${importSelection.size})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sincronizar com turmas */}
      <Dialog open={syncOpen} onOpenChange={setSyncOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Sincronizar {activeMatrix?.name} com turma(s)</DialogTitle>
            <DialogDescription>
              Cada turma recebe os componentes e cargas da sua própria série. Notas já lançadas nunca
              são apagadas: disciplinas fora da nova matriz ficam no histórico, sem entrar no IRA.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[320px] rounded-md border p-2">
            <div className="space-y-1">
              {classes.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm py-1">
                  <Checkbox
                    checked={classSelection.has(c.id)}
                    onCheckedChange={(v) => setClassSelection((prev) => {
                      const next = new Set(prev);
                      if (v === true) next.add(c.id); else next.delete(c.id);
                      return next;
                    })}
                  />
                  <span className="flex-1">{c.name}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {seriesShortLabel(c.series)}
                  </Badge>
                  {c.curriculum_matrix_id === matrixId && (
                    <Badge variant="secondary" className="text-[10px]">vinculada</Badge>
                  )}
                </label>
              ))}
              {classes.length === 0 && (
                <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma turma cadastrada.</p>
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSyncOpen(false)}>Fechar</Button>
            <Button onClick={handleSyncClasses} disabled={saving || classSelection.size === 0}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Sincronizar {classSelection.size > 0 ? `(${classSelection.size})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Subjects = () => (
  <DashboardLayout>
    <SubjectsContent />
  </DashboardLayout>
);

export default Subjects;
