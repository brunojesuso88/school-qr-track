import { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Image as ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSchoolProfile } from '@/hooks/useSchoolProfile';
import {
  SCHOOL_BRANDING_BUCKET as SCHOOL_HERO_BUCKET,
  SCHOOL_HERO_SETTING_KEY,
  buildBrandingPath,
  validateBrandingImage,
} from '@/lib/school/branding';

const SchoolHeroImage = () => {
  const { heroUrl, heroPath, loading, refetch } = useSchoolProfile();
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const check = validateBrandingImage(file);
    if (!check.ok) {
      toast.error(check.error);
      return;
    }

    setBusy(true);
    try {
      const path = schoolScopedPath(activeSchoolId, buildBrandingPath('hero', file.name));

      const { error: uploadError } = await supabase.storage
        .from(SCHOOL_HERO_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { error: settingError } = await supabase
        .from('settings')
        .upsert({ key: SCHOOL_HERO_SETTING_KEY, value: path }, { onConflict: 'school_id,key' });
      if (settingError) throw settingError;

      if (heroPath && heroPath !== path) {
        await supabase.storage.from(SCHOOL_HERO_BUCKET).remove([heroPath]);
      }

      await refetch();
      toast.success('Foto de destaque atualizada!');
    } catch (err) {
      console.error('Error uploading hero image:', err);
      toast.error('Erro ao enviar a foto de destaque');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({ key: SCHOOL_HERO_SETTING_KEY, value: '' }, { onConflict: 'school_id,key' });
      if (error) throw error;
      if (heroPath) {
        await supabase.storage.from(SCHOOL_HERO_BUCKET).remove([heroPath]);
      }
      await refetch();
      toast.success('Foto de destaque removida');
    } catch (err) {
      console.error('Error removing hero image:', err);
      toast.error('Erro ao remover a foto');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-primary" />
          Foto de destaque do Painel Inicial
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative aspect-[16/6] w-full overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary/15 via-muted to-accent/40">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : heroUrl ? (
            <img
              src={heroUrl}
              alt="Foto de destaque atual da escola"
              className="h-full w-full object-cover object-center"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-sm text-muted-foreground">
              <ImageIcon className="h-6 w-6" aria-hidden />
              Nenhuma foto cadastrada — o painel usa o fundo padrão.
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label="Selecionar foto de destaque"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => inputRef.current?.click()} disabled={busy}>
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {heroUrl ? 'Trocar imagem' : 'Selecionar imagem'}
          </Button>
          {heroPath && (
            <Button variant="outline" onClick={handleRemove} disabled={busy}>
              <Trash2 className="mr-2 h-4 w-4" />
              Remover
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Imagem em formato paisagem (recomendado 1600×600), até 5MB. Ela é exibida ao fundo do
          cabeçalho do Painel Inicial com camada escura para garantir a leitura do texto.
        </p>
      </CardContent>
    </Card>
  );
};

export default SchoolHeroImage;
