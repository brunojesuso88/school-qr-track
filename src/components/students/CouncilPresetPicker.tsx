import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { COUNCIL_PRESETS } from '@/lib/occurrences/councilPresets';

interface Props {
  selected: string[];
  onChange: (items: string[]) => void;
}

/** Multi-select rápido de itens do conselho — um toque por item, sem digitação. */
export const CouncilPresetPicker = ({ selected, onChange }: Props) => {
  const toggle = (key: string) => {
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  };

  return (
    <div className="space-y-2">
      <Label>Itens do conselho (toque para marcar)</Label>
      <div className="space-y-2">
        {COUNCIL_PRESETS.map((preset) => {
          const checked = selected.includes(preset.key);
          return (
            <button
              key={preset.key}
              type="button"
              onClick={() => toggle(preset.key)}
              aria-pressed={checked}
              className={cn(
                'w-full flex items-center gap-3 rounded-md border p-3 text-left text-sm transition-colors',
                checked
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border hover:bg-muted/50',
              )}
            >
              <Checkbox checked={checked} className="pointer-events-none" tabIndex={-1} />
              <span>{preset.label}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Marque quantos itens quiser. A observação abaixo é opcional e complementar.
      </p>
    </div>
  );
};

export default CouncilPresetPicker;
