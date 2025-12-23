import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, Loader2, Check, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const timezones = [
  { value: 'America/Sao_Paulo', label: 'Brasília (GMT-3)' },
  { value: 'America/Manaus', label: 'Manaus (GMT-4)' },
  { value: 'America/Belem', label: 'Belém (GMT-3)' },
  { value: 'America/Fortaleza', label: 'Fortaleza (GMT-3)' },
  { value: 'America/Recife', label: 'Recife (GMT-3)' },
  { value: 'America/Cuiaba', label: 'Cuiabá (GMT-4)' },
  { value: 'America/Porto_Velho', label: 'Porto Velho (GMT-4)' },
  { value: 'America/Rio_Branco', label: 'Rio Branco (GMT-5)' },
];

const SchoolSettings = () => {
  const [settings, setSettings] = useState({
    schoolName: '',
    timezone: 'America/Sao_Paulo'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['school_name', 'timezone']);

      if (error) throw error;

      if (data) {
        const newSettings = { ...settings };
        data.forEach(setting => {
          const value = setting.value as string;
          if (setting.key === 'school_name') newSettings.schoolName = value;
          if (setting.key === 'timezone') newSettings.timezone = value;
        });
        setSettings(newSettings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = [
        { key: 'school_name', value: JSON.stringify(settings.schoolName) },
        { key: 'timezone', value: JSON.stringify(settings.timezone) }
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('settings')
          .upsert(update, { onConflict: 'key' });
        if (error) throw error;
      }

      toast.success('Configurações da escola salvas!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Informações da Escola
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="schoolName">Nome da Instituição</Label>
            <Input
              id="schoolName"
              placeholder="Ex: Escola Municipal João da Silva"
              value={settings.schoolName}
              onChange={(e) => setSettings(prev => ({ ...prev, schoolName: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Este nome será exibido no cabeçalho e relatórios
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Fuso Horário</Label>
            <Select
              value={settings.timezone}
              onValueChange={(value) => setSettings(prev => ({ ...prev, timezone: value }))}
            >
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue placeholder="Selecione o fuso horário" />
              </SelectTrigger>
              <SelectContent>
                {timezones.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Usado para calcular horários de presença e notificações
            </p>
          </div>

          <Button onClick={handleSave} disabled={saving} className="mt-4">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Salvar Configurações
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SchoolSettings;
