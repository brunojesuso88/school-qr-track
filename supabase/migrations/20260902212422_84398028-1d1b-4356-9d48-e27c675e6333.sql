-- 1) Realtime por escola: topic = 'attendance-changes:<school_id>'
DROP POLICY IF EXISTS "Staff roles can receive attendance realtime messages" ON realtime.messages;

CREATE POLICY "School members receive attendance realtime messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() ~ '^attendance-changes:[0-9a-fA-F-]{36}$'
  AND public.has_row_role(
    (regexp_replace(realtime.topic(), '^attendance-changes:', ''))::uuid,
    ARRAY['admin','direction','teacher','staff']::app_role[]
  )
);

-- 2) dedupe_key agora inclui a escola; unicidade passa a ser por escola.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_dedupe_key_key;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_school_dedupe_key_idx
  ON public.notifications (COALESCE(school_id, '00000000-0000-0000-0000-000000000000'::uuid), dedupe_key);