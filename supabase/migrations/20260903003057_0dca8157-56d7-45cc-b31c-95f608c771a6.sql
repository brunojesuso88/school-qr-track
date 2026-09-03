-- 1) Segundo vínculo sempre pendente
CREATE OR REPLACE FUNCTION public.join_school_with_token(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE l public.school_registration_links; v_status text;
        v_existing public.school_memberships; v_auto boolean;
        v_other_active boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF (public.resolve_registration_link(_token) ->> 'valid') <> 'true' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_token');
  END IF;
  SELECT * INTO l FROM public.school_registration_links WHERE token = _token;
  SELECT s.auto_approve_registration INTO v_auto FROM public.schools s WHERE s.id = l.school_id;

  -- Aceite automático nunca vale para perfis privilegiados.
  IF l.default_role IN ('admin'::app_role, 'direction'::app_role) THEN
    v_auto := false;
  END IF;

  -- Usuário único de uma escola por padrão: segundo vínculo exige aprovação.
  SELECT EXISTS (
    SELECT 1 FROM public.school_memberships m
     WHERE m.user_id = auth.uid() AND m.status = 'active' AND m.school_id <> l.school_id
  ) INTO v_other_active;
  IF v_other_active THEN v_auto := false; END IF;

  v_status := CASE WHEN v_auto THEN 'active' ELSE 'pending' END;

  SELECT * INTO v_existing FROM public.school_memberships
   WHERE school_id = l.school_id AND user_id = auth.uid();
  IF v_existing.id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'status', v_existing.status,
      'already_member', true, 'school_id', l.school_id, 'role', v_existing.role,
      'requires_admin_approval', v_existing.status <> 'active',
      'second_school', v_other_active);
  END IF;

  INSERT INTO public.school_memberships (school_id, user_id, role, status, invited_by, approved_at)
  VALUES (l.school_id, auth.uid(), l.default_role, v_status, l.created_by,
          CASE WHEN v_status = 'active' THEN now() ELSE NULL END);

  UPDATE public.school_registration_links SET use_count = use_count + 1 WHERE id = l.id;
  RETURN jsonb_build_object('ok', true, 'status', v_status, 'already_member', false,
    'school_id', l.school_id, 'role', l.default_role,
    'requires_admin_approval', v_status <> 'active',
    'second_school', v_other_active);
END $function$;

-- 2) Branding institucional legível por qualquer membro (sem abrir settings)
CREATE OR REPLACE FUNCTION public.get_school_branding(_school_id uuid)
 RETURNS TABLE(school_name text, hero_path text, logo_path text)
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF _school_id IS NULL THEN RETURN; END IF;
  IF NOT (public.is_global_admin() OR public.can_access_school(_school_id)) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH s AS (SELECT name FROM public.schools WHERE id = _school_id),
  cfg AS (
    SELECT key, trim(both '"' from value::text) AS val
      FROM public.settings
     WHERE school_id = _school_id
       AND key IN ('school_name', 'school_hero_path', 'school_logo_path')
  )
  SELECT
    COALESCE(NULLIF((SELECT name FROM s), ''),
             NULLIF((SELECT val FROM cfg WHERE key = 'school_name'), ''), '')::text,
    COALESCE((SELECT val FROM cfg WHERE key = 'school_hero_path'), '')::text,
    COALESCE((SELECT val FROM cfg WHERE key = 'school_logo_path'), '')::text;
END $function$;

REVOKE ALL ON FUNCTION public.get_school_branding(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_school_branding(uuid) TO authenticated;

-- 3) Renomear escola (nome canônico + sincronização de documentos)
CREATE OR REPLACE FUNCTION public.admin_rename_school(_school_id uuid, _name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_name text := btrim(_name);
BEGIN
  IF NOT (public.is_global_admin() OR public.has_school_role(_school_id, ARRAY['admin']::app_role[])) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF v_name IS NULL OR char_length(v_name) < 3 OR char_length(v_name) > 150 THEN
    RAISE EXCEPTION 'Nome da escola deve ter entre 3 e 150 caracteres';
  END IF;

  UPDATE public.schools SET name = v_name, updated_at = now() WHERE id = _school_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Escola não encontrada'; END IF;

  INSERT INTO public.settings (school_id, key, value, updated_at)
  VALUES (_school_id, 'school_name', to_jsonb(v_name), now())
  ON CONFLICT (school_id, key) DO UPDATE SET value = to_jsonb(v_name), updated_at = now();
END $function$;

REVOKE ALL ON FUNCTION public.admin_rename_school(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_rename_school(uuid, text) TO authenticated;