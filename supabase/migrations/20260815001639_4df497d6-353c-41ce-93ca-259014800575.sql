-- 1) Professor não pode excluir alunos nem turmas
DROP POLICY IF EXISTS "Admin direction and teachers can delete students" ON public.students;
CREATE POLICY "Only admin and direction can delete students"
ON public.students FOR DELETE TO authenticated
USING (public.user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role]));

DROP POLICY IF EXISTS "Admin direction and teachers can delete classes" ON public.classes;
CREATE POLICY "Only admin and direction can delete classes"
ON public.classes FOR DELETE TO authenticated
USING (public.user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role]));

-- 2) Dados cadastrais vindos do boletim
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS school_code text,
  ADD COLUMN IF NOT EXISTS mother_name text,
  ADD COLUMN IF NOT EXISTS father_name text;

COMMENT ON COLUMN public.students.school_code IS 'Código (código escolar/SIAEP do boletim). Não é matrícula (student_id).';

-- 3) Somente admin/direction podem alterar os campos cadastrais vindos do boletim
CREATE OR REPLACE FUNCTION public.restrict_report_card_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.user_has_any_role(ARRAY['admin'::app_role,'direction'::app_role]) THEN
    IF NEW.school_code IS DISTINCT FROM OLD.school_code
       OR NEW.mother_name IS DISTINCT FROM OLD.mother_name
       OR NEW.father_name IS DISTINCT FROM OLD.father_name
       OR NEW.birth_date IS DISTINCT FROM OLD.birth_date THEN
      RAISE EXCEPTION 'Apenas administração e direção podem alterar Código, filiação e data de nascimento';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_report_card_fields ON public.students;
CREATE TRIGGER trg_restrict_report_card_fields
BEFORE UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.restrict_report_card_fields();