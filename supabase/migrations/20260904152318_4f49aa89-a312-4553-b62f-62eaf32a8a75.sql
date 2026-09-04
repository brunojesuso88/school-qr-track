-- 1) Matrizes curriculares nomeadas por escola
CREATE TABLE public.curriculum_matrices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_original boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT curriculum_matrices_name_not_blank CHECK (btrim(name) <> '')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.curriculum_matrices TO authenticated;
GRANT ALL ON public.curriculum_matrices TO service_role;

ALTER TABLE public.curriculum_matrices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros da escola leem matrizes"
  ON public.curriculum_matrices FOR SELECT TO authenticated
  USING (public.can_access_school(school_id));

CREATE POLICY "Equipe com permissao cria matrizes"
  ON public.curriculum_matrices FOR INSERT TO authenticated
  WITH CHECK (public.has_school_permission(school_id, 'subjects.manage'));

CREATE POLICY "Equipe com permissao edita matrizes"
  ON public.curriculum_matrices FOR UPDATE TO authenticated
  USING (public.has_school_permission(school_id, 'subjects.manage'))
  WITH CHECK (public.has_school_permission(school_id, 'subjects.manage'));

CREATE POLICY "Equipe com permissao exclui matrizes nao originais"
  ON public.curriculum_matrices FOR DELETE TO authenticated
  USING (public.has_school_permission(school_id, 'subjects.manage') AND is_original = false);

CREATE UNIQUE INDEX curriculum_matrices_school_name_unique
  ON public.curriculum_matrices (school_id, lower(btrim(name)));
CREATE UNIQUE INDEX curriculum_matrices_one_original
  ON public.curriculum_matrices (school_id) WHERE is_original;
CREATE INDEX curriculum_matrices_school_id_idx ON public.curriculum_matrices (school_id);

CREATE TRIGGER trg_curriculum_matrices_updated_at
  BEFORE UPDATE ON public.curriculum_matrices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_curriculum_matrices_school_immutable
  BEFORE UPDATE ON public.curriculum_matrices
  FOR EACH ROW EXECUTE FUNCTION public.enforce_school_id_immutable();

-- A matriz original nunca perde a marcação
CREATE OR REPLACE FUNCTION public.protect_original_matrix()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.is_original AND NEW.is_original = false THEN
    RAISE EXCEPTION 'A Matriz Original nao pode deixar de ser a matriz original da escola';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_curriculum_matrices_protect_original
  BEFORE UPDATE ON public.curriculum_matrices
  FOR EACH ROW EXECUTE FUNCTION public.protect_original_matrix();

-- 2) Componentes passam a pertencer a uma matriz
ALTER TABLE public.curriculum_matrix_subjects
  ADD COLUMN matrix_id uuid REFERENCES public.curriculum_matrices(id) ON DELETE CASCADE;

INSERT INTO public.curriculum_matrices (school_id, name, description, is_original)
SELECT s.id, 'Matriz Original', 'Matriz curricular original do Ensino Médio (EDUNEXUS).', true
  FROM public.schools s
 WHERE NOT EXISTS (
   SELECT 1 FROM public.curriculum_matrices m WHERE m.school_id = s.id AND m.is_original
 );

UPDATE public.curriculum_matrix_subjects c
   SET matrix_id = m.id
  FROM public.curriculum_matrices m
 WHERE m.school_id = c.school_id AND m.is_original AND c.matrix_id IS NULL;

ALTER TABLE public.curriculum_matrix_subjects ALTER COLUMN matrix_id SET NOT NULL;

DROP INDEX IF EXISTS public.curriculum_matrix_school_subject_series_unique;
CREATE UNIQUE INDEX curriculum_matrix_subjects_matrix_subject_series_unique
  ON public.curriculum_matrix_subjects (matrix_id, subject_id, series);
CREATE INDEX curriculum_matrix_subjects_matrix_id_idx
  ON public.curriculum_matrix_subjects (matrix_id);

CREATE TRIGGER trg_cms_matrix_same_school
  BEFORE INSERT OR UPDATE ON public.curriculum_matrix_subjects
  FOR EACH ROW EXECUTE FUNCTION public.enforce_child_school_match('curriculum_matrices', 'matrix_id');

