-- ============================================================
-- 1) APROVAÇÃO AUTOMÁTICA POR ESCOLA (persistente)
-- ============================================================
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS auto_approve_registration boolean NOT NULL DEFAULT false;

UPDATE public.schools s
   SET auto_approve_registration = true
 WHERE EXISTS (
   SELECT 1 FROM public.school_registration_links l
    WHERE l.school_id = s.id AND l.active AND l.auto_approve
 );

-- Links seguem sempre a configuração da escola
UPDATE public.school_registration_links l
   SET auto_approve = s.auto_approve_registration
  FROM public.schools s
 WHERE s.id = l.school_id AND l.auto_approve IS DISTINCT FROM s.auto_approve_registration;

-- ============================================================
-- 2) CATÁLOGO / PADRÕES DE PERMISSÃO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.role_permission_defaults (
  role app_role NOT NULL,
  permission_key text NOT NULL,
  module text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  allowed boolean NOT NULL,
  PRIMARY KEY (role, permission_key)
);

GRANT SELECT ON public.role_permission_defaults TO authenticated;
GRANT ALL ON public.role_permission_defaults TO service_role;
ALTER TABLE public.role_permission_defaults ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leem catalogo de permissoes" ON public.role_permission_defaults;
CREATE POLICY "Autenticados leem catalogo de permissoes"
  ON public.role_permission_defaults FOR SELECT TO authenticated USING (true);

DELETE FROM public.role_permission_defaults;

WITH c(module, sort_order, permission_key, label, dir, tea) AS (VALUES
  ('Alunos', 10, 'students.view',                 'Acessar alunos',                          true,  true),
  ('Alunos', 20, 'students.create',               'Cadastrar aluno',                         true,  true),
  ('Alunos', 30, 'students.edit',                 'Editar cadastro do aluno',                true,  true),
  ('Alunos', 40, 'students.delete',               'Excluir alunos',                          true,  false),
  ('Alunos', 50, 'occurrences.view',              'Visualizar ocorrências e conselho',       true,  true),
  ('Alunos', 60, 'occurrences.create',            'Registrar ocorrência',                    true,  true),
  ('Alunos', 70, 'occurrences.edit',              'Editar ocorrência',                       true,  true),
  ('Alunos', 80, 'occurrences.delete',            'Excluir ocorrência',                      true,  true),
  ('Alunos', 90, 'grades.view',                   'Visualizar notas e boletim',              true,  true),
  ('Alunos',100, 'grades.manage',                 'Alterar, importar e consolidar notas',    true,  false),
  ('Alunos',110, 'medical_certificates.manage',   'Gerenciar atestados médicos',             true,  true),
  ('Turmas',10,  'classes.view',                  'Acessar turmas',                          true,  true),
  ('Turmas',20,  'classes.create',                'Criar turma',                             true,  true),
  ('Turmas',30,  'classes.edit',                  'Editar turma',                            true,  true),
  ('Turmas',40,  'classes.delete',                'Excluir turma',                           true,  false),
  ('Turmas',50,  'classes.import_report_card',    'Importar boletim da turma',               true,  false),
  ('Frequência',10,'attendance.view',             'Acessar frequência',                      true,  true),
  ('Frequência',20,'attendance.record',           'Fazer frequência',                        true,  true),
  ('Frequência',30,'attendance.edit',             'Revisar e atualizar frequência',          true,  true),
  ('Frequência',40,'attendance.delete',           'Excluir registro de frequência',          true,  true),
  ('AEE',10,     'aee.view',                      'Acessar Sistema AEE',                     true,  true),
  ('AEE',20,     'aee.manage',                    'Gerenciar PEI/PAEE',                      true,  true),
  ('Professores',10,'teachers.view',              'Acessar professores',                     true,  false),
  ('Professores',20,'teachers.manage',            'Gerenciar professores',                   true,  false),
  ('Disciplinas',10,'subjects.view',              'Acessar disciplinas',                     true,  false),
  ('Disciplinas',20,'subjects.manage',            'Gerenciar matriz curricular',             true,  false),
  ('IRA',10,     'ira.view',                      'Acessar IRA',                             true,  false),
  ('IRA',20,     'ira.recalculate',               'Recalcular IRA',                          true,  false),
  ('IRA',30,     'ira.configure',                 'Configurar pesos e períodos do IRA',      true,  false),
  ('IRA',40,     'ira.export',                    'Exportar classificação do IRA',           true,  false),
  ('Projetos',10,'projects.view',                 'Acessar projetos',                        true,  true),
  ('Projetos',20,'projects.create',               'Criar projeto',                           true,  true),
  ('Projetos',30,'projects.edit',                 'Editar projeto',                          true,  true),
  ('Projetos',40,'projects.delete',               'Excluir projeto',                         true,  true),
  ('Eventos',10, 'events.view',                   'Acessar eventos',                         true,  true),
  ('Eventos',20, 'events.create',                 'Criar evento',                            true,  true),
  ('Eventos',30, 'events.edit',                   'Editar evento',                           true,  true),
  ('Eventos',40, 'events.delete',                 'Excluir evento',                          true,  true),
  ('Documentos',10,'declarations.access',         'Acessar e emitir declarações',            true,  false),
  ('Documentos',20,'teacher_notifications.access','Acessar Notificação Docente',             true,  false),
  ('Documentos',30,'teacher_notifications.manage','Criar, editar e excluir notificações',    true,  false),
  ('Sistema',10, 'notifications.access',          'Central de notificações',                 true,  true)
)
INSERT INTO public.role_permission_defaults(role, permission_key, module, label, sort_order, allowed)
SELECT 'direction'::app_role, permission_key, module, label, sort_order, dir FROM c
UNION ALL
SELECT 'teacher'::app_role, permission_key, module, label, sort_order, tea FROM c;

