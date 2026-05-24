
CREATE TABLE public.student_paee (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL UNIQUE,
  school TEXT,
  class_snapshot TEXT,
  shift_snapshot TEXT,
  birth_date_snapshot DATE,
  age INTEGER,
  elaboration_date DATE,
  disability_type TEXT,
  composition TEXT,
  libras_interpreter BOOLEAN NOT NULL DEFAULT false,
  support_assistant BOOLEAN NOT NULL DEFAULT false,
  weekdays TEXT[] NOT NULL DEFAULT '{}'::text[],
  schedule_time TEXT,
  periodicity TEXT,
  pedagogical_matrix JSONB NOT NULL DEFAULT '{}'::jsonb,
  aee_teacher_signature TEXT,
  coordinator_signature TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.student_paee ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin direction teachers view student_paee"
ON public.student_paee FOR SELECT TO authenticated
USING (user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role, 'teacher'::app_role]));

CREATE POLICY "Admin direction teachers can insert student_paee"
ON public.student_paee FOR INSERT TO authenticated
WITH CHECK (user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role, 'teacher'::app_role]));

CREATE POLICY "Admin direction teachers can update student_paee"
ON public.student_paee FOR UPDATE TO authenticated
USING (user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role, 'teacher'::app_role]));

CREATE POLICY "Admin direction can delete student_paee"
ON public.student_paee FOR DELETE TO authenticated
USING (user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role]));

CREATE TRIGGER update_student_paee_updated_at
BEFORE UPDATE ON public.student_paee
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
