ALTER TABLE public.ira_settings
  ADD COLUMN IF NOT EXISTS ira_period_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

UPDATE public.ira_settings
   SET ira_period_ids = ARRAY[ira_period_id]
 WHERE ira_period_id IS NOT NULL
   AND (ira_period_ids IS NULL OR cardinality(ira_period_ids) = 0);