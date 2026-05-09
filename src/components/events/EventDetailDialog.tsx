import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SchoolEvent, STATUS_COLORS, STATUS_LABELS } from './types';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export default function EventDetailDialog({ open, onOpenChange, event }: { open: boolean; onOpenChange: (o: boolean) => void; event: SchoolEvent | null }) {
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!event) return;
    (async () => {
      const next: Record<string, string> = {};
      for (const path of event.images || []) {
        const { data: signed } = await supabase.storage.from('school-events').createSignedUrl(path, 3600);
        if (signed?.signedUrl) next[path] = signed.signedUrl;
      }
      setThumbs(next);
    })();
  }, [event]);

  if (!event) return null;

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="space-y-1">
      <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide">{title}</h4>
      <div className="text-sm text-muted-foreground whitespace-pre-wrap">{children}</div>
    </section>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{event.title}</DialogTitle>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="outline" className={STATUS_COLORS[event.status]}>{STATUS_LABELS[event.status]}</Badge>
            {event.tags.map((t, i) => <Badge key={i} variant="secondary">{t}</Badge>)}
          </div>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {event.resumo_ia && <p className="italic text-muted-foreground border-l-2 border-primary pl-3">{event.resumo_ia}</p>}

          <div className="text-xs text-muted-foreground">
            {event.is_continuous ? 'Projeto contínuo' : (
              event.prazo_inicio ? `${format(new Date(event.prazo_inicio + 'T12:00'), "dd/MM/yyyy", { locale: ptBR })}${event.prazo_fim ? ` → ${format(new Date(event.prazo_fim + 'T12:00'), 'dd/MM/yyyy', { locale: ptBR })}` : ''}` : '—'
            )}
          </div>

          {event.responsaveis.length > 0 && <Section title="Responsáveis">{event.responsaveis.join(', ')}</Section>}
          {event.justificativa && <Section title="1. Justificativa">{event.justificativa}</Section>}
          {event.objetivo_geral && <Section title="2. Objetivo geral">{event.objetivo_geral}</Section>}
          {event.objetivos_especificos?.length > 0 && <Section title="3. Objetivos específicos"><ul className="list-disc pl-5">{event.objetivos_especificos.map((a, i) => <li key={i}>{a}</li>)}</ul></Section>}
          {event.acoes_estrategicas.length > 0 && <Section title="4. Plano estratégico do projeto"><ul className="list-disc pl-5">{event.acoes_estrategicas.map((a, i) => <li key={i}>{a}</li>)}</ul></Section>}
          {event.metodologia && <Section title="5. Metodologia">{event.metodologia}</Section>}
          {event.cronograma?.length > 0 && <Section title="6. Cronograma (sugestão)"><ul className="list-disc pl-5">{event.cronograma.map((c, i) => <li key={i}>{c.etapa}{c.periodo ? ` — ${c.periodo}` : ''}</li>)}</ul></Section>}
          {event.recursos?.length > 0 && <Section title="7. Recursos necessários"><ul className="list-disc pl-5">{event.recursos.map((a, i) => <li key={i}>{a}</li>)}</ul></Section>}
          {event.culminancia && <Section title="8. Culminância">{event.culminancia}</Section>}
          {event.avaliacao && <Section title="9. Avaliação">{event.avaliacao}</Section>}

          {event.images.length > 0 && (
            <Section title="Fotos">
              <div className="grid grid-cols-3 gap-3 mt-2">
                {event.images.map(p => thumbs[p] ? <img key={p} src={thumbs[p]} className="rounded aspect-square object-cover" /> : null)}
              </div>
            </Section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}