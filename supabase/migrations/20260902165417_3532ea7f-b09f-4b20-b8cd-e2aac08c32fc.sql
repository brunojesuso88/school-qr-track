-- ================= NOT NULL =================
DO $$
DECLARE t text;
  tables text[] := ARRAY[
    'students','classes','attendance','daily_attendance_closures','occurrences',
    'student_medical_certificates','student_pei','student_paee',
    'grade_subjects','grade_periods','student_grades','grade_imports',
    'grade_import_sessions','grade_import_jobs','grade_import_session_pages',
    'ira_settings','ira_snapshots','ira_staleness',
    'mapping_classes','mapping_teachers','mapping_class_subjects','teacher_availability',
    'timetable_entries','timetable_settings','timetable_rules','timetable_generation_history',
    'teacher_notifications','school_events','school_event_simple','management_signatures',
    'settings','notification_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN school_id SET NOT NULL', t);
    EXECUTE format(
      'CREATE POLICY school_isolation ON public.%I AS RESTRICTIVE FOR ALL TO public
         USING (public.can_access_school(school_id))
         WITH CHECK (public.can_access_school(school_id))', t);
  END LOOP;
END $$;

-- ================= uniques por escola =================
ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS classes_school_name_unique ON public.classes(school_id, name);

ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_student_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS students_school_student_id_unique ON public.students(school_id, student_id);

ALTER TABLE public.settings DROP CONSTRAINT IF EXISTS settings_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS settings_school_key_unique ON public.settings(school_id, key);

DROP INDEX IF EXISTS public.daily_attendance_closures_class_date_unique;
CREATE UNIQUE INDEX IF NOT EXISTS daily_attendance_closures_school_class_date_unique
  ON public.daily_attendance_closures(school_id, class_name, date);

ALTER TABLE public.teacher_notifications DROP CONSTRAINT IF EXISTS teacher_notifications_doc_year_doc_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS teacher_notifications_school_doc_unique
  ON public.teacher_notifications(school_id, doc_year, doc_number);

ALTER TABLE public.timetable_rules DROP CONSTRAINT IF EXISTS timetable_rules_rule_type_key;
CREATE UNIQUE INDEX IF NOT EXISTS timetable_rules_school_type_unique
  ON public.timetable_rules(school_id, rule_type);

-- ================= school_id imutável =================
CREATE OR REPLACE FUNCTION public.enforce_school_id_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.school_id IS DISTINCT FROM OLD.school_id THEN
    RAISE EXCEPTION 'Nao e permitido transferir registros entre escolas';
  END IF;
  RETURN NEW;
END $$;

-- ================= consistencia pai/filho =================
CREATE OR REPLACE FUNCTION public.enforce_child_school_match()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  parent_table text := TG_ARGV[0];
  fk_column    text := TG_ARGV[1];
  fk_value     uuid;
  parent_school uuid;
BEGIN
  EXECUTE format('SELECT ($1).%I', fk_column) INTO fk_value USING NEW;
  IF fk_value IS NULL THEN RETURN NEW; END IF;
  EXECUTE format('SELECT school_id FROM public.%I WHERE id = $1', parent_table)
    INTO parent_school USING fk_value;
  IF parent_school IS NOT NULL AND parent_school IS DISTINCT FROM NEW.school_id THEN
    RAISE EXCEPTION 'Registro vinculado pertence a outra escola';
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('attendance','students','student_id'),
    ('occurrences','students','student_id'),
    ('student_medical_certificates','students','student_id'),
    ('student_pei','students','student_id'),
    ('student_paee','students','student_id'),
    ('student_grades','students','student_id'),
    ('student_grades','grade_subjects','grade_subject_id'),
    ('grade_subjects','classes','class_id'),
    ('grade_periods','classes','class_id'),
    ('grade_imports','classes','class_id'),
    ('grade_import_sessions','classes','class_id'),
    ('grade_import_jobs','classes','class_id'),
    ('ira_settings','classes','class_id'),
    ('ira_staleness','classes','class_id'),
    ('ira_snapshots','students','student_id'),
    ('mapping_class_subjects','mapping_classes','class_id'),
    ('mapping_class_subjects','mapping_teachers','teacher_id'),
    ('teacher_availability','mapping_teachers','teacher_id'),
    ('timetable_entries','mapping_classes','class_id'),
    ('classes','mapping_classes','mapping_class_id')
  ) AS v(child, parent, fk) LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW
         EXECUTE FUNCTION public.enforce_child_school_match(%L, %L)',
      'trg_school_match_' || r.child || '_' || r.fk, r.child, r.parent, r.fk);
  END LOOP;

  FOR r IN SELECT unnest(ARRAY[
    'students','classes','attendance','occurrences','student_medical_certificates',
    'student_pei','student_paee','grade_subjects','grade_periods','student_grades',
    'ira_settings','ira_snapshots','ira_staleness','mapping_classes','mapping_teachers',
    'mapping_class_subjects','teacher_notifications','school_events','school_event_simple',
    'management_signatures','settings','daily_attendance_closures'
  ]) AS t LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_school_id_immutable BEFORE UPDATE ON public.%I FOR EACH ROW
         EXECUTE FUNCTION public.enforce_school_id_immutable()', r.t);
  END LOOP;
