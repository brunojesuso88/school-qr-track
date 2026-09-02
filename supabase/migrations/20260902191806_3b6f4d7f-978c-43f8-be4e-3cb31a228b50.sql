CREATE TABLE IF NOT EXISTS public.ab_audit_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_name text NOT NULL,
  passed boolean NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ab_audit_results TO service_role;
ALTER TABLE public.ab_audit_results ENABLE ROW LEVEL SECURITY;