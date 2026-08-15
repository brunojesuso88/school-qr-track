CREATE TABLE public.grade_import_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  file_name text,
  status text NOT NULL DEFAULT 'queued',
  total_pages integer NOT NULL DEFAULT 0,
  total_chunks integer NOT NULL DEFAULT 0,
  completed_chunks integer NOT NULL DEFAULT 0,
  failed_chunks integer NOT NULL DEFAULT 0,
  progress integer NOT NULL DEFAULT 0,
  current_chunk integer,
  failed_pages jsonb NOT NULL DEFAULT '[]'::jsonb,
  partials jsonb NOT NULL DEFAULT '{}'::jsonb,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  pdf_base64 text,
  result_json jsonb,
  issues_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT grade_import_jobs_status_check CHECK (status IN ('queued','processing','completed','failed','cancelled'))
);

CREATE INDEX idx_grade_import_jobs_class ON public.grade_import_jobs(class_id);
CREATE INDEX idx_grade_import_jobs_status ON public.grade_import_jobs(status);
CREATE INDEX idx_grade_import_jobs_created_by ON public.grade_import_jobs(created_by);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.grade_import_jobs TO authenticated;
GRANT ALL ON public.grade_import_jobs TO service_role;

ALTER TABLE public.grade_import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin e direcao veem jobs de boletim"
ON public.grade_import_jobs FOR SELECT TO authenticated
USING (public.user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role]));

CREATE POLICY "Admin e direcao criam jobs de boletim"
ON public.grade_import_jobs FOR INSERT TO authenticated
WITH CHECK (public.user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role]) AND created_by = auth.uid());

CREATE POLICY "Admin e direcao atualizam jobs de boletim"
ON public.grade_import_jobs FOR UPDATE TO authenticated
USING (public.user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role]));

CREATE POLICY "Admin e direcao excluem jobs de boletim"
ON public.grade_import_jobs FOR DELETE TO authenticated
USING (public.user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role]));

CREATE TRIGGER trg_grade_import_jobs_updated_at
BEFORE UPDATE ON public.grade_import_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();