-- 1. Evolve push_subscriptions into a device registry
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS school_id uuid,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS failure_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz;

-- de-duplicate endpoints before adding the unique constraint
DELETE FROM public.push_subscriptions p
 WHERE EXISTS (
   SELECT 1 FROM public.push_subscriptions q
    WHERE q.endpoint = p.endpoint
      AND (q.created_at, q.id) > (p.created_at, p.id)
 );

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_key
  ON public.push_subscriptions (endpoint);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_active_idx
  ON public.push_subscriptions (user_id) WHERE disabled_at IS NULL;

DROP TRIGGER IF EXISTS trg_push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER trg_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- users need UPDATE on their own devices (upsert of last_seen_at / metadata)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

DROP POLICY IF EXISTS "Users can update own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can update own push subscriptions"
  ON public.push_subscriptions FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 2. notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid,
  event_type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  route text,
  entity_type text,
  entity_id text,
  severity text NOT NULL DEFAULT 'info',
  created_by uuid,
  dedupe_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON public.notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_event_type_idx ON public.notifications (event_type);

-- 3. notification_recipients
CREATE TABLE IF NOT EXISTS public.notification_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  seen_at timestamptz,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notification_id, user_id)
);
GRANT SELECT, UPDATE ON public.notification_recipients TO authenticated;
GRANT ALL ON public.notification_recipients TO service_role;
ALTER TABLE public.notification_recipients ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS notification_recipients_user_unread_idx
  ON public.notification_recipients (user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS notification_recipients_user_idx
  ON public.notification_recipients (user_id, created_at DESC);

CREATE POLICY "Users read own notification recipients"
  ON public.notification_recipients FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users update own notification recipients"
  ON public.notification_recipients FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- notifications are readable only when the caller is a recipient
CREATE POLICY "Recipients read notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.notification_recipients r
     WHERE r.notification_id = notifications.id
       AND r.user_id = auth.uid()
  ));

-- 4. notification_deliveries (technical log, admin/direction visibility only)
CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  device_id uuid REFERENCES public.push_subscriptions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  http_status integer,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_deliveries_status_check
    CHECK (status IN ('queued','sent','failed','expired'))
);
GRANT SELECT ON public.notification_deliveries TO authenticated;
GRANT ALL ON public.notification_deliveries TO service_role;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS notification_deliveries_status_idx
  ON public.notification_deliveries (status, created_at);
CREATE INDEX IF NOT EXISTS notification_deliveries_user_idx
  ON public.notification_deliveries (user_id);
CREATE INDEX IF NOT EXISTS notification_deliveries_device_idx
  ON public.notification_deliveries (device_id);
CREATE UNIQUE INDEX IF NOT EXISTS notification_deliveries_unique_target
  ON public.notification_deliveries (notification_id, device_id);

CREATE POLICY "Management reads deliveries"
  ON public.notification_deliveries FOR SELECT TO authenticated
  USING (public.user_has_any_role(ARRAY['admin','direction']::app_role[]));

DROP TRIGGER IF EXISTS trg_notification_deliveries_updated_at ON public.notification_deliveries;
CREATE TRIGGER trg_notification_deliveries_updated_at
  BEFORE UPDATE ON public.notification_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. notification_preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  push_enabled boolean NOT NULL DEFAULT true,
  inapp_enabled boolean NOT NULL DEFAULT true,
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notification preferences"
  ON public.notification_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER trg_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Helper RPCs (no N+1 from the client)
CREATE OR REPLACE FUNCTION public.unread_notifications_count()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
    FROM public.notification_recipients r
   WHERE r.user_id = auth.uid()
     AND r.read_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  UPDATE public.notification_recipients
     SET read_at = now(), seen_at = COALESCE(seen_at, now())
   WHERE user_id = auth.uid()
     AND read_at IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.unread_notifications_count() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_all_notifications_read() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unread_notifications_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;