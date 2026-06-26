
-- 1) Audit logs: restrict INSERT so user_id must match auth.uid()
DROP POLICY IF EXISTS "Staff can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated can insert own audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role,'teacher'::app_role,'staff'::app_role])
);

-- 2) Students update: split policies so staff is isolated; trigger restrict_staff_student_updates already enforces column-level restriction (photo_url only)
DROP POLICY IF EXISTS "Staff can update students" ON public.students;

CREATE POLICY "Privileged roles can update students"
ON public.students
FOR UPDATE
TO authenticated
USING (user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role,'teacher'::app_role]))
WITH CHECK (user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role,'teacher'::app_role]));

CREATE POLICY "Staff can update student photo only"
ON public.students
FOR UPDATE
TO authenticated
USING (current_user_has_role('staff'::app_role))
WITH CHECK (current_user_has_role('staff'::app_role));
-- Column-level restriction enforced by trigger trg_restrict_staff_student_updates

-- 3) Storage class-photos: tighten DELETE for staff to only files they own (path starts with auth.uid())
DROP POLICY IF EXISTS "Staff can delete class photos" ON storage.objects;

CREATE POLICY "Privileged roles can delete class photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'class-photos'
  AND user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role,'teacher'::app_role])
);

CREATE POLICY "Staff can delete own class photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'class-photos'
  AND current_user_has_role('staff'::app_role)
  AND owner = auth.uid()
);
