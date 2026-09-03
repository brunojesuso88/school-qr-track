CREATE OR REPLACE FUNCTION public.admin_delete_school(_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _school public.schools;
  _remaining integer;
  _members integer;
BEGIN
  IF NOT public.is_global_admin() THEN
    RAISE EXCEPTION 'Apenas o administrador global pode excluir escolas';
  END IF;

  SELECT * INTO _school FROM public.schools WHERE id = _school_id;
  IF _school.id IS NULL THEN
    RAISE EXCEPTION 'Escola não encontrada';
  END IF;

  SELECT count(*) INTO _remaining FROM public.schools WHERE id <> _school_id;
  IF _remaining = 0 THEN
    RAISE EXCEPTION 'Não é possível excluir a última escola do sistema';
  END IF;

  SELECT count(*) INTO _members FROM public.school_memberships WHERE school_id = _school_id;

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data)
  VALUES (
    auth.uid(),
    'DELETE_SCHOOL',
    'schools',
    _school_id,
    jsonb_build_object(
      'name', _school.name,
      'slug', _school.slug,
      'code', _school.code,
      'member_count', _members
    )
  );

  DELETE FROM public.schools WHERE id = _school_id;

  RETURN jsonb_build_object('ok', true, 'school_id', _school_id, 'members_unlinked', _members);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_school(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delete_school(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_school(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_school(uuid) TO service_role;