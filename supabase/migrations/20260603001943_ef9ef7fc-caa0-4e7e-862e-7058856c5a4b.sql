CREATE POLICY "Staff can insert audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role, 'teacher'::app_role]));