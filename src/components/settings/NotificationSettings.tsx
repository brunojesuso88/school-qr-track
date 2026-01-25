import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Bell, Loader2, Check, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { PushNotificationToggle } from '@/components/PushNotificationToggle';
import { useAuth } from '@/contexts/AuthContext';

const NotificationSettings = () => {
  const { userRole } = useAuth();
  const isAdmin = userRole === 'admin';
  
  const [settings, setSettings] = useState({
    whatsappEnabled: false,
    whatsappPhone: '',
    notificationTime: '10:00',
    messageTemplate: 'Olá {guardian_name}, informamos que o(a) aluno(a) {student_name} não compareceu à escola hoje ({date}). Em caso de dúvidas, entre em contato com a secretaria.'
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
        .in('key', ['whatsapp_enabled', 'whatsapp_phone', 'notification_time', 'notification_template']);

      if (error) throw error;

      if (data) {
        const newSettings = { ...settings };
        data.forEach(setting => {
          const value = setting.value as string;
          if (setting.key === 'whatsapp_enabled') newSettings.whatsappEnabled = value === 'true';
          if (setting.key === 'whatsapp_phone') newSettings.whatsappPhone = value;
          if (setting.key === 'notification_time') newSettings.notificationTime = value;
          if (setting.key === 'notification_template') newSettings.messageTemplate = value;
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
        { key: 'whatsapp_enabled', value: JSON.stringify(String(settings.whatsappEnabled)) },
        { key: 'whatsapp_phone', value: JSON.stringify(settings.whatsappPhone) },
        { key: 'notification_time', value: JSON.stringify(settings.notificationTime) },
        { key: 'notification_template', value: JSON.stringify(settings.messageTemplate) }
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('settings')
          .upsert(update, { onConflict: 'key' });
        if (error) throw error;
      }

      toast.success('Configurações de notificação salvas!');
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
      {/* Push Notifications for Admins */}
      {isAdmin && <PushNotificationToggle />}
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-500" />
            Integração WhatsApp
            <Badge variant={settings.whatsappEnabled ? 'default' : 'secondary'}>
              {settings.whatsappEnabled ? 'Ativo' : 'Inativo'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Notificações Automáticas</Label>
              <p className="text-sm text-muted-foreground">
                Enviar mensagem automática quando aluno estiver ausente
              </p>
            </div>
            <Switch
              checked={settings.whatsappEnabled}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, whatsappEnabled: checked }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsappPhone">Número do WhatsApp Business</Label>
            <Input
              id="whatsappPhone"
              placeholder="+55 11 99999-9999"
              value={settings.whatsappPhone}
              onChange={(e) => setSettings(prev => ({ ...prev, whatsappPhone: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Número conectado à API do WhatsApp Business
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Configurações de Envio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notificationTime">Horário de Envio</Label>
            <Input
              id="notificationTime"
              type="time"
              value={settings.notificationTime}
              onChange={(e) => setSettings(prev => ({ ...prev, notificationTime: e.target.value }))}
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">
              Horário em que as notificações de ausência serão enviadas diariamente
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="template">Template da Mensagem</Label>
            <Textarea
              id="template"
              rows={4}
              value={settings.messageTemplate}
              onChange={(e) => setSettings(prev => ({ ...prev, messageTemplate: e.target.value }))}
            />
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Variáveis disponíveis: {'{guardian_name}'}, {'{student_name}'}, {'{date}'}, {'{class}'}
              </span>
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
                Salvar Configurações
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationSettings;
