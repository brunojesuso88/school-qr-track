import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, FileDown, Printer, Save, Trash2, Pencil, Eraser, Eye } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import logoCepans from '@/assets/logo-cepans.png';
import {
  NotificationData,
  NotificationStage,
  STAGE_OPTIONS,
  STAGE_TITLES,
  OBLIGATION_OPTIONS,
  buildNotificationBody,
  getResolvedObligations,
  formatDocNumber,
  formatDateBR,
  todayBR,
} from '@/lib/notificationTemplates';
import { NotificationPreview } from '@/components/notifications/NotificationPreview';

interface NotificationRecord extends NotificationData {
  id: string;
  doc_number: number;
  doc_year: number;
  custom_body: string | null;
  created_at: string;
}

const emptyForm: NotificationData = {
  teacher_name: '',
  stage: 'stage_1',
  reason: '',
  obligations: [],
  other_obligation: '',
  original_deadline: '',
  new_deadline: '',
  classes_subjects: '',
  teacher_justification: '',
};

function DatePick({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const date = value ? new Date(value + 'T00:00:00') : undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn('w-full justify-start text-left font-normal', !value && 'text-muted-foreground')}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, 'dd/MM/yyyy') : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => onChange(d ? format(d, 'yyyy-MM-dd') : '')}
          initialFocus
          className={cn('p-3 pointer-events-auto')}
        />
      </PopoverContent>
    </Popover>
  );
}

function buildPrintHTML(data: NotificationData, docNumber: number, docYear: number, customBody: string | null) {
  const stage = STAGE_TITLES[data.stage];
  const body = (customBody?.trim() || buildNotificationBody(data)).replace(/\n/g, '<br/>');
  const obligations = getResolvedObligations(data);
  const fileTitle = `NOTIFICACAO_${(data.teacher_name || 'PROFESSOR').toUpperCase().replace(/\s+/g, '_')}_${docYear}`;
  return `<!doctype html><html><head><meta charset="utf-8" /><title>${fileTitle}</title>
<style>
  @page { size: A4 portrait; margin: 20mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: "Times New Roman", Georgia, serif; color: #0B2E59; font-size: 12pt; line-height: 1.55; margin: 0; }
  .header { display: flex; align-items: center; gap: 16px; }
  .header img { width: 115px; height: 115px; object-fit: contain; }
  .header .info { flex: 1; text-align: center; }
  .header .info .line { font-size: 10.5pt; letter-spacing: 1px; }
  .header .info .school { font-size: 11.5pt; font-weight: 700; color: #0D47A1; margin-top: 3px; }
  .divider { height: 3px; background: linear-gradient(90deg,#0D47A1,#C62828); margin: 12px 0 20px; }
  .title { text-align: center; margin-bottom: 16px; }
  .title .t1 { font-size: 14pt; font-weight: 700; letter-spacing: 1px; }
  .title .t2 { font-size: 10pt; color: #475569; margin-top: 3px; }
  .title .meta { margin-top: 8px; font-size: 11pt; }
  .section { margin-bottom: 14px; }
  .section .label { font-weight: 700; color: #0D47A1; margin-bottom: 4px; }
  .body { text-align: justify; }
  ul { margin: 0; padding-left: 22px; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 56px; page-break-inside: avoid; }
  .sig { text-align: center; }
  .sig .line { border-top: 1px solid #0B2E59; padding-top: 6px; font-size: 11pt; }
  .sig .role { color: #475569; }
  .footer { margin-top: 28px; border-top: 1px solid #e2e8f0; padding-top: 8px; text-align: center; font-size: 9.5pt; color: #64748b; font-style: italic; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
  <div class="header">
    <img src="${logoCepans}" alt="CEPANS" />
    <div class="info">
      <div class="line">ESTADO DO MARANHÃO</div>
      <div class="line">SECRETARIA DE ESTADO DA EDUCAÇÃO DO MARANHÃO (SEDUC MA)</div>
      <div class="school">CENTRO DE ENSINO PROFESSOR ANTÔNIO NONATO SAMPAIO – CEPANS</div>
    </div>
    <div style="width:115px"></div>
  </div>
  <div class="divider"></div>
  <div class="title">
    <div class="t1">${stage.title}</div>
    <div class="t2">${stage.subtitle}</div>
    <div class="meta"><strong>Documento nº ${formatDocNumber(docNumber, docYear)}</strong> &nbsp;•&nbsp; Coelho Neto/MA, ${todayBR()}</div>
  </div>
  <div class="body section">${body}</div>
  ${data.reason ? `<div class="section"><div class="label">Motivo da notificação</div><div class="body">${escapeHTML(data.reason)}</div></div>` : ''}
  ${obligations.length ? `<div class="section"><div class="label">Obrigações acadêmicas não cumpridas</div><ul>${obligations.map((o) => `<li>${escapeHTML(o)}</li>`).join('')}</ul></div>` : ''}
  ${data.classes_subjects ? `<div class="section"><div class="label">Turmas / disciplina</div><div>${escapeHTML(data.classes_subjects)}</div></div>` : ''}
  ${data.teacher_justification ? `<div class="section"><div class="label">Justificativa apresentada pelo docente</div><div class="body" style="font-style:italic">${escapeHTML(data.teacher_justification)}</div></div>` : ''}
  <div class="signatures">
    <div class="sig"><div class="line"><strong>Bruno de Jesus Oliveira</strong><div class="role">Coordenador Pedagógico</div></div></div>
    <div class="sig"><div class="line"><strong>Ciente do(a) professor(a)</strong><div class="role">Data: ____/____/______</div></div></div>
  </div>
  <div class="footer">Documento de acompanhamento pedagógico-administrativo de uso interno da gestão escolar.</div>
  <script>window.onload = () => { const imgs = document.images; let n = imgs.length; if(!n) return setTimeout(()=>window.print(), 200); for (const i of imgs) { if (i.complete) { if(--n===0) setTimeout(()=>window.print(), 200);} else { i.onload = i.onerror = () => { if(--n===0) setTimeout(()=>window.print(), 200); }; } } };<\/script>
</body></html>`;
}

