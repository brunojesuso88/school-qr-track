import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SchoolEventSimple } from './types';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  event: SchoolEventSimple | null;
}

const formatDate = (d: string | null) => {
  if (!d) return 'Data não definida';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

export default function SchoolEventDetailDialog({ open, onOpenChange, event }: Props) {
  const [cover, setCover] = useState<string | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!event?.cover_image) { setCover(null); return; }
    supabase.storage.from('school-events').createSignedUrl(event.cover_image, 3600)
      .then(({ data }) => setCover(data?.signedUrl ?? null));
  }, [event?.cover_image]);

  useEffect(() => {
    if (!event) return;
    (async () => {
      const next: Record<string, string> = {};
      for (const path of event.images) {
        const { data: s } = await supabase.storage.from('school-events').createSignedUrl(path, 3600);
        if (s?.signedUrl) next[path] = s.signedUrl;
      }
      setThumbs(next);
    })();
  }, [event]);

  if (!event) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="aspect-video rounded-md overflow-hidden bg-muted border border-border flex items-center justify-center">
            {cover ? (
              <img src={cover} alt={event.name} className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="w-12 h-12 text-muted-foreground/40" />
            )}
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>{formatDate(event.event_date)}</span>
          </div>

          {event.description && (
            <div>
              <h4 className="text-sm font-semibold mb-1">Descrição</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.description}</p>
            </div>
          )}

          {event.images.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Fotos ({event.images.length})</h4>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {event.images.map(p => (
                  <a
                    key={p}
                    href={thumbs[p]}
                    target="_blank"
                    rel="noreferrer"
                    className="aspect-square rounded-md overflow-hidden bg-muted border border-border block"
                  >
                    {thumbs[p] && <img src={thumbs[p]} alt="" className="w-full h-full object-cover" />}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}