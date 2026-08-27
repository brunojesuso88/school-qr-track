import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Loader2, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useNotificationCenter } from '@/hooks/useNotificationCenter';
import { filterItems, formatBadge } from '@/lib/notifications/center';

const NotificationBell = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const { items, unread, loading, markRead, markAllRead } = useNotificationCenter();

  const visible = filterItems(items, filter);

  const handleClick = async (id: string, route: string | null) => {
    await markRead(id);
    setOpen(false);
    if (route) navigate(route);
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h} h`;
    return `${Math.floor(h / 24)} d`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 justify-center rounded-full text-[10px]"
              variant="destructive"
            >
              {formatBadge(unread)}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <p className="text-sm font-semibold">Notificações</p>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={markAllRead}
            disabled={unread === 0}
          >
            <CheckCheck className="w-3.5 h-3.5 mr-1" />
            Marcar todas
          </Button>
        </div>

        <div className="px-3 pt-2">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'unread')}>
            <TabsList className="grid grid-cols-2 h-8 w-full">
              <TabsTrigger value="all" className="text-xs">Todas</TabsTrigger>
              <TabsTrigger value="unread" className="text-xs">
                Não lidas{unread > 0 ? ` (${unread})` : ''}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="max-h-[22rem] overflow-y-auto py-2">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center px-4">
              <Inbox className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {filter === 'unread' ? 'Nenhuma notificação não lida' : 'Nenhuma notificação ainda'}
              </p>
            </div>
          ) : (
            visible.map((item) => (
              <button
                key={item.id}
                onClick={() => handleClick(item.id, item.route)}
                className={cn(
                  'w-full text-left px-3 py-2.5 hover:bg-accent transition-colors flex gap-2',
                  !item.read_at && 'bg-accent/40',
                )}
              >
                <span
                  className={cn(
                    'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                    item.read_at ? 'bg-transparent' : 'bg-primary',
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium truncate">{item.title}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {timeAgo(item.created_at)}
                    </span>
                  </span>
                  <span className="block text-xs text-muted-foreground line-clamp-2">
                    {item.body}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>

        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => { setOpen(false); navigate('/notifications'); }}
          >
            Abrir central de notificações
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
