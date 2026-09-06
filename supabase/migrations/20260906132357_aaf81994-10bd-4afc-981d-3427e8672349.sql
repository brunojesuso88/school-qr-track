-- =====================================================================
-- A) MATRIZ CURRICULAR OBRIGATÓRIA POR ESCOLA
-- =====================================================================
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS curriculum_matrix_id uuid REFERENCES public.curriculum_matrices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS curriculum_matrix_pending boolean NOT NULL DEFAULT false;

-- Backfill: matriz efetivamente vigente = a mais usada pelas turmas; empate/nenhuma => Matriz Original.
WITH ranked AS (
  SELECT m.school_id, m.id,
         ROW_NUMBER() OVER (
           PARTITION BY m.school_id
           ORDER BY (SELECT count(*) FROM public.classes c WHERE c.curriculum_matrix_id = m.id) DESC,
                    m.is_original DESC, m.created_at
         ) AS rn
    FROM public.curriculum_matrices m
)
UPDATE public.schools s
   SET curriculum_matrix_id = r.id
  FROM ranked r
 WHERE r.school_id = s.id AND r.rn = 1 AND s.curriculum_matrix_id IS NULL;

-- Escola sem nenhuma matriz => marcada para escolha administrativa (não adivinhamos).
UPDATE public.schools SET curriculum_matrix_pending = true WHERE curriculum_matrix_id IS NULL;

CREATE OR REPLACE FUNCTION public.enforce_school_matrix_match()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.curriculum_matrix_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.curriculum_matrices m
     WHERE m.id = NEW.curriculum_matrix_id AND m.school_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'A matriz curricular selecionada nao pertence a esta escola';
  END IF;
  IF NEW.curriculum_matrix_id IS NOT NULL THEN NEW.curriculum_matrix_pending := false; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_schools_matrix_match ON public.schools;
CREATE TRIGGER trg_schools_matrix_match
BEFORE INSERT OR UPDATE OF curriculum_matrix_id ON public.schools
FOR EACH ROW EXECUTE FUNCTION public.enforce_school_matrix_match();

-- Turma nova nasce com a matriz da ESCOLA (fallback: Matriz Original).
CREATE OR REPLACE FUNCTION public.default_class_curriculum_matrix()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.curriculum_matrix_id IS NULL AND NEW.school_id IS NOT NULL THEN
    SELECT s.curriculum_matrix_id INTO NEW.curriculum_matrix_id
      FROM public.schools s WHERE s.id = NEW.school_id;
    IF NEW.curriculum_matrix_id IS NULL THEN
      SELECT id INTO NEW.curriculum_matrix_id FROM public.curriculum_matrices
       WHERE school_id = NEW.school_id AND is_original LIMIT 1;
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- A matriz vinculada à escola não pode ser excluída.
CREATE OR REPLACE FUNCTION public.block_delete_matrix_in_use()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_classes int;
BEGIN
  IF OLD.is_original THEN
    RAISE EXCEPTION 'A Matriz Original da escola nao pode ser excluida';
  END IF;
  IF OLD.system_key IS NOT NULL THEN
    RAISE EXCEPTION 'A % e uma matriz padrao do sistema e nao pode ser excluida', OLD.name;
  END IF;
  IF EXISTS (SELECT 1 FROM public.schools s WHERE s.curriculum_matrix_id = OLD.id) THEN
    RAISE EXCEPTION 'Esta e a matriz curricular oficial da escola e nao pode ser excluida';
  END IF;
  SELECT count(*) INTO v_classes FROM public.classes WHERE curriculum_matrix_id = OLD.id;
  IF v_classes > 0 THEN
    RAISE EXCEPTION 'Esta matriz curricular esta vinculada a % turma(s).', v_classes;
  END IF;
  RETURN OLD;
END $$;

