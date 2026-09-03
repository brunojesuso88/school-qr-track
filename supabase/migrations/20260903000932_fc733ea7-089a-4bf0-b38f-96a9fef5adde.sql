CREATE OR REPLACE FUNCTION public.join_school_with_token(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE l public.school_registration_links; v_status text;
        v_existing public.school_memberships; v_auto boolean;
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
END $function$;