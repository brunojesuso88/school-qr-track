-- 1. Remove client INSERT on audit_logs; entries are recorded only by SECURITY DEFINER triggers
DROP POLICY IF EXISTS "Authenticated can insert audit logs" ON public.audit_logs;
REVOKE INSERT ON public.audit_logs FROM authenticated, anon;

-- 2. Remove 'staff' role from classes INSERT/UPDATE policies (staff is view-only)
DROP POLICY IF EXISTS "Staff can insert classes" ON public.classes;
DROP POLICY IF EXISTS "Staff can update classes" ON public.classes;

CREATE POLICY "Admin direction teachers can insert classes"
ON public.classes
FOR INSERT
TO authenticated
WITH CHECK (user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role, 'teacher'::app_role]));

CREATE POLICY "Admin direction teachers can update classes"
ON public.classes
FOR UPDATE
TO authenticated
USING (user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role, 'teacher'::app_role]));