
-- Tabela de professores do mapeamento
CREATE TABLE public.mapping_teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  subjects TEXT[] DEFAULT '{}',
  max_weekly_hours INTEGER NOT NULL DEFAULT 20,
  current_hours INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL,
  availability TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de disciplinas globais
CREATE TABLE public.mapping_global_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  default_weekly_classes INTEGER NOT NULL DEFAULT 4,
  shift TEXT NOT NULL DEFAULT 'morning',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de turmas do mapeamento
CREATE TABLE public.mapping_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  shift TEXT NOT NULL DEFAULT 'morning',
  student_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de disciplinas por turma
CREATE TABLE public.mapping_class_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES public.mapping_classes(id) ON DELETE CASCADE,
  subject_name TEXT NOT NULL,
  weekly_classes INTEGER NOT NULL DEFAULT 4,
  teacher_id UUID REFERENCES public.mapping_teachers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.mapping_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mapping_global_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mapping_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mapping_class_subjects ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para mapping_teachers
CREATE POLICY "Admin and direction can select mapping_teachers"
ON public.mapping_teachers FOR SELECT
USING (user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role]));

CREATE POLICY "Admin and direction can insert mapping_teachers"
ON public.mapping_teachers FOR INSERT
WITH CHECK (user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role]));

CREATE POLICY "Admin and direction can update mapping_teachers"
ON public.mapping_teachers FOR UPDATE
USING (user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role]));

CREATE POLICY "Admin and direction can delete mapping_teachers"
ON public.mapping_teachers FOR DELETE
USING (user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role]));

-- Políticas RLS para mapping_global_subjects
CREATE POLICY "Admin and direction can select mapping_global_subjects"
ON public.mapping_global_subjects FOR SELECT
USING (user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role]));

CREATE POLICY "Admin and direction can insert mapping_global_subjects"
ON public.mapping_global_subjects FOR INSERT
WITH CHECK (user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role]));

CREATE POLICY "Admin and direction can update mapping_global_subjects"
ON public.mapping_global_subjects FOR UPDATE
USING (user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role]));

CREATE POLICY "Admin and direction can delete mapping_global_subjects"
ON public.mapping_global_subjects FOR DELETE
USING (user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role]));

-- Políticas RLS para mapping_classes
CREATE POLICY "Admin and direction can select mapping_classes"
ON public.mapping_classes FOR SELECT
USING (user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role]));

CREATE POLICY "Admin and direction can insert mapping_classes"
ON public.mapping_classes FOR INSERT
WITH CHECK (user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role]));

CREATE POLICY "Admin and direction can update mapping_classes"
ON public.mapping_classes FOR UPDATE
USING (user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role]));

CREATE POLICY "Admin and direction can delete mapping_classes"
ON public.mapping_classes FOR DELETE
USING (user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role]));

-- Políticas RLS para mapping_class_subjects
CREATE POLICY "Admin and direction can select mapping_class_subjects"
ON public.mapping_class_subjects FOR SELECT
USING (user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role]));

CREATE POLICY "Admin and direction can insert mapping_class_subjects"
ON public.mapping_class_subjects FOR INSERT
WITH CHECK (user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role]));

CREATE POLICY "Admin and direction can update mapping_class_subjects"
ON public.mapping_class_subjects FOR UPDATE
USING (user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role]));

CREATE POLICY "Admin and direction can delete mapping_class_subjects"
ON public.mapping_class_subjects FOR DELETE
USING (user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role]));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_mapping_teachers_updated_at
BEFORE UPDATE ON public.mapping_teachers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mapping_classes_updated_at
BEFORE UPDATE ON public.mapping_classes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
