import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSchoolScopeKey, useActiveSchoolId } from '@/contexts/SchoolContext';
import { scopeToSchool, NO_ACTIVE_SCHOOL_MESSAGE } from '@/lib/schools/scope';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Trophy, AlertTriangle, Medal, FileDown, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { formatIra } from '@/lib/ira';
import {
  HIGH_SCHOOL_SERIES, HighSchoolSeries, RANKING_LIMIT, RankingResult, buildIraRanking, detectClassSeries,
  formatBirthDate, formatStudentCode, generateIraRankingPdf, parseClassSeries, seriesLabel,
  DEFAULT_RANKING_PDF_COLUMNS, RANKING_PDF_COLUMN_OPTIONS, RankingPdfColumn, buildIraRankingPdf,
  orderRankingColumns,
} from '@/lib/iraRanking';
import { supabase } from '@/integrations/supabase/client';
import logoAsset from '@/assets/logo-cepans.png.asset.json';

interface ClassOption {
  id: string;
  name: string;
  shift: string;
  /** Série estruturada da turma (`classes.series`). */
  series?: string | null;
}

interface Props {
  classes: ClassOption[];
  classesWithGrades: Set<string>;
}

const medalColor = (place: number) =>
  place === 1 ? 'text-amber-500' : place === 2 ? 'text-slate-400' : 'text-orange-700';

