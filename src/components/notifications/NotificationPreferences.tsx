import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CONFIGURABLE_EVENTS } from '@/lib/notifications/events';

interface PreferenceRow {
  event_type: string;
  push_enabled: boolean;
  inapp_enabled: boolean;
}

const NotificationPreferences = () => {
  const { user, userRole } = useAuth();
  const [prefs, setPrefs] = useState<Record<string, PreferenceRow>>({});
  const [loading, setLoading] = useState(true);

  const visibleEvents = CONFIGURABLE_EVENTS.filter((e) =>
    e.roles.includes((userRole ?? 'staff') as never),
  );

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('event_type, push_enabled, inapp_enabled')
        .eq('user_id', user.id);
      if (error) console.error('Erro ao carregar preferências:', error);
      const map: Record<string, PreferenceRow> = {};
      for (const row of data ?? []) map[row.event_type] = row as PreferenceRow;
      setPrefs(map);
      setLoading(false);
    };
    load();
  }, [user]);

  const update = async (
    eventType: string,
    field: 'push_enabled' | 'inapp_enabled',
    value: boolean,
  ) => {
    if (!user) return;
    const current = prefs[eventType] ?? { event_type: eventType, push_enabled: true, inapp_enabled: true };
    const next = { ...current, [field]: value };
    setPrefs((p) => ({ ...p, [eventType]: next }));

    const { error } = await supabase
      .from('notification_preferences')
      .upsert({
        user_id: user.id,
        event_type: eventType,
        push_enabled: next.push_enabled,
        inapp_enabled: next.inapp_enabled,
      }, { onConflict: 'user_id,event_type' });

    if (error) {
      toast.error('Não foi possível salvar a preferência');
      setPrefs((p) => ({ ...p, [eventType]: current }));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SlidersHorizontal className="w-5 h-5" />
          Preferências por tipo de aviso
        </CardTitle>
        <CardDescription>
          Escolha o que você quer receber por push (celular/navegador) e na central interna.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin" /></div>
        ) : (
          <div className="space-y-5">
            {visibleEvents.map((event) => {
              const pref = prefs[event.type] ?? { push_enabled: true, inapp_enabled: true };
              return (
                <div key={event.type} className="space-y-2 pb-4 border-b border-border last:border-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium">{event.label}</p>
                    <p className="text-xs text-muted-foreground">{event.description}</p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`push-${event.type}`}
                        checked={pref.push_enabled}
                        onCheckedChange={(v) => update(event.type, 'push_enabled', v)}
                      />
                      <Label htmlFor={`push-${event.type}`} className="text-sm">Push</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`inapp-${event.type}`}
                        checked={pref.inapp_enabled}
                        onCheckedChange={(v) => update(event.type, 'inapp_enabled', v)}
                      />
                      <Label htmlFor={`inapp-${event.type}`} className="text-sm">Central interna</Label>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NotificationPreferences;
