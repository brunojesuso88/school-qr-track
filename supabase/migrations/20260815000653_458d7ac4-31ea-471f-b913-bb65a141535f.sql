DROP POLICY IF EXISTS "Staff roles can receive realtime messages" ON realtime.messages;

CREATE POLICY "Staff roles can receive attendance realtime messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role, 'teacher'::app_role, 'staff'::app_role])
  AND realtime.topic() = 'attendance-changes'
);