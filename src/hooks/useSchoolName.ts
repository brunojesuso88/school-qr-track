import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useSchoolName = () => {
  const [schoolName, setSchoolName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSchoolName = async () => {
      try {
        const { data } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'school_name')
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
  }, []);

  return { schoolName, loading };
};
