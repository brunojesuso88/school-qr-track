import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/** Resolve o id da turma (public.classes) a partir do nome usado em students.class. */
export function useClassIdByName(className: string | null | undefined) {
  const [classId, setClassId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (!className) {
      setClassId(null);
      return;
    }
    setLoading(true);
    supabase
      .from('classes')
      .select('id')
      .eq('name', className)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setClassId((data?.id as string) ?? null);
        setLoading(false);
      });
    return () => { active = false; };
  }, [className]);

  return { classId, loading };
}