import { School } from 'lucide-react';
import { useSchool } from '@/contexts/SchoolContext';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

/** Seletor de escola ativa: aparece só para quem tem vínculo em mais de uma escola. */
const SchoolSwitcher = () => {
  const { schools, activeSchoolId, setActiveSchoolId } = useSchool();

  if (schools.length <= 1) return null;

  return (
    <div className="flex items-center gap-2">
      <School className="h-4 w-4 text-muted-foreground" />
      <Select value={activeSchoolId ?? undefined} onValueChange={setActiveSchoolId}>
        <SelectTrigger className="h-8 w-[200px] text-xs">
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
