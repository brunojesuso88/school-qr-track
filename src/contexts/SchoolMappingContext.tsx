import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Paleta de cores para professores
const TEACHER_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
  '#14B8A6', '#A855F7', '#F43F5E', '#22C55E', '#0EA5E9'
];

export interface MappingTeacher {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  max_weekly_hours: number;
  current_hours: number;
  color: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface MappingGlobalSubject {
  id: string;
  name: string;
  default_weekly_classes: number;
  created_at: string;
}

export interface MappingClass {
  id: string;
  name: string;
  shift: string;
  student_count?: number;
  weekly_hours: number;
  created_at: string;
  updated_at: string;
}

export interface MappingClassSubject {
  id: string;
  class_id: string;
  subject_name: string;
  weekly_classes: number;
  teacher_id?: string;
  created_at: string;
}

export interface BatchChange {
  classSubjectId: string;
  action: 'assign' | 'unassign';
  newTeacherId?: string;
  previousTeacherId?: string | null;
}

interface SchoolMappingContextType {
  teachers: MappingTeacher[];
  globalSubjects: MappingGlobalSubject[];
  classes: MappingClass[];
  classSubjects: MappingClassSubject[];
  loading: boolean;
  
  // Teacher functions
  addTeacher: (teacher: Omit<MappingTeacher, 'id' | 'created_at' | 'updated_at' | 'color' | 'current_hours'>) => Promise<{ id: string } | undefined>;
  updateTeacher: (id: string, teacher: Partial<MappingTeacher>) => Promise<void>;
  deleteTeacher: (id: string) => Promise<void>;
  
  // Global Subject functions
  addGlobalSubject: (subject: Omit<MappingGlobalSubject, 'id' | 'created_at'>) => Promise<void>;
  updateGlobalSubject: (id: string, subject: Partial<MappingGlobalSubject>) => Promise<void>;
  deleteGlobalSubject: (id: string) => Promise<void>;
  
  // Class functions
  addClass: (classData: Omit<MappingClass, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateClass: (id: string, classData: Partial<MappingClass>) => Promise<void>;
  deleteClass: (id: string) => Promise<void>;
  
  // Class Subject functions
  addClassSubject: (subject: Omit<MappingClassSubject, 'id' | 'created_at'>) => Promise<void>;
  updateClassSubject: (id: string, subject: Partial<MappingClassSubject>) => Promise<void>;
  deleteClassSubject: (id: string) => Promise<void>;
  
  // Assignment functions
  assignTeacher: (classSubjectId: string, teacherId: string) => Promise<void>;
  unassignTeacher: (classSubjectId: string) => Promise<void>;
  batchSaveAssignments: (changes: BatchChange[]) => Promise<void>;
  
  // Helpers
  getNextColor: () => string;
  refreshData: () => Promise<void>;
}

const SchoolMappingContext = createContext<SchoolMappingContextType | undefined>(undefined);

export const SchoolMappingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [teachers, setTeachers] = useState<MappingTeacher[]>([]);
  const [globalSubjects, setGlobalSubjects] = useState<MappingGlobalSubject[]>([]);
  const [classes, setClasses] = useState<MappingClass[]>([]);
  const [classSubjects, setClassSubjects] = useState<MappingClassSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [teachersRes, subjectsRes, classesRes, classSubjectsRes] = await Promise.all([
        supabase.from('mapping_teachers').select('*').order('name'),
        supabase.from('mapping_global_subjects').select('*').order('name'),
        supabase.from('mapping_classes').select('*').order('name'),
        supabase.from('mapping_class_subjects').select('*')
      ]);

      if (teachersRes.error) throw teachersRes.error;
      if (subjectsRes.error) throw subjectsRes.error;
      if (classesRes.error) throw classesRes.error;
      if (classSubjectsRes.error) throw classSubjectsRes.error;

      const teachersData = teachersRes.data || [];
      const classSubjectsData = classSubjectsRes.data || [];

      // Recalcular current_hours dinamicamente
      const recalculatedTeachers = teachersData.map(teacher => {
        const realHours = classSubjectsData
          .filter(cs => cs.teacher_id === teacher.id)
          .reduce((sum, cs) => sum + cs.weekly_classes, 0);
        return { ...teacher, current_hours: realHours };
      });

