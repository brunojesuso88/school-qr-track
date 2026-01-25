import { useState } from 'react';
import { Bell, BellOff, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export const PushNotificationToggle = () => {
  const { 
    isSupported, 
    isSubscribed, 
    isLoading, 
    permission, 
    subscribe, 
    unsubscribe,
    isConfigured 
  } = usePushNotifications();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggle = async () => {
    setIsUpdating(true);
    
    try {
      if (isSubscribed) {
        const result = await unsubscribe();
        if (result.success) {
          toast.success('Notificações desativadas');
        } else {
          toast.error(result.error || 'Erro ao desativar notificações');
        }
      } else {
        const result = await subscribe();
        if (result.success) {
          toast.success('Notificações ativadas! Você receberá alertas de novos usuários.');
        } else {
          if (result.error === 'Permission denied') {
            toast.error('Permissão negada. Habilite notificações nas configurações do navegador.');
          } else {
            toast.error(result.error || 'Erro ao ativar notificações');
          }
        }
      }
    } finally {
      setIsUpdating(false);
    }
  };

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notificações Push
          </CardTitle>
          <CardDescription>
            Receba alertas quando novos usuários se cadastrarem
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Seu navegador não suporta notificações push. Tente usar um navegador mais recente.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!isConfigured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notificações Push
          </CardTitle>
          <CardDescription>
            Receba alertas quando novos usuários se cadastrarem
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Notificações push não estão configuradas. Configure as VAPID keys para habilitar.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isSubscribed ? (
            <Bell className="w-5 h-5 text-green-500" />
          ) : (
            <BellOff className="w-5 h-5 text-muted-foreground" />
          )}
          Notificações Push
        </CardTitle>
        <CardDescription>
          Receba alertas quando novos usuários se cadastrarem no sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {permission === 'denied' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Notificações bloqueadas. Altere as permissões nas configurações do navegador.
            </AlertDescription>
          </Alert>
        )}
        
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="push-toggle" className="text-base">
              Notificações de novos usuários
            </Label>
            <p className="text-sm text-muted-foreground">
              {isSubscribed 
                ? 'Você receberá notificações quando novos usuários se cadastrarem'
                : 'Ative para receber alertas de novos cadastros'
              }
            </p>
          </div>
          <Switch
            id="push-toggle"
            checked={isSubscribed}
            onCheckedChange={handleToggle}
            disabled={isLoading || isUpdating || permission === 'denied'}
          />
        </div>

        {isSubscribed && (
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Notificações ativas
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
