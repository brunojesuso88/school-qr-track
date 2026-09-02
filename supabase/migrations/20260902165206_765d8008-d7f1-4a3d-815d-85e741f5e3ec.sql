-- ============ FASE A: estrutura multi-escola + backfill ============

CREATE TABLE IF NOT EXISTS public.schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  city text,
  state text,
  logo_path text,
  hero_path text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schools TO authenticated;
GRANT ALL ON public.schools TO service_role;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.school_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','inactive','rejected')),
  invited_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_memberships TO authenticated;
GRANT ALL ON public.school_memberships TO service_role;
ALTER TABLE public.school_memberships ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS school_memberships_user_idx ON public.school_memberships(user_id, status);

CREATE TABLE IF NOT EXISTS public.school_registration_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  default_role app_role NOT NULL DEFAULT 'teacher',
  auto_approve boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  max_uses integer,
  use_count integer NOT NULL DEFAULT 0,
  revoked_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_registration_links TO authenticated;
GRANT ALL ON public.school_registration_links TO service_role;
ALTER TABLE public.school_registration_links ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS school_registration_links_one_active
  ON public.school_registration_links(school_id) WHERE active;

CREATE TRIGGER trg_schools_updated_at BEFORE UPDATE ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_school_memberships_updated_at BEFORE UPDATE ON public.school_memberships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_school_registration_links_updated_at BEFORE UPDATE ON public.school_registration_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ helpers ============
CREATE OR REPLACE FUNCTION public.is_global_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
$$;

CREATE OR REPLACE FUNCTION public.current_user_school_ids()
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(m.school_id), ARRAY[]::uuid[])
    FROM public.school_memberships m
   WHERE m.user_id = auth.uid() AND m.status = 'active'
$$;

CREATE OR REPLACE FUNCTION public.is_school_member(_school_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.school_memberships m
     WHERE m.user_id = auth.uid() AND m.school_id = _school_id AND m.status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.has_school_role(_school_id uuid, _roles app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.school_memberships m
     WHERE m.user_id = auth.uid() AND m.school_id = _school_id
       AND m.status = 'active' AND m.role = ANY(_roles)
  )
$$;

-- barreira de isolamento usada nas policies RESTRICTIVE (fase B)
CREATE OR REPLACE FUNCTION public.can_access_school(_school_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _school_id IS NOT NULL
     AND (public.is_global_admin() OR public.is_school_member(_school_id))
$$;

-- ============ escola atual + memberships legados ============
DO $$
DECLARE
  v_name text;
  v_school uuid;
BEGIN
  SELECT (value #>> '{}') INTO v_name FROM public.settings WHERE key = 'school_name';
  v_name := COALESCE(NULLIF(trim(v_name), ''), 'Escola Principal');

  SELECT id INTO v_school FROM public.schools WHERE code = 'ESCOLA-001';
  IF v_school IS NULL THEN
    INSERT INTO public.schools (name, slug, code, status, logo_path, hero_path)
    VALUES (
      v_name,
      'escola-principal',
      'ESCOLA-001',
      'active',
      (SELECT value #>> '{}' FROM public.settings WHERE key = 'school_logo_path'),
      (SELECT value #>> '{}' FROM public.settings WHERE key = 'school_hero_path')
    )
    RETURNING id INTO v_school;
  END IF;

  INSERT INTO public.school_registration_links (school_id, token, default_role, active)
  SELECT v_school, encode(gen_random_bytes(24), 'hex'), 'teacher', true
   WHERE NOT EXISTS (SELECT 1 FROM public.school_registration_links WHERE school_id = v_school AND active);

  -- todo usuário atual vira membro ativo da escola atual, com o papel atual
  INSERT INTO public.school_memberships (school_id, user_id, role, status, approved_at)
  SELECT v_school, ur.user_id, ur.role, 'active', now()
    FROM public.user_roles ur
  ON CONFLICT (school_id, user_id) DO NOTHING;
END $$;

-- ============ school_id em todas as tabelas escolares + backfill ============
DO $$
DECLARE
  t text;
  v_school uuid;
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
  SELECT id INTO v_school FROM public.schools WHERE code = 'ESCOLA-001';

  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE', t);
    EXECUTE format('UPDATE public.%I SET school_id = %L WHERE school_id IS NULL', t, v_school);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(school_id)', t || '_school_id_idx', t);
  END LOOP;

  -- tabelas que já possuíam school_id
  UPDATE public.notifications SET school_id = v_school WHERE school_id IS NULL;
  UPDATE public.push_subscriptions p SET school_id = v_school
   WHERE p.school_id IS NULL
     AND (SELECT count(*) FROM public.school_memberships m WHERE m.user_id = p.user_id AND m.status='active') = 1;
END $$;