-- ============================================================
-- 3) PERMISSÕES POR ESCOLA
-- ============================================================
CREATE TABLE IF NOT EXISTS public.school_role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  permission_key text NOT NULL,
  allowed boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_role_permissions_role_check CHECK (role IN ('direction','teacher')),
  CONSTRAINT school_role_permissions_unique UNIQUE (school_id, role, permission_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_role_permissions TO authenticated;
GRANT ALL ON public.school_role_permissions TO service_role;
ALTER TABLE public.school_role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros leem permissoes da escola" ON public.school_role_permissions;
CREATE POLICY "Membros leem permissoes da escola"
  ON public.school_role_permissions FOR SELECT TO authenticated
  USING (public.can_access_school(school_id));

DROP POLICY IF EXISTS "Admin gerencia permissoes da escola" ON public.school_role_permissions;
CREATE POLICY "Admin gerencia permissoes da escola"
  ON public.school_role_permissions FOR ALL TO authenticated
  USING (public.is_global_admin() OR public.has_school_role(school_id, ARRAY['admin']::app_role[]))
  WITH CHECK (public.is_global_admin() OR public.has_school_role(school_id, ARRAY['admin']::app_role[]));

DROP TRIGGER IF EXISTS trg_school_role_permissions_updated_at ON public.school_role_permissions;
CREATE TRIGGER trg_school_role_permissions_updated_at
  BEFORE UPDATE ON public.school_role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed idempotente dos padrões para uma escola
CREATE OR REPLACE FUNCTION public.seed_school_permissions(_school_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.school_role_permissions (school_id, role, permission_key, allowed)
  SELECT _school_id, d.role, d.permission_key, d.allowed
    FROM public.role_permission_defaults d
  ON CONFLICT (school_id, role, permission_key) DO NOTHING;
$$;

-- Backfill de todas as escolas existentes
DO $$
DECLARE s record;
BEGIN
  FOR s IN SELECT id FROM public.schools LOOP
    PERFORM public.seed_school_permissions(s.id);
  END LOOP;
END $$;

-- Novas escolas já nascem com os padrões
CREATE OR REPLACE FUNCTION public.seed_school_permissions_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_school_permissions(NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_seed_school_permissions ON public.schools;
CREATE TRIGGER trg_seed_school_permissions
  AFTER INSERT ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.seed_school_permissions_trigger();

-- ============================================================
-- 4) HELPERS DE AUTORIZAÇÃO
-- ============================================================
-- Papel escolar em QUALQUER escola (substitui checagens legadas globais)
CREATE OR REPLACE FUNCTION public.user_has_any_school_role(_roles app_role[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_global_admin() OR EXISTS (
    SELECT 1 FROM public.school_memberships m
     WHERE m.user_id = auth.uid() AND m.status = 'active' AND m.role = ANY(_roles)
  )
$$;

-- Verificação central de permissão por escola
CREATE OR REPLACE FUNCTION public.has_school_permission(_school_id uuid, _permission_key text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_role app_role; v_allowed boolean;
BEGIN
  IF public.is_global_admin() THEN RETURN true; END IF;
  IF _school_id IS NULL THEN RETURN false; END IF;

  SELECT m.role INTO v_role
    FROM public.school_memberships m
   WHERE m.user_id = auth.uid() AND m.school_id = _school_id AND m.status = 'active'
   LIMIT 1;

  IF v_role IS NULL THEN RETURN false; END IF;
  IF v_role = 'admin' THEN RETURN true; END IF;
  IF v_role NOT IN ('direction','teacher') THEN RETURN false; END IF;

  SELECT p.allowed INTO v_allowed
    FROM public.school_role_permissions p
   WHERE p.school_id = _school_id AND p.role = v_role AND p.permission_key = _permission_key;

  IF v_allowed IS NULL THEN
    SELECT d.allowed INTO v_allowed
      FROM public.role_permission_defaults d
     WHERE d.role = v_role AND d.permission_key = _permission_key;
  END IF;

  RETURN coalesce(v_allowed, false);
END $$;

-- ============================================================
-- 5) RPCs DE ADMINISTRAÇÃO
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_manage_school_permissions(_school_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_global_admin()
      OR (_school_id IS NOT NULL AND public.has_school_role(_school_id, ARRAY['admin']::app_role[]))
$$;

CREATE OR REPLACE FUNCTION public.admin_school_permissions(_school_id uuid)
RETURNS TABLE(role app_role, permission_key text, module text, label text,
              sort_order integer, allowed boolean, is_default boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT d.role, d.permission_key, d.module, d.label, d.sort_order,
         coalesce(p.allowed, d.allowed),
         p.allowed IS NULL
    FROM public.role_permission_defaults d
    LEFT JOIN public.school_role_permissions p
      ON p.school_id = _school_id AND p.role = d.role AND p.permission_key = d.permission_key
   WHERE public.can_manage_school_permissions(_school_id)
   ORDER BY d.role, d.module, d.sort_order
$$;

CREATE OR REPLACE FUNCTION public.admin_set_school_permission(
  _school_id uuid, _role app_role, _permission_key text, _allowed boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.can_manage_school_permissions(_school_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF _role NOT IN ('direction','teacher') THEN
    RAISE EXCEPTION 'Perfil nao configuravel';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.role_permission_defaults d
                  WHERE d.role = _role AND d.permission_key = _permission_key) THEN
    RAISE EXCEPTION 'Permissao desconhecida';
  END IF;

  INSERT INTO public.school_role_permissions (school_id, role, permission_key, allowed)
  VALUES (_school_id, _role, _permission_key, _allowed)
  ON CONFLICT (school_id, role, permission_key)
  DO UPDATE SET allowed = excluded.allowed, updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.admin_reset_school_permissions(_school_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.can_manage_school_permissions(_school_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  DELETE FROM public.school_role_permissions
   WHERE school_id = _school_id AND role = _role;
  PERFORM public.seed_school_permissions(_school_id);
END $$;

-- Permissões efetivas do usuário atual na escola informada
CREATE OR REPLACE FUNCTION public.my_school_permissions(_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_role app_role; v_map jsonb;
BEGIN
  IF public.is_global_admin() THEN
    SELECT jsonb_object_agg(d.permission_key, true) INTO v_map
      FROM public.role_permission_defaults d WHERE d.role = 'direction';
    RETURN jsonb_build_object('role', 'admin', 'permissions', coalesce(v_map, '{}'::jsonb));
  END IF;

  SELECT m.role INTO v_role FROM public.school_memberships m
   WHERE m.user_id = auth.uid() AND m.school_id = _school_id AND m.status = 'active' LIMIT 1;

  IF v_role IS NULL THEN
    RETURN jsonb_build_object('role', NULL, 'permissions', '{}'::jsonb);
  END IF;

  IF v_role NOT IN ('direction','teacher') THEN
    SELECT jsonb_object_agg(d.permission_key, v_role = 'admin') INTO v_map
      FROM public.role_permission_defaults d WHERE d.role = 'direction';
    RETURN jsonb_build_object('role', v_role, 'permissions', coalesce(v_map, '{}'::jsonb));
  END IF;

  SELECT jsonb_object_agg(d.permission_key, coalesce(p.allowed, d.allowed)) INTO v_map
    FROM public.role_permission_defaults d
    LEFT JOIN public.school_role_permissions p
      ON p.school_id = _school_id AND p.role = d.role AND p.permission_key = d.permission_key
   WHERE d.role = v_role;

  RETURN jsonb_build_object('role', v_role, 'permissions', coalesce(v_map, '{}'::jsonb));
END $$;

-- Aceite automático por escola
CREATE OR REPLACE FUNCTION public.admin_set_school_auto_approve(_school_id uuid, _enabled boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.can_manage_school_permissions(_school_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  UPDATE public.schools SET auto_approve_registration = _enabled, updated_at = now()
   WHERE id = _school_id;
  UPDATE public.school_registration_links SET auto_approve = _enabled, updated_at = now()
   WHERE school_id = _school_id;
END $$;

-- Escolas gerenciáveis pelo usuário (admin global => todas)
CREATE OR REPLACE FUNCTION public.my_manageable_schools()
RETURNS TABLE(school_id uuid, name text, auto_approve_registration boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.id, s.name, s.auto_approve_registration
    FROM public.schools s
   WHERE public.is_global_admin()
      OR public.has_school_role(s.id, ARRAY['admin']::app_role[])
   ORDER BY s.name
$$;

-- ============================================================
-- 6) LINK DE CADASTRO SEGUE A ESCOLA
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolve_registration_link(_token text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
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
    'auto_approve', s.auto_approve_registration);
END $$;

CREATE OR REPLACE FUNCTION public.join_school_with_token(_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE l public.school_registration_links; v_status text;
        v_existing public.school_memberships; v_auto boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF (public.resolve_registration_link(_token) ->> 'valid') <> 'true' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_token');
  END IF;
  SELECT * INTO l FROM public.school_registration_links WHERE token = _token;
  SELECT s.auto_approve_registration INTO v_auto FROM public.schools s WHERE s.id = l.school_id;
  v_status := CASE WHEN v_auto THEN 'active' ELSE 'pending' END;

  SELECT * INTO v_existing FROM public.school_memberships
   WHERE school_id = l.school_id AND user_id = auth.uid();
  IF v_existing.id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'status', v_existing.status,
      'already_member', true, 'school_id', l.school_id, 'role', v_existing.role);
  END IF;

  INSERT INTO public.school_memberships (school_id, user_id, role, status, invited_by, approved_at)
  VALUES (l.school_id, auth.uid(), l.default_role, v_status, l.created_by,
          CASE WHEN v_status = 'active' THEN now() ELSE NULL END);

  UPDATE public.school_registration_links SET use_count = use_count + 1 WHERE id = l.id;
  RETURN jsonb_build_object('ok', true, 'status', v_status, 'already_member', false,
    'school_id', l.school_id, 'role', l.default_role);
END $$;

-- Regeneração preserva a configuração da escola
CREATE OR REPLACE FUNCTION public.admin_regenerate_registration_link(_school_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_token text; v_auto boolean; v_role app_role;
BEGIN
  IF NOT public.can_manage_school_permissions(_school_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  SELECT auto_approve_registration INTO v_auto FROM public.schools WHERE id = _school_id;
  SELECT default_role INTO v_role FROM public.school_registration_links
   WHERE school_id = _school_id ORDER BY created_at DESC LIMIT 1;

  UPDATE public.school_registration_links
     SET active = false, revoked_at = now()
   WHERE school_id = _school_id AND active;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  INSERT INTO public.school_registration_links (school_id, token, created_by, auto_approve, default_role)
  VALUES (_school_id, v_token, auth.uid(), coalesce(v_auto, false), coalesce(v_role, 'teacher'::app_role));
  RETURN v_token;
END $$;

-- Criação de escola com aceite automático opcional
DROP FUNCTION IF EXISTS public.admin_create_school(text, text, text, text);
CREATE OR REPLACE FUNCTION public.admin_create_school(
  _name text, _city text DEFAULT NULL, _state text DEFAULT NULL,
  _code text DEFAULT NULL, _auto_approve boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
      v_code := 'ESCOLA-' || upper(substr(encode(extensions.gen_random_bytes(3), 'hex'), 1, 6));
    END LOOP;
  ELSIF EXISTS (SELECT 1 FROM public.schools WHERE code = v_code) THEN
    RAISE EXCEPTION 'Codigo ja utilizado por outra escola';
  END IF;

  INSERT INTO public.schools (name, slug, code, city, state, created_by, auto_approve_registration)
  VALUES (trim(_name), v_slug, v_code, NULLIF(trim(coalesce(_city,'')),''),
          NULLIF(trim(coalesce(_state,'')),''), auth.uid(), coalesce(_auto_approve, false))
  RETURNING id INTO v_id;

  INSERT INTO public.school_registration_links (school_id, token, created_by, auto_approve)
  VALUES (v_id, encode(extensions.gen_random_bytes(24), 'hex'), auth.uid(), coalesce(_auto_approve, false));

  RETURN v_id;
END $$;

-- Visão administrativa inclui a configuração de aceite
DROP FUNCTION IF EXISTS public.admin_school_overview();
CREATE OR REPLACE FUNCTION public.admin_school_overview()
RETURNS TABLE(school_id uuid, name text, slug text, code text, status text,
              city text, state text, member_count integer, pending_count integer,
              token text, auto_approve_registration boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.id, s.name, s.slug, s.code, s.status, s.city, s.state,
    (SELECT count(*)::int FROM public.school_memberships m WHERE m.school_id = s.id AND m.status = 'active'),
    (SELECT count(*)::int FROM public.school_memberships m WHERE m.school_id = s.id AND m.status = 'pending'),
    (SELECT l.token FROM public.school_registration_links l WHERE l.school_id = s.id AND l.active LIMIT 1),
    s.auto_approve_registration
    FROM public.schools s
   WHERE public.is_global_admin()
   ORDER BY s.name
$$;

-- ============================================================
-- 7) CID: papel escolar em vez de papel global legado
-- ============================================================
DROP POLICY IF EXISTS "Admin and direction can read cid cache" ON public.cid_lookup_cache;
CREATE POLICY "Admin and direction can read cid cache"
  ON public.cid_lookup_cache FOR SELECT TO authenticated
  USING (public.user_has_any_school_role(ARRAY['admin','direction']::app_role[]));

DROP POLICY IF EXISTS "Admin and direction can write cid cache" ON public.cid_lookup_cache;
CREATE POLICY "Admin and direction can write cid cache"
  ON public.cid_lookup_cache FOR INSERT TO authenticated
  WITH CHECK (public.user_has_any_school_role(ARRAY['admin','direction']::app_role[]));

DROP POLICY IF EXISTS "Admin and direction can update cid cache" ON public.cid_lookup_cache;
CREATE POLICY "Admin and direction can update cid cache"
  ON public.cid_lookup_cache FOR UPDATE TO authenticated
  USING (public.user_has_any_school_role(ARRAY['admin','direction']::app_role[]))
  WITH CHECK (public.user_has_any_school_role(ARRAY['admin','direction']::app_role[]));