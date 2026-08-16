CREATE OR REPLACE FUNCTION public.normalize_subject_key(_name text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT trim(regexp_replace(
    lower(translate(coalesce(_name,''),
      'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
      'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc')),
    '[^a-z0-9]+', ' ', 'g'))
$$;

CREATE TABLE IF NOT EXISTS public.curriculum_matrix_subjects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id uuid NOT NULL REFERENCES public.mapping_global_subjects(id) ON DELETE CASCADE,
  series text NOT NULL CHECK (series IN ('1','2','3')),
  weekly_classes integer NOT NULL CHECK (weekly_classes > 0),
  include_in_ira boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_id, series)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.curriculum_matrix_subjects TO authenticated;
GRANT ALL ON public.curriculum_matrix_subjects TO service_role;

ALTER TABLE public.curriculum_matrix_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read curriculum matrix" ON public.curriculum_matrix_subjects;
CREATE POLICY "Authenticated can read curriculum matrix"
ON public.curriculum_matrix_subjects FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin and direction manage curriculum matrix" ON public.curriculum_matrix_subjects;
CREATE POLICY "Admin and direction manage curriculum matrix"
ON public.curriculum_matrix_subjects FOR ALL TO authenticated
USING (public.user_has_any_role(ARRAY['admin','direction']::app_role[]))
WITH CHECK (public.user_has_any_role(ARRAY['admin','direction']::app_role[]));

DROP TRIGGER IF EXISTS trg_curriculum_matrix_subjects_updated_at ON public.curriculum_matrix_subjects;
CREATE TRIGGER trg_curriculum_matrix_subjects_updated_at
BEFORE UPDATE ON public.curriculum_matrix_subjects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $seed$
DECLARE
  rec record;
  sid uuid;
  series_list text[];
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      ('ARTE','ART', ARRAY['ARTES']::text[], 2::int, 1::int, 1::int),
      ('BIOLOGIA','BIO', ARRAY[]::text[], 2, 2, 2),
      ('EDUCACAO DIGITAL','ED', ARRAY['EDUCAÇÃO DIGITAL']::text[], 1, 1, 1),
      ('EDUCACAO FISICA','EF', ARRAY['EDUCAÇÃO FÍSICA','ED FISICA']::text[], 2, 1, 1),
      ('FILOSOFIA','FIL', ARRAY[]::text[], 1, 2, 1),
      ('FISICA','FIS', ARRAY['FÍSICA']::text[], 2, 2, 2),
      ('GEOGRAFIA','GEO', ARRAY[]::text[], 2, 2, 2),
      ('HISTORIA','HIS', ARRAY['HISTÓRIA']::text[], 2, 2, 2),
      ('IDENTIDADE E PROTAGONISMO','IP', ARRAY[]::text[], 1, 1, 1),
      ('LETRAMENTO EM LINGUA PORTUGUESA','Let. LP', ARRAY['LETRAMENTO EM LÍNGUA PORTUGUESA','LETRAMENTO LINGUA PORTUGUESA']::text[], 1, NULL, NULL),
      ('LETRAMENTO EM MATEMATICA','Let. Mat', ARRAY['LETRAMENTO EM MATEMÁTICA','LETRAMENTO MATEMATICA']::text[], 1, NULL, NULL),
      ('LINGUA INGLESA','ING', ARRAY['LÍNGUA INGLESA','INGLES','INGLÊS']::text[], 1, 1, 2),
      ('LINGUA PORTUGUESA','LP', ARRAY['LÍNGUA PORTUGUESA','PORTUGUES','PORTUGUÊS']::text[], 4, 4, 4),
      ('MATEMATICA','MAT', ARRAY['MATEMÁTICA']::text[], 4, 4, 4),
      ('QUIMICA','QUI', ARRAY['QUÍMICA']::text[], 2, 2, 2),
      ('SOCIOLOGIA','SOC', ARRAY[]::text[], 1, 1, 1),
      ('APROFUNDAMENTO IF - I','AP I', ARRAY[
        'APROFUNDAMENTO IF - CHL - I','APROFUNDAMENTO IF - CNS - I','APROFUNDAMENTO IF - ETT - I',
        'APROFUNDAMENTO IF CHL I','APROFUNDAMENTO IF CNS I','APROFUNDAMENTO IF ETT I']::text[], NULL, 2, 2),
      ('APROFUNDAMENTO IF - II','AP II', ARRAY[
        'APROFUNDAMENTO IF - CHL - II','APROFUNDAMENTO IF - CNS - II','APROFUNDAMENTO IF - ETT - II',
        'APROFUNDAMENTO IF CHL II','APROFUNDAMENTO IF CNS II','APROFUNDAMENTO IF ETT II']::text[], NULL, 2, 2)
    ) AS t(name, abbr, aliases, s1, s2, s3)
  LOOP
    series_list := ARRAY[]::text[];
    IF rec.s1 IS NOT NULL THEN series_list := series_list || '1'::text; END IF;
    IF rec.s2 IS NOT NULL THEN series_list := series_list || '2'::text; END IF;
    IF rec.s3 IS NOT NULL THEN series_list := series_list || '3'::text; END IF;

    SELECT id INTO sid FROM public.mapping_global_subjects
     WHERE public.normalize_subject_key(name) = public.normalize_subject_key(rec.name)
     LIMIT 1;

    IF sid IS NULL THEN
      INSERT INTO public.mapping_global_subjects (name, abbreviation, aliases, series, default_weekly_classes)
      VALUES (rec.name, rec.abbr, rec.aliases, series_list,
              COALESCE(rec.s1, rec.s2, rec.s3))
      RETURNING id INTO sid;
    ELSE
      UPDATE public.mapping_global_subjects g
         SET name = rec.name,
             abbreviation = COALESCE(g.abbreviation, rec.abbr),
             aliases = COALESCE((SELECT array_agg(DISTINCT a) FROM unnest(g.aliases || rec.aliases) a WHERE a <> ''), ARRAY[]::text[]),
             series = COALESCE((SELECT array_agg(DISTINCT s ORDER BY s) FROM unnest(g.series || series_list) s), ARRAY[]::text[]),
             default_weekly_classes = COALESCE(rec.s1, rec.s2, rec.s3, g.default_weekly_classes)
       WHERE g.id = sid;
    END IF;

    IF rec.s1 IS NOT NULL THEN
      INSERT INTO public.curriculum_matrix_subjects (subject_id, series, weekly_classes, include_in_ira)
      VALUES (sid, '1', rec.s1, true)
      ON CONFLICT (subject_id, series) DO UPDATE SET weekly_classes = EXCLUDED.weekly_classes, updated_at = now();
    END IF;
    IF rec.s2 IS NOT NULL THEN
      INSERT INTO public.curriculum_matrix_subjects (subject_id, series, weekly_classes, include_in_ira)
      VALUES (sid, '2', rec.s2, true)
      ON CONFLICT (subject_id, series) DO UPDATE SET weekly_classes = EXCLUDED.weekly_classes, updated_at = now();
    END IF;
    IF rec.s3 IS NOT NULL THEN
      INSERT INTO public.curriculum_matrix_subjects (subject_id, series, weekly_classes, include_in_ira)
      VALUES (sid, '3', rec.s3, true)
      ON CONFLICT (subject_id, series) DO UPDATE SET weekly_classes = EXCLUDED.weekly_classes, updated_at = now();
    END IF;
  END LOOP;
END
$seed$;