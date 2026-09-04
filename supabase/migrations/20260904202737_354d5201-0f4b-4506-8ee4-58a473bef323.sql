-- 1) Séries: ampliar para os percursos da Matriz Integral (EPT/EVE/SEC)
ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_series_check;
ALTER TABLE public.classes ADD CONSTRAINT classes_series_check
  CHECK (series IS NULL OR series = ANY (ARRAY['1','2','3','eja1','eja2','ept1','eve2','sec2','eve3','sec3']));

ALTER TABLE public.curriculum_matrix_subjects DROP CONSTRAINT IF EXISTS curriculum_matrix_subjects_series_check;
ALTER TABLE public.curriculum_matrix_subjects ADD CONSTRAINT curriculum_matrix_subjects_series_check
  CHECK (series = ANY (ARRAY['1','2','3','eja1','eja2','ept1','eve2','sec2','eve3','sec3']));

ALTER TABLE public.mapping_global_subjects DROP CONSTRAINT IF EXISTS mapping_global_subjects_series_valid;
ALTER TABLE public.mapping_global_subjects ADD CONSTRAINT mapping_global_subjects_series_valid
  CHECK (series <@ ARRAY['1','2','3','eja1','eja2','ept1','eve2','sec2','eve3','sec3']);

-- 2) Identidade técnica e modo de IRA das matrizes
ALTER TABLE public.curriculum_matrices ADD COLUMN IF NOT EXISTS system_key text;
ALTER TABLE public.curriculum_matrices ADD COLUMN IF NOT EXISTS ira_calculation_mode text NOT NULL DEFAULT 'weighted_weekly';
ALTER TABLE public.curriculum_matrices DROP CONSTRAINT IF EXISTS curriculum_matrices_system_key_check;
ALTER TABLE public.curriculum_matrices ADD CONSTRAINT curriculum_matrices_system_key_check
  CHECK (system_key IS NULL OR system_key = ANY (ARRAY['original','integral']));
ALTER TABLE public.curriculum_matrices DROP CONSTRAINT IF EXISTS curriculum_matrices_ira_mode_check;
ALTER TABLE public.curriculum_matrices ADD CONSTRAINT curriculum_matrices_ira_mode_check
  CHECK (ira_calculation_mode = ANY (ARRAY['weighted_weekly','arithmetic']));
CREATE UNIQUE INDEX IF NOT EXISTS curriculum_matrices_school_system_key_unique
  ON public.curriculum_matrices (school_id, system_key) WHERE system_key IS NOT NULL;

UPDATE public.curriculum_matrices SET system_key = 'original'
 WHERE is_original AND system_key IS DISTINCT FROM 'original';

-- Preserva matriz homônima criada manualmente (renomeada, componentes intactos)
UPDATE public.curriculum_matrices
   SET name = 'Matriz Integral (copia manual anterior)'
 WHERE system_key IS NULL AND is_original = false AND lower(btrim(name)) = 'matriz integral';

-- 3) Carga semanal não aplicável + ocorrências (slots) na matriz
ALTER TABLE public.curriculum_matrix_subjects ALTER COLUMN weekly_classes DROP NOT NULL;
ALTER TABLE public.curriculum_matrix_subjects DROP CONSTRAINT IF EXISTS curriculum_matrix_subjects_weekly_classes_check;
ALTER TABLE public.curriculum_matrix_subjects ADD CONSTRAINT curriculum_matrix_subjects_weekly_classes_check
  CHECK (weekly_classes IS NULL OR weekly_classes > 0);
ALTER TABLE public.curriculum_matrix_subjects ADD COLUMN IF NOT EXISTS slot_index integer NOT NULL DEFAULT 1;
ALTER TABLE public.curriculum_matrix_subjects ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.curriculum_matrix_subjects DROP CONSTRAINT IF EXISTS curriculum_matrix_subjects_matrix_subject_series_unique;
DROP INDEX IF EXISTS public.curriculum_matrix_subjects_matrix_subject_series_unique;
CREATE UNIQUE INDEX IF NOT EXISTS curriculum_matrix_subjects_matrix_subject_series_slot_unique
  ON public.curriculum_matrix_subjects (matrix_id, subject_id, series, slot_index);

