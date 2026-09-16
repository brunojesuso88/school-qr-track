-- Autoria das ocorrências: preenche created_by automaticamente e permite que o
-- próprio autor edite seu registro, sem alterar dados acadêmicos existentes.
ALTER TABLE public.occurrences ALTER COLUMN created_by SET DEFAULT auth.uid();

-- Campos imutáveis em UPDATE (id, escola, aluno, autor, criação) + updated_at.
CREATE OR REPLACE FUNCTION public.occurrences_protect_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.id := OLD.id;
  NEW.school_id := OLD.school_id;
  NEW.student_id := OLD.student_id;
  NEW.created_by := OLD.created_by;
  NEW.created_at := OLD.created_at;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS occurrences_protect_immutable_trg ON public.occurrences;
CREATE TRIGGER occurrences_protect_immutable_trg
BEFORE UPDATE ON public.occurrences
FOR EACH ROW EXECUTE FUNCTION public.occurrences_protect_immutable();

-- Autor pode editar sua própria ocorrência (escola isolada por can_access_school).
DROP POLICY IF EXISTS "Autor edita suas ocorrencias" ON public.occurrences;
CREATE POLICY "Autor edita suas ocorrencias"
ON public.occurrences
FOR UPDATE
TO authenticated
USING (created_by = auth.uid() AND can_access_school(school_id))
WITH CHECK (created_by = auth.uid() AND can_access_school(school_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.occurrences TO authenticated;
GRANT ALL ON public.occurrences TO service_role;