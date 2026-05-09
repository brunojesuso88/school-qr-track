import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Pencil, FileDown, Trash2, Calendar, Users, Target, ListChecks, Workflow, AlertTriangle, Paperclip } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SchoolEvent, STATUS_COLORS, STATUS_LABELS } from './types';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  event: SchoolEvent;
  onView: () => void;
  onEdit: () => void;
  onExport: () => void;
  onDelete: () => void;
}

export default function EventCard({ event, onView, onEdit, onExport, onDelete }: Props) {
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    const first = event.images?.[0];
    if (!first) { setThumb(null); return; }
    supabase.storage.from('school-events').createSignedUrl(first, 3600).then(({ data }) => {
      setThumb(data?.signedUrl ?? null);
    });
  }, [event.images]);

  const dateLabel = event.is_continuous
    ? 'Evento contínuo'
    : event.prazo_inicio
      ? `${format(new Date(event.prazo_inicio + 'T12:00'), "dd 'de' MMM yyyy", { locale: ptBR })}${event.prazo_fim ? ` → ${format(new Date(event.prazo_fim + 'T12:00'), "dd 'de' MMM yyyy", { locale: ptBR })}` : ''}`
      : format(new Date(event.created_at), "dd 'de' MMM yyyy", { locale: ptBR });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="overflow-hidden hover:shadow-lg transition-shadow border-l-4 border-l-primary/60">
        <div className="flex flex-col md:flex-row">
          {thumb && (
            <div className="md:w-48 h-40 md:h-auto bg-muted shrink-0">
              <img src={thumb} alt={event.title} className="w-full h-full object-cover" />
            </div>
          )}
          <CardContent className="flex-1 p-5 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-foreground leading-tight">{event.title || 'Sem título'}</h3>
                {event.enfoque && (
                  <p className="text-xs text-muted-foreground line-clamp-1"><span className="font-medium">Enfoque:</span> {event.enfoque}</p>
                )}
              </div>
              <Badge variant="outline" className={STATUS_COLORS[event.status]}>{STATUS_LABELS[event.status]}</Badge>
            </div>

            {event.resumo_ia && (
              <p className="text-sm text-muted-foreground line-clamp-2 italic">{event.resumo_ia}</p>
            )}

            {event.metas && (
              <p className="text-xs text-foreground/80 line-clamp-1"><span className="font-medium">Metas:</span> {event.metas}</p>
            )}

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {event.acoes_estrategicas.length > 0 && (
                <span className="inline-flex items-center gap-1"><Target className="w-3.5 h-3.5" />{event.acoes_estrategicas.length} ações</span>
              )}
              {event.procedimentos.length > 0 && (
                <span className="inline-flex items-center gap-1"><Workflow className="w-3.5 h-3.5" />{event.procedimentos.length} procedimentos</span>
              )}
              {event.pontos_atencao && (
                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"><AlertTriangle className="w-3.5 h-3.5" />Pontos de atenção</span>
              )}
              {event.pdf_original && (
                <span className="inline-flex items-center gap-1"><Paperclip className="w-3.5 h-3.5" />PDF importado</span>
              )}
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{dateLabel}</span>
              {event.responsaveis.length > 0 && (
                <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" />{event.responsaveis.slice(0, 3).join(', ')}{event.responsaveis.length > 3 ? ` +${event.responsaveis.length - 3}` : ''}</span>
              )}
            </div>

            {event.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {event.tags.slice(0, 6).map((t, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px] font-normal">{t}</Badge>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={onView}><Eye className="w-4 h-4" />Visualizar</Button>
              <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="w-4 h-4" />Editar</Button>
              <Button size="sm" variant="outline" onClick={onExport}><FileDown className="w-4 h-4" />PDF</Button>
              <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="w-4 h-4" />Excluir</Button>
            </div>
          </CardContent>
        </div>
      </Card>
    </motion.div>
  );
}