import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface TimetableSettings {
  id: string;
  school_year: string;
  days_per_week: number;
  periods_per_day: number;
  period_duration_minutes: number;
  break_after_period: number[];
  break_duration_minutes: number;
}

export interface TeacherAvailability {
  id: string;
  teacher_id: string;
  day_of_week: number;
  period_number: number;
  available: boolean;
}

export interface TimetableEntry {
  id: string;
  class_id: string;
  subject_name: string;
  teacher_id?: string;
  day_of_week: number;
  period_number: number;
  is_locked: boolean;
}

export interface TimetableRule {
  id: string;
  rule_type: string;
  rule_name: string;
  description?: string | null;
  is_active: boolean;
  priority: number;
  parameters: unknown;
}

export interface TimetableGenerationHistory {
  id: string;
  generated_at: string;
  generated_by?: string | null;
  quality_score?: number | null;
  conflicts_count: number;
  status: string;
  snapshot?: unknown;
  explanation?: string | null;
}

export interface Conflict {
  type: 'teacher_overlap' | 'class_overlap' | 'availability' | 'workload';
  message: string;
  entries: string[];
  severity: 'error' | 'warning';
}

interface TimetableContextType {
  settings: TimetableSettings | null;
  teacherAvailability: TeacherAvailability[];
  entries: TimetableEntry[];
  rules: TimetableRule[];
  history: TimetableGenerationHistory[];
  loading: boolean;
  conflicts: Conflict[];
  
  // Settings
  updateSettings: (settings: Partial<TimetableSettings>) => Promise<void>;
  
  // Availability
  setTeacherAvailability: (teacherId: string, availability: { day: number; period: number; available: boolean }[]) => Promise<void>;
  getTeacherAvailability: (teacherId: string) => TeacherAvailability[];
  
