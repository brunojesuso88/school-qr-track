import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, ClipboardList } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import EventCard from '@/components/events/EventCard';
import EventMetrics from '@/components/events/EventMetrics';
import EventFormDialog from '@/components/events/EventFormDialog';
import EventDetailDialog from '@/components/events/EventDetailDialog';
import { SchoolEvent, STATUS_LABELS, EventStatus } from '@/components/events/types';
import jsPDF from 'jspdf';
import logoCepans from '@/assets/logo-cepans.png';

export default function Events() {
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [active, setActive] = useState<SchoolEvent | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch(logoCepans)
      .then(r => r.blob())
      .then(b => new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(b);
      }))
      .then(setLogoDataUrl)
      .catch(() => {});
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('school_events').select('*').order('created_at', { ascending: false });
    if (error) toast.error('Erro ao carregar projetos');
    else setEvents((data || []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter(e => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [e.title, e.enfoque, e.metas, e.pontos_atencao, e.resumo_ia, ...(e.tags || []), ...(e.responsaveis || [])].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [events, search, statusFilter]);

  const onNew = () => { setActive(null); setFormOpen(true); };
  const onEdit = (e: SchoolEvent) => { setActive(e); setFormOpen(true); };
  const onView = (e: SchoolEvent) => { setActive(e); setDetailOpen(true); };

  const onDelete = async (e: SchoolEvent) => {
    if (!window.confirm(`Excluir o projeto "${e.title}"?`)) return;
    const { error } = await supabase.from('school_events').delete().eq('id', e.id);
    if (error) toast.error('Erro ao excluir');
    else { toast.success('Projeto excluído'); load(); }
  };

  const onExport = (e: SchoolEvent) => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 40;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const headerH = 110;
    let y = headerH + 10;

    const drawHeader = () => {
      if (logoDataUrl) {
        try { doc.addImage(logoDataUrl, 'PNG', margin, 24, 64, 64); } catch {}
      }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
      doc.text('CENTRO DE ENSINO PROF. ANTÔNIO NONATO SAMPAIO', margin + 78, 44);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      doc.text('Coelho Neto – MA', margin + 78, 60);
      doc.setFontSize(9); doc.setTextColor(120);
      doc.text('Plano de Ação Escolar — Projetos e Atas', margin + 78, 74);
      doc.setTextColor(0);
      doc.setDrawColor(180); doc.setLineWidth(0.8);
      doc.line(margin, headerH - 10, pageW - margin, headerH - 10);
    };

    const drawFooter = (page: number, total: number) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(140);
      doc.text(`Página ${page} de ${total}`, pageW / 2, pageH - 20, { align: 'center' });
      doc.setTextColor(0);
    };

    const wrap = (text: string, size = 11, bold = false) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size);
      const lines = doc.splitTextToSize(text || '—', pageW - margin * 2);
      lines.forEach((l: string) => {
        if (y > pageH - 50) { doc.addPage(); drawHeader(); y = headerH + 10; }
        doc.text(l, margin, y); y += size + 4;
      });
      y += 4;
    };

    drawHeader();
    wrap(`PROJETO: ${e.title}`, 16, true);
    wrap('IDENTIFICAÇÃO DO PROJETO', 12, true);
    wrap(`Status: ${STATUS_LABELS[e.status]}`, 10);
    if (e.is_continuous) wrap('Período: contínuo', 10);
    else if (e.prazo_inicio) wrap(`Período: ${e.prazo_inicio}${e.prazo_fim ? ' a ' + e.prazo_fim : ''}`, 10);
    if (e.responsaveis.length) wrap('Responsáveis: ' + e.responsaveis.join(', '), 10);
    if (e.tags.length) wrap('Tags: ' + e.tags.join(', '), 10);
    if (e.resumo_ia) wrap(e.resumo_ia);
    if (e.justificativa) { wrap('1. JUSTIFICATIVA', 12, true); wrap(e.justificativa); }
    if (e.objetivo_geral) { wrap('2. OBJETIVO GERAL', 12, true); wrap(e.objetivo_geral); }
    if (e.objetivos_especificos?.length) { wrap('3. OBJETIVOS ESPECÍFICOS', 12, true); e.objetivos_especificos.forEach(a => wrap('• ' + a)); }
    if (e.acoes_estrategicas.length) { wrap('4. PLANO ESTRATÉGICO DO PROJETO', 12, true); e.acoes_estrategicas.forEach(a => wrap('• ' + a)); }
    if (e.metodologia) { wrap('5. METODOLOGIA', 12, true); wrap(e.metodologia); }
    if (e.cronograma?.length) { wrap('6. CRONOGRAMA (Sugestão)', 12, true); e.cronograma.forEach(c => wrap('• ' + c.etapa + (c.periodo ? ' — ' + c.periodo : ''))); }
    if (e.recursos?.length) { wrap('7. RECURSOS NECESSÁRIOS', 12, true); e.recursos.forEach(a => wrap('• ' + a)); }
    if (e.culminancia) { wrap('8. CULMINÂNCIA', 12, true); wrap(e.culminancia); }
    if (e.avaliacao) { wrap('9. AVALIAÇÃO', 12, true); wrap(e.avaliacao); }

    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) { doc.setPage(i); drawFooter(i, total); }
    doc.save(`${e.title.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`);
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><ClipboardList className="w-7 h-7 text-primary" /> Projetos</h1>
            <p className="text-muted-foreground mt-1">Registro inteligente de projetos e ações do plano escolar</p>
          </div>
          <Button onClick={onNew}><Plus className="w-4 h-4" /> Novo Projeto</Button>
        </header>

        <EventMetrics events={events} />

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por título, tema, responsável, tag..." className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {(Object.keys(STATUS_LABELS) as EventStatus[]).map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-12">Carregando...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground/50" />
            <p className="mt-3 text-muted-foreground">Nenhum projeto encontrado</p>
            <Button variant="outline" className="mt-4" onClick={onNew}><Plus className="w-4 h-4" /> Criar primeiro projeto</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(e => (
              <EventCard key={e.id} event={e}
                onView={() => onView(e)} onEdit={() => onEdit(e)} onExport={() => onExport(e)} onDelete={() => onDelete(e)} />
            ))}
          </div>
        )}
      </div>

      <EventFormDialog open={formOpen} onOpenChange={setFormOpen} event={active} onSaved={load} />
      <EventDetailDialog open={detailOpen} onOpenChange={setDetailOpen} event={active} />
    </DashboardLayout>
  );
}