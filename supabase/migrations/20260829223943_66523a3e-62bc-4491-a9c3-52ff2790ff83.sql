CREATE TABLE public.ira_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  class_name text,
  series text,
  eligible boolean NOT NULL DEFAULT true,
  ira_value numeric,
  ira_status text NOT NULL DEFAULT 'unavailable',
  ira_reason text,
  medals jsonb NOT NULL DEFAULT '[]'::jsonb,
  computed_at timestamp with time zone NOT NULL DEFAULT now(),
  computed_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ira_snapshots_student_unique UNIQUE (student_id)
);

CREATE INDEX ira_snapshots_class_idx ON public.ira_snapshots(class_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ira_snapshots TO authenticated;
GRANT ALL ON public.ira_snapshots TO service_role;

ALTER TABLE public.ira_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe escolar pode consultar o IRA persistido"
ON public.ira_snapshots FOR SELECT TO authenticated
USING (public.user_has_any_role(ARRAY['admin','direction','teacher','staff']::app_role[]));

CREATE POLICY "Gestao pode gravar o IRA persistido"
ON public.ira_snapshots FOR INSERT TO authenticated
WITH CHECK (public.user_has_any_role(ARRAY['admin','direction']::app_role[]));

CREATE POLICY "Gestao pode atualizar o IRA persistido"
ON public.ira_snapshots FOR UPDATE TO authenticated
USING (public.user_has_any_role(ARRAY['admin','direction']::app_role[]))
WITH CHECK (public.user_has_any_role(ARRAY['admin','direction']::app_role[]));

CREATE POLICY "Gestao pode limpar o IRA persistido"
ON public.ira_snapshots FOR DELETE TO authenticated
USING (public.user_has_any_role(ARRAY['admin','direction']::app_role[]));

CREATE TRIGGER trg_ira_snapshots_updated_at
BEFORE UPDATE ON public.ira_snapshots
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ira_staleness (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  stale boolean NOT NULL DEFAULT true,
  reason text,
  marked_at timestamp with time zone NOT NULL DEFAULT now(),
  last_computed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ira_staleness_class_unique UNIQUE (class_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ira_staleness TO authenticated;
GRANT ALL ON public.ira_staleness TO service_role;

ALTER TABLE public.ira_staleness ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe escolar pode consultar o estado do IRA"
ON public.ira_staleness FOR SELECT TO authenticated
USING (public.user_has_any_role(ARRAY['admin','direction','teacher','staff']::app_role[]));

CREATE POLICY "Equipe pedagogica pode marcar o IRA como desatualizado"
ON public.ira_staleness FOR INSERT TO authenticated
WITH CHECK (public.user_has_any_role(ARRAY['admin','direction','teacher']::app_role[]));

CREATE POLICY "Equipe pedagogica pode atualizar o estado do IRA"
ON public.ira_staleness FOR UPDATE TO authenticated
USING (public.user_has_any_role(ARRAY['admin','direction','teacher']::app_role[]))
WITH CHECK (public.user_has_any_role(ARRAY['admin','direction','teacher']::app_role[]));

CREATE POLICY "Gestao pode remover o estado do IRA"
ON public.ira_staleness FOR DELETE TO authenticated
USING (public.user_has_any_role(ARRAY['admin','direction']::app_role[]));

CREATE TRIGGER trg_ira_staleness_updated_at
BEFORE UPDATE ON public.ira_staleness
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();