  // Entries
  addEntry: (entry: Omit<TimetableEntry, 'id'>) => Promise<void>;
  updateEntry: (id: string, entry: Partial<TimetableEntry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  moveEntry: (id: string, newDay: number, newPeriod: number) => Promise<void>;
  lockEntry: (id: string, locked: boolean) => Promise<void>;
  clearEntries: (classId?: string) => Promise<void>;
  
  // Rules
  toggleRule: (id: string, active: boolean) => Promise<void>;
  updateRulePriority: (id: string, priority: number) => Promise<void>;
  
  // Generation
  generateTimetable: (classIds: string[], level?: string) => Promise<{ success: boolean; message: string }>;
  
  // Helpers
  validateTimetable: () => Conflict[];
  refreshData: () => Promise<void>;
}

const TimetableContext = createContext<TimetableContextType | undefined>(undefined);

export const TimetableProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<TimetableSettings | null>(null);
  const [teacherAvailability, setTeacherAvailabilityState] = useState<TeacherAvailability[]>([]);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [rules, setRules] = useState<TimetableRule[]>([]);
  const [history, setHistory] = useState<TimetableGenerationHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, availabilityRes, entriesRes, rulesRes, historyRes] = await Promise.all([
        supabase.from('timetable_settings').select('*').limit(1).single(),
        supabase.from('teacher_availability').select('*'),
        supabase.from('timetable_entries').select('*'),
        supabase.from('timetable_rules').select('*').order('priority', { ascending: false }),
        supabase.from('timetable_generation_history').select('*').order('generated_at', { ascending: false }).limit(10)
      ]);

      if (settingsRes.data) setSettings(settingsRes.data);
      if (availabilityRes.data) setTeacherAvailabilityState(availabilityRes.data);
      if (entriesRes.data) setEntries(entriesRes.data);
      if (rulesRes.data) setRules(rulesRes.data);
      if (historyRes.data) setHistory(historyRes.data);
    } catch (error: unknown) {
      console.error('Error fetching timetable data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Validate timetable and update conflicts
  const validateTimetable = useCallback((): Conflict[] => {
    const newConflicts: Conflict[] = [];
    
    // Check for teacher overlaps (same teacher, same day/period, different classes)
    const teacherSlots = new Map<string, TimetableEntry[]>();
    entries.forEach(entry => {
      if (entry.teacher_id) {
        const key = `${entry.teacher_id}-${entry.day_of_week}-${entry.period_number}`;
        if (!teacherSlots.has(key)) teacherSlots.set(key, []);
        teacherSlots.get(key)!.push(entry);
      }
    });
    
    teacherSlots.forEach((slots, key) => {
      if (slots.length > 1) {
        newConflicts.push({
          type: 'teacher_overlap',
          message: `Professor com aulas simultâneas`,
          entries: slots.map(s => s.id),
          severity: 'error'
        });
      }
    });

    // Check for class overlaps (same class, same day/period, multiple subjects)
    const classSlots = new Map<string, TimetableEntry[]>();
    entries.forEach(entry => {
      const key = `${entry.class_id}-${entry.day_of_week}-${entry.period_number}`;
      if (!classSlots.has(key)) classSlots.set(key, []);
      classSlots.get(key)!.push(entry);
    });
    
    classSlots.forEach((slots) => {
      if (slots.length > 1) {
        newConflicts.push({
          type: 'class_overlap',
          message: `Turma com aulas duplicadas no mesmo horário`,
          entries: slots.map(s => s.id),
          severity: 'error'
        });
      }
    });

    // Check teacher availability
    entries.forEach(entry => {
      if (entry.teacher_id) {
        const availability = teacherAvailability.find(
          a => a.teacher_id === entry.teacher_id && 
               a.day_of_week === entry.day_of_week && 
               a.period_number === entry.period_number
        );
        if (availability && !availability.available) {
          newConflicts.push({
            type: 'availability',
            message: `Professor indisponível neste horário`,
            entries: [entry.id],
            severity: 'error'
          });
        }
      }
    });

    setConflicts(newConflicts);
    return newConflicts;
  }, [entries, teacherAvailability]);

  useEffect(() => {
    if (entries.length > 0) {
      validateTimetable();
    }
  }, [entries, validateTimetable]);

  // Settings functions
  const updateSettings = async (newSettings: Partial<TimetableSettings>) => {
    if (!settings?.id) return;
    const { error } = await supabase.from('timetable_settings').update(newSettings).eq('id', settings.id);
    if (error) throw error;
    await fetchData();
  };

  // Availability functions
  const setTeacherAvailability = async (
    teacherId: string, 
    availability: { day: number; period: number; available: boolean }[]
  ) => {
    // Delete existing availability for this teacher
    await supabase.from('teacher_availability').delete().eq('teacher_id', teacherId);
    
    // Insert new availability
    const inserts = availability.map(a => ({
      teacher_id: teacherId,
      day_of_week: a.day,
      period_number: a.period,
      available: a.available
    }));
    
    if (inserts.length > 0) {
      const { error } = await supabase.from('teacher_availability').insert(inserts);
      if (error) throw error;
    }
    
    await fetchData();
  };

  const getTeacherAvailability = (teacherId: string): TeacherAvailability[] => {
    return teacherAvailability.filter(a => a.teacher_id === teacherId);
  };

  // Entry functions
  const addEntry = async (entry: Omit<TimetableEntry, 'id'>) => {
    const { error } = await supabase.from('timetable_entries').insert(entry);
    if (error) throw error;
    await fetchData();
  };

  const updateEntry = async (id: string, entry: Partial<TimetableEntry>) => {
    const { error } = await supabase.from('timetable_entries').update(entry).eq('id', id);
    if (error) throw error;
    await fetchData();
  };

  const deleteEntry = async (id: string) => {
    const { error } = await supabase.from('timetable_entries').delete().eq('id', id);
    if (error) throw error;
    await fetchData();
  };

  const moveEntry = async (id: string, newDay: number, newPeriod: number) => {
    const { error } = await supabase.from('timetable_entries').update({
      day_of_week: newDay,
      period_number: newPeriod
    }).eq('id', id);
    if (error) throw error;
    await fetchData();
  };

  const lockEntry = async (id: string, locked: boolean) => {
    const { error } = await supabase.from('timetable_entries').update({ is_locked: locked }).eq('id', id);
    if (error) throw error;
    await fetchData();
  };

  const clearEntries = async (classId?: string) => {
    if (classId) {
      const { error } = await supabase.from('timetable_entries').delete().eq('class_id', classId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('timetable_entries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
    }
    await fetchData();
  };

  // Rules functions
  const toggleRule = async (id: string, active: boolean) => {
    const { error } = await supabase.from('timetable_rules').update({ is_active: active }).eq('id', id);
    if (error) throw error;
    await fetchData();
  };

  const updateRulePriority = async (id: string, priority: number) => {
    const { error } = await supabase.from('timetable_rules').update({ priority }).eq('id', id);
    if (error) throw error;
    await fetchData();
  };

  // Generation function
  const generateTimetable = async (classIds: string[], level?: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await supabase.functions.invoke('generate-timetable', {
        body: { classIds, generationLevel: level || 'moderate' }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      await fetchData();
      
      return {
        success: true,
        message: response.data?.explanation || 'Horário gerado com sucesso!'
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao gerar horário';
      toast({
        title: 'Erro na geração',
        description: errorMessage,
        variant: 'destructive'
      });
      return {
        success: false,
        message: errorMessage
      };
    }
  };

  return (
    <TimetableContext.Provider value={{
      settings,
      teacherAvailability,
      entries,
      rules,
      history,
      loading,
      conflicts,
      updateSettings,
      setTeacherAvailability,
      getTeacherAvailability,
      addEntry,
      updateEntry,
      deleteEntry,
      moveEntry,
      lockEntry,
      clearEntries,
      toggleRule,
      updateRulePriority,
      generateTimetable,
      validateTimetable,
      refreshData: fetchData
    }}>
      {children}
    </TimetableContext.Provider>
  );
};

export const useTimetable = () => {
  const context = useContext(TimetableContext);
  if (!context) {
    throw new Error('useTimetable must be used within TimetableProvider');
  }
  return context;
};
