
-- 1. Students: restrict staff role; create RPC for basic lookup by QR
DROP POLICY IF EXISTS "Staff can view students" ON public.students;
CREATE POLICY "Admin direction teachers view students"
ON public.students
FOR SELECT
USING (user_has_any_role(ARRAY['admin', 'direction', 'teacher']::app_role[]));

CREATE OR REPLACE FUNCTION public.get_student_basic_by_qr(_qr_code text)
RETURNS TABLE (
  id uuid,
  full_name text,
  student_id text,
  class text,
  shift text,
  photo_url text,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.full_name, s.student_id, s.class, s.shift, s.photo_url, s.status::text
  FROM public.students s
  WHERE s.qr_code = _qr_code
    AND user_has_any_role(ARRAY['admin','direction','teacher','staff']::app_role[])
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_student_basic_by_qr(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_student_basic_by_qr(text) TO authenticated;

-- 2. Attendance: restrict staff to today only
DROP POLICY IF EXISTS "Staff can view attendance" ON public.attendance;
CREATE POLICY "Admin direction teachers view attendance"
ON public.attendance
FOR SELECT
USING (user_has_any_role(ARRAY['admin','direction','teacher']::app_role[]));

CREATE POLICY "Staff view today attendance"
ON public.attendance
FOR SELECT
USING (
  user_has_any_role(ARRAY['staff']::app_role[])
  AND date = CURRENT_DATE
);

-- 3. Notification logs: admin only
DROP POLICY IF EXISTS "Admin and direction can view notification logs" ON public.notification_logs;
DROP POLICY IF EXISTS "Admin and direction can insert notification logs" ON public.notification_logs;

CREATE POLICY "Admin can view notification logs"
ON public.notification_logs
FOR SELECT
USING (user_has_any_role(ARRAY['admin']::app_role[]));

CREATE POLICY "Admin can insert notification logs"
ON public.notification_logs
FOR INSERT
WITH CHECK (user_has_any_role(ARRAY['admin']::app_role[]));

-- 4. AEE storage: remove staff access
DROP POLICY IF EXISTS "Staff can view AEE documents" ON storage.objects;
CREATE POLICY "Admin direction teachers view AEE documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'aee-documents'
  AND user_has_any_role(ARRAY['admin','direction','teacher']::app_role[])
);

-- 5. Audit logs: restrict insert to authenticated
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated can insert audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
