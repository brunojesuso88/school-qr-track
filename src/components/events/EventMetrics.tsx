import { Card } from '@/components/ui/card';
import { CalendarCheck, Clock, ListChecks, CalendarDays } from 'lucide-react';
import { SchoolEvent } from './types';

export default function EventMetrics({ events }: { events: SchoolEvent[] }) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const total = events.length;
  const monthCount = events.filter(e => new Date(e.created_at) >= monthStart).length;
  const inProgress = events.filter(e => e.status === 'em_andamento').length;
  const done = events.filter(e => e.status === 'concluido').length;

  const cards = [
    { label: 'Total de eventos', value: total, icon: CalendarDays, color: 'text-primary bg-primary/10' },
    { label: 'Eventos do mês', value: monthCount, icon: CalendarCheck, color: 'text-blue-500 bg-blue-500/10' },
    { label: 'Em andamento', value: inProgress, icon: Clock, color: 'text-amber-500 bg-amber-500/10' },
    { label: 'Concluídos', value: done, icon: ListChecks, color: 'text-emerald-500 bg-emerald-500/10' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map(c => (
        <Card key={c.label} className="p-4 flex items-center gap-3">
          <div className={`p-3 rounded-lg ${c.color}`}><c.icon className="w-5 h-5" /></div>
          <div>
            <div className="text-2xl font-bold leading-none">{c.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{c.label}</div>
          </div>
        </Card>
      ))}
    </div>
  );
}