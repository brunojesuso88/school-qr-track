-- notification_logs: restrict to authenticated
DROP POLICY IF EXISTS "Admin can view notification logs" ON public.notification_logs;
DROP POLICY IF EXISTS "Admin can insert notification logs" ON public.notification_logs;

CREATE POLICY "Admin can view notification logs"
ON public.notification_logs FOR SELECT TO authenticated
USING (user_has_any_role(ARRAY['admin'::app_role]));

CREATE POLICY "Admin can insert notification logs"
ON public.notification_logs FOR INSERT TO authenticated
WITH CHECK (user_has_any_role(ARRAY['admin'::app_role]));

-- user_roles: restrict UPDATE/SELECT to authenticated
DROP POLICY IF EXISTS "Admins can update all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles or admins can view all" ON public.user_roles;

CREATE POLICY "Admins can update all roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (current_user_has_role('admin'::app_role))
WITH CHECK (current_user_has_role('admin'::app_role));

CREATE POLICY "Users can view own roles or admins can view all"
ON public.user_roles FOR SELECT TO authenticated
USING ((auth.uid() = user_id) OR current_user_has_role('admin'::app_role));

-- storage: drop overly permissive student-photos view policy
DROP POLICY IF EXISTS "Authenticated users can view student photos" ON storage.objects;

-- realtime.messages: restrict to staff roles
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff roles can receive realtime messages" ON realtime.messages;
CREATE POLICY "Staff roles can receive realtime messages"
ON realtime.messages FOR SELECT TO authenticated
USING (public.user_has_any_role(ARRAY['admin'::public.app_role, 'direction'::public.app_role, 'teacher'::public.app_role, 'staff'::public.app_role]));