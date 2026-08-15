CREATE TABLE public.grade_import_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  file_name text,
  total_pages integer NOT NULL DEFAULT 0,
  current_page integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'processing_page',
  confirmed_pages integer NOT NULL DEFAULT 0,
  ignored_pages integer NOT NULL DEFAULT 0,
  notes_imported integer NOT NULL DEFAULT 0,
  current_preview jsonb,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  pdf_base64 text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.grade_import_sessions TO authenticated;
GRANT ALL ON public.grade_import_sessions TO service_role;
ALTER TABLE public.grade_import_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin e direcao veem sessoes de boletim" ON public.grade_import_sessions
  FOR SELECT TO authenticated USING (user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role]));
CREATE POLICY "Admin e direcao criam sessoes de boletim" ON public.grade_import_sessions
  FOR INSERT TO authenticated WITH CHECK (user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role]) AND created_by = auth.uid());
CREATE POLICY "Admin e direcao atualizam sessoes de boletim" ON public.grade_import_sessions
  FOR UPDATE TO authenticated USING (user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role]));
CREATE POLICY "Admin e direcao excluem sessoes de boletim" ON public.grade_import_sessions
  FOR DELETE TO authenticated USING (user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role]));

CREATE TRIGGER trg_grade_import_sessions_updated_at
  BEFORE UPDATE ON public.grade_import_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.grade_import_session_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.grade_import_sessions(id) ON DELETE CASCADE,
  page_number integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  preview_json jsonb,
  error text,
  confirmed_by uuid,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, page_number)
);

CREATE INDEX idx_grade_import_session_pages_session ON public.grade_import_session_pages(session_id, page_number);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.grade_import_session_pages TO authenticated;
GRANT ALL ON public.grade_import_session_pages TO service_role;
ALTER TABLE public.grade_import_session_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin e direcao veem paginas de sessao" ON public.grade_import_session_pages
  FOR SELECT TO authenticated USING (user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role]));
CREATE POLICY "Admin e direcao criam paginas de sessao" ON public.grade_import_session_pages
  FOR INSERT TO authenticated WITH CHECK (user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role]));
CREATE POLICY "Admin e direcao atualizam paginas de sessao" ON public.grade_import_session_pages
  FOR UPDATE TO authenticated USING (user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role]));
CREATE POLICY "Admin e direcao excluem paginas de sessao" ON public.grade_import_session_pages
  FOR DELETE TO authenticated USING (user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role]));

CREATE TRIGGER trg_grade_import_session_pages_updated_at
  BEFORE UPDATE ON public.grade_import_session_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();