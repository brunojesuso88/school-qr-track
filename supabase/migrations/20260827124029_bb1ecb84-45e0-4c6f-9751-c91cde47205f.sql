-- 1. Tabela principal
CREATE TABLE public.student_medical_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  cid_code text,
  cid_description text,
  cid_source text,
  notes text,
  issuer text,
  attachment_path text,
  status_manual text NOT NULL DEFAULT 'active',
  cancelled_reason text,
  cancelled_by uuid,
  cancelled_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT smc_dates_valid CHECK (end_date >= start_date),
  CONSTRAINT smc_status_valid CHECK (status_manual IN ('active','cancelled')),
  CONSTRAINT smc_cid_source_valid CHECK (cid_source IS NULL OR cid_source IN ('catalog','ai','manual')),
  CONSTRAINT smc_notes_len CHECK (notes IS NULL OR char_length(notes) <= 500),
  CONSTRAINT smc_issuer_len CHECK (issuer IS NULL OR char_length(issuer) <= 200),
  CONSTRAINT smc_cid_code_len CHECK (cid_code IS NULL OR char_length(cid_code) <= 10)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_medical_certificates TO authenticated;
GRANT ALL ON public.student_medical_certificates TO service_role;

ALTER TABLE public.student_medical_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and direction can view certificates"
  ON public.student_medical_certificates FOR SELECT TO authenticated
  USING (public.user_has_any_role(ARRAY['admin','direction']::app_role[]));

CREATE POLICY "Admin and direction can insert certificates"
  ON public.student_medical_certificates FOR INSERT TO authenticated
  WITH CHECK (public.user_has_any_role(ARRAY['admin','direction']::app_role[]));

CREATE POLICY "Admin and direction can update certificates"
  ON public.student_medical_certificates FOR UPDATE TO authenticated
  USING (public.user_has_any_role(ARRAY['admin','direction']::app_role[]))
  WITH CHECK (public.user_has_any_role(ARRAY['admin','direction']::app_role[]));

CREATE POLICY "Admin and direction can delete certificates"
  ON public.student_medical_certificates FOR DELETE TO authenticated
  USING (public.user_has_any_role(ARRAY['admin','direction']::app_role[]));

-- Índices
CREATE INDEX idx_smc_student_start ON public.student_medical_certificates (student_id, start_date DESC);
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE INDEX idx_smc_active_range ON public.student_medical_certificates
  USING gist (student_id, daterange(start_date, end_date, '[]'))
  WHERE status_manual = 'active';
CREATE INDEX idx_smc_active ON public.student_medical_certificates (student_id)
  WHERE status_manual = 'active';

CREATE TRIGGER trg_smc_updated_at
  BEFORE UPDATE ON public.student_medical_certificates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER audit_smc_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.student_medical_certificates
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 2. Bloqueio de sobreposição no banco
CREATE OR REPLACE FUNCTION public.prevent_certificate_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status_manual <> 'active' THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.student_medical_certificates c
     WHERE c.student_id = NEW.student_id
       AND c.id <> NEW.id
       AND c.status_manual = 'active'
       AND daterange(c.start_date, c.end_date, '[]')
           && daterange(NEW.start_date, NEW.end_date, '[]')
  ) THEN
    RAISE EXCEPTION 'Já existe um atestado ativo que abrange parte desse período. Edite ou cancele o registro existente.'
      USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_smc_prevent_overlap
  BEFORE INSERT OR UPDATE ON public.student_medical_certificates
  FOR EACH ROW EXECUTE FUNCTION public.prevent_certificate_overlap();

-- 3. Cobertura segura (sem CID) para professor/staff/admin
CREATE OR REPLACE FUNCTION public.get_certificate_coverage(
  _student_ids uuid[],
  _start_date date,
  _end_date date
)
RETURNS TABLE(student_id uuid, start_date date, end_date date, status text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.student_id, c.start_date, c.end_date, c.status_manual
    FROM public.student_medical_certificates c
   WHERE c.status_manual = 'active'
     AND c.student_id = ANY(_student_ids)
     AND daterange(c.start_date, c.end_date, '[]')
         && daterange(_start_date, _end_date, '[]')
     AND public.user_has_any_role(ARRAY['admin','direction','teacher','staff']::app_role[]);
$$;

REVOKE ALL ON FUNCTION public.get_certificate_coverage(uuid[], date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_certificate_coverage(uuid[], date, date) TO authenticated;

-- Cobertura de hoje para toda a escola (badge em lote)
CREATE OR REPLACE FUNCTION public.get_active_certificate_students(_on_date date)
RETURNS TABLE(student_id uuid, start_date date, end_date date)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.student_id, c.start_date, c.end_date
    FROM public.student_medical_certificates c
   WHERE c.status_manual = 'active'
     AND _on_date BETWEEN c.start_date AND c.end_date
     AND public.user_has_any_role(ARRAY['admin','direction','teacher','staff']::app_role[]);
$$;

REVOKE ALL ON FUNCTION public.get_active_certificate_students(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_certificate_students(date) TO authenticated;

-- 4. Cache de CID (sem vínculo com aluno)
CREATE TABLE public.cid_lookup_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  simple_explanation text,
  source text NOT NULL DEFAULT 'ai',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cid_cache_source_valid CHECK (source IN ('catalog','ai','manual'))
);

GRANT SELECT, INSERT, UPDATE ON public.cid_lookup_cache TO authenticated;
GRANT ALL ON public.cid_lookup_cache TO service_role;

ALTER TABLE public.cid_lookup_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read cid cache"
  ON public.cid_lookup_cache FOR SELECT TO authenticated
  USING (public.user_has_any_role(ARRAY['admin','direction','teacher','staff']::app_role[]));

CREATE POLICY "Admin and direction can write cid cache"
  ON public.cid_lookup_cache FOR INSERT TO authenticated
  WITH CHECK (public.user_has_any_role(ARRAY['admin','direction']::app_role[]));

CREATE POLICY "Admin and direction can update cid cache"
  ON public.cid_lookup_cache FOR UPDATE TO authenticated
  USING (public.user_has_any_role(ARRAY['admin','direction']::app_role[]))
  WITH CHECK (public.user_has_any_role(ARRAY['admin','direction']::app_role[]));

CREATE TRIGGER trg_cid_cache_updated_at
  BEFORE UPDATE ON public.cid_lookup_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Policies de storage para o bucket privado de atestados
CREATE POLICY "Admin direction can read medical certificates files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'medical-certificates' AND public.user_has_any_role(ARRAY['admin','direction']::app_role[]));

CREATE POLICY "Admin direction can upload medical certificates files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'medical-certificates' AND public.user_has_any_role(ARRAY['admin','direction']::app_role[]));

CREATE POLICY "Admin direction can update medical certificates files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'medical-certificates' AND public.user_has_any_role(ARRAY['admin','direction']::app_role[]));

CREATE POLICY "Admin direction can delete medical certificates files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'medical-certificates' AND public.user_has_any_role(ARRAY['admin','direction']::app_role[]));
