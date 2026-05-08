
CREATE TABLE public.school_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  enfoque text DEFAULT '',
  metas text DEFAULT '',
  pontos_atencao text DEFAULT '',
  acoes_estrategicas jsonb NOT NULL DEFAULT '[]'::jsonb,
  procedimentos jsonb NOT NULL DEFAULT '[]'::jsonb,
  responsaveis jsonb NOT NULL DEFAULT '[]'::jsonb,
  prazo_inicio date,
  prazo_fim date,
  is_continuous boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'planejado',
  tags text[] NOT NULL DEFAULT '{}',
  resumo_ia text DEFAULT '',
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  pdf_original text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.school_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view school_events"
ON public.school_events FOR SELECT TO authenticated
USING (user_has_any_role(ARRAY['admin','direction','teacher','staff']::app_role[]));

CREATE POLICY "Admin direction teachers insert school_events"
ON public.school_events FOR INSERT TO authenticated
WITH CHECK (user_has_any_role(ARRAY['admin','direction','teacher']::app_role[]));

CREATE POLICY "Admin direction teachers update school_events"
ON public.school_events FOR UPDATE TO authenticated
USING (user_has_any_role(ARRAY['admin','direction','teacher']::app_role[]));

CREATE POLICY "Admin direction teachers delete school_events"
ON public.school_events FOR DELETE TO authenticated
USING (user_has_any_role(ARRAY['admin','direction','teacher']::app_role[]));

CREATE TRIGGER trg_school_events_updated_at
BEFORE UPDATE ON public.school_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_school_events_created_at ON public.school_events (created_at DESC);
CREATE INDEX idx_school_events_status ON public.school_events (status);

INSERT INTO storage.buckets (id, name, public) VALUES ('school-events', 'school-events', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Staff view school-events files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'school-events' AND user_has_any_role(ARRAY['admin','direction','teacher','staff']::app_role[]));

CREATE POLICY "Staff insert school-events files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'school-events' AND user_has_any_role(ARRAY['admin','direction','teacher']::app_role[]));

CREATE POLICY "Staff update school-events files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'school-events' AND user_has_any_role(ARRAY['admin','direction','teacher']::app_role[]));

CREATE POLICY "Staff delete school-events files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'school-events' AND user_has_any_role(ARRAY['admin','direction','teacher']::app_role[]));
