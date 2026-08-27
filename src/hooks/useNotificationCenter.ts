import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { markAllItemsRead, markItemRead, unreadCount, type NotificationItem } from '@/lib/notifications/center';

const PAGE_SIZE = 30;

export const useNotificationCenter = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    // Sem cache: leitura direta da tabela, evitando contagem defasada.
    const { data, error } = await supabase
      .from('notification_recipients')
      .select('id, notification_id, read_at, seen_at, created_at, notifications(event_type, title, body, route, severity)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (error) {
      console.error('Erro ao carregar notificações:', error);
      setLoading(false);
      return;
    }

    const mapped: NotificationItem[] = (data ?? []).map((row: any) => ({
      id: row.id,
      notification_id: row.notification_id,
      read_at: row.read_at,
      seen_at: row.seen_at,
      created_at: row.created_at,
      event_type: row.notifications?.event_type ?? 'unknown',
      title: row.notifications?.title ?? 'EDUNEXUS',
      body: row.notifications?.body ?? '',
      route: row.notifications?.route ?? null,
      severity: row.notifications?.severity ?? 'info',
    }));

    setItems(mapped);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Realtime: novas notificações atualizam o badge imediatamente.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notification-recipients-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notification_recipients',
          filter: `user_id=eq.${user.id}`,
        },
        () => { fetchItems(); },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchItems]);

  const markRead = useCallback(async (recipientId: string) => {
    setItems((prev) => markItemRead(prev, recipientId));
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('notification_recipients')
      .update({ read_at: now, seen_at: now })
      .eq('id', recipientId)
      .is('read_at', null);
    if (error) console.error('Erro ao marcar como lida:', error);
  }, []);

  const markAllRead = useCallback(async () => {
    setItems((prev) => markAllItemsRead(prev));
    const { error } = await supabase.rpc('mark_all_notifications_read');
    if (error) {
      console.error('Erro ao marcar todas como lidas:', error);
      fetchItems();
    }
  }, [fetchItems]);

  const unread = useMemo(() => unreadCount(items), [items]);

  return { items, unread, loading, refresh: fetchItems, markRead, markAllRead };
};
