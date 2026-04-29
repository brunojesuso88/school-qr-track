
CREATE TABLE public.student_pei (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL UNIQUE REFERENCES public.students(id) ON DELETE CASCADE,
  -- Identificação
  birth_date_snapshot date,
  shift_snapshot text,
  enrollment_number text,
  aee_teacher text,
  coordination text,
  elaboration_date date,
  legal_guardian text,
  contact text,
  email text,
  phone text,
  -- Texto livre
  functional_profile text,
  potentialities text,
  learning_barriers text,
  evaluation_criteria text,
  -- Estruturados
  performance_levels jsonb NOT NULL DEFAULT '{}'::jsonb,
  intervention_plan jsonb NOT NULL DEFAULT '[]'::jsonb,
  discipline_adaptations jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Metadados
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.student_pei ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view student_pei"
ON public.student_pei FOR SELECT TO authenticated
USING (user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role, 'teacher'::app_role, 'staff'::app_role]));

CREATE POLICY "Admin direction teachers can insert student_pei"
ON public.student_pei FOR INSERT TO authenticated
WITH CHECK (user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role, 'teacher'::app_role]));

CREATE POLICY "Admin direction teachers can update student_pei"
ON public.student_pei FOR UPDATE TO authenticated
USING (user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role, 'teacher'::app_role]));

CREATE POLICY "Admin direction can delete student_pei"
ON public.student_pei FOR DELETE TO authenticated
USING (user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role]));

CREATE TRIGGER update_student_pei_updated_at
BEFORE UPDATE ON public.student_pei
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
