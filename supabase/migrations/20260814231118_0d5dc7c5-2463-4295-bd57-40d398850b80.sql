-- 1. Vínculo opcional turma <-> mapeamento escolar
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS mapping_class_id uuid REFERENCES public.mapping_classes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_classes_mapping_class_id ON public.classes(mapping_class_id);

-- 2. Importações de boletim
CREATE TABLE public.grade_imports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  school_year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now())::int,
  file_name text,
  status text NOT NULL DEFAULT 'confirmed',
  conflict_strategy text NOT NULL DEFAULT 'keep',
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT grade_imports_status_check CHECK (status IN ('pending_review','confirmed','cancelled')),
  CONSTRAINT grade_imports_conflict_check CHECK (conflict_strategy IN ('keep','overwrite'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.grade_imports TO authenticated;
GRANT ALL ON public.grade_imports TO service_role;
ALTER TABLE public.grade_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin e direcao gerenciam importacoes de boletim"
  ON public.grade_imports FOR ALL TO authenticated
  USING (public.user_has_any_role(ARRAY['admin','direction']::app_role[]))
  WITH CHECK (public.user_has_any_role(ARRAY['admin','direction']::app_role[]));

CREATE POLICY "Equipe visualiza importacoes de boletim"
  ON public.grade_imports FOR SELECT TO authenticated
  USING (public.user_has_any_role(ARRAY['admin','direction','teacher','staff']::app_role[]));

CREATE TRIGGER trg_grade_imports_updated_at
  BEFORE UPDATE ON public.grade_imports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER audit_grade_imports_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.grade_imports
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 3. Disciplinas do boletim
CREATE TABLE public.grade_subjects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name text NOT NULL,
  normalized_name text NOT NULL,
  mapping_class_subject_id uuid REFERENCES public.mapping_class_subjects(id) ON DELETE SET NULL,
  weekly_classes integer,
  include_in_ira boolean NOT NULL DEFAULT false,
  custom_ira_weight numeric(5,2),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT grade_subjects_unique_per_class UNIQUE (class_id, normalized_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.grade_subjects TO authenticated;
GRANT ALL ON public.grade_subjects TO service_role;
ALTER TABLE public.grade_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin e direcao gerenciam disciplinas do boletim"
  ON public.grade_subjects FOR ALL TO authenticated
  USING (public.user_has_any_role(ARRAY['admin','direction']::app_role[]))
  WITH CHECK (public.user_has_any_role(ARRAY['admin','direction']::app_role[]));

CREATE POLICY "Equipe visualiza disciplinas do boletim"
  ON public.grade_subjects FOR SELECT TO authenticated
  USING (public.user_has_any_role(ARRAY['admin','direction','teacher','staff']::app_role[]));

CREATE TRIGGER trg_grade_subjects_updated_at
  BEFORE UPDATE ON public.grade_subjects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Períodos do boletim
CREATE TABLE public.grade_periods (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  label text NOT NULL,
  normalized_label text NOT NULL,
  kind text NOT NULL DEFAULT 'period',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT grade_periods_kind_check CHECK (kind IN ('period','final','unknown')),
  CONSTRAINT grade_periods_unique_per_class UNIQUE (class_id, normalized_label)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.grade_periods TO authenticated;
GRANT ALL ON public.grade_periods TO service_role;
ALTER TABLE public.grade_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin e direcao gerenciam periodos do boletim"
  ON public.grade_periods FOR ALL TO authenticated
  USING (public.user_has_any_role(ARRAY['admin','direction']::app_role[]))
  WITH CHECK (public.user_has_any_role(ARRAY['admin','direction']::app_role[]));

CREATE POLICY "Equipe visualiza periodos do boletim"
  ON public.grade_periods FOR SELECT TO authenticated
  USING (public.user_has_any_role(ARRAY['admin','direction','teacher','staff']::app_role[]));

CREATE TRIGGER trg_grade_periods_updated_at
  BEFORE UPDATE ON public.grade_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Notas dos alunos
CREATE TABLE public.student_grades (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  grade_subject_id uuid NOT NULL REFERENCES public.grade_subjects(id) ON DELETE CASCADE,
  grade_period_id uuid NOT NULL REFERENCES public.grade_periods(id) ON DELETE CASCADE,
  value numeric(6,2),
  raw_text text,
  confidence numeric(4,3),
  flags text[] NOT NULL DEFAULT ARRAY[]::text[],
  source text NOT NULL DEFAULT 'import',
  import_id uuid REFERENCES public.grade_imports(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT student_grades_source_check CHECK (source IN ('import','manual')),
  CONSTRAINT student_grades_unique_cell UNIQUE (student_id, grade_subject_id, grade_period_id)
);

CREATE INDEX idx_student_grades_student ON public.student_grades(student_id);
CREATE INDEX idx_student_grades_subject ON public.student_grades(grade_subject_id);
CREATE INDEX idx_student_grades_import ON public.student_grades(import_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_grades TO authenticated;
GRANT ALL ON public.student_grades TO service_role;
ALTER TABLE public.student_grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin e direcao gerenciam notas"
  ON public.student_grades FOR ALL TO authenticated
  USING (public.user_has_any_role(ARRAY['admin','direction']::app_role[]))
  WITH CHECK (public.user_has_any_role(ARRAY['admin','direction']::app_role[]));

CREATE POLICY "Equipe visualiza notas"
  ON public.student_grades FOR SELECT TO authenticated
  USING (public.user_has_any_role(ARRAY['admin','direction','teacher','staff']::app_role[]));

CREATE TRIGGER trg_student_grades_updated_at
  BEFORE UPDATE ON public.student_grades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER audit_student_grades_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.student_grades
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 6. Configuração do IRA por turma
CREATE TABLE public.ira_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  ira_period_id uuid REFERENCES public.grade_periods(id) ON DELETE SET NULL,
  use_final_grade boolean NOT NULL DEFAULT false,
  scale_max numeric(5,2) NOT NULL DEFAULT 10,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ira_settings_unique_class UNIQUE (class_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ira_settings TO authenticated;
GRANT ALL ON public.ira_settings TO service_role;
ALTER TABLE public.ira_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin e direcao gerenciam configuracao do IRA"
  ON public.ira_settings FOR ALL TO authenticated
  USING (public.user_has_any_role(ARRAY['admin','direction']::app_role[]))
  WITH CHECK (public.user_has_any_role(ARRAY['admin','direction']::app_role[]));

CREATE POLICY "Equipe visualiza configuracao do IRA"
  ON public.ira_settings FOR SELECT TO authenticated
  USING (public.user_has_any_role(ARRAY['admin','direction','teacher','staff']::app_role[]));

CREATE TRIGGER trg_ira_settings_updated_at
  BEFORE UPDATE ON public.ira_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();