-- 3) Turma guarda a matriz atribuída
ALTER TABLE public.classes
  ADD COLUMN curriculum_matrix_id uuid REFERENCES public.curriculum_matrices(id) ON DELETE SET NULL;

UPDATE public.classes c
   SET curriculum_matrix_id = m.id
  FROM public.curriculum_matrices m
 WHERE m.school_id = c.school_id AND m.is_original AND c.curriculum_matrix_id IS NULL;

CREATE INDEX classes_curriculum_matrix_id_idx ON public.classes (curriculum_matrix_id);

CREATE TRIGGER trg_classes_matrix_same_school
  BEFORE INSERT OR UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_child_school_match('curriculum_matrices', 'curriculum_matrix_id');

CREATE OR REPLACE FUNCTION public.default_class_curriculum_matrix()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.curriculum_matrix_id IS NULL AND NEW.school_id IS NOT NULL THEN
    SELECT id INTO NEW.curriculum_matrix_id
      FROM public.curriculum_matrices
     WHERE school_id = NEW.school_id AND is_original
     LIMIT 1;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_classes_default_matrix
  BEFORE INSERT ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.default_class_curriculum_matrix();

-- 4) Semeadura idempotente da Matriz Original
CREATE OR REPLACE FUNCTION public.seed_school_curriculum(_school_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
            'Matriz curricular original do Ensino Médio (EDUNEXUS).', true)
    RETURNING id INTO v_matrix;
  END IF;

  FOR r IN
    SELECT * FROM (VALUES
      ('ARTE','ART', ARRAY['ARTES']::text[], 2, 1, 1),
      ('BIOLOGIA','BIO', ARRAY[]::text[], 2, 2, 2),
      ('EDUCACAO DIGITAL','ED', ARRAY['EDUCAÇÃO DIGITAL']::text[], 1, 1, 1),
      ('EDUCACAO FISICA','EF', ARRAY['EDUCAÇÃO FÍSICA','ED FISICA']::text[], 1, 1, 1),
      ('FILOSOFIA','FIL', ARRAY[]::text[], 1, 2, 1),
      ('FISICA','FIS', ARRAY['FÍSICA']::text[], 2, 2, 2),
      ('GEOGRAFIA','GEO', ARRAY[]::text[], 2, 2, 2),
      ('HISTORIA','HIS', ARRAY['HISTÓRIA']::text[], 2, 2, 2),
      ('IDENTIDADE E PROTAGONISMO','IP', ARRAY[]::text[], 1, 1, 1),
      ('LETRAMENTO EM LINGUA PORTUGUESA','Let. LP',
        ARRAY['LETRAMENTO EM LÍNGUA PORTUGUESA','LETRAMENTO LINGUA PORTUGUESA']::text[], 1, NULL, NULL),
      ('LETRAMENTO EM MATEMATICA','Let. Mat',
        ARRAY['LETRAMENTO EM MATEMÁTICA','LETRAMENTO MATEMATICA']::text[], 1, NULL, NULL),
      ('LINGUA INGLESA','ING', ARRAY['LÍNGUA INGLESA','INGLES','INGLÊS']::text[], 1, 1, 2),
      ('LINGUA PORTUGUESA','LP', ARRAY['LÍNGUA PORTUGUESA','PORTUGUES','PORTUGUÊS']::text[], 4, 4, 4),
      ('MATEMATICA','MAT', ARRAY['MATEMÁTICA']::text[], 4, 4, 4),
      ('QUIMICA','QUI', ARRAY['QUÍMICA']::text[], 2, 2, 2),
      ('SOCIOLOGIA','SOC', ARRAY[]::text[], 1, 1, 1),
      ('APROFUNDAMENTO IF - I','AP I',
        ARRAY['APROFUNDAMENTO IF - CHL - I','APROFUNDAMENTO IF - CNS - I','APROFUNDAMENTO IF - ETT - I',
              'APROFUNDAMENTO IF - CHL I','APROFUNDAMENTO IF - CNS I','APROFUNDAMENTO IF - ETT I']::text[],
        NULL, 2, 2),
      ('APROFUNDAMENTO IF - II','AP II',
        ARRAY['APROFUNDAMENTO IF - CHL - II','APROFUNDAMENTO IF - CNS - II','APROFUNDAMENTO IF - ETT - II',
              'APROFUNDAMENTO IF - CHL II','APROFUNDAMENTO IF - CNS II','APROFUNDAMENTO IF - ETT II']::text[],
        NULL, 2, 2)
    ) AS t(name, abbr, aliases, w1, w2, w3)
  LOOP
    v_series := ARRAY(
      SELECT x.s FROM (VALUES ('1', r.w1), ('2', r.w2), ('3', r.w3)) AS x(s, w)
       WHERE x.w IS NOT NULL ORDER BY x.s
    );

    SELECT id INTO v_subject FROM public.mapping_global_subjects
     WHERE school_id = _school_id AND upper(btrim(name)) = upper(r.name) LIMIT 1;

    IF v_subject IS NULL THEN
      INSERT INTO public.mapping_global_subjects
        (school_id, name, abbreviation, aliases, series, default_weekly_classes, shift)
      VALUES (_school_id, r.name, r.abbr, r.aliases, v_series,
              coalesce(r.w1, r.w2, r.w3, 1), 'morning')
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
      FROM (VALUES ('1', r.w1), ('2', r.w2), ('3', r.w3)) AS x(s, w)
     WHERE x.w IS NOT NULL
    ON CONFLICT (matrix_id, subject_id, series) DO NOTHING;
  END LOOP;

  UPDATE public.classes
     SET curriculum_matrix_id = v_matrix
   WHERE school_id = _school_id AND curriculum_matrix_id IS NULL;

  RETURN v_matrix;
