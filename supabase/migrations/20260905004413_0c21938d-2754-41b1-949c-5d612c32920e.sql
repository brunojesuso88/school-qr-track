-- Merge seguro/idempotente da disciplina renomeada (complementa a migration
-- 20260905003613). Nenhuma nota é tocada; apenas metadados e duplicatas estruturais.
DO $$
DECLARE
  v_old text := 'ASPECTOS CULTURAIS E DIMENSOES DO TURISMO DEEVENTOS';
  v_new text := 'ASPECTOS CULTURAIS E DIMENSOES DO TURISMO DE EVENTOS';
  r record;
  d record;
  v_target uuid;
BEGIN
  FOR r IN
    SELECT id, school_id, aliases, series FROM public.mapping_global_subjects WHERE name = v_old
  LOOP
    SELECT id INTO v_target FROM public.mapping_global_subjects
     WHERE school_id = r.school_id AND name = v_new LIMIT 1;

    IF v_target IS NULL THEN
      UPDATE public.mapping_global_subjects
         SET name = v_new,
             aliases = (SELECT ARRAY(SELECT DISTINCT x
                                       FROM unnest(COALESCE(aliases, '{}'::text[]) || ARRAY[v_old]) AS x))
       WHERE id = r.id;
      CONTINUE;
    END IF;

    -- Aliases das DUAS linhas + nome antigo; união das séries.
    UPDATE public.mapping_global_subjects t
       SET aliases = (SELECT ARRAY(SELECT DISTINCT x
                                     FROM unnest(COALESCE(t.aliases, '{}'::text[])
                                               || COALESCE(r.aliases, '{}'::text[])
                                               || ARRAY[v_old]) AS x
                                    WHERE x <> v_new)),
           series = (SELECT ARRAY(SELECT DISTINCT x
                                    FROM unnest(COALESCE(t.series, '{}'::text[])
                                              || COALESCE(r.series, '{}'::text[])) AS x))
     WHERE t.id = v_target;

    -- Chave real: (matrix_id, subject_id, series, slot_index). Onde antigo e novo
    -- coexistem, preserva a linha canônica mais completa e remove SOMENTE a duplicata.
    FOR d IN
      SELECT old_row.id AS old_id, new_row.id AS new_id
        FROM public.curriculum_matrix_subjects old_row
        JOIN public.curriculum_matrix_subjects new_row
          ON new_row.matrix_id = old_row.matrix_id
         AND new_row.series = old_row.series
         AND new_row.slot_index = old_row.slot_index
         AND new_row.subject_id = v_target
       WHERE old_row.subject_id = r.id
    LOOP
      UPDATE public.curriculum_matrix_subjects keep
         SET weekly_classes = COALESCE(keep.weekly_classes, drop_row.weekly_classes),
             include_in_ira = keep.include_in_ira OR drop_row.include_in_ira,
             sort_order = LEAST(keep.sort_order, drop_row.sort_order)
        FROM public.curriculum_matrix_subjects drop_row
       WHERE keep.id = d.new_id AND drop_row.id = d.old_id;

      DELETE FROM public.curriculum_matrix_subjects WHERE id = d.old_id;
    END LOOP;

    UPDATE public.curriculum_matrix_subjects SET subject_id = v_target WHERE subject_id = r.id;
    DELETE FROM public.mapping_global_subjects WHERE id = r.id;
  END LOOP;

  -- Rótulo das disciplinas já importadas (student_grades intacto).
  UPDATE public.grade_subjects
     SET name = v_new,
         normalized_name = public.normalize_subject_key(v_new)
   WHERE name = v_old;

  -- Alias antigo garantido em toda linha canônica (leitura de boletins antigos).
  UPDATE public.mapping_global_subjects
     SET aliases = (SELECT ARRAY(SELECT DISTINCT x
                                   FROM unnest(COALESCE(aliases, '{}'::text[]) || ARRAY[v_old]) AS x))
   WHERE name = v_new
     AND NOT (COALESCE(aliases, '{}'::text[]) @> ARRAY[v_old]);
END $$;

-- Remove a função no-op criada/derrubada na migration anterior (garantia de estado limpo).
DROP FUNCTION IF EXISTS public.fix_integral_turismo_eventos_name();