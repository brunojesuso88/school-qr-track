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

export default function Events() {
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [active, setActive] = useState<SchoolEvent | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('school_events').select('*').order('created_at', { ascending: false });
    if (error) toast.error('Erro ao carregar eventos');
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
    if (!window.confirm(`Excluir "${e.title}"?`)) return;
    const { error } = await supabase.from('school_events').delete().eq('id', e.id);
    if (error) toast.error('Erro ao excluir');
    else { toast.success('Evento excluído'); load(); }
  };

  const onExport = (e: SchoolEvent) => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 40;
    let y = margin;
    const pageW = doc.internal.pageSize.getWidth();
    const wrap = (text: string, size = 11, bold = false) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size);
      const lines = doc.splitTextToSize(text || '—', pageW - margin * 2);
      lines.forEach((l: string) => {
        if (y > 780) { doc.addPage(); y = margin; }
        doc.text(l, margin, y); y += size + 4;
      });
      y += 4;
    };
    wrap(e.title, 18, true);
    wrap(`Status: ${STATUS_LABELS[e.status]}`, 10);
    if (e.is_continuous) wrap('Período: contínuo', 10);
    else if (e.prazo_inicio) wrap(`Período: ${e.prazo_inicio}${e.prazo_fim ? ' a ' + e.prazo_fim : ''}`, 10);
    if (e.resumo_ia) { wrap('Resumo', 12, true); wrap(e.resumo_ia); }
    if (e.enfoque) { wrap('1. Enfoque', 12, true); wrap(e.enfoque); }
    if (e.metas) { wrap('2. Metas', 12, true); wrap(e.metas); }
    if (e.pontos_atencao) { wrap('3. Pontos de atenção', 12, true); wrap(e.pontos_atencao); }
    if (e.acoes_estrategicas.length) { wrap('4. Ações estratégicas', 12, true); e.acoes_estrategicas.forEach(a => wrap('• ' + a)); }
    if (e.procedimentos.length) { wrap('5. Procedimentos', 12, true); e.procedimentos.forEach(a => wrap('• ' + a)); }
    if (e.responsaveis.length) { wrap('6. Responsáveis', 12, true); wrap(e.responsaveis.join(', ')); }
    if (e.tags.length) { wrap('Tags: ' + e.tags.join(', '), 10); }
    doc.save(`${e.title.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`);
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><ClipboardList className="w-7 h-7 text-primary" /> Eventos e Atas</h1>
            <p className="text-muted-foreground mt-1">Registro inteligente de ações e eventos do plano escolar</p>
          </div>
          <Button onClick={onNew}><Plus className="w-4 h-4" /> Novo Evento</Button>
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
            <p className="mt-3 text-muted-foreground">Nenhum evento encontrado</p>
            <Button variant="outline" className="mt-4" onClick={onNew}><Plus className="w-4 h-4" /> Criar primeiro evento</Button>
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