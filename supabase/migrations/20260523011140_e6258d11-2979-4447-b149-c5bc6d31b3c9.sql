-- Restrict staff update on attendance to current day only
DROP POLICY IF EXISTS "Staff can update attendance" ON public.attendance;
CREATE POLICY "Staff can update attendance"
ON public.attendance
FOR UPDATE
TO authenticated
USING (
  user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role, 'teacher'::app_role])
  OR (user_has_any_role(ARRAY['staff'::app_role]) AND date = CURRENT_DATE)
);

-- Remove staff from student_pei SELECT (sensitive medical/PII)
DROP POLICY IF EXISTS "Staff can view student_pei" ON public.student_pei;
CREATE POLICY "Admin direction teachers view student_pei"
ON public.student_pei
FOR SELECT
TO authenticated
USING (user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role, 'teacher'::app_role]));

-- Remove staff from students INSERT (sensitive medical fields)
DROP POLICY IF EXISTS "Staff can insert students" ON public.students;
CREATE POLICY "Admin direction teachers can insert students"
ON public.students
FOR INSERT
TO authenticated
WITH CHECK (user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role, 'teacher'::app_role]));