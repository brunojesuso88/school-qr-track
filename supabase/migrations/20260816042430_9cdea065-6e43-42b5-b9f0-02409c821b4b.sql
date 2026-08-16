ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS series text;

ALTER TABLE public.classes
  DROP CONSTRAINT IF EXISTS classes_series_check;

ALTER TABLE public.classes
  ADD CONSTRAINT classes_series_check CHECK (series IS NULL OR series IN ('1','2','3'));

CREATE OR REPLACE FUNCTION public.restrict_class_series_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.series IS DISTINCT FROM OLD.series
     AND NOT public.user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role]) THEN
    RAISE EXCEPTION 'Apenas administração e direção podem alterar a série da turma';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_class_series_updates ON public.classes;
CREATE TRIGGER trg_restrict_class_series_updates
  BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.restrict_class_series_updates();