END $$;

REVOKE ALL ON FUNCTION public.seed_school_curriculum(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_school_curriculum(uuid) TO service_role;

-- Toda escola nova nasce com a matriz original
CREATE OR REPLACE FUNCTION public.seed_school_curriculum_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.seed_school_curriculum(NEW.id);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_schools_seed_curriculum
  AFTER INSERT ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.seed_school_curriculum_trigger();

-- Reparo idempotente de todas as escolas
CREATE OR REPLACE FUNCTION public.repair_school_curricula()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; v_count int := 0; v_created int := 0; v_before int;
BEGIN
  IF NOT public.is_global_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  FOR s IN SELECT id FROM public.schools LOOP
    SELECT count(*) INTO v_before FROM public.curriculum_matrix_subjects WHERE school_id = s.id;
    PERFORM public.seed_school_curriculum(s.id);
    v_count := v_count + 1;
    v_created := v_created + GREATEST(
      (SELECT count(*) FROM public.curriculum_matrix_subjects WHERE school_id = s.id) - v_before, 0);
  END LOOP;
  RETURN jsonb_build_object('schools', v_count, 'components_created', v_created);
END $$;

GRANT EXECUTE ON FUNCTION public.repair_school_curricula() TO authenticated;

-- 5) Troca segura da matriz da turma, com auditoria
CREATE OR REPLACE FUNCTION public.set_class_curriculum_matrix(_class_id uuid, _matrix_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school uuid; v_old uuid; v_matrix_school uuid;
BEGIN
  SELECT school_id, curriculum_matrix_id INTO v_school, v_old
    FROM public.classes WHERE id = _class_id;
  IF v_school IS NULL THEN RAISE EXCEPTION 'Turma nao encontrada'; END IF;
  IF NOT public.has_school_permission(v_school, 'grades.manage')
     AND NOT public.has_school_permission(v_school, 'subjects.manage') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT school_id INTO v_matrix_school FROM public.curriculum_matrices WHERE id = _matrix_id;
  IF v_matrix_school IS NULL OR v_matrix_school <> v_school THEN
    RAISE EXCEPTION 'Matriz curricular invalida para esta escola';
  END IF;

  IF v_old IS DISTINCT FROM _matrix_id THEN
    UPDATE public.classes SET curriculum_matrix_id = _matrix_id WHERE id = _class_id;
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (auth.uid(), 'class_curriculum_matrix_change', 'classes', _class_id,
            jsonb_build_object('school_id', v_school, 'curriculum_matrix_id', v_old),
            jsonb_build_object('school_id', v_school, 'curriculum_matrix_id', _matrix_id));
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.set_class_curriculum_matrix(uuid, uuid) TO authenticated;

-- 6) Backfill imediato de todas as escolas existentes
DO $$
DECLARE s record;
BEGIN
  FOR s IN SELECT id FROM public.schools LOOP
    PERFORM public.seed_school_curriculum(s.id);
  END LOOP;
END $$;