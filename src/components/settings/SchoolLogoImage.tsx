import { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BadgeCheck, Loader2, Trash2, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSchoolProfile } from '@/hooks/useSchoolProfile';
import {
  SCHOOL_BRANDING_BUCKET,
  SCHOOL_LOGO_SETTING_KEY,
  buildBrandingPath,
  validateBrandingImage,
} from '@/lib/school/branding';

const SchoolLogoImage = () => {
  const { logoUrl, logoPath, schoolName, loading, refetch } = useSchoolProfile();
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
      const path = schoolScopedPath(activeSchoolId, buildBrandingPath('logo', file.name));

      const { error: uploadError } = await supabase.storage
        .from(SCHOOL_BRANDING_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { error: settingError } = await supabase
        .from('settings')
        .upsert({ key: SCHOOL_LOGO_SETTING_KEY, value: path }, { onConflict: 'school_id,key' });
      if (settingError) throw settingError;

      if (logoPath && logoPath !== path) {
        await supabase.storage.from(SCHOOL_BRANDING_BUCKET).remove([logoPath]);
      }

      await refetch();
      toast.success('Logo da escola atualizado!');
    } catch (err) {
      console.error('Error uploading school logo:', err);
      toast.error('Erro ao enviar o logo da escola');
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
        .upsert({ key: SCHOOL_LOGO_SETTING_KEY, value: '' }, { onConflict: 'school_id,key' });
      if (error) throw error;
      if (logoPath) {
        await supabase.storage.from(SCHOOL_BRANDING_BUCKET).remove([logoPath]);
      }
      await refetch();
      toast.success('Logo removido');
    } catch (err) {
      console.error('Error removing school logo:', err);
      toast.error('Erro ao remover o logo');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <BadgeCheck className="h-5 w-5 text-primary" />
          Logo da escola
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : logoUrl ? (
            <img
              src={logoUrl}
              alt={schoolName ? `Logo do ${schoolName}` : 'Logo da escola'}
              className="h-full w-full object-contain p-2"
            />
          ) : (
            <span className="px-2 text-center text-xs text-muted-foreground">
              Nenhum logo cadastrado
            </span>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label="Selecionar logo da escola"
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
            {logoUrl ? 'Trocar imagem' : 'Selecionar imagem'}
          </Button>
          {logoPath && (
            <Button variant="outline" onClick={handleRemove} disabled={busy}>
              <Trash2 className="mr-2 h-4 w-4" />
              Remover
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Preferencialmente quadrado, em PNG com fundo transparente (até 5MB). Sem logo cadastrado,
          o sistema continua usando o logo padrão nos relatórios.
        </p>
      </CardContent>
    </Card>
  );
};

export default SchoolLogoImage;
