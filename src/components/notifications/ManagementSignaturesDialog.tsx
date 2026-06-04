import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Trash2, Star, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ManagementSignature {
  id: string;
  name: string;
  role_label: string | null;
  storage_path: string;
  is_default: boolean;
  preview_url?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged?: () => void;
}

async function fetchSignatures(): Promise<ManagementSignature[]> {
  const { data, error } = await supabase
    .from('management_signatures')
    .select('*')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  const list = (data || []) as ManagementSignature[];
  // Sign URLs in parallel for previews
  await Promise.all(
    list.map(async (s) => {
      const { data: u } = await supabase.storage
        .from('management-signatures')
        .createSignedUrl(s.storage_path, 3600);
      s.preview_url = u?.signedUrl;
    }),
  );
  return list;
}

export function ManagementSignaturesDialog({ open, onOpenChange, onChanged }: Props) {
  const { user } = useAuth();
  const [list, setList] = useState<ManagementSignature[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [roleLabel, setRoleLabel] = useState('Direção Escolar');
  const [file, setFile] = useState<File | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      setList(await fetchSignatures());
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar assinaturas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  const handleUpload = async () => {
    if (!name.trim()) return toast.error('Informe o nome do gestor');
    if (!file) return toast.error('Selecione uma imagem');
    if (!['image/png', 'image/jpeg'].includes(file.type)) return toast.error('Use PNG ou JPG');
    if (file.size > 1024 * 1024) return toast.error('Imagem deve ter no máximo 1 MB');
    setBusy(true);
    try {
      const ext = file.type === 'image/png' ? 'png' : 'jpg';
      const path = `${user?.id || 'anon'}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('management-signatures')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from('management_signatures').insert({
        name: name.trim().slice(0, 80),
        role_label: roleLabel.trim() || null,
        storage_path: path,
        is_default: list.length === 0,
        created_by: user?.id ?? null,
      });
      if (insErr) throw insErr;
      toast.success('Assinatura salva');
      setName('');
      setRoleLabel('Direção Escolar');
      setFile(null);
      await refresh();
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar');
    } finally {
      setBusy(false);
    }
  };

  const setDefault = async (s: ManagementSignature) => {
    const { error } = await supabase
      .from('management_signatures')
      .update({ is_default: true })
      .eq('id', s.id);
    if (error) return toast.error('Erro ao definir padrão');
    toast.success('Padrão atualizado');
    await refresh();
    onChanged?.();
  };

  const remove = async (s: ManagementSignature) => {
    if (!confirm(`Excluir assinatura de ${s.name}?`)) return;
    const { error } = await supabase.from('management_signatures').delete().eq('id', s.id);
    if (error) return toast.error('Erro ao excluir');
    await supabase.storage.from('management-signatures').remove([s.storage_path]);
    toast.success('Excluída');
    await refresh();
    onChanged?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-auto"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Assinaturas da Gestão</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border rounded-md p-4 space-y-3 bg-muted/30">
            <div className="text-sm font-medium">Adicionar nova assinatura</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome do gestor *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Maria Silva"
                  maxLength={80}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cargo / rótulo</Label>
                <Input
                  value={roleLabel}
                  onChange={(e) => setRoleLabel(e.target.value)}
                  placeholder="Direção Escolar"
                  maxLength={60}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Imagem da assinatura (PNG ou JPG, máx. 1 MB)</Label>
              <Input
                type="file"
                accept="image/png,image/jpeg"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <p className="text-xs text-muted-foreground">
                Dica: use uma imagem com fundo transparente (PNG) para melhor resultado.
              </p>
            </div>
            <Button onClick={handleUpload} disabled={busy} className="bg-[#0D47A1] hover:bg-[#0B2E59] text-white">
              <Upload className="w-4 h-4 mr-2" />
              {busy ? 'Salvando...' : 'Salvar assinatura'}
            </Button>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">Assinaturas salvas</div>
            {loading ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Carregando...</div>
            ) : list.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground border rounded-md">
                Nenhuma assinatura cadastrada.
              </div>
            ) : (
              <div className="space-y-2">
                {list.map((s) => (
                  <div key={s.id} className="border rounded-md p-3 flex items-center gap-3">
                    <div className="w-32 h-16 border bg-white rounded flex items-center justify-center overflow-hidden shrink-0">
                      {s.preview_url ? (
                        <img src={s.preview_url} alt={s.name} className="max-w-full max-h-full object-contain" />
                      ) : (
                        <span className="text-[10px] text-muted-foreground">sem prévia</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{s.name}</span>
                        {s.is_default && <Badge className="bg-amber-500 hover:bg-amber-500">Padrão</Badge>}
                      </div>
                      {s.role_label && (
                        <div className="text-xs text-muted-foreground">{s.role_label}</div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {!s.is_default && (
                        <Button size="sm" variant="ghost" onClick={() => setDefault(s)} title="Definir como padrão">
                          <Star className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => remove(s)}
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export async function getSignatureAsDataUrl(storage_path: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from('management-signatures')
      .download(storage_path);
    if (error || !data) return null;
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(data);
    });
  } catch {
    return null;
  }
}

export async function loadSignatures(): Promise<ManagementSignature[]> {
  return fetchSignatures();
}