-- =====================================================================
-- B) CLASSIFICAÇÃO UNIVERSAL + PESO EXPLÍCITO DO IRA
-- =====================================================================
CREATE OR REPLACE FUNCTION public.default_component_classification(_name text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN public.normalize_subject_key(_name) ~
      '(aprofundamento|projeto de vida|itinerar|eletiva|trilha|tecnic|profission|mundo do trabalho|estudo orientado|educacao digital|identidade e protagonismo|pratica|nucleo|empreendedor|robotica|informatica)'
      THEN 'itinerario'
    WHEN public.normalize_subject_key(_name) ~
      '(lingua portuguesa|portugues|redacao|literatura|matematica|fisica|quimica|biologia|historia|geografia|filosofia|sociologia|arte|educacao fisica|lingua inglesa|ingles|espanhol|ciencias da natureza|ciencias humanas|linguagens)'
      THEN 'fgb'
    ELSE 'itinerario'
  END
$$;

CREATE OR REPLACE FUNCTION public.default_component_ira_weight(_classification text, _name text)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _classification <> 'fgb' THEN 1
    WHEN public.normalize_subject_key(_name) ~ '(lingua portuguesa|^portugues|matematica)' THEN 4
    ELSE 2
  END
$$;

ALTER TABLE public.curriculum_matrix_subjects
  ADD COLUMN IF NOT EXISTS classification text,
  ADD COLUMN IF NOT EXISTS ira_weight numeric;

UPDATE public.curriculum_matrix_subjects c
   SET classification = public.default_component_classification(s.name)
  FROM public.mapping_global_subjects s
 WHERE s.id = c.subject_id AND c.classification IS NULL;

UPDATE public.curriculum_matrix_subjects c
   SET ira_weight = public.default_component_ira_weight(c.classification, s.name)
  FROM public.mapping_global_subjects s
 WHERE s.id = c.subject_id AND c.ira_weight IS NULL;

CREATE OR REPLACE FUNCTION public.curriculum_component_defaults()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text;
BEGIN
  IF NEW.classification IS NULL OR NEW.ira_weight IS NULL THEN
    SELECT name INTO v_name FROM public.mapping_global_subjects WHERE id = NEW.subject_id;
    IF NEW.classification IS NULL THEN
      NEW.classification := public.default_component_classification(coalesce(v_name, ''));
    END IF;
    IF NEW.ira_weight IS NULL THEN
      NEW.ira_weight := public.default_component_ira_weight(NEW.classification, coalesce(v_name, ''));
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cms_component_defaults ON public.curriculum_matrix_subjects;
CREATE TRIGGER trg_cms_component_defaults
BEFORE INSERT OR UPDATE ON public.curriculum_matrix_subjects
FOR EACH ROW EXECUTE FUNCTION public.curriculum_component_defaults();

ALTER TABLE public.curriculum_matrix_subjects
  ALTER COLUMN classification SET NOT NULL,
  ALTER COLUMN ira_weight SET NOT NULL;

ALTER TABLE public.curriculum_matrix_subjects
  DROP CONSTRAINT IF EXISTS cms_classification_chk,
  DROP CONSTRAINT IF EXISTS cms_ira_weight_chk;
ALTER TABLE public.curriculum_matrix_subjects
  ADD CONSTRAINT cms_classification_chk CHECK (classification IN ('fgb', 'itinerario')),
  ADD CONSTRAINT cms_ira_weight_chk CHECK (ira_weight > 0);

-- Disciplinas das TURMAS: classificação, peso e vínculo canônico com o componente da matriz.
ALTER TABLE public.grade_subjects
  ADD COLUMN IF NOT EXISTS classification text,
  ADD COLUMN IF NOT EXISTS ira_weight numeric,
  ADD COLUMN IF NOT EXISTS curriculum_matrix_subject_id uuid
    REFERENCES public.curriculum_matrix_subjects(id) ON DELETE SET NULL;

ALTER TABLE public.grade_subjects
  DROP CONSTRAINT IF EXISTS grade_subjects_classification_chk,
  DROP CONSTRAINT IF EXISTS grade_subjects_ira_weight_chk;
ALTER TABLE public.grade_subjects
  ADD CONSTRAINT grade_subjects_classification_chk
    CHECK (classification IS NULL OR classification IN ('fgb', 'itinerario')),
  ADD CONSTRAINT grade_subjects_ira_weight_chk
    CHECK (ira_weight IS NULL OR ira_weight > 0);

-- Passo 1: nome canônico + mesma ocorrência (slot).
UPDATE public.grade_subjects gs
   SET curriculum_matrix_subject_id = m.id,
       classification = m.classification,
       ira_weight = m.ira_weight
  FROM public.classes c
  JOIN public.curriculum_matrix_subjects m
    ON m.matrix_id = c.curriculum_matrix_id AND m.school_id = c.school_id AND m.series = c.series
  JOIN public.mapping_global_subjects s ON s.id = m.subject_id
 WHERE gs.class_id = c.id AND gs.school_id = c.school_id
   AND gs.curriculum_matrix_subject_id IS NULL
   AND m.slot_index = gs.slot_index
   AND public.normalize_subject_key(s.name) = public.normalize_subject_key(gs.name);

-- Passo 2: aliases oficiais da disciplina (mesma ocorrência).
UPDATE public.grade_subjects gs
   SET curriculum_matrix_subject_id = m.id,
       classification = m.classification,
       ira_weight = m.ira_weight
  FROM public.classes c
  JOIN public.curriculum_matrix_subjects m
    ON m.matrix_id = c.curriculum_matrix_id AND m.school_id = c.school_id AND m.series = c.series
  JOIN public.mapping_global_subjects s ON s.id = m.subject_id
 WHERE gs.class_id = c.id AND gs.school_id = c.school_id
   AND gs.curriculum_matrix_subject_id IS NULL
   AND m.slot_index = gs.slot_index
   AND EXISTS (
     SELECT 1 FROM unnest(coalesce(s.aliases, '{}'::text[])) a
      WHERE public.normalize_subject_key(a) = public.normalize_subject_key(gs.name)
   );

-- Passo 3: correspondência ÚNICA ignorando o slot (sem ambiguidade).
WITH cand AS (
  SELECT gs.id AS gs_id, min(m.id::text)::uuid AS m_id, count(*) AS n
    FROM public.grade_subjects gs
    JOIN public.classes c ON c.id = gs.class_id AND c.school_id = gs.school_id
    JOIN public.curriculum_matrix_subjects m
      ON m.matrix_id = c.curriculum_matrix_id AND m.school_id = c.school_id AND m.series = c.series
    JOIN public.mapping_global_subjects s ON s.id = m.subject_id
   WHERE gs.curriculum_matrix_subject_id IS NULL
     AND (public.normalize_subject_key(s.name) = public.normalize_subject_key(gs.name)
          OR EXISTS (SELECT 1 FROM unnest(coalesce(s.aliases, '{}'::text[])) a
                      WHERE public.normalize_subject_key(a) = public.normalize_subject_key(gs.name)))
   GROUP BY gs.id
)
UPDATE public.grade_subjects gs
   SET curriculum_matrix_subject_id = m.id,
       classification = m.classification,
       ira_weight = m.ira_weight
  FROM cand, public.curriculum_matrix_subjects m
 WHERE cand.gs_id = gs.id AND cand.n = 1 AND m.id = cand.m_id;

-- =====================================================================
-- D) MEDALHAS DE DESEMPENHO CONFIGURÁVEIS POR ESCOLA
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.medal_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  symbol text NOT NULL DEFAULT '🏅',
  description text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT medal_definitions_name_unique UNIQUE (school_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.medal_definitions TO authenticated;
GRANT ALL ON public.medal_definitions TO service_role;
ALTER TABLE public.medal_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "medal_definitions_select" ON public.medal_definitions;
CREATE POLICY "medal_definitions_select" ON public.medal_definitions
FOR SELECT TO authenticated USING (public.can_access_school(school_id));
DROP POLICY IF EXISTS "medal_definitions_write" ON public.medal_definitions;
CREATE POLICY "medal_definitions_write" ON public.medal_definitions
FOR ALL TO authenticated
USING (public.has_school_permission(school_id, 'ira.configure'))
WITH CHECK (public.has_school_permission(school_id, 'ira.configure'));

DROP TRIGGER IF EXISTS trg_medal_definitions_updated_at ON public.medal_definitions;
CREATE TRIGGER trg_medal_definitions_updated_at BEFORE UPDATE ON public.medal_definitions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.medal_definition_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medal_id uuid NOT NULL REFERENCES public.medal_definitions(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  matrix_subject_id uuid NOT NULL REFERENCES public.curriculum_matrix_subjects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT medal_definition_subjects_unique UNIQUE (medal_id, matrix_subject_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.medal_definition_subjects TO authenticated;
GRANT ALL ON public.medal_definition_subjects TO service_role;
ALTER TABLE public.medal_definition_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "medal_definition_subjects_select" ON public.medal_definition_subjects;
CREATE POLICY "medal_definition_subjects_select" ON public.medal_definition_subjects
FOR SELECT TO authenticated USING (public.can_access_school(school_id));
DROP POLICY IF EXISTS "medal_definition_subjects_write" ON public.medal_definition_subjects;
CREATE POLICY "medal_definition_subjects_write" ON public.medal_definition_subjects
FOR ALL TO authenticated
USING (public.has_school_permission(school_id, 'ira.configure'))
WITH CHECK (public.has_school_permission(school_id, 'ira.configure'));

-- Nenhuma associação cross-school / cross-matriz.
CREATE OR REPLACE FUNCTION public.enforce_medal_subject_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_medal_school uuid; v_comp_school uuid; v_comp_matrix uuid; v_school_matrix uuid;
BEGIN
  SELECT school_id INTO v_medal_school FROM public.medal_definitions WHERE id = NEW.medal_id;
  IF v_medal_school IS NULL THEN RAISE EXCEPTION 'Medalha inexistente'; END IF;
  NEW.school_id := v_medal_school;

  SELECT school_id, matrix_id INTO v_comp_school, v_comp_matrix
    FROM public.curriculum_matrix_subjects WHERE id = NEW.matrix_subject_id;
  IF v_comp_school IS NULL THEN RAISE EXCEPTION 'Componente curricular inexistente'; END IF;
  IF v_comp_school <> v_medal_school THEN
    RAISE EXCEPTION 'O componente curricular pertence a outra escola';
  END IF;

  SELECT curriculum_matrix_id INTO v_school_matrix FROM public.schools WHERE id = v_medal_school;
  IF v_school_matrix IS NOT NULL AND v_comp_matrix <> v_school_matrix THEN
    RAISE EXCEPTION 'O componente curricular nao pertence a matriz curricular da escola';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_medal_subject_scope ON public.medal_definition_subjects;
CREATE TRIGGER trg_medal_subject_scope
BEFORE INSERT OR UPDATE ON public.medal_definition_subjects
FOR EACH ROW EXECUTE FUNCTION public.enforce_medal_subject_scope();

-- Semeadura idempotente das 5 medalhas atuais, com as disciplinas da matriz da escola.
CREATE OR REPLACE FUNCTION public.seed_school_medals(_school_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_matrix uuid; v_medal uuid; v_created int := 0; r record;
  v_defs jsonb := jsonb_build_array(
    jsonb_build_object('name','Linguagens','symbol','📖','order',1,'aliases',
      jsonb_build_array('lingua portuguesa','portugues','letramento em lingua portuguesa','educacao fisica','arte','lingua inglesa','ingles')),
    jsonb_build_object('name','Matemática','symbol','🔢','order',2,'aliases',
      jsonb_build_array('matematica','letramento em matematica')),
    jsonb_build_object('name','Humanas','symbol','🌍','order',3,'aliases',
      jsonb_build_array('historia','geografia','filosofia','sociologia')),
    jsonb_build_object('name','Natureza','symbol','🔬','order',4,'aliases',
      jsonb_build_array('fisica','quimica','biologia')),
    jsonb_build_object('name','Parte Diversificada','symbol','⭐','order',5,'aliases',
      jsonb_build_array('educacao digital','identidade e protagonismo','letramento em lingua portuguesa','projeto de vida'))
  );
BEGIN
  SELECT curriculum_matrix_id INTO v_matrix FROM public.schools WHERE id = _school_id;
  IF v_matrix IS NULL THEN RETURN 0; END IF;
  IF EXISTS (SELECT 1 FROM public.medal_definitions WHERE school_id = _school_id) THEN RETURN 0; END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(v_defs) AS d(def) LOOP
    INSERT INTO public.medal_definitions (school_id, name, symbol, sort_order)
    VALUES (_school_id, r.def->>'name', r.def->>'symbol', (r.def->>'order')::int)
    RETURNING id INTO v_medal;
    v_created := v_created + 1;

    INSERT INTO public.medal_definition_subjects (medal_id, school_id, matrix_subject_id)
    SELECT v_medal, _school_id, m.id
      FROM public.curriculum_matrix_subjects m
      JOIN public.mapping_global_subjects s ON s.id = m.subject_id
     WHERE m.school_id = _school_id AND m.matrix_id = v_matrix
       AND EXISTS (
         SELECT 1 FROM jsonb_array_elements_text(r.def->'aliases') a
          WHERE public.normalize_subject_key(s.name) = a.value
             OR EXISTS (SELECT 1 FROM unnest(coalesce(s.aliases,'{}'::text[])) al
                         WHERE public.normalize_subject_key(al) = a.value)
       )
    ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN v_created;
END $$;

DO $$ DECLARE s record; BEGIN
  FOR s IN SELECT id FROM public.schools LOOP PERFORM public.seed_school_medals(s.id); END LOOP;
END $$;

-- =====================================================================
-- Criação de escola: base curricular OBRIGATÓRIA (atômica)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.admin_create_school(
  _name text, _city text DEFAULT NULL, _state text DEFAULT NULL,
  _code text DEFAULT NULL, _auto_approve boolean DEFAULT false,
  _base_key text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_slug text; v_code text; v_id uuid; i integer := 1; v_base text; v_matrix uuid;
BEGIN
  IF NOT public.is_global_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF coalesce(trim(_name), '') = '' THEN RAISE EXCEPTION 'Nome obrigatorio'; END IF;

  v_base := lower(nullif(trim(coalesce(_base_key, '')), ''));
  IF v_base IS NULL THEN
    RAISE EXCEPTION 'Selecione a matriz curricular (base) que a escola utilizara';
  END IF;
  IF v_base NOT IN ('original', 'integral') THEN
    RAISE EXCEPTION 'Base curricular invalida: %', v_base;
  END IF;

  v_slug := regexp_replace(lower(translate(_name,
    'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
    'aaaaaeeeeiiiiooooouuuucaaaaaeeeeiiiiooooouuuuc')), '[^a-z0-9]+', '-', 'g');
  v_slug := trim(both '-' from v_slug);
  WHILE EXISTS (SELECT 1 FROM public.schools WHERE slug = v_slug) LOOP
    i := i + 1; v_slug := trim(both '-' from v_slug) || '-' || i;
  END LOOP;

  v_code := NULLIF(upper(trim(coalesce(_code, ''))), '');
  IF v_code IS NULL THEN
    v_code := 'ESCOLA-' || lpad(((SELECT count(*) FROM public.schools) + 1)::text, 3, '0');
    WHILE EXISTS (SELECT 1 FROM public.schools WHERE code = v_code) LOOP
      v_code := 'ESCOLA-' || upper(substr(encode(extensions.gen_random_bytes(3), 'hex'), 1, 6));
    END LOOP;
  ELSIF EXISTS (SELECT 1 FROM public.schools WHERE code = v_code) THEN
    RAISE EXCEPTION 'Codigo ja utilizado por outra escola';
  END IF;

  INSERT INTO public.schools (name, slug, code, city, state, created_by, auto_approve_registration)
  VALUES (trim(_name), v_slug, v_code, NULLIF(trim(coalesce(_city,'')),''),
          NULLIF(trim(coalesce(_state,'')),''), auth.uid(), coalesce(_auto_approve, false))
  RETURNING id INTO v_id;

  SELECT id INTO v_matrix FROM public.curriculum_matrices
   WHERE school_id = v_id AND (system_key = v_base OR (v_base = 'original' AND is_original))
   ORDER BY (system_key = v_base) DESC LIMIT 1;
  IF v_matrix IS NULL THEN
    RAISE EXCEPTION 'A base curricular % nao pudo ser criada para a escola', v_base;
  END IF;

  UPDATE public.schools SET curriculum_matrix_id = v_matrix WHERE id = v_id;
  PERFORM public.seed_school_medals(v_id);

  INSERT INTO public.school_registration_links (school_id, token, created_by, auto_approve)
  VALUES (v_id, encode(extensions.gen_random_bytes(24), 'hex'), auth.uid(), coalesce(_auto_approve, false));

  RETURN v_id;
END $$;

-- Correção administrativa da matriz da escola (casos ambíguos).
CREATE OR REPLACE FUNCTION public.admin_set_school_curriculum_matrix(_school_id uuid, _matrix_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_global_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.curriculum_matrices
                  WHERE id = _matrix_id AND school_id = _school_id) THEN
    RAISE EXCEPTION 'A matriz curricular nao pertence a esta escola';
  END IF;
  UPDATE public.schools SET curriculum_matrix_id = _matrix_id WHERE id = _school_id;
  PERFORM public.seed_school_medals(_school_id);
END $$;
