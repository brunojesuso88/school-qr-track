import { School } from 'lucide-react';
import { useSchool } from '@/contexts/SchoolContext';
import { cn } from '@/lib/utils';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface SchoolSwitcherProps {
  /** `sidebar` renderiza a variante compacta em largura total (sem ícone externo). */
  variant?: 'default' | 'sidebar';
}

/** Seletor de escola ativa: aparece só para quem tem vínculo em mais de uma escola. */
const SchoolSwitcher = ({ variant = 'default' }: SchoolSwitcherProps) => {
  const { schools, activeSchoolId, setActiveSchoolId } = useSchool();

  if (schools.length <= 1) return null;

  const isSidebar = variant === 'sidebar';

  return (
    <div className={cn('flex items-center gap-2', isSidebar && 'w-full')}>
      {!isSidebar && <School className="h-4 w-4 text-muted-foreground" />}
      <Select value={activeSchoolId ?? undefined} onValueChange={setActiveSchoolId}>
        <SelectTrigger
          aria-label="Trocar escola ativa"
          className={cn(
            'h-8 text-xs',
            isSidebar ? 'w-full bg-sidebar-accent/40 text-sidebar-foreground' : 'w-[200px]',
          )}
        >
          <SelectValue placeholder="Selecionar escola" />
        </SelectTrigger>
        <SelectContent>
          {schools.map((s) => (
            <SelectItem key={s.school_id} value={s.school_id}>
              {s.school_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default SchoolSwitcher;
