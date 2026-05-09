ALTER TABLE public.school_events
  ADD COLUMN IF NOT EXISTS justificativa text DEFAULT '',
  ADD COLUMN IF NOT EXISTS objetivo_geral text DEFAULT '',
  ADD COLUMN IF NOT EXISTS objetivos_especificos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS metodologia text DEFAULT '',
  ADD COLUMN IF NOT EXISTS cronograma jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS recursos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS culminancia text DEFAULT '',
  ADD COLUMN IF NOT EXISTS avaliacao text DEFAULT '';