import { Calendar, Eye, Pencil, Trash2, ImageIcon, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SchoolEventSimple } from './types';
import { toast } from 'sonner';

interface Props {
  event: SchoolEventSimple;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const formatDate = (d: string | null) => {
  if (!d) return 'Data não definida';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

export default function SchoolEventCard({ event, onView, onEdit, onDelete }: Props) {
  const [cover, setCover] = useState<string | null>(null);

  const handleShare = async () => {
    const url = `${window.location.origin}/school-events?id=${event.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copiado para a área de transferência');
    } catch {
      toast.error('Não foi possível copiar o link');
    }
  };

  useEffect(() => {
    if (!event.cover_image) { setCover(null); return; }
    supabase.storage.from('school-events').createSignedUrl(event.cover_image, 3600)
      .then(({ data }) => setCover(data?.signedUrl ?? null));
  }, [event.cover_image]);

  return (
    <article className="bg-card border border-border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
      <div className="flex flex-col sm:flex-row gap-4 p-4">
        <div className="w-full sm:w-40 sm:h-40 aspect-square max-w-[200px] mx-auto sm:mx-0 rounded-md overflow-hidden bg-muted border border-border flex items-center justify-center shrink-0">
          {cover ? (
            <img src={cover} alt={event.name} className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-10 h-10 text-muted-foreground/40" />
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5" />
            <span>{formatDate(event.event_date)}</span>
            {event.images.length > 0 && (
              <span className="ml-auto text-muted-foreground/70">{event.images.length} foto{event.images.length > 1 ? 's' : ''}</span>
            )}
          </div>
          <h3 className="mt-1 text-lg font-semibold leading-tight line-clamp-2">{event.name}</h3>
          {event.description && (
            <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{event.description}</p>
          )}

          <div className="mt-auto pt-3 border-t border-border/50 flex items-center gap-1">
            <TooltipProvider delayDuration={200}>
              <IconBtn label="Visualizar" onClick={onView}><Eye className="w-4 h-4" /></IconBtn>
              <IconBtn label="Editar" onClick={onEdit}><Pencil className="w-4 h-4" /></IconBtn>
              <IconBtn label="Compartilhar link" onClick={handleShare}><Link2 className="w-4 h-4" /></IconBtn>
              <IconBtn label="Excluir" onClick={onDelete} danger><Trash2 className="w-4 h-4" /></IconBtn>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </article>
  );
}

function IconBtn({ label, onClick, children, danger }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClick}
          className={danger ? 'text-destructive hover:text-destructive hover:bg-destructive/10' : ''}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}