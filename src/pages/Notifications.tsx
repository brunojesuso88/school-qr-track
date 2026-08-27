import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, CheckCheck, Inbox, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotificationCenter } from '@/hooks/useNotificationCenter';
import { filterItems } from '@/lib/notifications/center';
import { getEventDefinition } from '@/lib/notifications/events';
import { PushNotificationToggle } from '@/components/PushNotificationToggle';
import NotificationPreferences from '@/components/notifications/NotificationPreferences';

const Notifications = () => {
  const navigate = useNavigate();
  const { items, unread, loading, markRead, markAllRead } = useNotificationCenter();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const visible = filterItems(items, filter);

  const handleOpen = async (id: string, route: string | null) => {
    await markRead(id);
    if (route) navigate(route);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Central de notificações</h1>
            <p className="text-muted-foreground">
              Avisos do sistema e configuração de notificações no seu dispositivo
            </p>
          </div>
          <Button variant="outline" onClick={markAllRead} disabled={unread === 0}>
            <CheckCheck className="w-4 h-4 mr-2" />
            Marcar todas como lidas
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Meus avisos
              {unread > 0 && <Badge variant="destructive">{unread} não lidas</Badge>}
            </CardTitle>
            <CardDescription>
              Histórico das notificações enviadas para o seu perfil.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'unread')}>
              <TabsList className="mb-4">
                <TabsTrigger value="all">Todas</TabsTrigger>
                <TabsTrigger value="unread">Não lidas</TabsTrigger>
              </TabsList>
              <TabsContent value={filter} className="mt-0">
                {loading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : visible.length === 0 ? (
                  <div className="flex flex-col items-center py-10 text-center">
                    <Inbox className="w-10 h-10 text-muted-foreground mb-3" />
                    <p className="font-medium">Nenhuma notificação</p>
                    <p className="text-sm text-muted-foreground">
                      Você será avisado aqui quando algo novo acontecer.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border rounded-lg border border-border">
                    {visible.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleOpen(item.id, item.route)}
                        className={cn(
                          'w-full text-left p-4 hover:bg-accent transition-colors',
                          !item.read_at && 'bg-accent/40',
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          {!item.read_at && <span className="h-2 w-2 rounded-full bg-primary" />}
                          <span className="font-medium">{item.title}</span>
                          <Badge variant="secondary" className="text-[10px]">
                            {getEventDefinition(item.event_type)?.label ?? 'Aviso'}
                          </Badge>
                          <span className="ml-auto text-xs text-muted-foreground">
                            {new Date(item.created_at).toLocaleString('pt-BR', {
                              timeZone: 'America/Fortaleza',
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{item.body}</p>
                      </button>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <PushNotificationToggle />
        <NotificationPreferences />
      </div>
    </DashboardLayout>
  );
};

export default Notifications;
