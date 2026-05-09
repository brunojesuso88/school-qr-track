import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Pencil, FileDown, Trash2, Target, Workflow, Paperclip, ClipboardList } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
    const path = event.cover_image || event.images?.[0];
    if (!path) { setThumb(null); return; }
    supabase.storage.from('school-events').createSignedUrl(path, 3600).then(({ data }) => {
      setThumb(data?.signedUrl ?? null);
    });
  }, [event.cover_image, event.images]);

  const dateLabel = event.is_continuous
    ? 'Projeto contínuo'
    : event.prazo_inicio
      ? `${format(new Date(event.prazo_inicio + 'T12:00'), 'dd MMM yyyy', { locale: ptBR })}${event.prazo_fim ? ` → ${format(new Date(event.prazo_fim + 'T12:00'), 'dd MMM yyyy', { locale: ptBR })}` : ''}`
      : format(new Date(event.created_at), 'dd MMM yyyy', { locale: ptBR });

  const IconBtn = ({ label, onClick, icon: Icon, danger }: { label: string; onClick: () => void; icon: any; danger?: boolean }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="icon" variant="ghost" onClick={onClick}
          className={`h-8 w-8 ${danger ? 'text-destructive hover:text-destructive' : ''}`}>
          <Icon className="w-4 h-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="overflow-hidden hover:shadow-md transition-shadow border-l-2 border-l-primary/50">
        <div className="flex flex-col sm:flex-row gap-4 p-4">
          <div className="w-full sm:w-40 sm:h-40 aspect-square max-w-[200px] mx-auto sm:mx-0 shrink-0 rounded-md overflow-hidden bg-muted border border-border flex items-center justify-center">
            {thumb ? (
              <img src={thumb} alt={event.title} className="w-full h-full object-cover" />
            ) : (
              <ClipboardList className="w-10 h-10 text-muted-foreground/40" />
            )}
          </div>

          <CardContent className="flex-1 p-0 flex flex-col justify-between gap-3 min-w-0">
            <div className="space-y-2 min-w-0">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground font-mono">
                <Badge variant="outline" className={`${STATUS_COLORS[event.status]} text-[10px] uppercase tracking-wider font-mono px-1.5 py-0`}>{STATUS_LABELS[event.status]}</Badge>
                <span className="truncate">{dateLabel}</span>
              </div>

              <h3 className="text-base font-semibold text-foreground tracking-tight leading-snug line-clamp-2">{event.title || 'Sem título'}</h3>

              {event.resumo_ia && (
                <p className="text-sm text-muted-foreground line-clamp-2">{event.resumo_ia}</p>
              )}

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {event.acoes_estrategicas.length > 0 && (
                  <span className="inline-flex items-center gap-1"><Target className="w-3.5 h-3.5" />{event.acoes_estrategicas.length} ações</span>
                )}
                {event.procedimentos.length > 0 && (
                  <span className="inline-flex items-center gap-1"><Workflow className="w-3.5 h-3.5" />{event.procedimentos.length} procedimentos</span>
                )}
                {event.pdf_original && (
                  <span className="inline-flex items-center gap-1"><Paperclip className="w-3.5 h-3.5" />PDF</span>
                )}
              </div>

              {event.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {event.tags.slice(0, 3).map((t, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px] font-normal">{t}</Badge>
                  ))}
                  {event.tags.length > 3 && (
                    <Badge variant="secondary" className="text-[10px] font-normal">+{event.tags.length - 3}</Badge>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end items-center gap-1 pt-1 border-t border-border/50">
              <TooltipProvider delayDuration={200}>
                <IconBtn label="Visualizar" onClick={onView} icon={Eye} />
                <IconBtn label="Editar" onClick={onEdit} icon={Pencil} />
                <IconBtn label="Exportar PDF" onClick={onExport} icon={FileDown} />
                <IconBtn label="Excluir" onClick={onDelete} icon={Trash2} danger />
              </TooltipProvider>
            </div>
          </CardContent>
        </div>
      </Card>
    </motion.div>
  );
}