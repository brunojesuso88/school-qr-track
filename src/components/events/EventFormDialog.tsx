import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Plus, Trash2, FileUp, Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { SchoolEvent, EventStatus, STATUS_LABELS, emptyEvent } from './types';

type EventDraft = Omit<SchoolEvent, 'id' | 'created_at' | 'updated_at' | 'created_by'> & { id?: string };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: SchoolEvent | null;
  onSaved: () => void;
}

export default function EventFormDialog({ open, onOpenChange, event, onSaved }: Props) {
  const [data, setData] = useState<EventDraft>({ ...emptyEvent });
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const fileImgRef = useRef<HTMLInputElement>(null);
  const filePdfRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setData(event ? { ...event } : { ...emptyEvent });
    }
  }, [open, event]);

  useEffect(() => {
    (async () => {
      const next: Record<string, string> = {};
      for (const path of data.images) {
        if (thumbs[path]) { next[path] = thumbs[path]; continue; }
        const { data: signed } = await supabase.storage.from('school-events').createSignedUrl(path, 3600);
        if (signed?.signedUrl) next[path] = signed.signedUrl;
      }
      setThumbs(next);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.images]);

  const update = <K extends keyof EventDraft>(k: K, v: EventDraft[K]) => setData(d => ({ ...d, [k]: v }));

  const aiSuggest = async (field: string) => {
    setAiBusy(field);
    try {
      const { data: res, error } = await supabase.functions.invoke('event-ai-suggest', {
        body: { field, context: data },
      });
      if (error || !res?.success) throw new Error(res?.error || error?.message || 'Falha');
      if (Array.isArray(res.items)) {
        if (field === 'tags') update('tags', Array.from(new Set([...(data.tags || []), ...res.items])));
        else if (field === 'acoes_estrategicas') update('acoes_estrategicas', [...(data.acoes_estrategicas || []), ...res.items]);
        else if (field === 'procedimentos') update('procedimentos', [...(data.procedimentos || []), ...res.items]);
        else if (field === 'pontos_atencao') update('pontos_atencao', [data.pontos_atencao, ...res.items.map((x: string) => `• ${x}`)].filter(Boolean).join('\n'));
      } else if (res.text) {
        update(field as any, res.text);
      }
      toast.success('Sugestão aplicada');
    } catch (e: any) {
      toast.error(e.message || 'Erro na IA');
    } finally {
      setAiBusy(null);
    }
  };

  const aiFillAll = async () => {
    setAiBusy('all');
    try {
      const { data: res, error } = await supabase.functions.invoke('event-ai-fill', { body: { draft: data } });
      if (error || !res?.success) throw new Error(res?.error || error?.message || 'Falha');
      setData(d => ({ ...d, ...res.event }));
      toast.success('Evento preenchido pela IA');
    } catch (e: any) {
      toast.error(e.message || 'Erro na IA');
    } finally {
      setAiBusy(null);
    }
  };

  const importPdf = async (file: File) => {
    setPdfBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const b64 = btoa(bin);
      const { data: res, error } = await supabase.functions.invoke('parse-event-pdf', { body: { pdfBase64: b64 } });
      if (error || !res?.success) throw new Error(res?.error || error?.message || 'Falha');
      // upload pdf
      const path = `pdfs/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      await supabase.storage.from('school-events').upload(path, file, { upsert: false });
      setData(d => ({ ...d, ...res.event, pdf_original: path }));
      toast.success('PDF analisado e campos preenchidos');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao processar PDF');
    } finally {
      setPdfBusy(false);
    }
  };

  const uploadImages = async (files: FileList | null) => {
    if (!files?.length) return;
    setImageBusy(true);
    try {
      const paths: string[] = [];
      for (const f of Array.from(files)) {
        if (!f.type.startsWith('image/')) continue;
        const path = `images/${crypto.randomUUID()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const { error } = await supabase.storage.from('school-events').upload(path, f, { upsert: false });
        if (!error) paths.push(path);
      }
      update('images', [...data.images, ...paths]);
      toast.success(`${paths.length} imagem(ns) enviada(s)`);
    } catch (e: any) {
      toast.error(e.message || 'Erro no upload');
    } finally {
      setImageBusy(false);
    }
  };

  const removeImage = async (path: string) => {
    await supabase.storage.from('school-events').remove([path]);
    update('images', data.images.filter(p => p !== path));
  };

  const addItem = (key: 'acoes_estrategicas' | 'procedimentos' | 'responsaveis' | 'tags') => {
    update(key, [...(data[key] as string[]), '']);
  };
  const updateItem = (key: 'acoes_estrategicas' | 'procedimentos' | 'responsaveis' | 'tags', i: number, v: string) => {
    const arr = [...(data[key] as string[])]; arr[i] = v; update(key, arr);
  };
  const removeItem = (key: 'acoes_estrategicas' | 'procedimentos' | 'responsaveis' | 'tags', i: number) => {
    update(key, (data[key] as string[]).filter((_, idx) => idx !== i));
  };

  const save = async () => {
    if (!data.title.trim()) { toast.error('Título é obrigatório'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = {
        title: data.title,
        enfoque: data.enfoque || '',
        metas: data.metas || '',
        pontos_atencao: data.pontos_atencao || '',
        acoes_estrategicas: (data.acoes_estrategicas || []).filter(s => s.trim()),
        procedimentos: (data.procedimentos || []).filter(s => s.trim()),
        responsaveis: (data.responsaveis || []).filter(s => s.trim()),
        prazo_inicio: data.is_continuous ? null : data.prazo_inicio,
        prazo_fim: data.is_continuous ? null : data.prazo_fim,
        is_continuous: data.is_continuous,
        status: data.status,
        tags: (data.tags || []).filter(s => s.trim()),
        resumo_ia: data.resumo_ia || '',
        images: data.images,
        pdf_original: data.pdf_original,
      };
      if (event?.id) {
        const { error } = await supabase.from('school_events').update(payload).eq('id', event.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('school_events').insert({ ...payload, created_by: user?.id });
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

  const AiBtn = ({ field }: { field: string }) => (
    <Button type="button" size="sm" variant="ghost" onClick={() => aiSuggest(field)} disabled={aiBusy === field} className="text-primary">
      {aiBusy === field ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} IA
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" onInteractOutside={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{event ? 'Editar evento' : 'Novo evento'}</DialogTitle>
          <DialogDescription>Preencha as informações do evento ou use a IA para acelerar.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 mb-4 p-3 bg-muted/40 rounded-lg">
          <Button type="button" variant="default" size="sm" onClick={aiFillAll} disabled={aiBusy === 'all'}>
            {aiBusy === 'all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Preencher com IA
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => filePdfRef.current?.click()} disabled={pdfBusy}>
            {pdfBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
            {pdfBusy ? 'Analisando documento com IA...' : 'Importar PDF'}
          </Button>
          <input type="file" ref={filePdfRef} accept="application/pdf" className="hidden" onChange={e => e.target.files?.[0] && importPdf(e.target.files[0])} />
        </div>

        <Tabs defaultValue="ident">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="ident">Identificação</TabsTrigger>
            <TabsTrigger value="conteudo">Conteúdo</TabsTrigger>
            <TabsTrigger value="execucao">Execução</TabsTrigger>
            <TabsTrigger value="midia">Mídia</TabsTrigger>
          </TabsList>

          <TabsContent value="ident" className="space-y-4 pt-4">
            <div>
              <Label>Título *</Label>
              <Input value={data.title} onChange={e => update('title', e.target.value)} placeholder="Ex.: Feira de Ciências 2026" />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Status</Label>
                <Select value={data.status} onValueChange={(v: EventStatus) => update('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABELS) as EventStatus[]).map(s => (
                      <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-3 pb-1">
                <Switch id="continuous" checked={data.is_continuous} onCheckedChange={v => update('is_continuous', v)} />
                <Label htmlFor="continuous" className="cursor-pointer">Evento contínuo</Label>
              </div>
            </div>
            {!data.is_continuous && (
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Data início</Label>
                  <Input type="date" value={data.prazo_inicio || ''} onChange={e => update('prazo_inicio', e.target.value || null)} />
                </div>
                <div>
                  <Label>Data fim</Label>
                  <Input type="date" value={data.prazo_fim || ''} onChange={e => update('prazo_fim', e.target.value || null)} />
                </div>
              </div>
            )}
            <div>
              <div className="flex items-center justify-between"><Label>Resumo institucional</Label><AiBtn field="resumo_ia" /></div>
              <Textarea rows={3} value={data.resumo_ia} onChange={e => update('resumo_ia', e.target.value)} placeholder="Breve descrição institucional do evento" />
            </div>
          </TabsContent>

          <TabsContent value="conteudo" className="space-y-4 pt-4">
            <div>
              <div className="flex items-center justify-between"><Label>1. Enfoque</Label><AiBtn field="enfoque" /></div>
              <Textarea rows={3} value={data.enfoque} onChange={e => update('enfoque', e.target.value)} placeholder="Indicador educacional relacionado ao evento" />
            </div>
            <div>
              <div className="flex items-center justify-between"><Label>2. Metas</Label><AiBtn field="metas" /></div>
              <Textarea rows={3} value={data.metas} onChange={e => update('metas', e.target.value)} placeholder="Resultados mensuráveis esperados (SMART)" />
            </div>
            <div>
              <div className="flex items-center justify-between"><Label>3. Pontos de atenção</Label><AiBtn field="pontos_atencao" /></div>
              <Textarea rows={4} value={data.pontos_atencao} onChange={e => update('pontos_atencao', e.target.value)} placeholder="Problemas críticos identificados" />
            </div>
          </TabsContent>

          <TabsContent value="execucao" className="space-y-4 pt-4">
            <ListEditor
              label="4. Ações estratégicas (verbo no infinitivo)"
              items={data.acoes_estrategicas}
              onAdd={() => addItem('acoes_estrategicas')}
              onUpdate={(i, v) => updateItem('acoes_estrategicas', i, v)}
              onRemove={i => removeItem('acoes_estrategicas', i)}
              ai={<AiBtn field="acoes_estrategicas" />}
              placeholder="Promover, Realizar, Implementar..."
            />
            <ListEditor
              label="5. Procedimentos (verbo no gerúndio)"
              items={data.procedimentos}
              onAdd={() => addItem('procedimentos')}
              onUpdate={(i, v) => updateItem('procedimentos', i, v)}
              onRemove={i => removeItem('procedimentos', i)}
              ai={<AiBtn field="procedimentos" />}
              placeholder="Realizando, Aplicando, Desenvolvendo..."
            />
            <ListEditor
              label="6. Responsáveis"
              items={data.responsaveis}
              onAdd={() => addItem('responsaveis')}
              onUpdate={(i, v) => updateItem('responsaveis', i, v)}
              onRemove={i => removeItem('responsaveis', i)}
              placeholder="Nome do responsável"
            />
            <div>
              <div className="flex items-center justify-between"><Label>Tags</Label><AiBtn field="tags" /></div>
              <div className="flex flex-wrap gap-2 mt-2">
                {data.tags.map((t, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    {t}
                    <button type="button" onClick={() => removeItem('tags', i)} className="ml-1 hover:text-destructive"><X className="w-3 h-3" /></button>
                  </Badge>
                ))}
                <Button type="button" size="sm" variant="outline" onClick={() => {
                  const v = window.prompt('Nova tag');
                  if (v?.trim()) update('tags', [...data.tags, v.trim()]);
                }}><Plus className="w-3 h-3" /> Tag</Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="midia" className="space-y-4 pt-4">
            <div>
              <Label className="flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Fotos do Evento</Label>
              <div
                className="mt-2 border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => fileImgRef.current?.click()}
                onDragOver={e => { e.preventDefault(); }}
                onDrop={e => { e.preventDefault(); uploadImages(e.dataTransfer.files); }}
              >
                {imageBusy ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : <>
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-2">Arraste imagens aqui ou clique para selecionar</p>
                  <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP</p>
                </>}
                <input ref={fileImgRef} type="file" multiple accept="image/*" className="hidden" onChange={e => uploadImages(e.target.files)} />
              </div>
              {data.images.length > 0 && (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3 mt-4">
                  {data.images.map(p => (
                    <div key={p} className="relative group aspect-square rounded-md overflow-hidden bg-muted">
                      {thumbs[p] && <img src={thumbs[p]} alt="" className="w-full h-full object-cover" />}
                      <button type="button" onClick={() => removeImage(p)} className="absolute top-1 right-1 p-1 rounded bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}Salvar evento</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ListEditor({ label, items, onAdd, onUpdate, onRemove, ai, placeholder }: {
  label: string; items: string[]; onAdd: () => void; onUpdate: (i: number, v: string) => void; onRemove: (i: number) => void; ai?: React.ReactNode; placeholder?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between"><Label>{label}</Label>{ai}</div>
      <div className="space-y-2 mt-2">
        {items.map((v, i) => (
          <div key={i} className="flex gap-2">
            <Input value={v} onChange={e => onUpdate(i, e.target.value)} placeholder={placeholder} />
            <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(i)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={onAdd}><Plus className="w-4 h-4" /> Adicionar</Button>
      </div>
    </div>
  );
}