-- Eixos autorizados dos Aprofundamentos: CHL, CNS, ETT, SEA (identidade curricular, nunca por turma).
CREATE OR REPLACE FUNCTION public.ensure_aprofundamento_axis_aliases(_school_id uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_updated int := 0; r record; v_new text[];
BEGIN
  FOR r IN
    SELECT s.id, s.name, coalesce(s.aliases, '{}'::text[]) AS aliases,
           CASE WHEN upper(btrim(s.name)) = 'APROFUNDAMENTO IF - II' THEN 'II' ELSE 'I' END AS roman
      FROM public.mapping_global_subjects s
     WHERE upper(btrim(s.name)) IN ('APROFUNDAMENTO IF - I', 'APROFUNDAMENTO IF - II')
       AND (_school_id IS NULL OR s.school_id = _school_id)
  LOOP
    v_new := ARRAY[
      format('APROFUNDAMENTO IF - CHL - %s', r.roman), format('APROFUNDAMENTO IF CHL %s', r.roman),
      format('APROFUNDAMENTO IF - CNS - %s', r.roman), format('APROFUNDAMENTO IF CNS %s', r.roman),
      format('APROFUNDAMENTO IF - ETT - %s', r.roman), format('APROFUNDAMENTO IF ETT %s', r.roman),
      format('APROFUNDAMENTO IF - SEA - %s', r.roman), format('APROFUNDAMENTO IF SEA %s', r.roman)
    ];
    UPDATE public.mapping_global_subjects s
       SET aliases = ARRAY(
             SELECT DISTINCT a FROM (
               SELECT unnest(r.aliases) AS a
               UNION SELECT unnest(v_new)
             ) u WHERE a IS NOT NULL AND btrim(a) <> ''
           )
     WHERE s.id = r.id
       AND NOT (v_new <@ r.aliases);
    IF FOUND THEN v_updated := v_updated + 1; END IF;
  END LOOP;
  RETURN v_updated;
END $$;

REVOKE ALL ON FUNCTION public.ensure_aprofundamento_axis_aliases(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_aprofundamento_axis_aliases(uuid) TO service_role;

-- Escolas novas: aliases completos logo após a semeadura da Matriz Original.
CREATE OR REPLACE FUNCTION public.seed_school_curriculum_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.seed_school_curriculum(NEW.id);
  PERFORM public.ensure_aprofundamento_axis_aliases(NEW.id);
  RETURN NEW;
END $$;

-- Reparo manual também garante os aliases.
CREATE OR REPLACE FUNCTION public.repair_school_curricula()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; v_count int := 0; v_created int := 0; v_before int; v_aliases int := 0;
BEGIN
  IF NOT public.is_global_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  FOR s IN SELECT id FROM public.schools LOOP
    SELECT count(*) INTO v_before FROM public.curriculum_matrix_subjects WHERE school_id = s.id;
    PERFORM public.seed_school_curriculum(s.id);
    v_aliases := v_aliases + public.ensure_aprofundamento_axis_aliases(s.id);
    v_count := v_count + 1;
    v_created := v_created + GREATEST(
      (SELECT count(*) FROM public.curriculum_matrix_subjects WHERE school_id = s.id) - v_before, 0);
  END LOOP;
  RETURN jsonb_build_object('schools', v_count, 'components_created', v_created,
                            'aliases_updated', v_aliases);
END $$;

GRANT EXECUTE ON FUNCTION public.repair_school_curricula() TO authenticated;

-- Backfill idempotente das escolas existentes.
SELECT public.ensure_aprofundamento_axis_aliases(NULL);