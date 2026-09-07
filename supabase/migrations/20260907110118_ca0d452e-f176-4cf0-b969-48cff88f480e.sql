-- 1) resolve_registration_link: expõe school_id (o token já identifica a escola publicamente)
CREATE OR REPLACE FUNCTION public.resolve_registration_link(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE l public.school_registration_links; s public.schools;
BEGIN
  SELECT * INTO l FROM public.school_registration_links WHERE token = _token;
  IF l.id IS NULL THEN RETURN jsonb_build_object('valid', false, 'reason', 'not_found'); END IF;
  IF NOT l.active OR l.revoked_at IS NOT NULL THEN RETURN jsonb_build_object('valid', false, 'reason', 'revoked'); END IF;
  IF l.expires_at IS NOT NULL AND l.expires_at < now() THEN RETURN jsonb_build_object('valid', false, 'reason', 'expired'); END IF;
  IF l.max_uses IS NOT NULL AND l.use_count >= l.max_uses THEN RETURN jsonb_build_object('valid', false, 'reason', 'exhausted'); END IF;
  SELECT * INTO s FROM public.schools WHERE id = l.school_id;
  IF s.status <> 'active' THEN RETURN jsonb_build_object('valid', false, 'reason', 'school_inactive'); END IF;
  RETURN jsonb_build_object('valid', true, 'school_id', s.id, 'school_name', s.name, 'city', s.city,
    'state', s.state, 'logo_path', s.logo_path, 'default_role', l.default_role,
    'auto_approve', s.auto_approve_registration);
END $function$;

-- 2) join_school_with_token: reabre vínculo inativo/recusado como pendente (sem duplicar, sem auto-aprovar)
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
    -- Vínculo encerrado pela gestão (inativo/recusado): reabre como PENDENTE.
    -- Nunca auto-aprova aqui — a gestão já tomou uma decisão explícita sobre este usuário.
    IF v_existing.status IN ('inactive', 'rejected') THEN
      UPDATE public.school_memberships
         SET status = 'pending',
             role = l.default_role,
             invited_by = l.created_by,
             approved_by = NULL,
             approved_at = NULL,
             updated_at = now()
       WHERE id = v_existing.id;
      UPDATE public.school_registration_links SET use_count = use_count + 1 WHERE id = l.id;
      RETURN jsonb_build_object('ok', true, 'status', 'pending',
        'already_member', false, 'reopened', true, 'previous_status', v_existing.status,
        'school_id', l.school_id, 'role', l.default_role,
        'requires_admin_approval', true,
        'second_school', v_other_active);
    END IF;

    -- Ativo ou já pendente: devolve o estado real, sem alterar nada.
    RETURN jsonb_build_object('ok', true, 'status', v_existing.status,
      'already_member', true, 'reopened', false, 'school_id', l.school_id, 'role', v_existing.role,
      'requires_admin_approval', v_existing.status <> 'active',
      'second_school', v_other_active);
  END IF;

  INSERT INTO public.school_memberships (school_id, user_id, role, status, invited_by, approved_at)
  VALUES (l.school_id, auth.uid(), l.default_role, v_status, l.created_by,
          CASE WHEN v_status = 'active' THEN now() ELSE NULL END);

  UPDATE public.school_registration_links SET use_count = use_count + 1 WHERE id = l.id;
  RETURN jsonb_build_object('ok', true, 'status', v_status, 'already_member', false, 'reopened', false,
    'school_id', l.school_id, 'role', l.default_role,
    'requires_admin_approval', v_status <> 'active',
    'second_school', v_other_active);
END $function$;