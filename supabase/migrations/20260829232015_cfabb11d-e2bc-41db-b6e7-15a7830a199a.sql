ALTER TABLE public.occurrences
  ADD COLUMN IF NOT EXISTS council_items text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.occurrences
  ADD CONSTRAINT occurrences_council_items_scope
  CHECK (type = 'class_council' OR cardinality(council_items) = 0);

DROP TRIGGER IF EXISTS update_occurrences_updated_at ON public.occurrences;
CREATE TRIGGER update_occurrences_updated_at
  BEFORE UPDATE ON public.occurrences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();