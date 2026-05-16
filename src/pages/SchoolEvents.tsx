import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, CalendarDays } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import SchoolEventCard from '@/components/school-events/SchoolEventCard';
import SchoolEventFormDialog from '@/components/school-events/SchoolEventFormDialog';
import SchoolEventDetailDialog from '@/components/school-events/SchoolEventDetailDialog';
import { SchoolEventSimple } from '@/components/school-events/types';

export default function SchoolEvents() {
  const [events, setEvents] = useState<SchoolEventSimple[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [active, setActive] = useState<SchoolEventSimple | null>(null);
  const [searchParams] = useSearchParams();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('school_event_simple')
      .select('*')
      .order('event_date', { ascending: false, nullsFirst: false });
    if (error) toast.error('Erro ao carregar eventos');
    else setEvents((data || []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const id = searchParams.get('id');
    if (id && events.length) {
      const found = events.find(e => e.id === id);
      if (found) { setActive(found); setDetailOpen(true); }
    }
  }, [events, searchParams]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter(e => `${e.name} ${e.description}`.toLowerCase().includes(q));
  }, [events, search]);

  const onNew = () => { setActive(null); setFormOpen(true); };
  const onEdit = (e: SchoolEventSimple) => { setActive(e); setFormOpen(true); };
  const onView = (e: SchoolEventSimple) => { setActive(e); setDetailOpen(true); };

  const onDelete = async (e: SchoolEventSimple) => {
    if (!window.confirm(`Excluir o evento "${e.name}"?`)) return;
    const paths = [...(e.images || []), ...(e.cover_image ? [e.cover_image] : [])];
    if (paths.length) await supabase.storage.from('school-events').remove(paths);
    const { error } = await supabase.from('school_event_simple').delete().eq('id', e.id);
    if (error) toast.error('Erro ao excluir');
    else { toast.success('Evento excluído'); load(); }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <CalendarDays className="w-7 h-7 text-primary" /> Eventos
            </h1>
            <p className="text-muted-foreground mt-1">Registro de eventos da escola com fotos e descrição</p>
          </div>
          <Button onClick={onNew}><Plus className="w-4 h-4" /> Novo Evento</Button>
        </header>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou descrição..." className="pl-9" />
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-12">Carregando...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <CalendarDays className="w-12 h-12 mx-auto text-muted-foreground/50" />
            <p className="mt-3 text-muted-foreground">Nenhum evento encontrado</p>
            <Button variant="outline" className="mt-4" onClick={onNew}><Plus className="w-4 h-4" /> Criar primeiro evento</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(e => (
              <SchoolEventCard
                key={e.id}
                event={e}
                onView={() => onView(e)}
                onEdit={() => onEdit(e)}
                onDelete={() => onDelete(e)}
              />
            ))}
          </div>
        )}
      </div>

      <SchoolEventFormDialog open={formOpen} onOpenChange={setFormOpen} event={active} onSaved={load} />
      <SchoolEventDetailDialog open={detailOpen} onOpenChange={setDetailOpen} event={active} />
    </DashboardLayout>
  );
}