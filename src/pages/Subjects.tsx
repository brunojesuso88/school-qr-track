import { useCallback, useEffect, useMemo, useState } from "react";
import { Library, Loader2, Pencil } from "lucide-react";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DashboardLayout from "@/components/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { CLASS_SERIES_OPTIONS, HighSchoolSeries } from "@/lib/series";
import { CurriculumMatrixItem, fetchCurriculumMatrix, matrixWeeklyTotal } from "@/lib/curriculumMatrix";

const parseAliases = (value: string) =>
  [...new Set(value.split(/[\n;,]+/).map((a) => a.trim()).filter(Boolean))];

const SubjectsContent = () => {
  const { toast } = useToast();
  const { userRole } = useAuth();
  const canEdit = userRole === "admin" || userRole === "direction";
  const [items, setItems] = useState<CurriculumMatrixItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [series, setSeries] = useState<HighSchoolSeries>("1");
  const [editing, setEditing] = useState<CurriculumMatrixItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ abbreviation: "", aliases: "", weekly: "1", ira: true });

  const load = useCallback(async () => {
    try {
      setItems(await fetchCurriculumMatrix());
    } catch {
      toast({ title: "Não foi possível carregar a matriz curricular", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const bySeries = useMemo(
    () => items.filter((i) => i.series === series),
    [items, series],
  );

  const openEdit = (item: CurriculumMatrixItem) => {
    setEditing(item);
    setForm({
      abbreviation: item.abbreviation ?? "",
      aliases: (item.aliases ?? []).join("\n"),
      weekly: String(item.weekly_classes),
      ira: item.include_in_ira,
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    const weekly = Number(form.weekly);
    if (!Number.isFinite(weekly) || weekly < 1) {
      toast({ title: "Carga semanal deve ser maior que zero", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const aliases = parseAliases(form.aliases);
      const [matrixRes, catalogRes] = await Promise.all([
        supabase.from("curriculum_matrix_subjects")
          .update({ weekly_classes: weekly, include_in_ira: form.ira })
          .eq("id", editing.id),
        supabase.from("mapping_global_subjects")
          .update({
            abbreviation: form.abbreviation.trim() ? form.abbreviation.trim() : null,
            aliases,
          })
          .eq("id", editing.subject_id),
      ]);
      if (matrixRes.error) throw matrixRes.error;
      if (catalogRes.error) throw catalogRes.error;
      toast({ title: "Matriz curricular atualizada" });
      setEditing(null);
      await load();
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
          Matriz curricular oficial do Ensino Médio por série. Serve de referência para a leitura dos
          boletins e para o cálculo do IRA.
        </p>
      </div>

      <Tabs value={series} onValueChange={(v) => setSeries(v as HighSchoolSeries)}>
        <TabsList>
          {CLASS_SERIES_OPTIONS.map((o) => (
            <TabsTrigger key={o.value} value={o.value}>{o.value}º ano</TabsTrigger>
          ))}
        </TabsList>

        {CLASS_SERIES_OPTIONS.map((o) => (
          <TabsContent key={o.value} value={o.value} className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{o.label}</CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{bySeries.length} componentes</Badge>
                  <Badge variant="outline">{matrixWeeklyTotal(bySeries)} aulas/semana (total real)</Badge>
                  <span className="text-xs">
                    Todos os componentes oficiais participam do IRA por padrão.
                  </span>
                </CardDescription>
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
                        <TableHead className="w-16" />
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
                              <Button variant="ghost" size="icon" onClick={() => openEdit(item)} aria-label={`Editar ${item.name}`}>
                                <Pencil className="h-4 w-4" />
                              </Button>
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
          Apenas administração e direção podem editar a matriz curricular.
        </p>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="abbr">Abreviação</Label>
              <Input id="abbr" value={form.abbreviation}
                onChange={(e) => setForm((f) => ({ ...f, abbreviation: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aliases">Nomes reconhecidos no boletim (um por linha)</Label>
              <Textarea id="aliases" rows={5} value={form.aliases}
                onChange={(e) => setForm((f) => ({ ...f, aliases: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weekly">Carga semanal nesta série</Label>
              <Input id="weekly" type="number" min={1} value={form.weekly}
                onChange={(e) => setForm((f) => ({ ...f, weekly: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="ira" checked={form.ira}
                onCheckedChange={(c) => setForm((f) => ({ ...f, ira: c === true }))} />
              <Label htmlFor="ira" className="cursor-pointer">Participa do cálculo do IRA</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
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
