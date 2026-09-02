CREATE OR REPLACE FUNCTION public.audit_ab_isolation()
RETURNS TABLE(check_name text, passed boolean, detail text)
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_a uuid; v_b uuid;
  v_ta uuid := '901fa791-5322-46dc-95fd-3bb50a37e08d'; -- professor (escola A)
  v_tb uuid := '3588643d-a2a8-4093-89b8-ed542eaa5c25'; -- professor movido p/ escola B
  v_dir uuid := '30b6499b-11eb-40d0-b43c-ed0c191ea52d'; -- direção A (+ direção B no teste)
  v_gadm uuid := '1bba6837-7898-4957-b809-2312d5cdf941';
  v_tb_role public.app_role; v_tb_status text;
  v_cls_b uuid; v_stu_b uuid;
  n1 int; n2 int; n3 int; n4 int; n5 int; n6 int; n7 int;
  b1 boolean; b2 boolean;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS ab_results(check_name text, passed boolean, detail text) ON COMMIT DROP;
  DELETE FROM ab_results;

  SELECT id INTO v_a FROM public.schools ORDER BY created_at LIMIT 1;

  INSERT INTO public.schools(name, slug, code, status, created_by)
    VALUES ('AB TEST B','ab-test-b','ABTESTB','active', v_gadm) RETURNING id INTO v_b;

  INSERT INTO public.classes(name, shift, location, school_id)
    VALUES ('AB-B-TURMA','morning','SEDE', v_b) RETURNING id INTO v_cls_b;
  INSERT INTO public.students(full_name, student_id, class, shift, school_id)
    VALUES ('AB B Aluno','ABB1','AB-B-TURMA','morning', v_b) RETURNING id INTO v_stu_b;
  INSERT INTO public.attendance(student_id, date, status, school_id)
    VALUES (v_stu_b, CURRENT_DATE, 'present', v_b);
  INSERT INTO public.occurrences(student_id, type, date, school_id)
    VALUES (v_stu_b, 'AB TESTE', CURRENT_DATE, v_b);
  INSERT INTO public.school_events(title, school_id, created_by)
    VALUES ('AB B Evento', v_b, v_gadm);
  INSERT INTO public.settings(key, value, school_id)
    VALUES ('ab_test_key', '"b"'::jsonb, v_b);
  INSERT INTO public.ira_staleness(class_id, stale, school_id)
    VALUES (v_cls_b, true, v_b);
  INSERT INTO public.school_registration_links(school_id, token, default_role, created_by)
    VALUES (v_b, 'ab-test-token-xyz', 'teacher', v_gadm);

  SELECT role, status INTO v_tb_role, v_tb_status
    FROM public.school_memberships WHERE user_id = v_tb AND school_id = v_a;
  DELETE FROM public.school_memberships WHERE user_id = v_tb AND school_id = v_a;
  INSERT INTO public.school_memberships(school_id, user_id, role, status)
    VALUES (v_b, v_tb, 'teacher', 'active');
  INSERT INTO public.school_memberships(school_id, user_id, role, status)
    VALUES (v_b, v_dir, 'direction', 'active');

  ------------------------------------------------------------------ professor A
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_ta, 'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n1 FROM public.students WHERE school_id = v_a;
  SELECT count(*) INTO n2 FROM public.students WHERE school_id = v_b;
  SELECT count(*) INTO n3 FROM public.attendance WHERE school_id = v_b;
  SELECT count(*) INTO n4 FROM public.occurrences WHERE school_id = v_b;
  SELECT count(*) INTO n5 FROM public.school_events WHERE school_id = v_b;
  SELECT count(*) INTO n6 FROM public.settings WHERE school_id = v_b;
  SELECT count(*) INTO n7 FROM public.ira_staleness WHERE school_id = v_b;
  BEGIN
    INSERT INTO public.students(full_name, student_id, class, shift, school_id)
      VALUES ('AB Invasor','ABX1','AB-B-TURMA','morning', v_b);
    b1 := false; -- não deveria conseguir
  EXCEPTION WHEN others THEN b1 := true;
  END;
  b2 := public.storage_school_allowed('schools/' || v_b || '/x.png');
  RESET ROLE;
  INSERT INTO ab_results VALUES
    ('professor A lê a própria escola', n1 > 0, 'alunos A visíveis: '||n1),
    ('professor A não lê alunos de B', n2 = 0, 'alunos B visíveis: '||n2),
    ('professor A não lê frequência/ocorrência/eventos/settings/IRA de B',
      n3+n4+n5+n6+n7 = 0, format('freq %s, ocor %s, ev %s, set %s, ira %s', n3,n4,n5,n6,n7)),
    ('professor A não grava em B', b1, 'insert cross-school bloqueado'),
    ('professor A não acessa Storage de B', b2 = false, 'storage_school_allowed(B)='||b2);

  ------------------------------------------------------------------ professor B
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_tb, 'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n1 FROM public.students WHERE school_id = v_b;
  SELECT count(*) INTO n2 FROM public.students WHERE school_id = v_a;
  SELECT count(*) INTO n3 FROM public.attendance WHERE school_id = v_a;
  SELECT count(*) INTO n4 FROM public.student_medical_certificates WHERE school_id = v_a;
  SELECT count(*) INTO n5 FROM public.student_pei WHERE school_id = v_a;
  SELECT count(*) INTO n6 FROM public.student_grades WHERE school_id = v_a;
  SELECT count(*) INTO n7 FROM public.ira_snapshots WHERE school_id = v_a;
  BEGIN
    INSERT INTO public.occurrences(student_id, type, date, school_id)
      VALUES (v_stu_b, 'AB OK', CURRENT_DATE, v_b);
    b1 := true;
  EXCEPTION WHEN others THEN b1 := false;
  END;
  b2 := public.storage_school_allowed('student-photos/legacy-file.png');
  RESET ROLE;
  INSERT INTO ab_results VALUES
    ('professor B lê a própria escola', n1 > 0, 'alunos B visíveis: '||n1),
    ('professor B não lê dados de A', n2+n3 = 0, format('alunos %s, freq %s', n2, n3)),
    ('professor B não lê atestados/PEI/notas/IRA de A',
      n4+n5+n6+n7 = 0, format('atest %s, pei %s, notas %s, ira %s', n4,n5,n6,n7)),
    ('professor B grava na própria escola', b1, 'insert em B permitido'),
    ('professor B não acessa Storage legado (seed school)', b2 = false, 'legacy allowed='||b2);

  ------------------------------------------------------------------ direção com dupla filiação
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_dir, 'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  b1 := public.has_school_role(v_a, ARRAY['direction']::public.app_role[]);
  b2 := public.has_school_role(v_b, ARRAY['direction']::public.app_role[]);
  SELECT count(*) INTO n1 FROM public.students WHERE school_id = v_b;
  RESET ROLE;
  INSERT INTO ab_results VALUES
    ('papel resolvido por escola (dupla filiação)', b1 AND b2, format('A=%s, B=%s', b1, b2)),
    ('direção multi-escola lê B quando é membro de B', n1 > 0, 'alunos B: '||n1);

  ------------------------------------------------------------------ audiência / link
  SELECT count(*) INTO n1 FROM public.school_memberships
    WHERE school_id = v_a AND user_id = v_tb;
  SELECT count(*) INTO n2 FROM public.school_registration_links
    WHERE token = 'ab-test-token-xyz' AND school_id = v_b;
  SELECT count(*) INTO n3 FROM public.ira_staleness WHERE school_id = v_a AND class_id = v_cls_b;
  INSERT INTO ab_results VALUES
    ('audiência de A não inclui professor de B', n1 = 0, 'memberships A p/ tb: '||n1),
    ('link de cadastro pertence só a B', n2 = 1, 'links: '||n2),
    ('staleness de IRA de B não afeta A', n3 = 0, 'linhas cruzadas: '||n3);

  ------------------------------------------------------------------ limpeza
  DELETE FROM public.school_memberships WHERE school_id = v_b;
  IF v_tb_role IS NOT NULL THEN
    INSERT INTO public.school_memberships(school_id, user_id, role, status)
      VALUES (v_a, v_tb, v_tb_role, v_tb_status);
  END IF;
  DELETE FROM public.school_registration_links WHERE school_id = v_b;
  DELETE FROM public.ira_staleness WHERE school_id = v_b;
  DELETE FROM public.settings WHERE school_id = v_b;
  DELETE FROM public.school_events WHERE school_id = v_b;
  DELETE FROM public.occurrences WHERE school_id = v_b;
  DELETE FROM public.attendance WHERE school_id = v_b;
  DELETE FROM public.students WHERE school_id = v_b;
  DELETE FROM public.classes WHERE school_id = v_b;
  DELETE FROM public.schools WHERE id = v_b;

  RETURN QUERY SELECT r.check_name, r.passed, r.detail FROM ab_results r;
END;
$fn$;

REVOKE ALL ON FUNCTION public.audit_ab_isolation() FROM PUBLIC, anon, authenticated;