      // Sincronizar banco quando houver divergência
      for (const teacher of recalculatedTeachers) {
        const original = teachersData.find(t => t.id === teacher.id);
        if (original && original.current_hours !== teacher.current_hours) {
          supabase.from('mapping_teachers')
            .update({ current_hours: teacher.current_hours })
            .eq('id', teacher.id);
        }
      }

      setTeachers(recalculatedTeachers);
      setGlobalSubjects(subjectsRes.data || []);
      setClasses(classesRes.data || []);
      setClassSubjects(classSubjectsData);
    } catch (error: any) {
      console.error('Error fetching mapping data:', error);
      toast({
        title: 'Erro ao carregar dados',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getNextColor = () => {
    const usedColors = teachers.map(t => t.color);
    const availableColor = TEACHER_COLORS.find(c => !usedColors.includes(c));
    return availableColor || TEACHER_COLORS[teachers.length % TEACHER_COLORS.length];
  };

  // Teacher functions
  const addTeacher = async (teacher: Omit<MappingTeacher, 'id' | 'created_at' | 'updated_at' | 'color' | 'current_hours'>): Promise<{ id: string } | undefined> => {
    const { data, error } = await supabase.from('mapping_teachers').insert({
      ...teacher,
      color: getNextColor(),
      current_hours: 0
    }).select('id').single();
    if (error) throw error;
    await fetchData();
    return data;
  };

  const updateTeacher = async (id: string, teacher: Partial<MappingTeacher>) => {
    const { error } = await supabase.from('mapping_teachers').update(teacher).eq('id', id);
    if (error) throw error;
    await fetchData();
  };

  const deleteTeacher = async (id: string) => {
    const { error } = await supabase.from('mapping_teachers').delete().eq('id', id);
    if (error) throw error;
    await fetchData();
  };

  // Global Subject functions
  const addGlobalSubject = async (subject: Omit<MappingGlobalSubject, 'id' | 'created_at'>) => {
    const { error } = await supabase.from('mapping_global_subjects').insert(subject);
    if (error) throw error;
    await fetchData();
  };

  const updateGlobalSubject = async (id: string, subject: Partial<MappingGlobalSubject>) => {
    const { error } = await supabase.from('mapping_global_subjects').update(subject).eq('id', id);
    if (error) throw error;
    await fetchData();
  };

  const deleteGlobalSubject = async (id: string) => {
    const { error } = await supabase.from('mapping_global_subjects').delete().eq('id', id);
    if (error) throw error;
    await fetchData();
  };

  // Class functions
  const addClass = async (classData: Omit<MappingClass, 'id' | 'created_at' | 'updated_at'>) => {
    const { error } = await supabase.from('mapping_classes').insert(classData);
    if (error) throw error;
    await fetchData();
  };

  const updateClass = async (id: string, classData: Partial<MappingClass>) => {
    const { error } = await supabase.from('mapping_classes').update(classData).eq('id', id);
    if (error) throw error;
    await fetchData();
  };

  const deleteClass = async (id: string) => {
    const { error } = await supabase.from('mapping_classes').delete().eq('id', id);
    if (error) throw error;
    await fetchData();
  };

  // Class Subject functions
  const addClassSubject = async (subject: Omit<MappingClassSubject, 'id' | 'created_at'>) => {
    const { error } = await supabase.from('mapping_class_subjects').insert(subject);
    if (error) throw error;
    await fetchData();
  };

  const updateClassSubject = async (id: string, subject: Partial<MappingClassSubject>) => {
    const { error } = await supabase.from('mapping_class_subjects').update(subject).eq('id', id);
    if (error) throw error;
    await fetchData();
  };

  const deleteClassSubject = async (id: string) => {
    const { error } = await supabase.from('mapping_class_subjects').delete().eq('id', id);
    if (error) throw error;
    await fetchData();
  };

  // Assignment functions
  const assignTeacher = async (classSubjectId: string, teacherId: string) => {
    const classSubject = classSubjects.find(cs => cs.id === classSubjectId);
    const teacher = teachers.find(t => t.id === teacherId);
    
    if (!classSubject || !teacher) return;

    const newHours = teacher.current_hours + classSubject.weekly_classes;
    
    await Promise.all([
      supabase.from('mapping_class_subjects').update({ teacher_id: teacherId }).eq('id', classSubjectId),
      supabase.from('mapping_teachers').update({ current_hours: newHours }).eq('id', teacherId)
    ]);
    
    await fetchData();
  };

  const unassignTeacher = async (classSubjectId: string) => {
    const classSubject = classSubjects.find(cs => cs.id === classSubjectId);
    if (!classSubject || !classSubject.teacher_id) return;

    const teacher = teachers.find(t => t.id === classSubject.teacher_id);
    if (!teacher) return;

    const newHours = Math.max(0, teacher.current_hours - classSubject.weekly_classes);

    await Promise.all([
      supabase.from('mapping_class_subjects').update({ teacher_id: null }).eq('id', classSubjectId),
      supabase.from('mapping_teachers').update({ current_hours: newHours }).eq('id', classSubject.teacher_id)
    ]);

    await fetchData();
  };

  // Batch save function - processes all changes and calls fetchData only once
  const batchSaveAssignments = async (changes: BatchChange[]) => {
    // Group operations
    const unassigns: { classSubjectId: string; teacherId: string; weeklyClasses: number }[] = [];
    const assigns: { classSubjectId: string; teacherId: string; weeklyClasses: number }[] = [];
    
    for (const change of changes) {
      const cs = classSubjects.find(c => c.id === change.classSubjectId);
      if (!cs) continue;
      
      if (change.action === 'unassign' && change.previousTeacherId) {
        unassigns.push({
          classSubjectId: change.classSubjectId,
          teacherId: change.previousTeacherId,
          weeklyClasses: cs.weekly_classes
        });
      } else if (change.action === 'assign' && change.newTeacherId) {
        // If there's a previous teacher, we need to unassign first
        if (change.previousTeacherId) {
          unassigns.push({
            classSubjectId: change.classSubjectId,
            teacherId: change.previousTeacherId,
            weeklyClasses: cs.weekly_classes
          });
        }
        assigns.push({
          classSubjectId: change.classSubjectId,
          teacherId: change.newTeacherId,
          weeklyClasses: cs.weekly_classes
        });
      }
    }
    
    // Calculate teacher hour deltas
    const teacherHourDeltas = new Map<string, number>();
    
    // Process unassigns - decrease hours
    for (const unassign of unassigns) {
      const current = teacherHourDeltas.get(unassign.teacherId) || 0;
      teacherHourDeltas.set(unassign.teacherId, current - unassign.weeklyClasses);
    }
    
    // Process assigns - increase hours
    for (const assign of assigns) {
      const current = teacherHourDeltas.get(assign.teacherId) || 0;
      teacherHourDeltas.set(assign.teacherId, current + assign.weeklyClasses);
    }
    
    // Execute all unassignments in batch
    if (unassigns.length > 0) {
      const unassignIds = unassigns.map(u => u.classSubjectId);
      const { error } = await supabase
        .from('mapping_class_subjects')
        .update({ teacher_id: null })
        .in('id', unassignIds);
      if (error) throw error;
    }
    
    // Execute all assignments (one by one since each has different teacher_id)
    for (const assign of assigns) {
      const { error } = await supabase
        .from('mapping_class_subjects')
        .update({ teacher_id: assign.teacherId })
        .eq('id', assign.classSubjectId);
      if (error) throw error;
    }
    
    // Update teacher hours in batch
    for (const [teacherId, delta] of teacherHourDeltas) {
      const teacher = teachers.find(t => t.id === teacherId);
      if (teacher) {
        const newHours = Math.max(0, teacher.current_hours + delta);
        const { error } = await supabase
          .from('mapping_teachers')
          .update({ current_hours: newHours })
          .eq('id', teacherId);
        if (error) throw error;
      }
    }
    
    // Single fetchData at the end
    await fetchData();
  };

  return (
    <SchoolMappingContext.Provider value={{
      teachers,
      globalSubjects,
      classes,
      classSubjects,
      loading,
      addTeacher,
      updateTeacher,
      deleteTeacher,
      addGlobalSubject,
      updateGlobalSubject,
      deleteGlobalSubject,
      addClass,
      updateClass,
      deleteClass,
      addClassSubject,
      updateClassSubject,
      deleteClassSubject,
      assignTeacher,
      unassignTeacher,
      batchSaveAssignments,
      getNextColor,
      refreshData: fetchData
    }}>
      {children}
    </SchoolMappingContext.Provider>
  );
};

export const useSchoolMapping = () => {
  const context = useContext(SchoolMappingContext);
  if (!context) {
    throw new Error('useSchoolMapping must be used within SchoolMappingProvider');
  }
  return context;
};