END $$;

-- ================= papeis: união legado + membership =================
CREATE OR REPLACE FUNCTION public.user_has_any_role(_roles app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = ANY(_roles)
  ) OR EXISTS (
    SELECT 1 FROM public.school_memberships
     WHERE user_id = auth.uid() AND status = 'active' AND role = ANY(_roles)
  )
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_role(_role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = _role
  ) OR EXISTS (
    SELECT 1 FROM public.school_memberships
     WHERE user_id = auth.uid() AND status = 'active' AND role = _role
  )
$$;

-- ================= RLS das novas tabelas =================
CREATE POLICY "Membros veem suas escolas" ON public.schools FOR SELECT TO authenticated
  USING (public.is_global_admin() OR public.is_school_member(id));
CREATE POLICY "Admin global gerencia escolas" ON public.schools FOR ALL TO authenticated
  USING (public.is_global_admin()) WITH CHECK (public.is_global_admin());
CREATE POLICY "Direcao atualiza a propria escola" ON public.schools FOR UPDATE TO authenticated
  USING (public.has_school_role(id, ARRAY['admin','direction']::app_role[]))
  WITH CHECK (public.has_school_role(id, ARRAY['admin','direction']::app_role[]));

CREATE POLICY "Usuario ve seus vinculos" ON public.school_memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid()
         OR public.is_global_admin()
         OR public.has_school_role(school_id, ARRAY['admin','direction']::app_role[]));
CREATE POLICY "Admin global gerencia vinculos" ON public.school_memberships FOR ALL TO authenticated
  USING (public.is_global_admin()) WITH CHECK (public.is_global_admin());
CREATE POLICY "Gestao da escola gerencia vinculos" ON public.school_memberships FOR UPDATE TO authenticated
  USING (public.has_school_role(school_id, ARRAY['admin','direction']::app_role[]))
  WITH CHECK (public.has_school_role(school_id, ARRAY['admin','direction']::app_role[]));

CREATE POLICY "Gestao ve links da escola" ON public.school_registration_links FOR SELECT TO authenticated
  USING (public.is_global_admin() OR public.has_school_role(school_id, ARRAY['admin','direction']::app_role[]));
CREATE POLICY "Admin global gerencia links" ON public.school_registration_links FOR ALL TO authenticated
  USING (public.is_global_admin()) WITH CHECK (public.is_global_admin());

-- ================= signup sem papel automatico =================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

