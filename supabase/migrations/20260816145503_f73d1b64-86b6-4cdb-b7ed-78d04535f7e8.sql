ALTER TABLE public.grade_import_sessions
  ADD COLUMN IF NOT EXISTS auto_accept_rules jsonb NOT NULL DEFAULT '{"use_pdf_registry": false, "accept_unique_fuzzy": false}'::jsonb;