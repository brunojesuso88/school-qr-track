
-- Fix audit_logs insert policy to actually include staff
DROP POLICY IF EXISTS "Staff can insert audit logs" ON public.audit_logs;
CREATE POLICY "Staff can insert audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (public.user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role,'teacher'::app_role,'staff'::app_role]));

-- Allow staff to update students, but only the photo_url column
DROP POLICY IF EXISTS "Staff can update students" ON public.students;
CREATE POLICY "Staff can update students"
ON public.students
FOR UPDATE
TO authenticated
USING (public.user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role,'teacher'::app_role,'staff'::app_role]))
WITH CHECK (public.user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role,'teacher'::app_role,'staff'::app_role]));

CREATE OR REPLACE FUNCTION public.restrict_staff_student_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_user_has_role('staff'::app_role)
     AND NOT public.user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role,'teacher'::app_role]) THEN
    IF to_jsonb(NEW) - 'photo_url' - 'updated_at' IS DISTINCT FROM to_jsonb(OLD) - 'photo_url' - 'updated_at' THEN
      RAISE EXCEPTION 'Staff podem atualizar apenas a foto do aluno';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_staff_student_updates ON public.students;
CREATE TRIGGER trg_restrict_staff_student_updates
BEFORE UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.restrict_staff_student_updates();