const IraRankingExport = ({ classes, classesWithGrades }: Props) => {
  const schoolScopeKey = useSchoolScopeKey();
  const activeSchoolId = useActiveSchoolId();
  const [selected, setSelected] = useState<string[]>([]);
  const [series, setSeries] = useState<HighSchoolSeries | ''>('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<RankingResult | null>(null);
const [rankingStale, setRankingStale] = useState(false);
  const [columns, setColumns] = useState<RankingPdfColumn[]>(DEFAULT_RANKING_PDF_COLUMNS);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const previewUrlRef = useRef<string | null>(null);

  const revokePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
  }, [schoolScopeKey]);

  useEffect(() => revokePreview, [revokePreview]);

  const activeColumns = useMemo(() => orderRankingColumns(columns), [columns]);
  const hasColumn = (c: RankingPdfColumn) => activeColumns.includes(c);

  const toggleColumn = (c: RankingPdfColumn, checked: boolean) => {
    revokePreview();
    setColumns((prev) => (checked ? [...new Set([...prev, c])] : prev.filter((p) => p !== c)));
  };

  /** Turmas com boletim importado. */
  const withGrades = useMemo(
    () => classes.filter((c) => classesWithGrades.has(c.id)),
    [classes, classesWithGrades],
  );

  /**
   * Somente turmas cuja série ESTRUTURADA corresponde à série escolhida.
   * Turmas sem série definida nunca entram silenciosamente na classificação.
   */
  const options = useMemo(() => {
    if (!series) return [];
    return withGrades.filter((c) => parseClassSeries(c.series) === series);
  }, [withGrades, series]);

  /** Turmas com boletim, porém sem série estruturada definida. */
  const withoutSeries = useMemo(
    () => withGrades.filter((c) => parseClassSeries(c.series) === null).map((c) => ({
      name: c.name,
      guess: detectClassSeries(c.name),
    })),
    [withGrades],
  );

  const selectedNames = useMemo(
    () => options.filter((c) => selected.includes(c.id)).map((c) => c.name),
    [options, selected],
  );

  const changeSeries = (value: HighSchoolSeries) => {
    setSeries(value);
    setResult(null);
    revokePreview();
    // Limpa automaticamente turmas de outra série.
    setSelected((prev) => prev.filter((id) => {
      const c = withGrades.find((w) => w.id === id);
      return !!c && parseClassSeries(c.series) === value;
    }));
  };

  const toggle = (id: string, checked: boolean) => {
    setResult(null);
    revokePreview();
    setSelected((prev) => (checked ? [...new Set([...prev, id])] : prev.filter((p) => p !== id)));
  };

  const loadPreview = async () => {
    if (!series) {
      toast.error('Escolha a série do Ensino Médio antes de calcular a classificação.');
      return;
    }
    if (selected.length === 0) {
      toast.error('Selecione ao menos uma turma para compor a classificação.');
      return;
    }
    if (activeColumns.length === 0) {
      toast.error('Selecione ao menos uma coluna do PDF.');
      return;
    }
    if (!activeSchoolId) {
      toast.error(NO_ACTIVE_SCHOOL_MESSAGE);
      return;
    }
    setLoading(true);
    try {
      const data = await buildIraRanking(selected, activeSchoolId);
      setResult(data);
      const { data: stRows } = await scopeToSchool(
        supabase.from('ira_staleness').select('class_id, stale'),
        activeSchoolId,
      ).in('class_id', selected);
      const rows = (stRows || []) as { stale: boolean }[];
      setRankingStale(rows.some((r) => r.stale) || rows.length < selected.length);
      if (data.eligibleCount === 0) {
        toast.error('Nenhum aluno elegível encontrado nas turmas selecionadas.');
      }

    } catch (e) {
      console.error(e);
      toast.error('Não foi possível calcular a classificação.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const exportPdf = async () => {
    if (!result || result.top.length === 0) return;
    if (activeColumns.length === 0) {
      toast.error('Selecione ao menos uma coluna do PDF.');
      return;
    }
    setExporting(true);
    try {
      await generateIraRankingPdf(result.top, {
        classNames: selectedNames,
        periodsLabel: result.periodsLabel,
        totalEligible: result.eligibleCount,
        logoUrl: logoAsset.url,
        series: series || undefined,
        columns: activeColumns,
      });
      toast.success(`PDF gerado com ${result.top.length} colocação(ões).`);
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível gerar o PDF da classificação.');
    } finally {
      setExporting(false);
    }
  };

  const openPreview = async () => {
    if (!result || result.top.length === 0) return;
    if (activeColumns.length === 0) {
      toast.error('Selecione ao menos uma coluna do PDF.');
      return;
    }
    setPreviewing(true);
    try {
      const doc = await buildIraRankingPdf(result.top, {
        classNames: selectedNames,
        periodsLabel: result.periodsLabel,
        totalEligible: result.eligibleCount,
        logoUrl: logoAsset.url,
        series: series || undefined,
        columns: activeColumns,
      });
      revokePreview();
      const url = URL.createObjectURL(doc.output('blob'));
      previewUrlRef.current = url;
      setPreviewUrl(url);
      setPreviewOpen(true);
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível gerar a pré-visualização do PDF.');
    } finally {
      setPreviewing(false);
    }
  };

  const outOfTop = result ? Math.max(0, result.eligibleCount - result.top.length) : 0;

  return (
    <Card className="border-primary/40 bg-primary/[0.03]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="w-4 h-4 text-primary" />
          Exportação da Classificação do IRA
        </CardTitle>
        <CardDescription>
          Escolha a série do Ensino Médio, selecione as turmas, confira a prévia e exporte em PDF os {RANKING_LIMIT} melhores resultados.
          O cálculo usa a configuração de IRA de cada turma. Escolha quais informações serão exibidas — o nome completo só será incluído quando selecionado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ira-ranking-series">
            Série da classificação <span className="text-destructive">*</span>
          </Label>
          <Select value={series} onValueChange={(v) => changeSeries(v as HighSchoolSeries)}>
            <SelectTrigger id="ira-ranking-series" className="w-full sm:w-80">
              <SelectValue placeholder="Selecione a série do Ensino Médio" />
            </SelectTrigger>
            <SelectContent>
              {HIGH_SCHOOL_SERIES.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!series && (
            <p className="text-xs text-muted-foreground">
              A classificação nunca mistura 1ª, 2ª e 3ª série — escolha uma série para continuar.
            </p>
          )}
        </div>

        {withoutSeries.length > 0 && series && (
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertTitle className="text-sm">Turmas sem série definida</AlertTitle>
            <AlertDescription className="text-xs">
              {withoutSeries.map((c) => c.name).join(', ')} — defina a série em “Configuração do IRA”
              (campo <strong>Série da turma</strong>) para que possam participar da classificação.
            </AlertDescription>
          </Alert>
        )}

        {!series ? null : withGrades.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma turma com boletim importado. Importe um boletim para gerar a classificação.
          </p>
        ) : options.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma turma da {seriesLabel(series)} com boletim importado.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Turmas participantes · {seriesLabel(series)}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { setResult(null); setSelected(options.map((o) => o.id)); }}>
                    Selecionar todas
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setResult(null); setSelected([]); }}>
                    Limpar
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-40 rounded-md border p-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {options.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selected.includes(c.id)}
                        onCheckedChange={(checked) => toggle(c.id, !!checked)}
                      />
                      <span className="truncate">{c.name}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {selected.length > 0 && (
              <div className="rounded-md border bg-background p-3 text-sm space-y-1">
                <p className="font-medium">Resumo da seleção</p>
                <p className="text-muted-foreground text-xs">
                  {selected.length} turma(s): {selectedNames.join(', ')}
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={loadPreview} disabled={loading || !series || selected.length === 0 || !activeSchoolId}>
                {loading && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
                Calcular prévia da classificação
              </Button>
              <Button
                size="sm"
                variant="default"
                onClick={openPreview}
                disabled={!series || !result || result.top.length === 0 || previewing || activeColumns.length === 0}
              >
                {previewing ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Eye className="w-3 h-3 mr-2" />}
                Pré-visualizar PDF
              </Button>
            </div>

            <div className="space-y-2 rounded-md border bg-background p-3">
              <p className="text-sm font-medium">Colunas do PDF</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {RANKING_PDF_COLUMN_OPTIONS.map((o) => (
                  <label key={o.value} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={hasColumn(o.value)}
                      onCheckedChange={(checked) => toggleColumn(o.value, !!checked)}
                    />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
              {activeColumns.length === 0 && (
                <p className="text-xs text-destructive">
                  Selecione ao menos uma coluna para pré-visualizar ou exportar o PDF.
                </p>
              )}
            </div>

            {result && (
              <div className="space-y-3">
                {rankingStale && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>IRA possivelmente desatualizado</AlertTitle>
                    <AlertDescription>
                      Alguma turma selecionada teve notas alteradas após o último cálculo salvo.
                      Atualize o IRA na aba Alunos para garantir a classificação correta.
                    </AlertDescription>
                  </Alert>
                )}
                <div className="flex flex-wrap gap-2 text-xs">

                  <Badge variant="secondary">{result.eligibleCount} aluno(s) elegível(is)</Badge>
                  <Badge variant="outline">Top {RANKING_LIMIT} · exportando {result.top.length}</Badge>
                  {outOfTop > 0 && <Badge variant="outline">{outOfTop} fora do Top {RANKING_LIMIT}</Badge>}
                  {result.ineligibleCount > 0 && (
                    <Badge variant="outline">{result.ineligibleCount} sem IRA calculável</Badge>
                  )}
                  {result.periodsLabel && <Badge variant="outline">Base: {result.periodsLabel}</Badge>}
                </div>

                {result.eligibleCount === 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="w-4 h-4" />
                    <AlertTitle className="text-sm">Exportação bloqueada</AlertTitle>
                    <AlertDescription className="text-xs">
                      Nenhum aluno com IRA válido nas turmas selecionadas.
                      {result.classesWithoutConfig.length > 0
                        ? ` Turmas sem configuração de IRA: ${result.classesWithoutConfig.join(', ')} (Configurações → IRA).`
                        : ' Verifique se o boletim foi importado e as disciplinas participantes foram marcadas.'}
                    </AlertDescription>
                  </Alert>
                )}

                {result.eligibleCount > 0 && result.eligibleCount < RANKING_LIMIT && (
                  <Alert>
                    <AlertTriangle className="w-4 h-4" />
                    <AlertTitle className="text-sm">Menos de {RANKING_LIMIT} elegíveis</AlertTitle>
                    <AlertDescription className="text-xs">
                      Serão exportados todos os {result.eligibleCount} aluno(s) elegível(is).
                    </AlertDescription>
                  </Alert>
                )}

                {result.missingDataCount > 0 && (
                  <Alert>
                    <AlertTriangle className="w-4 h-4" />
                    <AlertTitle className="text-sm">Dados ausentes</AlertTitle>
                    <AlertDescription className="text-xs">
                      {result.missingDataCount} aluno(s) do Top {RANKING_LIMIT} estão sem código e/ou data de
                      nascimento. O PDF mostrará “não informado” — nenhum dado é preenchido automaticamente.
                    </AlertDescription>
                  </Alert>
                )}

                {result.classesWithoutConfig.length > 0 && result.eligibleCount > 0 && (
                  <Alert>
                    <AlertTriangle className="w-4 h-4" />
                    <AlertTitle className="text-sm">Turmas sem configuração de IRA</AlertTitle>
                    <AlertDescription className="text-xs">
                      {result.classesWithoutConfig.join(', ')} — os alunos dessas turmas ficam fora da classificação.
                    </AlertDescription>
                  </Alert>
                )}

                {result.top.length > 0 && (
                  <div className="rounded-md border bg-background">
                    <ScrollArea className="h-72">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {hasColumn('position') && <TableHead className="w-24">Colocação</TableHead>}
                            {hasColumn('code') && <TableHead>Código</TableHead>}
                            {hasColumn('fullName') && <TableHead>Nome completo</TableHead>}
                            {hasColumn('birthDate') && <TableHead>Data de nascimento</TableHead>}
                            {hasColumn('className') && <TableHead>Turma/Série</TableHead>}
                            {hasColumn('ira') && <TableHead className="text-right">IRA</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {result.top.map((e, i) => (
                            <TableRow key={e.studentId}>
                              {hasColumn('position') && <TableCell className="font-medium">
                                <span className="flex items-center gap-1">
                                  {i < 3 && <Medal className={`w-4 h-4 ${medalColor(i + 1)}`} />}
                                  {i + 1}º
                                </span>
                              </TableCell>}
                              {hasColumn('code') && <TableCell>
                                {formatStudentCode(e.code) || <span className="text-amber-600">não informado</span>}
                              </TableCell>}
                              {hasColumn('fullName') && <TableCell>
                                {e.fullName || <span className="text-amber-600">não informado</span>}
                              </TableCell>}
                              {hasColumn('birthDate') && <TableCell>
                                {e.birthDate ? formatBirthDate(e.birthDate) : <span className="text-amber-600">não informada</span>}
                              </TableCell>}
                              {hasColumn('className') && <TableCell>{e.className}</TableCell>}
                              {hasColumn('ira') && (
                                <TableCell className="text-right font-semibold">{formatIra(e.ira)}</TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>

      <Dialog
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) revokePreview();
        }}
      >
        <DialogContent className="max-w-[95vw] sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Pré-visualização do PDF</DialogTitle>
            <DialogDescription>
              Confira o documento com as colunas selecionadas antes de exportar.
            </DialogDescription>
          </DialogHeader>
          {previewUrl ? (
            <object data={previewUrl} type="application/pdf" className="w-full h-[65vh] rounded-md border">
              <div className="p-4 text-sm space-y-2">
                <p>Seu navegador não conseguiu exibir o PDF aqui.</p>
                <Button size="sm" variant="outline" asChild>
                  <a href={previewUrl} target="_blank" rel="noreferrer">Abrir prévia em nova aba</a>
                </Button>
              </div>
            </object>
          ) : (
            <p className="text-sm text-muted-foreground">Prévia indisponível.</p>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setPreviewOpen(false); revokePreview(); }}>
              Fechar
            </Button>
            <Button size="sm" onClick={exportPdf} disabled={exporting}>
              {exporting ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <FileDown className="w-3 h-3 mr-2" />}
              Exportar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default IraRankingExport;
