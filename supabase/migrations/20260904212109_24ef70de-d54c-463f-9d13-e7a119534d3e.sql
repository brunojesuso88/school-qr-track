-- 1) Carga semanal 0 = "não informada" (valor válido, nunca vira peso no IRA)
ALTER TABLE public.curriculum_matrix_subjects
  DROP CONSTRAINT IF EXISTS curriculum_matrix_subjects_weekly_classes_check;
ALTER TABLE public.curriculum_matrix_subjects
  ADD CONSTRAINT curriculum_matrix_subjects_weekly_classes_check
  CHECK (weekly_classes IS NULL OR weekly_classes >= 0);
ALTER TABLE public.curriculum_matrix_subjects ALTER COLUMN weekly_classes SET DEFAULT 0;
UPDATE public.curriculum_matrix_subjects SET weekly_classes = 0 WHERE weekly_classes IS NULL;

-- 2) Um único algoritmo de IRA: o modo por matriz deixa de existir
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
    INSERT INTO public.curriculum_matrices (school_id, name, description, is_original, system_key)
    VALUES (_school_id, 'Matriz Integral',
            'Matriz curricular do Ensino Medio em Tempo Integral (EPT/EVE/SEC).',
            false, 'integral')
    RETURNING id INTO v_matrix;
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
    ('sec2', 17, 1, 'ORGANIZACAO EMPRESARIAL, GESTAO DE PESSOAS E EQUIPES'),
    ('sec2', 18, 1, 'PROJETO DE VIDA'),
    ('sec2', 19, 1, 'QUIMICA'),
    ('sec2', 20, 1, 'REDACAO EMPRESARIAL E TECNICAS SECRETARIAIS'),
    ('sec2', 21, 1, 'SOCIOLOGIA'),
    ('sec2', 22, 1, 'TECNOLOGIAS APLICADAS AO SECRETARIADO'),
    ('eve3', 0, 1, 'ARTE'),
    ('eve3', 1, 1, 'BIOLOGIA'),
    ('eve3', 2, 1, 'CERIMONIAL, ETIQUETA E PROTOCOLO'),
    ('eve3', 3, 1, 'DECORACAO DE AMBIENTES E INTERIORES PARA EVENTOS'),
    ('eve3', 4, 2, 'DECORACAO DE AMBIENTES E INTERIORES PARA EVENTOS'),
    ('eve3', 5, 1, 'EDUCACAO FISICA'),
    ('eve3', 6, 1, 'ESTUDO ORIENTADO E AVALIACAO SEMANAL'),
    ('eve3', 7, 1, 'FILOSOFIA'),
    ('eve3', 8, 1, 'FISICA'),
    ('eve3', 9, 1, 'GEOGRAFIA'),
    ('eve3', 10, 1, 'GESTAO DE ALIMENTOS E BEBIDAS EM EVENTOS'),
    ('eve3', 11, 1, 'GESTAO DE EVENTOS: PLANEJAMENTO E EXECUCAO'),
    ('eve3', 12, 1, 'HISTORIA'),
    ('eve3', 13, 1, 'LETRAMENTO EM LINGUA PORTUGUESA'),
    ('eve3', 14, 1, 'LETRAMENTO EM MATEMATICA'),
    ('eve3', 15, 1, 'LINGUA ESPANHOLA'),
    ('eve3', 16, 1, 'LINGUA INGLESA'),
    ('eve3', 17, 1, 'LINGUA PORTUGUESA'),
    ('eve3', 18, 1, 'MARKETING EM EVENTOS'),
    ('eve3', 19, 1, 'MATEMATICA'),
    ('eve3', 20, 1, 'PROJETO DE VIDA'),
    ('eve3', 21, 1, 'QUIMICA'),
    ('eve3', 22, 1, 'SOCIOLOGIA'),
    ('eve3', 23, 1, 'TUTORIA'),
    ('sec3', 0, 1, 'ARTE'),
    ('sec3', 1, 1, 'BIOLOGIA'),
    ('sec3', 2, 1, 'CONTABILIDADE BASICA E GESTAO FINANCEIRA'),
    ('sec3', 3, 1, 'EDUCACAO FISICA'),
    ('sec3', 4, 1, 'ESTUDO ORIENTADO E AVALIACAO SEMANAL'),
    ('sec3', 5, 1, 'FILOSOFIA'),
    ('sec3', 6, 1, 'FISICA'),
    ('sec3', 7, 1, 'GEOGRAFIA'),
    ('sec3', 8, 1, 'HISTORIA'),
    ('sec3', 9, 1, 'LETRAMENTO EM LINGUA PORTUGUESA'),
    ('sec3', 10, 1, 'LETRAMENTO EM MATEMATICA'),
    ('sec3', 11, 1, 'LINGUA ESPANHOLA'),
    ('sec3', 12, 1, 'LINGUA INGLESA'),
    ('sec3', 13, 1, 'LINGUA PORTUGUESA'),
    ('sec3', 14, 1, 'MATEMATICA'),
    ('sec3', 15, 1, 'ORGANIZACAO EMPRESARIAL, GESTAO DE PESSOAS E EQUIPES'),
    ('sec3', 16, 1, 'PLANEJAMENTO, CAPTACAO E EXECUCAO DE RECURSOS'),
    ('sec3', 17, 1, 'PROJETO DE VIDA'),
    ('sec3', 18, 1, 'QUIMICA'),
    ('sec3', 19, 1, 'REDACAO EMPRESARIAL E TECNICAS SECRETARIAIS'),
    ('sec3', 20, 1, 'SOCIOLOGIA'),
    ('sec3', 21, 1, 'TECNOLOGIAS APLICADAS AO SECRETARIADO'),
    ('sec3', 22, 1, 'TUTORIA')
    ) AS t(series, sort_order, slot_index, subject_name)
  LOOP
    SELECT id INTO v_subject FROM public.mapping_global_subjects
     WHERE school_id = _school_id AND upper(btrim(name)) = r.subject_name
     LIMIT 1;

    IF v_subject IS NULL THEN
      INSERT INTO public.mapping_global_subjects (school_id, name, default_weekly_classes, shift, series, aliases)
      VALUES (_school_id, r.subject_name, 1, 'morning', ARRAY[r.series], ARRAY[]::text[])
      RETURNING id INTO v_subject;
    ELSE
      UPDATE public.mapping_global_subjects
         SET series = (SELECT ARRAY(SELECT DISTINCT unnest(series || ARRAY[r.series])))
       WHERE id = v_subject AND NOT (r.series = ANY (series));
    END IF;

    INSERT INTO public.curriculum_matrix_subjects
      (school_id, matrix_id, subject_id, series, weekly_classes, include_in_ira, slot_index, sort_order)
    VALUES (_school_id, v_matrix, v_subject, r.series, 0, true, r.slot_index, r.sort_order)
    ON CONFLICT (matrix_id, subject_id, series, slot_index) DO NOTHING;
  END LOOP;

  RETURN v_matrix;
END
$function$;

REVOKE ALL ON FUNCTION public.seed_school_integral_matrix(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_school_integral_matrix(uuid) TO service_role;

ALTER TABLE public.curriculum_matrices DROP CONSTRAINT IF EXISTS curriculum_matrices_ira_mode_check;
ALTER TABLE public.curriculum_matrices DROP COLUMN IF EXISTS ira_calculation_mode;
