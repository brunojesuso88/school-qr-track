import { useState } from 'react';
import { Bell, BellOff, AlertCircle, Smartphone, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAuth } from '@/contexts/AuthContext';

export const PushNotificationToggle = () => {
  const {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    platform,
    subscribe,
    unsubscribe,
    sendTestNotification,
    isConfigured,
    keyLoaded,
  } = usePushNotifications();
  const { userRole } = useAuth();
  const canSendTest = userRole === 'admin' || userRole === 'direction';
  const [isUpdating, setIsUpdating] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const handleToggle = async () => {
    setIsUpdating(true);
    try {
      if (isSubscribed) {
        const result = await unsubscribe();
        if (result.success) toast.success('Notificações desativadas');
        else toast.error(result.error || 'Erro ao desativar notificações');
      } else {
        const result = await subscribe();
        if (result.success) {
          toast.success('Notificações ativadas neste dispositivo.');
        } else if (result.error === 'ios_requires_install') {
          toast.error('No iPhone/iPad é necessário instalar o app na Tela de Início antes de ativar.');
        } else if (result.error === 'Permission denied') {
          toast.error('Permissão negada. Habilite notificações nas configurações do navegador.');
        } else {
          toast.error(result.error || 'Erro ao ativar notificações');
        }
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const result = await sendTestNotification();
      if (result.success) toast.success('Notificação de teste enviada para este dispositivo.');
      else toast.error(result.error || 'Não foi possível enviar o teste');
    } finally {
      setIsTesting(false);
    }
  };

  const header = (
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        {isSubscribed ? <Bell className="w-5 h-5 text-primary" /> : <BellOff className="w-5 h-5 text-muted-foreground" />}
        Notificações no dispositivo
      </CardTitle>
      <CardDescription>
        Receba avisos do EDUNEXUS no celular ou no computador, mesmo com o app fechado.
      </CardDescription>
    </CardHeader>
  );

  if (platform.requiresInstall) {
    return (
      <Card>
        {header}
        <CardContent>
          <Alert>
            <Smartphone className="h-4 w-4" />
            <AlertDescription className="space-y-1">
              <p className="font-medium">Instale o app para receber notificações no iPhone/iPad</p>
              <p className="text-sm">
                Compartilhar → Adicionar à Tela de Início → abrir pelo ícone → Ativar notificações.
              </p>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!isSupported) {
    return (
      <Card>
        {header}
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Este navegador não suporta notificações push. A central de notificações dentro do sistema continua funcionando.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!isConfigured) {
    return (
      <Card>
        {header}
        <CardContent>
          {keyLoaded ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Notificações push não estão configuradas neste ambiente.
              </AlertDescription>
            </Alert>
          ) : (
            <p className="text-sm text-muted-foreground">Verificando configuração de notificações...</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {header}
      <CardContent className="space-y-4">
        {permission === 'denied' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Notificações bloqueadas. Altere as permissões nas configurações do navegador.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="push-toggle" className="text-base">Ativar notificações push</Label>
            <p className="text-sm text-muted-foreground">
              {isSubscribed
                ? `Ativas neste dispositivo (${platform.platformLabel})`
                : 'Toque para permitir notificações neste dispositivo'}
            </p>
          </div>
          <Switch
            id="push-toggle"
            checked={isSubscribed}
            onCheckedChange={handleToggle}
            disabled={isLoading || isUpdating || permission === 'denied'}
          />
        </div>

        {isSubscribed && canSendTest && (
          <Button variant="outline" onClick={handleTest} disabled={isTesting} className="w-full">
            <Send className="w-4 h-4 mr-2" />
            {isTesting ? 'Enviando...' : 'Enviar notificação de teste para este dispositivo'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
