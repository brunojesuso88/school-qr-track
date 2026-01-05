import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Clock, Loader2, Check, Volume2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CutoffTimes {
  morning: string;
  afternoon: string;
  evening: string;
}

const GeneralSettings = () => {
  const [cutoffTimes, setCutoffTimes] = useState<CutoffTimes>({
    morning: '08:00',
    afternoon: '14:00',
    evening: '20:00'
  });
  const [soundEnabled, setSoundEnabled] = useState(false);
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
        .in('key', ['cutoff_morning', 'cutoff_afternoon', 'cutoff_evening', 'realtime_sound_enabled']);

      if (error) throw error;

      if (data) {
        const times = { ...cutoffTimes };
        data.forEach(setting => {
          if (setting.key === 'cutoff_morning') times.morning = setting.value as string;
          if (setting.key === 'cutoff_afternoon') times.afternoon = setting.value as string;
          if (setting.key === 'cutoff_evening') times.evening = setting.value as string;
          if (setting.key === 'realtime_sound_enabled') {
            setSoundEnabled(setting.value === true || setting.value === 'true');
          }
        });
        setCutoffTimes(times);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSetting = async (key: string, value: string | boolean) => {
    const { error } = await supabase
      .from('settings')
      .upsert({ key, value: typeof value === 'string' ? JSON.stringify(value) : value }, { onConflict: 'key' });
    
    if (error) throw error;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        saveSetting('cutoff_morning', cutoffTimes.morning),
        saveSetting('cutoff_afternoon', cutoffTimes.afternoon),
        saveSetting('cutoff_evening', cutoffTimes.evening)
      ]);
      toast.success('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleSoundToggle = async (checked: boolean) => {
    setSoundEnabled(checked);
    try {
      await saveSetting('realtime_sound_enabled', checked);
      toast.success(checked ? 'Som de notificação ativado' : 'Som de notificação desativado');
    } catch (error) {
      console.error('Error saving sound setting:', error);
      toast.error('Erro ao salvar configuração');
      setSoundEnabled(!checked); // Revert on error
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
            <Clock className="h-5 w-5 text-primary" />
            Horário Limite por Turno
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Defina o horário máximo para entrada dos alunos em cada turno. 
            Após este horário, a presença será registrada como atraso.
          </p>
          
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="morning">Turno Manhã</Label>
              <Input
                id="morning"
                type="time"
                value={cutoffTimes.morning}
                onChange={(e) => setCutoffTimes(prev => ({ ...prev, morning: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Padrão: 08:00</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="afternoon">Turno Tarde</Label>
              <Input
                id="afternoon"
                type="time"
                value={cutoffTimes.afternoon}
                onChange={(e) => setCutoffTimes(prev => ({ ...prev, afternoon: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Padrão: 14:00</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="evening">Turno Noite</Label>
              <Input
                id="evening"
                type="time"
                value={cutoffTimes.evening}
                onChange={(e) => setCutoffTimes(prev => ({ ...prev, evening: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Padrão: 20:00</p>
            </div>
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
                Salvar Horários
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-primary" />
            Sons de Notificação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="sound-toggle">Som ao detectar novo registro</Label>
              <p className="text-sm text-muted-foreground">
                Tocar um som sutil quando outro funcionário registrar presença via Realtime
              </p>
            </div>
            <Switch 
              id="sound-toggle"
              checked={soundEnabled}
              onCheckedChange={handleSoundToggle}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GeneralSettings;