-- 4) Ocorrências (slots) nas disciplinas de notas da turma
ALTER TABLE public.grade_subjects ADD COLUMN IF NOT EXISTS slot_index integer NOT NULL DEFAULT 1;
ALTER TABLE public.grade_subjects DROP CONSTRAINT IF EXISTS grade_subjects_unique_per_class;
DROP INDEX IF EXISTS public.grade_subjects_unique_per_class;
ALTER TABLE public.grade_subjects ADD CONSTRAINT grade_subjects_unique_per_class
  UNIQUE (class_id, normalized_name, slot_index);

-- 5) Semeadura idempotente da Matriz Integral oficial (system_key='integral')
CREATE OR REPLACE FUNCTION public.seed_school_integral_matrix(_school_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_matrix uuid;
  r record;
  v_subject uuid;
BEGIN
  SELECT id INTO v_matrix FROM public.curriculum_matrices
   WHERE school_id = _school_id AND system_key = 'integral';

  IF v_matrix IS NULL THEN
    INSERT INTO public.curriculum_matrices (school_id, name, description, is_original, system_key, ira_calculation_mode)
    VALUES (_school_id, 'Matriz Integral',
            'Matriz curricular do Ensino Medio em Tempo Integral (EPT/EVE/SEC). IRA por media aritmetica simples.',
            false, 'integral', 'arithmetic')
    RETURNING id INTO v_matrix;
  ELSE
    UPDATE public.curriculum_matrices
       SET ira_calculation_mode = 'arithmetic'
     WHERE id = v_matrix AND ira_calculation_mode <> 'arithmetic';
  END IF;

  FOR r IN
    SELECT * FROM (VALUES
    ('ept1', 0, 1, 'ARTE'),
    ('ept1', 1, 1, 'BIOLOGIA'),
    ('ept1', 2, 1, 'CRIATIVIDADE E INOVACAO NO EMPREENDEDORISMO'),
    ('ept1', 3, 1, 'EDUCACAO DIGITAL(IS)'),
    ('ept1', 4, 1, 'EDUCACAO FISICA'),
    ('ept1', 5, 1, 'EMPREENDEDORISMO'),
    ('ept1', 6, 1, 'ESTUDO ORIENTADO E AVALIACAO SEMANAL'),
    ('ept1', 7, 1, 'FILOSOFIA'),
    ('ept1', 8, 1, 'FISICA'),
    ('ept1', 9, 1, 'FUNDAMENTOS DA EDUCACAO FINANCEIRA'),
    ('ept1', 10, 1, 'FUNDAMENTOS DE EDUCACAO FINANCEIRA'),
    ('ept1', 11, 1, 'GEOGRAFIA'),
    ('ept1', 12, 1, 'HISTORIA'),
    ('ept1', 13, 1, 'LETRAMENTO EM LINGUA PORTUGUESA'),
    ('ept1', 14, 1, 'LETRAMENTO EM MATEMATICA'),
    ('ept1', 15, 1, 'LINGUA ESPANHOLA'),
    ('ept1', 16, 1, 'LINGUA INGLESA'),
    ('ept1', 17, 1, 'LINGUA PORTUGUESA'),
    ('ept1', 18, 1, 'MATEMATICA'),
    ('ept1', 19, 1, 'PROJETO DE VIDA'),
    ('ept1', 20, 1, 'QUIMICA'),
    ('ept1', 21, 1, 'SOCIOLOGIA'),
    ('ept1', 22, 1, 'TUTORIA'),
    ('eve2', 0, 1, 'ARTE'),
    ('eve2', 1, 1, 'ASPECTOS CULTURAIS E DIMENSOES DO TURISMO DEEVENTOS'),
    ('eve2', 2, 1, 'BIOLOGIA'),
    ('eve2', 3, 1, 'CERIMONIAL, ETIQUETA E PROTOCOLO'),
    ('eve2', 4, 1, 'DECORACAO DE AMBIENTES E INTERIORES PARA EVENTOS'),
    ('eve2', 5, 1, 'EDUCACAO FISICA'),
    ('eve2', 6, 1, 'ESTUDO ORIENTADO E AVALIACAO SEMANAL'),
    ('eve2', 7, 1, 'FILOSOFIA'),
    ('eve2', 8, 1, 'FISICA'),
    ('eve2', 9, 1, 'GEOGRAFIA'),
    ('eve2', 10, 1, 'GESTAO DE ALIMENTOS E BEBIDAS EM EVENTOS'),
    ('eve2', 11, 1, 'GESTAO DE EVENTOS: PLANEJAMENTO E EXECUCAO'),
    ('eve2', 12, 1, 'HISTORIA'),
    ('eve2', 13, 1, 'LETRAMENTO EM LINGUA PORTUGUESA'),
    ('eve2', 14, 1, 'LETRAMENTO EM MATEMATICA'),
    ('eve2', 15, 1, 'LINGUA ESPANHOLA'),
    ('eve2', 16, 1, 'LINGUA INGLESA'),
    ('eve2', 17, 1, 'LINGUA PORTUGUESA'),
    ('eve2', 18, 1, 'MARKETING EM EVENTOS'),
    ('eve2', 19, 1, 'MATEMATICA'),
    ('eve2', 20, 1, 'PROJETO DE VIDA'),
    ('eve2', 21, 1, 'QUIMICA'),
    ('eve2', 22, 1, 'SOCIOLOGIA'),
    ('sec2', 0, 1, 'ARTE'),
    ('sec2', 1, 1, 'BIOLOGIA'),
    ('sec2', 2, 1, 'CONTABILIDADE BASICA E GESTAO FINANCEIRA'),
    ('sec2', 3, 1, 'EDUCACAO FISICA'),
    ('sec2', 4, 1, 'ESTUDO ORIENTADO E AVALIACAO SEMANAL'),
    ('sec2', 5, 1, 'FILOSOFIA'),
    ('sec2', 6, 1, 'FISICA'),
    ('sec2', 7, 1, 'FUNDAMENTOS DE ECONOMIA'),
    ('sec2', 8, 1, 'FUNDAMENTOS DO SECRETARIADO'),
    ('sec2', 9, 1, 'GEOGRAFIA'),
    ('sec2', 10, 1, 'HISTORIA'),
    ('sec2', 11, 1, 'LETRAMENTO EM LINGUA PORTUGUESA'),
    ('sec2', 12, 1, 'LETRAMENTO EM MATEMATICA'),
    ('sec2', 13, 1, 'LINGUA ESPANHOLA'),
    ('sec2', 14, 1, 'LINGUA INGLESA'),
    ('sec2', 15, 1, 'LINGUA PORTUGUESA'),
    ('sec2', 16, 1, 'MATEMATICA'),
    ('sec2', 17, 1, 'NOCOES DE DIREITO E SEGURANCA DO TRABALHO'),
    ('sec2', 18, 1, 'ORGANIZACAO EMPRESARIAL, GESTAO DE PESSOAS E EQUIPES'),
    ('sec2', 19, 1, 'PROJETO DE VIDA'),
    ('sec2', 20, 1, 'QUIMICA'),
    ('sec2', 21, 1, 'REDACAO DE DOCUMENTOS OFICIAIS E ARQUIVISTICA'),
    ('sec2', 22, 1, 'ROTINAS E SERVICOS DO SECRETARIADO'),
    ('sec2', 23, 1, 'SOCIOLOGIA'),
    ('eve3', 0, 1, 'ARTE'),
    ('eve3', 1, 1, 'BIOLOGIA'),
    ('eve3', 2, 1, 'DIREITO DO ENTRETENIMENTO'),
    ('eve3', 3, 1, 'EDUCACAO FISICA'),
    ('eve3', 4, 1, 'ELABORACAO DE PROJETOS DE EVENTOS'),
    ('eve3', 5, 1, 'ESTUDO ORIENTADO E AVALIACAO SEMANAL'),
    ('eve3', 6, 1, 'FILOSOFIA'),
    ('eve3', 7, 1, 'FISICA'),
    ('eve3', 8, 1, 'GEOGRAFIA'),
    ('eve3', 9, 1, 'GESTAO OPERACIONAL E LOGISTICA EM EVENTOS'),
    ('eve3', 10, 1, 'HIGIENE E SEGURANCA DO TRABALHO'),
    ('eve3', 11, 1, 'HISTORIA'),
    ('eve3', 12, 1, 'LETRAMENTO EM LINGUA PORTUGUESA'),
    ('eve3', 13, 1, 'LETRAMENTO EM MATEMATICA'),
    ('eve3', 14, 1, 'LINGUA ESPANHOLA'),
    ('eve3', 15, 1, 'LINGUA INGLESA'),
    ('eve3', 16, 1, 'LINGUA PORTUGUESA'),
    ('eve3', 17, 1, 'MATEMATICA'),
    ('eve3', 18, 1, 'MIDIA E COMUNICACAO EM EVENTOS'),
    ('eve3', 19, 1, 'PLANEJAMENTO, CAPTACAO E EXECUCAO DE RECURSOS'),
    ('eve3', 20, 1, 'POS MEDIO'),
    ('eve3', 21, 1, 'PROJETO INTEGRADOR'),
    ('eve3', 22, 1, 'QUIMICA'),
    ('eve3', 23, 1, 'SEGURANCA E ACESSIBILIDADE EM EVENTOS'),
    ('eve3', 24, 1, 'SOCIOLOGIA'),
    ('eve3', 25, 1, 'TECNICAS DE NEGOCIACAO PARA EVENTOS'),
    ('sec3', 0, 1, 'ARTE'),
    ('sec3', 1, 1, 'BIOLOGIA'),
    ('sec3', 2, 1, 'CERIMONIAL E ORGANIZACAO DE EVENTOS'),
    ('sec3', 3, 1, 'EDUCACAO FISICA'),
    ('sec3', 4, 1, 'ESTUDO ORIENTADO E AVALIACAO SEMANAL'),
    ('sec3', 5, 1, 'FILOSOFIA'),
    ('sec3', 6, 1, 'FISICA'),
    ('sec3', 7, 1, 'FUNDAMENTOS DO MARKETING'),
    ('sec3', 8, 1, 'GEOGRAFIA'),
    ('sec3', 9, 1, 'HISTORIA'),
    ('sec3', 10, 1, 'LETRAMENTO EM LINGUA PORTUGUESA'),
    ('sec3', 11, 1, 'LETRAMENTO EM MATEMATICA'),
    ('sec3', 12, 1, 'LINGUA ESPANHOLA'),
    ('sec3', 13, 1, 'LINGUA INGLESA'),
    ('sec3', 14, 1, 'LINGUA PORTUGUESA'),
    ('sec3', 15, 1, 'MATEMATICA'),
    ('sec3', 16, 1, 'MATEMATICA FINANCEIRA E ESTATISTICA APLICADA'),
    ('sec3', 17, 1, 'NOCOES DE ADMINISTRACAO'),
    ('sec3', 18, 1, 'POS MEDIO'),
    ('sec3', 19, 1, 'PROJETO INTEGRADOR'),
    ('sec3', 20, 1, 'QUIMICA'),
    ('sec3', 21, 1, 'RELACOES INTERPESSOAIS E TECNICAS DE ATENDIMENTO'),
    ('sec3', 22, 1, 'SOCIOLOGIA')
    ) AS t(series, sort_order, slot_index, subject_name)
  LOOP
    -- Reaproveita a disciplina do catalogo pelo nome canonico exato.
    -- `default_weekly_classes` e apenas fallback tecnico do catalogo: a carga
    -- da Matriz Integral e NULL (nao aplicavel) e nunca entra no IRA.
    SELECT id INTO v_subject FROM public.mapping_global_subjects
     WHERE school_id = _school_id AND upper(btrim(name)) = upper(btrim(r.subject_name))
     LIMIT 1;

    IF v_subject IS NULL THEN
      INSERT INTO public.mapping_global_subjects (school_id, name, default_weekly_classes, shift, series, aliases)
      VALUES (_school_id, r.subject_name, 1, 'morning', ARRAY[r.series::text], '{}'::text[])
      RETURNING id INTO v_subject;
    ELSE
      UPDATE public.mapping_global_subjects
         SET series = (SELECT array_agg(DISTINCT x ORDER BY x)
                         FROM unnest(series || ARRAY[r.series::text]) x)
       WHERE id = v_subject AND NOT (r.series::text = ANY (series));
    END IF;

    INSERT INTO public.curriculum_matrix_subjects
      (school_id, matrix_id, subject_id, series, weekly_classes, include_in_ira, slot_index, sort_order)
    VALUES (_school_id, v_matrix, v_subject, r.series, NULL, true, r.slot_index, r.sort_order)
    ON CONFLICT (matrix_id, subject_id, series, slot_index) DO NOTHING;
  END LOOP;

  RETURN v_matrix;
END
$function$;

-- Semeadura para novas escolas (Original + Integral) e reparo global
CREATE OR REPLACE FUNCTION public.seed_school_curriculum_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  PERFORM public.seed_school_curriculum(NEW.id);
  PERFORM public.ensure_aprofundamento_axis_aliases(NEW.id);
  PERFORM public.seed_school_integral_matrix(NEW.id);
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.repair_school_curricula()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE s record; v_count int := 0; v_created int := 0; v_before int; v_aliases int := 0;
BEGIN
  IF NOT public.is_global_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  FOR s IN SELECT id FROM public.schools LOOP
    SELECT count(*) INTO v_before FROM public.curriculum_matrix_subjects WHERE school_id = s.id;
    PERFORM public.seed_school_curriculum(s.id);
    v_aliases := v_aliases + public.ensure_aprofundamento_axis_aliases(s.id);
    PERFORM public.seed_school_integral_matrix(s.id);
    v_count := v_count + 1;
    v_created := v_created + GREATEST(
      (SELECT count(*) FROM public.curriculum_matrix_subjects WHERE school_id = s.id) - v_before, 0);
  END LOOP;
  RETURN jsonb_build_object('schools', v_count, 'components_created', v_created,
                            'aliases_updated', v_aliases);
END $function$;

-- 6) Protecao das matrizes de sistema contra exclusao acidental
CREATE OR REPLACE FUNCTION public.block_delete_matrix_in_use()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_classes int;
BEGIN
  IF OLD.is_original THEN
    RAISE EXCEPTION 'A Matriz Original da escola nao pode ser excluida';
  END IF;
  IF OLD.system_key IS NOT NULL THEN
    RAISE EXCEPTION 'A % e uma matriz padrao do sistema e nao pode ser excluida', OLD.name;
  END IF;
  SELECT count(*) INTO v_classes FROM public.classes WHERE curriculum_matrix_id = OLD.id;
  IF v_classes > 0 THEN
    RAISE EXCEPTION 'Esta matriz curricular esta vinculada a % turma(s). Sincronize essas turmas com outra matriz antes de excluir.', v_classes;
  END IF;
  RETURN OLD;
END $function$;

-- Backfill idempotente nas escolas existentes
DO $do$
DECLARE s record;
BEGIN
  FOR s IN SELECT id FROM public.schools LOOP
    PERFORM public.seed_school_integral_matrix(s.id);
  END LOOP;
END $do$;