function escapeHTML(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

export default function TeacherNotifications() {
  const { user } = useAuth();
  const [form, setForm] = useState<NotificationData>(emptyForm);
  const [customBody, setCustomBody] = useState<string>('');
  const [editingBody, setEditingBody] = useState(false);
  const [previewDocNumber, setPreviewDocNumber] = useState<number>(1);
  const [records, setRecords] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingYear, setEditingYear] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Filters
  const [fTeacher, setFTeacher] = useState('');
  const [fStage, setFStage] = useState<'all' | NotificationStage>('all');
  const [fSubject, setFSubject] = useState('');

  const year = new Date().getFullYear();

  const fetchRecords = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('teacher_notifications')
      .select('*')
      .order('doc_year', { ascending: false })
      .order('doc_number', { ascending: false });
    setLoading(false);
    if (error) {
      toast.error('Erro ao carregar histórico');
      return;
    }
    setRecords((data || []) as unknown as NotificationRecord[]);
    // Preview number = next sequential for current year
    const maxThisYear = (data || []).filter((r: any) => r.doc_year === year).reduce((m: number, r: any) => Math.max(m, r.doc_number), 0);
    setPreviewDocNumber(maxThisYear + 1);
  };

  useEffect(() => { fetchRecords(); }, []);

  const previewData: NotificationData = useMemo(() => form, [form]);
  const previewYear = editingYear ?? year;

  const validate = (): string | null => {
    if (!form.teacher_name.trim()) return 'Informe o nome do professor.';
    if (!form.reason.trim()) return 'Informe o motivo da notificação.';
    if (!form.obligations.length) return 'Selecione ao menos uma obrigação acadêmica.';
    if (form.obligations.includes('Outros') && !form.other_obligation?.trim()) return 'Descreva a obrigação em "Outros".';
    if (!form.original_deadline) return 'Informe o prazo original.';
    if (!form.new_deadline) return 'Informe o novo prazo.';
    return null;
  };

  const resetForm = () => {
    setForm(emptyForm);
    setCustomBody('');
    setEditingBody(false);
    setEditingId(null);
    setEditingYear(null);
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('teacher_notifications')
          .update({
            teacher_name: form.teacher_name,
            stage: form.stage,
            reason: form.reason,
            obligations: form.obligations,
            other_obligation: form.other_obligation || null,
            original_deadline: form.original_deadline,
            new_deadline: form.new_deadline,
            classes_subjects: form.classes_subjects || null,
            teacher_justification: form.teacher_justification || null,
            custom_body: customBody || null,
          })
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Notificação atualizada.');
      } else {
        const { data: numData, error: numErr } = await supabase.rpc('next_teacher_notification_number', { _year: year });
        if (numErr) throw numErr;
        const nextNumber = numData as unknown as number;
        const { error } = await supabase.from('teacher_notifications').insert({
          doc_number: nextNumber,
          doc_year: year,
          teacher_name: form.teacher_name,
          stage: form.stage,
          reason: form.reason,
          obligations: form.obligations,
          other_obligation: form.other_obligation || null,
          original_deadline: form.original_deadline,
          new_deadline: form.new_deadline,
          classes_subjects: form.classes_subjects || null,
          teacher_justification: form.teacher_justification || null,
          custom_body: customBody || null,
          created_by: user?.id ?? null,
        });
        if (error) throw error;
        toast.success(`Notificação ${formatDocNumber(nextNumber, year)} emitida.`);
      }
      resetForm();
      fetchRecords();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    const html = buildPrintHTML(form, editingId ? (previewDocNumber) : previewDocNumber, previewYear, customBody || null);
    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) { toast.error('Permita pop-ups para imprimir.'); return; }
    w.document.write(html);
    w.document.close();
  };

  const loadRecord = (r: NotificationRecord) => {
    setForm({
      teacher_name: r.teacher_name,
      stage: r.stage,
      reason: r.reason,
      obligations: r.obligations || [],
      other_obligation: r.other_obligation || '',
      original_deadline: r.original_deadline,
      new_deadline: r.new_deadline,
      classes_subjects: r.classes_subjects || '',
      teacher_justification: r.teacher_justification || '',
    });
    setCustomBody(r.custom_body || '');
    setEditingId(r.id);
    setEditingYear(r.doc_year);
    setPreviewDocNumber(r.doc_number);
    setEditingBody(!!r.custom_body);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast.info(`Editando ${formatDocNumber(r.doc_number, r.doc_year)}`);
  };

  const deleteRecord = async (r: NotificationRecord) => {
    if (!confirm(`Excluir notificação ${formatDocNumber(r.doc_number, r.doc_year)}?`)) return;
    const { error } = await supabase.from('teacher_notifications').delete().eq('id', r.id);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Excluída.');
    fetchRecords();
  };

  const printRecord = (r: NotificationRecord) => {
    const html = buildPrintHTML(
      {
        teacher_name: r.teacher_name,
        stage: r.stage,
        reason: r.reason,
        obligations: r.obligations || [],
        other_obligation: r.other_obligation,
        original_deadline: r.original_deadline,
        new_deadline: r.new_deadline,
        classes_subjects: r.classes_subjects,
        teacher_justification: r.teacher_justification,
      },
      r.doc_number,
      r.doc_year,
      r.custom_body,
    );
    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  const filtered = records.filter((r) => {
    if (fTeacher && !r.teacher_name.toLowerCase().includes(fTeacher.toLowerCase())) return false;
    if (fStage !== 'all' && r.stage !== fStage) return false;
    if (fSubject && !(r.classes_subjects || '').toLowerCase().includes(fSubject.toLowerCase())) return false;
    return true;
  });

  const toggleObligation = (opt: string, checked: boolean) => {
    setForm((f) => ({
      ...f,
      obligations: checked ? [...f.obligations, opt] : f.obligations.filter((o) => o !== opt),
    }));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Notificação Docente</h1>
            <p className="text-sm text-muted-foreground">
              Emissão de comunicações orientativas e notificações administrativas internas — CEPANS.
            </p>
          </div>
          {editingId && (
            <Badge variant="secondary" className="text-xs">
              Editando {formatDocNumber(previewDocNumber, previewYear)}
            </Badge>
          )}
        </div>

        <Tabs defaultValue="new">
          <TabsList>
            <TabsTrigger value="new">Nova Notificação</TabsTrigger>
            <TabsTrigger value="history">Histórico ({records.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="mt-4">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* FORM */}
              <Card>
                <CardHeader>
                  <CardTitle>Dados da Notificação</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome completo do professor *</Label>
                    <Input
                      placeholder="Digite o nome completo do professor"
                      value={form.teacher_name}
                      onChange={(e) => setForm({ ...form, teacher_name: e.target.value })}
                      maxLength={150}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Etapa da notificação *</Label>
                    <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v as NotificationStage })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STAGE_OPTIONS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {STAGE_OPTIONS.find((s) => s.value === form.stage)?.description}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Motivo da notificação *</Label>
                    <Textarea
                      rows={3}
                      placeholder="Descreva objetivamente o motivo da notificação"
                      value={form.reason}
                      onChange={(e) => setForm({ ...form, reason: e.target.value })}
                      maxLength={1500}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Obrigações acadêmicas não cumpridas *</Label>
                    <p className="text-xs text-muted-foreground">Selecione uma ou mais opções</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 border rounded-md">
                      {OBLIGATION_OPTIONS.map((opt) => (
                        <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={form.obligations.includes(opt)}
                            onCheckedChange={(c) => toggleObligation(opt, !!c)}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                    {form.obligations.includes('Outros') && (
                      <Input
                        placeholder="Descreva a obrigação"
                        value={form.other_obligation || ''}
                        onChange={(e) => setForm({ ...form, other_obligation: e.target.value })}
                        maxLength={200}
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Prazo originalmente estabelecido *</Label>
                      <DatePick
                        value={form.original_deadline}
                        onChange={(v) => setForm({ ...form, original_deadline: v })}
                        placeholder="Selecione a data"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Novo prazo para regularização *</Label>
                      <DatePick
                        value={form.new_deadline}
                        onChange={(v) => setForm({ ...form, new_deadline: v })}
                        placeholder="Selecione a data"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Turmas / disciplina</Label>
                    <Input
                      placeholder="Ex.: Física – 1º A, 2º B e 3º C"
                      value={form.classes_subjects || ''}
                      onChange={(e) => setForm({ ...form, classes_subjects: e.target.value })}
                      maxLength={200}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Justificativa apresentada pelo professor</Label>
                    <Textarea
                      rows={3}
                      placeholder="Inserir justificativa (se houver)"
                      value={form.teacher_justification || ''}
                      onChange={(e) => setForm({ ...form, teacher_justification: e.target.value })}
                      maxLength={1500}
                    />
                  </div>

                  <div className="rounded-md bg-muted/40 p-3 text-sm flex items-center justify-between">
                    <span className="text-muted-foreground">Numeração do documento</span>
                    <span className="font-mono font-semibold">{formatDocNumber(previewDocNumber, previewYear)}</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Corpo do documento</Label>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setEditingBody((v) => !v)}>
                        <Pencil className="w-3.5 h-3.5 mr-1" />
                        {editingBody ? 'Usar texto automático' : 'Editar texto'}
                      </Button>
                    </div>
                    {editingBody ? (
                      <Textarea
                        rows={8}
                        value={customBody || buildNotificationBody(form)}
                        onChange={(e) => setCustomBody(e.target.value)}
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Gerado automaticamente conforme a etapa selecionada. Clique em "Editar texto" para personalizar.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button onClick={handleSave} disabled={saving} className="bg-[#0D47A1] hover:bg-[#0B2E59] text-white">
                      <Save className="w-4 h-4 mr-2" />
                      {editingId ? 'Salvar Alterações' : 'Gerar Documento'}
                    </Button>
                    <Button variant="secondary" onClick={() => setPreviewOpen(true)}>
                      <Eye className="w-4 h-4 mr-2" />
                      Visualizar Prévia
                    </Button>
                    <Button onClick={handlePrint} className="bg-[#C62828] hover:bg-[#a01f1f] text-white">
                      <FileDown className="w-4 h-4 mr-2" />
                      Baixar PDF
                    </Button>
                    <Button variant="outline" onClick={handlePrint}>
                      <Printer className="w-4 h-4 mr-2" />
                      Imprimir
                    </Button>
                    <Button variant="ghost" onClick={resetForm}>
                      <Eraser className="w-4 h-4 mr-2" />
                      Limpar
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* PREVIEW */}
              <div className="xl:sticky xl:top-20 self-start">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Prévia institucional A4</div>
                <div className="bg-[#F5F7FA] p-4 rounded-lg border max-h-[calc(100vh-180px)] overflow-auto">
                  <NotificationPreview
                    data={previewData}
                    docNumber={previewDocNumber}
                    docYear={previewYear}
                    customBody={editingBody ? customBody : null}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-4 space-y-4">
            <Card>
              <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input placeholder="Buscar professor..." value={fTeacher} onChange={(e) => setFTeacher(e.target.value)} />
                <Select value={fStage} onValueChange={(v) => setFStage(v as any)}>
                  <SelectTrigger><SelectValue placeholder="Etapa" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as etapas</SelectItem>
                    <SelectItem value="stage_1">Etapa 1</SelectItem>
                    <SelectItem value="stage_2">Etapa 2</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Disciplina/turma..." value={fSubject} onChange={(e) => setFSubject(e.target.value)} />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">Carregando...</div>
                ) : filtered.length === 0 ? (
                  <div className="p-12 text-center text-sm text-muted-foreground">Nenhuma notificação encontrada.</div>
                ) : (
                  <div className="divide-y">
                    {filtered.map((r) => (
                      <div key={r.id} className="p-4 flex flex-wrap gap-3 items-start justify-between hover:bg-muted/40 transition">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs px-2 py-0.5 bg-[#0D47A1] text-white rounded">
                              {formatDocNumber(r.doc_number, r.doc_year)}
                            </span>
                            <Badge variant={r.stage === 'stage_2' ? 'destructive' : 'secondary'}>
                              {r.stage === 'stage_2' ? 'Etapa 2 — Advertência' : 'Etapa 1 — Orientativa'}
                            </Badge>
                            <span className="font-medium">{r.teacher_name}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Prazo original: {formatDateBR(r.original_deadline)} • Novo prazo: {formatDateBR(r.new_deadline)}
                            {r.classes_subjects ? ` • ${r.classes_subjects}` : ''}
                          </div>
                          <div className="text-sm mt-1 line-clamp-2">{r.reason}</div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => loadRecord(r)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => printRecord(r)}>
                            <Printer className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteRecord(r)} className="text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Prévia da Notificação</DialogTitle>
          </DialogHeader>
          <div className="bg-[#F5F7FA] p-4 rounded">
            <NotificationPreview
              data={previewData}
              docNumber={previewDocNumber}
              docYear={previewYear}
              customBody={editingBody ? customBody : null}
            />
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}