export interface NotificationItem {
  id: string;
  notification_id: string;
  read_at: string | null;
  seen_at: string | null;
  created_at: string;
  event_type: string;
  title: string;
  body: string;
  route: string | null;
  severity: string;
}

export function unreadCount(items: NotificationItem[]): number {
  return items.filter((i) => !i.read_at).length;
}

export function filterItems(
  items: NotificationItem[],
  filter: 'all' | 'unread',
): NotificationItem[] {
  return filter === 'unread' ? items.filter((i) => !i.read_at) : items;
}

export function markItemRead(
  items: NotificationItem[],
  id: string,
  now = new Date().toISOString(),
): NotificationItem[] {
  return items.map((i) => (i.id === id ? { ...i, read_at: i.read_at ?? now, seen_at: i.seen_at ?? now } : i));
}

export function markAllItemsRead(
  items: NotificationItem[],
  now = new Date().toISOString(),
): NotificationItem[] {
  return items.map((i) => ({ ...i, read_at: i.read_at ?? now, seen_at: i.seen_at ?? now }));
}

export function formatBadge(count: number): string {
  if (count <= 0) return '';
  return count > 99 ? '99+' : String(count);
}
