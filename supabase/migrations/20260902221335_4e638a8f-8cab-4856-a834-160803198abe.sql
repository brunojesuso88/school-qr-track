CREATE OR REPLACE FUNCTION public.admin_create_school(_name text, _city text DEFAULT NULL::text, _state text DEFAULT NULL::text, _code text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  INSERT INTO public.schools (name, slug, code, city, state, created_by)
  VALUES (trim(_name), v_slug, v_code, NULLIF(trim(coalesce(_city,'')),''),
          NULLIF(trim(coalesce(_state,'')),''), auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO public.school_registration_links (school_id, token, created_by)
  VALUES (v_id, encode(extensions.gen_random_bytes(24), 'hex'), auth.uid());

  RETURN v_id;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_regenerate_registration_link(_school_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_token text;
BEGIN
  IF NOT public.is_global_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  UPDATE public.school_registration_links
     SET active = false, revoked_at = now()
   WHERE school_id = _school_id AND active;
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  INSERT INTO public.school_registration_links (school_id, token, created_by)
  VALUES (_school_id, v_token, auth.uid());
  RETURN v_token;
END $function$;