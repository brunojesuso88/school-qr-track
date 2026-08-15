ALTER TABLE public.grade_import_sessions
  ADD COLUMN IF NOT EXISTS auto_accept boolean NOT NULL DEFAULT false;

ALTER TABLE public.grade_import_session_pages
  ADD COLUMN IF NOT EXISTS confirmation_mode text;