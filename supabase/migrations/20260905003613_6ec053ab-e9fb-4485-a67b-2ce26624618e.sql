-- Normaliza o nome da disciplina "ASPECTOS CULTURAIS E DIMENSOES DO TURISMO DEEVENTOS"
-- (espaço perdido) para "... DO TURISMO DE EVENTOS", preservando o nome antigo como alias.
DO $$
DECLARE
  v_old text := 'ASPECTOS CULTURAIS E DIMENSOES DO TURISMO DEEVENTOS';
  v_new text := 'ASPECTOS CULTURAIS E DIMENSOES DO TURISMO DE EVENTOS';
  r record;
  v_target uuid;
BEGIN
  FOR r IN
    SELECT id, school_id FROM public.mapping_global_subjects WHERE name = v_old
  LOOP
    SELECT id INTO v_target FROM public.mapping_global_subjects
     WHERE school_id = r.school_id AND name = v_new LIMIT 1;

    IF v_target IS NULL THEN
      UPDATE public.mapping_global_subjects
         SET name = v_new,
             aliases = (SELECT ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(aliases, '{}'::text[]) || ARRAY[v_old]) AS x))
       WHERE id = r.id;
    ELSE
      -- Já existe o nome correto na escola: aponta os componentes para ele e remove o duplicado.
      UPDATE public.curriculum_matrix_subjects SET subject_id = v_target WHERE subject_id = r.id;
      UPDATE public.mapping_global_subjects
         SET aliases = (SELECT ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(aliases, '{}'::text[]) || ARRAY[v_old]) AS x))
       WHERE id = v_target;
      DELETE FROM public.mapping_global_subjects WHERE id = r.id;
    END IF;
  END LOOP;

  -- Disciplinas já importadas em turmas mantêm as notas: só o rótulo é corrigido.
  UPDATE public.grade_subjects
     SET name = v_new,
         normalized_name = public.normalize_subject_key(v_new)
   WHERE name = v_old;
END $$;

-- Semente oficial passa a gravar o nome correto em novas escolas.
CREATE OR REPLACE FUNCTION public.fix_integral_turismo_eventos_name()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT 1;
$$;
DROP FUNCTION IF EXISTS public.fix_integral_turismo_eventos_name();