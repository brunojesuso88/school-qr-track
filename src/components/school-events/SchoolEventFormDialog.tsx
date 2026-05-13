import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { SchoolEventSimple, emptySchoolEvent } from './types';

type Draft = Omit<SchoolEventSimple, 'id' | 'created_at' | 'updated_at' | 'created_by'> & { id?: string };

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  event: SchoolEventSimple | null;
  onSaved: () => void;
}

export default function SchoolEventFormDialog({ open, onOpenChange, event, onSaved }: Props) {
  const [data, setData] = useState<Draft>({ ...emptySchoolEvent });
  const [saving, setSaving] = useState(false);
  const [coverThumb, setCoverThumb] = useState<string | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const fileCoverRef = useRef<HTMLInputElement>(null);
  const fileImgRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setData(event ? { ...event } : { ...emptySchoolEvent });
  }, [open, event]);

  useEffect(() => {
    if (!data.cover_image) { setCoverThumb(null); return; }
    supabase.storage.from('school-events').createSignedUrl(data.cover_image, 3600)
      .then(({ data: s }) => setCoverThumb(s?.signedUrl ?? null));
  }, [data.cover_image]);

  useEffect(() => {
    (async () => {
      const next: Record<string, string> = {};
      for (const path of data.images) {
        if (thumbs[path]) { next[path] = thumbs[path]; continue; }
        const { data: s } = await supabase.storage.from('school-events').createSignedUrl(path, 3600);
        if (s?.signedUrl) next[path] = s.signedUrl;
      }
      setThumbs(next);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.images]);

  const update = <K extends keyof Draft>(k: K, v: Draft[K]) => setData(d => ({ ...d, [k]: v }));

  const uploadCover = async (file: File | undefined) => {
    if (!file) return;
    setCoverBusy(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `simple-covers/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('school-events').upload(path, file, { upsert: false });
      if (error) throw error;
      if (data.cover_image) {
        await supabase.storage.from('school-events').remove([data.cover_image]);
      }
      update('cover_image', path);
    } catch (e: any) {
      toast.error(e.message || 'Erro no upload da capa');
    } finally {
      setCoverBusy(false);
    }
  };

  const removeCover = async () => {
    if (!data.cover_image) return;
    await supabase.storage.from('school-events').remove([data.cover_image]);
    update('cover_image', null);
  };

  const uploadImages = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setImgBusy(true);
    try {
      const paths: string[] = [];
      for (const f of Array.from(files)) {
        const path = `simple-images/${crypto.randomUUID()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const { error } = await supabase.storage.from('school-events').upload(path, f, { upsert: false });
        if (error) throw error;
        paths.push(path);
      }
      update('images', [...data.images, ...paths]);
    } catch (e: any) {
      toast.error(e.message || 'Erro no upload');
    } finally {
      setImgBusy(false);
    }
  };

  const removeImage = async (path: string) => {
    await supabase.storage.from('school-events').remove([path]);
    update('images', data.images.filter(p => p !== path));
  };

  const save = async () => {
    if (!data.name.trim()) { toast.error('Informe o nome do evento'); return; }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const payload = {
        name: data.name.trim(),
        event_date: data.event_date || null,
        description: data.description || '',
        cover_image: data.cover_image,
        images: data.images,
      };
      if (data.id) {
        const { error } = await supabase.from('school_event_simple').update(payload).eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('school_event_simple').insert({ ...payload, created_by: u.user?.id });
        if (error) throw error;
      }
      toast.success('Evento salvo');
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{data.id ? 'Editar Evento' : 'Novo Evento'}</DialogTitle>
          <DialogDescription>Preencha as informações do evento e adicione fotos.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="info" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="info">Informações</TabsTrigger>
            <TabsTrigger value="media">Mídia</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do evento *</Label>
              <Input id="name" value={data.name} onChange={e => update('name', e.target.value)} placeholder="Ex: Festa Junina 2026" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event_date">Data do evento</Label>
              <Input id="event_date" type="date" value={data.event_date || ''} onChange={e => update('event_date', e.target.value || null)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea id="description" rows={6} value={data.description} onChange={e => update('description', e.target.value)} placeholder="Descreva o evento..." />
            </div>
          </TabsContent>

          <TabsContent value="media" className="space-y-6 mt-4">
            <div className="space-y-2">
              <Label>Capa do evento</Label>
              <div className="flex items-start gap-4">
                <div className="w-40 h-40 rounded-md overflow-hidden bg-muted border border-border flex items-center justify-center shrink-0">
                  {coverThumb ? (
                    <img src={coverThumb} alt="Capa" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-10 h-10 text-muted-foreground/40" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => fileCoverRef.current?.click()} disabled={coverBusy}>
                    {coverBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                    {data.cover_image ? 'Trocar capa' : 'Enviar capa'}
                  </Button>
                  {data.cover_image && (
                    <Button type="button" variant="ghost" size="sm" onClick={removeCover}>
                      <X className="w-4 h-4 mr-2" /> Remover
                    </Button>
                  )}
                  <input ref={fileCoverRef} type="file" accept="image/*" className="hidden" onChange={e => uploadCover(e.target.files?.[0])} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Fotos do evento</Label>
              <div
                className="border-2 border-dashed rounded-md p-6 text-center cursor-pointer hover:bg-muted/50 transition"
                onClick={() => fileImgRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); uploadImages(e.dataTransfer.files); }}
              >
                {imgBusy ? (
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                ) : (
                  <>
                    <Upload className="w-6 h-6 mx-auto text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">Clique ou arraste fotos para enviar</p>
                  </>
                )}
                <input ref={fileImgRef} type="file" multiple accept="image/*" className="hidden" onChange={e => uploadImages(e.target.files)} />
              </div>
              {data.images.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
                  {data.images.map(p => (
                    <div key={p} className="relative aspect-square rounded-md overflow-hidden bg-muted border border-border group">
                      {thumbs[p] && <img src={thumbs[p]} alt="" className="w-full h-full object-cover" />}
                      <button
                        type="button"
                        onClick={() => removeImage(p)}
                        className="absolute top-1 right-1 p-1 rounded bg-background/80 opacity-0 group-hover:opacity-100 transition"
                        aria-label="Remover foto"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}