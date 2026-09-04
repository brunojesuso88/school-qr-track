-- 1) Constraints: passam a aceitar as etapas EJA sem enfraquecer a validação
ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_series_check;
ALTER TABLE public.classes ADD CONSTRAINT classes_series_check
  CHECK (series IS NULL OR series = ANY (ARRAY['1','2','3','eja1','eja2']::text[]));

ALTER TABLE public.curriculum_matrix_subjects DROP CONSTRAINT IF EXISTS curriculum_matrix_subjects_series_check;
ALTER TABLE public.curriculum_matrix_subjects ADD CONSTRAINT curriculum_matrix_subjects_series_check
  CHECK (series = ANY (ARRAY['1','2','3','eja1','eja2']::text[]));

ALTER TABLE public.mapping_global_subjects DROP CONSTRAINT IF EXISTS mapping_global_subjects_series_valid;
ALTER TABLE public.mapping_global_subjects ADD CONSTRAINT mapping_global_subjects_series_valid
  CHECK (series <@ ARRAY['1','2','3','eja1','eja2']::text[]);

-- 2) Seed da Matriz Original com as 5 séries/etapas (idempotente)
CREATE OR REPLACE FUNCTION public.seed_school_curriculum(_school_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_matrix uuid;
  v_subject uuid;
  v_series text[];
  r record;
BEGIN
  IF _school_id IS NULL THEN RAISE EXCEPTION 'Escola obrigatoria'; END IF;

  SELECT id INTO v_matrix FROM public.curriculum_matrices
   WHERE school_id = _school_id AND is_original LIMIT 1;
  IF v_matrix IS NULL THEN
    INSERT INTO public.curriculum_matrices (school_id, name, description, is_original)
    VALUES (_school_id, 'Matriz Original',
            'Matriz curricular original do Ensino Médio e do EJA (EDUNEXUS).', true)
    RETURNING id INTO v_matrix;
  END IF;

  FOR r IN
    SELECT * FROM (VALUES
      ('ARTE','ART', ARRAY['ARTES']::text[], 2, 1, 1, 1, 1),
      ('BIOLOGIA','BIO', ARRAY[]::text[], 2, 2, 2, 2, 2),
      ('EDUCACAO DIGITAL','ED', ARRAY['EDUCAÇÃO DIGITAL']::text[], 1, 1, 1, NULL, 1),
      ('EDUCACAO FISICA','EF', ARRAY['EDUCAÇÃO FÍSICA','ED FISICA']::text[], 1, 1, 1, NULL, NULL),
      ('FILOSOFIA','FIL', ARRAY[]::text[], 1, 2, 1, 1, 1),
      ('FISICA','FIS', ARRAY['FÍSICA']::text[], 2, 2, 2, 2, 2),
      ('GEOGRAFIA','GEO', ARRAY[]::text[], 2, 2, 2, 2, 2),
      ('HISTORIA','HIS', ARRAY['HISTÓRIA']::text[], 2, 2, 2, 2, 2),
      ('IDENTIDADE E PROTAGONISMO','IP', ARRAY[]::text[], 1, 1, 1, 1, NULL),
      ('LETRAMENTO EM LINGUA PORTUGUESA','Let. LP',
        ARRAY['LETRAMENTO EM LÍNGUA PORTUGUESA','LETRAMENTO LINGUA PORTUGUESA']::text[], 1, NULL, NULL, 1, NULL),
      ('LETRAMENTO EM MATEMATICA','Let. Mat',
        ARRAY['LETRAMENTO EM MATEMÁTICA','LETRAMENTO MATEMATICA']::text[], 1, NULL, NULL, 1, NULL),
      ('LINGUA INGLESA','ING', ARRAY['LÍNGUA INGLESA','INGLES','INGLÊS']::text[], 1, 1, 2, 1, 1),
      ('LINGUA PORTUGUESA','LP', ARRAY['LÍNGUA PORTUGUESA','PORTUGUES','PORTUGUÊS']::text[], 4, 4, 4, 4, 4),
      ('MATEMATICA','MAT', ARRAY['MATEMÁTICA']::text[], 4, 4, 4, 4, 4),
      ('QUIMICA','QUI', ARRAY['QUÍMICA']::text[], 2, 2, 2, 2, 2),
      ('SOCIOLOGIA','SOC', ARRAY[]::text[], 1, 1, 1, 1, 1),
      ('APROFUNDAMENTO IF - I','AP I',
        ARRAY['APROFUNDAMENTO IF - CHL - I','APROFUNDAMENTO IF - CNS - I','APROFUNDAMENTO IF - ETT - I',
              'APROFUNDAMENTO IF - SEA - I',
              'APROFUNDAMENTO IF - CHL I','APROFUNDAMENTO IF - CNS I','APROFUNDAMENTO IF - ETT I',
              'APROFUNDAMENTO IF - SEA I']::text[],
        NULL, 2, 2, NULL, 2),
      ('APROFUNDAMENTO IF - II','AP II',
        ARRAY['APROFUNDAMENTO IF - CHL - II','APROFUNDAMENTO IF - CNS - II','APROFUNDAMENTO IF - ETT - II',
              'APROFUNDAMENTO IF - SEA - II',
              'APROFUNDAMENTO IF - CHL II','APROFUNDAMENTO IF - CNS II','APROFUNDAMENTO IF - ETT II',
              'APROFUNDAMENTO IF - SEA II']::text[],
        NULL, 2, 2, NULL, NULL)
    ) AS t(name, abbr, aliases, w1, w2, w3, we1, we2)
  LOOP
    v_series := ARRAY(
      SELECT x.s FROM (VALUES ('1', r.w1), ('2', r.w2), ('3', r.w3),
                              ('eja1', r.we1), ('eja2', r.we2)) AS x(s, w)
       WHERE x.w IS NOT NULL ORDER BY x.s
    );

    SELECT id INTO v_subject FROM public.mapping_global_subjects
     WHERE school_id = _school_id AND upper(btrim(name)) = upper(r.name) LIMIT 1;

    IF v_subject IS NULL THEN
      INSERT INTO public.mapping_global_subjects
        (school_id, name, abbreviation, aliases, series, default_weekly_classes, shift)
      VALUES (_school_id, r.name, r.abbr, r.aliases, v_series,
              coalesce(r.w1, r.w2, r.w3, r.we1, r.we2, 1), 'morning')
      RETURNING id INTO v_subject;
    ELSE
      UPDATE public.mapping_global_subjects s
         SET abbreviation = coalesce(s.abbreviation, r.abbr),
             aliases = ARRAY(SELECT DISTINCT a FROM (
                          SELECT unnest(coalesce(s.aliases, '{}'::text[])) AS a
                          UNION SELECT unnest(r.aliases)
                        ) u WHERE a IS NOT NULL AND btrim(a) <> ''),
             series = ARRAY(SELECT DISTINCT x FROM (
                          SELECT unnest(coalesce(s.series, '{}'::text[])) AS x
                          UNION SELECT unnest(v_series)
                        ) v ORDER BY x)
       WHERE s.id = v_subject;
    END IF;

    INSERT INTO public.curriculum_matrix_subjects
      (school_id, matrix_id, subject_id, series, weekly_classes, include_in_ira)
    SELECT _school_id, v_matrix, v_subject, x.s, x.w, true
      FROM (VALUES ('1', r.w1), ('2', r.w2), ('3', r.w3),
                   ('eja1', r.we1), ('eja2', r.we2)) AS x(s, w)
     WHERE x.w IS NOT NULL
    ON CONFLICT (matrix_id, subject_id, series) DO NOTHING;
  END LOOP;

  UPDATE public.classes
     SET curriculum_matrix_id = v_matrix
   WHERE school_id = _school_id AND curriculum_matrix_id IS NULL;

  RETURN v_matrix;
END
$function$;

-- 3) Backfill idempotente das escolas existentes (por school_id)
DO $$
DECLARE s record;
BEGIN
  FOR s IN SELECT id FROM public.schools LOOP
    PERFORM public.seed_school_curriculum(s.id);
    PERFORM public.ensure_aprofundamento_axis_aliases(s.id);
  END LOOP;
END $$;