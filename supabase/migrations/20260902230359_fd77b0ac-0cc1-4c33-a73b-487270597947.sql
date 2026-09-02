CREATE TABLE IF NOT EXISTS public.app_config (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.app_config TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_config TO authenticated;
GRANT ALL ON public.app_config TO service_role;

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_config_read_authenticated" ON public.app_config;
CREATE POLICY "app_config_read_authenticated" ON public.app_config
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "app_config_write_global_admin" ON public.app_config;
CREATE POLICY "app_config_write_global_admin" ON public.app_config
  FOR ALL TO authenticated
  USING (public.is_global_admin())
  WITH CHECK (public.is_global_admin());

INSERT INTO public.app_config (key, value)
VALUES ('public_app_url', 'https://edunexusbruno.tech')
ON CONFLICT (key) DO NOTHING;