-- ================= RPCs de cadastro por link =================
CREATE OR REPLACE FUNCTION public.resolve_registration_link(_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.school_registration_links; s public.schools;
BEGIN
  SELECT * INTO l FROM public.school_registration_links WHERE token = _token;
  IF l.id IS NULL THEN RETURN jsonb_build_object('valid', false, 'reason', 'not_found'); END IF;
  IF NOT l.active OR l.revoked_at IS NOT NULL THEN RETURN jsonb_build_object('valid', false, 'reason', 'revoked'); END IF;
  IF l.expires_at IS NOT NULL AND l.expires_at < now() THEN RETURN jsonb_build_object('valid', false, 'reason', 'expired'); END IF;
  IF l.max_uses IS NOT NULL AND l.use_count >= l.max_uses THEN RETURN jsonb_build_object('valid', false, 'reason', 'exhausted'); END IF;
  SELECT * INTO s FROM public.schools WHERE id = l.school_id;
  IF s.status <> 'active' THEN RETURN jsonb_build_object('valid', false, 'reason', 'school_inactive'); END IF;
  RETURN jsonb_build_object('valid', true, 'school_name', s.name, 'city', s.city,
    'state', s.state, 'logo_path', s.logo_path, 'default_role', l.default_role,
    'auto_approve', l.auto_approve);
END $$;
REVOKE ALL ON FUNCTION public.resolve_registration_link(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_registration_link(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.join_school_with_token(_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.school_registration_links; v_status text; v_existing public.school_memberships;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF (public.resolve_registration_link(_token) ->> 'valid') <> 'true' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_token');
  END IF;
  SELECT * INTO l FROM public.school_registration_links WHERE token = _token;
  v_status := CASE WHEN l.auto_approve THEN 'active' ELSE 'pending' END;

  SELECT * INTO v_existing FROM public.school_memberships
   WHERE school_id = l.school_id AND user_id = auth.uid();
  IF v_existing.id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'status', v_existing.status, 'already_member', true);
  END IF;

  INSERT INTO public.school_memberships (school_id, user_id, role, status, invited_by, approved_at)
  VALUES (l.school_id, auth.uid(), l.default_role, v_status, l.created_by,
          CASE WHEN v_status = 'active' THEN now() ELSE NULL END);

  UPDATE public.school_registration_links SET use_count = use_count + 1 WHERE id = l.id;
  RETURN jsonb_build_object('ok', true, 'status', v_status, 'already_member', false);
END $$;
REVOKE ALL ON FUNCTION public.join_school_with_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_school_with_token(text) TO authenticated;

-- ================= RPCs de administracao global =================
CREATE OR REPLACE FUNCTION public.admin_create_school(_name text, _city text DEFAULT NULL,
  _state text DEFAULT NULL, _code text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_slug text; v_code text; v_id uuid; i integer := 1;
BEGIN
  IF NOT public.is_global_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF coalesce(trim(_name), '') = '' THEN RAISE EXCEPTION 'Nome obrigatorio'; END IF;

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
      v_code := 'ESCOLA-' || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 6));
    END LOOP;
  ELSIF EXISTS (SELECT 1 FROM public.schools WHERE code = v_code) THEN
    RAISE EXCEPTION 'Codigo ja utilizado por outra escola';
  END IF;

  INSERT INTO public.schools (name, slug, code, city, state, created_by)
  VALUES (trim(_name), v_slug, v_code, NULLIF(trim(coalesce(_city,'')),''),
          NULLIF(trim(coalesce(_state,'')),''), auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO public.school_registration_links (school_id, token, created_by)
  VALUES (v_id, encode(gen_random_bytes(24), 'hex'), auth.uid());

  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_create_school(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_school(text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_regenerate_registration_link(_school_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_token text;
BEGIN
  IF NOT public.is_global_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  UPDATE public.school_registration_links
     SET active = false, revoked_at = now()
   WHERE school_id = _school_id AND active;
  v_token := encode(gen_random_bytes(24), 'hex');
  INSERT INTO public.school_registration_links (school_id, token, created_by)
  VALUES (_school_id, v_token, auth.uid());
  RETURN v_token;
END $$;
REVOKE ALL ON FUNCTION public.admin_regenerate_registration_link(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_regenerate_registration_link(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_revoke_registration_link(_school_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_global_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  UPDATE public.school_registration_links
     SET active = false, revoked_at = now()
   WHERE school_id = _school_id AND active;
END $$;
REVOKE ALL ON FUNCTION public.admin_revoke_registration_link(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_revoke_registration_link(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_upsert_membership(_school_id uuid, _user_id uuid,
  _role app_role, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_global_admin()
          OR public.has_school_role(_school_id, ARRAY['admin','direction']::app_role[])) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF _status NOT IN ('pending','active','inactive','rejected') THEN
    RAISE EXCEPTION 'Situacao invalida';
  END IF;
  INSERT INTO public.school_memberships (school_id, user_id, role, status, invited_by, approved_by, approved_at)
  VALUES (_school_id, _user_id, _role, _status, auth.uid(),
          CASE WHEN _status = 'active' THEN auth.uid() END,
          CASE WHEN _status = 'active' THEN now() END)
  ON CONFLICT (school_id, user_id) DO UPDATE
    SET role = EXCLUDED.role,
        status = EXCLUDED.status,
        approved_by = CASE WHEN EXCLUDED.status = 'active' THEN auth.uid() ELSE public.school_memberships.approved_by END,
        approved_at = CASE WHEN EXCLUDED.status = 'active' THEN now() ELSE public.school_memberships.approved_at END,
        updated_at = now();
END $$;
REVOKE ALL ON FUNCTION public.admin_upsert_membership(uuid, uuid, app_role, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_upsert_membership(uuid, uuid, app_role, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_remove_membership(_school_id uuid, _user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_global_admin()
          OR public.has_school_role(_school_id, ARRAY['admin','direction']::app_role[])) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  DELETE FROM public.school_memberships WHERE school_id = _school_id AND user_id = _user_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_remove_membership(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_remove_membership(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(user_id uuid, full_name text, email text, is_global_admin boolean, memberships jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name, p.email,
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'admin'),
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'school_id', m.school_id, 'school_name', s.name,
        'role', m.role, 'status', m.status) ORDER BY s.name)
        FROM public.school_memberships m
        JOIN public.schools s ON s.id = m.school_id
       WHERE m.user_id = p.id), '[]'::jsonb)
    FROM public.profiles p
   WHERE public.is_global_admin()
   ORDER BY p.full_name NULLS LAST
$$;
REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_school_overview()
RETURNS TABLE(school_id uuid, name text, slug text, code text, status text, city text,
  state text, member_count integer, pending_count integer, token text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.name, s.slug, s.code, s.status, s.city, s.state,
    (SELECT count(*)::int FROM public.school_memberships m WHERE m.school_id = s.id AND m.status = 'active'),
    (SELECT count(*)::int FROM public.school_memberships m WHERE m.school_id = s.id AND m.status = 'pending'),
    (SELECT l.token FROM public.school_registration_links l WHERE l.school_id = s.id AND l.active LIMIT 1)
    FROM public.schools s
   WHERE public.is_global_admin()
   ORDER BY s.name
$$;
REVOKE ALL ON FUNCTION public.admin_school_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_school_overview() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_school_members(_school_id uuid)
RETURNS TABLE(user_id uuid, full_name text, email text, role app_role, status text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.user_id, p.full_name, p.email, m.role, m.status, m.created_at
    FROM public.school_memberships m
    LEFT JOIN public.profiles p ON p.id = m.user_id
   WHERE m.school_id = _school_id
     AND (public.is_global_admin()
          OR public.has_school_role(_school_id, ARRAY['admin','direction']::app_role[]))
   ORDER BY m.status, p.full_name NULLS LAST
$$;
REVOKE ALL ON FUNCTION public.admin_school_members(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_school_members(uuid) TO authenticated;
