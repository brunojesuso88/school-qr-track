import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AISuggestPickerProps {
  /** Edge function name: 'pei-suggest' or 'paee-suggest' */
  functionName: 'pei-suggest' | 'paee-suggest';
  /** Body to send to the edge function (must include `context`) */
  body: Record<string, unknown>;
  /** Called when user confirms selection */
  onAdd: (items: string[]) => void;
  /** Trigger button label */
  label?: string;
  /** Header text inside popover */
  title?: string;
  /** Bullet prefix when joining selected items (default: '• ') */
  bulletPrefix?: string;
}

export const AISuggestPicker = ({
  functionName,
  body,
  onAdd,
  label = 'Sugerir com IA',
  title = 'Sugestões da IA',
}: AISuggestPickerProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const fetchSuggestions = async () => {
    setLoading(true);
    setSelected(new Set());
    try {
      const { data, error } = await supabase.functions.invoke(functionName, { body });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha ao gerar sugestões');
      setItems(data.items || []);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Falha ao gerar sugestões');
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (i: number) => {
    const next = new Set(selected);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setSelected(next);
  };

  const confirm = () => {
    if (selected.size === 0) {
      toast.info('Selecione ao menos uma sugestão');
      return;
    }
    const picked = Array.from(selected).sort((a, b) => a - b).map((i) => items[i]);
    onAdd(picked);
    setSelected(new Set());
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v && items.length === 0) fetchSuggestions();
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(500px,94vw)] p-0" align="end">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-xs font-medium text-muted-foreground">{title}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={fetchSuggestions}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <>
                <RefreshCw className="w-3 h-3" /> Gerar novas
              </>
            )}
          </Button>
        </div>

        <div className="max-h-72 overflow-y-auto p-1">
          {loading && items.length === 0 && (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Gerando sugestões...
            </div>
          )}
          {!loading && items.length === 0 && (
            <p className="px-2 py-6 text-sm text-muted-foreground text-center">
              Nenhuma sugestão disponível.
            </p>
          )}
          {items.map((it, i) => {
            const checked = selected.has(i);
            return (
              <label
                key={i}
                className={
                  'flex items-start gap-2 rounded-md px-2 py-2 cursor-pointer transition-colors ' +
                  (checked ? 'bg-primary/10' : 'hover:bg-accent')
                }
              >
                <Checkbox
                  className="mt-0.5"
                  checked={checked}
                  onCheckedChange={() => toggle(i)}
                />
                <span className="text-sm leading-snug flex-1">{it}</span>
              </label>
            );
          })}
        </div>

        {items.length > 0 && (
          <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/40">
            <span className="text-xs text-muted-foreground">
              {selected.size} selecionada{selected.size === 1 ? '' : 's'}
            </span>
            <Button type="button" size="sm" className="h-7" onClick={confirm}>
              Adicionar
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

/** Append multiple items as bulleted lines to existing text */
export const appendBullets = (current: string, items: string[]): string => {
  if (items.length === 0) return current;
  const bullets = items.map((t) => `• ${t}`).join('\n');
  if (!current.trim()) return bullets;
  return `${current.trimEnd()}\n${bullets}`;
};