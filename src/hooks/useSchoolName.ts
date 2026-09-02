import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveSchoolId } from '@/contexts/SchoolContext';

export const useSchoolName = () => {
  const activeSchoolId = useActiveSchoolId();
  const [schoolName, setSchoolName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeSchoolId) {
      setSchoolName('');
      setLoading(false);
      return;
    }
    const fetchSchoolName = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'school_name')
          .eq('school_id', activeSchoolId)
          .single();

        if (data?.value) {
          // Handle both string and JSON values
          const value = data.value;
          setSchoolName(typeof value === 'string' ? value : String(value));
        }
      } catch (error) {
        console.error('Error fetching school name:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSchoolName();
  }, [activeSchoolId]);

  return { schoolName, loading };
};
