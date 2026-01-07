-- Table: timetable_settings (Configurações do Horário)
CREATE TABLE public.timetable_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_year TEXT NOT NULL DEFAULT '2025',
  days_per_week INTEGER NOT NULL DEFAULT 5,
  periods_per_day INTEGER NOT NULL DEFAULT 6,
  period_duration_minutes INTEGER NOT NULL DEFAULT 50,
  break_after_period INTEGER[] DEFAULT ARRAY[3],
  break_duration_minutes INTEGER NOT NULL DEFAULT 15,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: teacher_availability (Disponibilidade Detalhada dos Professores)
CREATE TABLE public.teacher_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES public.mapping_teachers(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 5),
  period_number INTEGER NOT NULL CHECK (period_number >= 1 AND period_number <= 6),
  available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(teacher_id, day_of_week, period_number)
);

-- Table: timetable_entries (Entradas do Horário)
CREATE TABLE public.timetable_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES public.mapping_classes(id) ON DELETE CASCADE,
  subject_name TEXT NOT NULL,
  teacher_id UUID REFERENCES public.mapping_teachers(id) ON DELETE SET NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 5),
  period_number INTEGER NOT NULL CHECK (period_number >= 1 AND period_number <= 6),
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: timetable_rules (Regras Pedagógicas)
CREATE TABLE public.timetable_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_type TEXT NOT NULL UNIQUE,
  rule_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  parameters JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: timetable_generation_history (Histórico de Gerações)
CREATE TABLE public.timetable_generation_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  generated_by UUID,
  quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
  conflicts_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'archived')),
  snapshot JSONB,
  explanation TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.timetable_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_generation_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for timetable_settings
CREATE POLICY "Users can view timetable settings" 
ON public.timetable_settings FOR SELECT 
USING (public.user_has_any_role(ARRAY['admin', 'direction', 'teacher']::app_role[]));

CREATE POLICY "Admin/Direction can manage timetable settings" 
ON public.timetable_settings FOR ALL 
USING (public.user_has_any_role(ARRAY['admin', 'direction']::app_role[]));

-- RLS Policies for teacher_availability
CREATE POLICY "Users can view teacher availability" 
ON public.teacher_availability FOR SELECT 
USING (public.user_has_any_role(ARRAY['admin', 'direction', 'teacher']::app_role[]));

CREATE POLICY "Admin/Direction can manage teacher availability" 
ON public.teacher_availability FOR ALL 
USING (public.user_has_any_role(ARRAY['admin', 'direction']::app_role[]));

-- RLS Policies for timetable_entries
CREATE POLICY "Users can view timetable entries" 
ON public.timetable_entries FOR SELECT 
USING (public.user_has_any_role(ARRAY['admin', 'direction', 'teacher']::app_role[]));

CREATE POLICY "Admin/Direction can manage timetable entries" 
ON public.timetable_entries FOR ALL 
USING (public.user_has_any_role(ARRAY['admin', 'direction']::app_role[]));

-- RLS Policies for timetable_rules
CREATE POLICY "Users can view timetable rules" 
ON public.timetable_rules FOR SELECT 
USING (public.user_has_any_role(ARRAY['admin', 'direction', 'teacher']::app_role[]));

CREATE POLICY "Admin/Direction can manage timetable rules" 
ON public.timetable_rules FOR ALL 
USING (public.user_has_any_role(ARRAY['admin', 'direction']::app_role[]));

-- RLS Policies for timetable_generation_history
CREATE POLICY "Users can view generation history" 
ON public.timetable_generation_history FOR SELECT 
USING (public.user_has_any_role(ARRAY['admin', 'direction', 'teacher']::app_role[]));

CREATE POLICY "Admin/Direction can manage generation history" 
ON public.timetable_generation_history FOR ALL 
USING (public.user_has_any_role(ARRAY['admin', 'direction']::app_role[]));

-- Insert default timetable settings
INSERT INTO public.timetable_settings (school_year, days_per_week, periods_per_day, period_duration_minutes, break_after_period, break_duration_minutes)
VALUES ('2025', 5, 6, 50, ARRAY[3], 15);

-- Insert default pedagogical rules
INSERT INTO public.timetable_rules (rule_type, rule_name, description, is_active, priority) VALUES
('avoid_same_subject_same_day', 'Evitar Repetição de Disciplina', 'Evitar aulas da mesma disciplina no mesmo dia para a mesma turma', true, 8),
('avoid_teacher_gaps', 'Evitar Janelas do Professor', 'Minimizar períodos vazios entre aulas do mesmo professor', true, 9),
('prefer_paired_lessons', 'Preferir Aulas Geminadas', 'Priorizar aulas duplas quando possível para disciplinas que necessitam', true, 6),
('distribute_heavy_subjects', 'Distribuir Disciplinas Pesadas', 'Distribuir disciplinas com maior carga horária ao longo da semana', true, 7),
('respect_teacher_availability', 'Respeitar Disponibilidade', 'Respeitar rigorosamente a disponibilidade cadastrada dos professores', true, 10);

-- Triggers for updated_at
CREATE TRIGGER update_timetable_settings_updated_at
BEFORE UPDATE ON public.timetable_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_timetable_entries_updated_at
BEFORE UPDATE ON public.timetable_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();