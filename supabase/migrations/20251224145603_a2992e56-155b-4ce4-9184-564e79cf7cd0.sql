-- 1. Adicionar política DELETE na tabela attendance
CREATE POLICY "Staff can delete attendance"
ON public.attendance
FOR DELETE
USING (
  current_user_has_role('admin'::app_role) OR 
  current_user_has_role('direction'::app_role) OR 
  current_user_has_role('teacher'::app_role) OR 
  current_user_has_role('staff'::app_role)
);

-- 2. Criar função para validar que presença não pode ser registrada em finais de semana
CREATE OR REPLACE FUNCTION public.validate_attendance_weekday()
RETURNS TRIGGER AS $$
BEGIN
  IF EXTRACT(DOW FROM NEW.date) IN (0, 6) THEN
    RAISE EXCEPTION 'Não é permitido registrar presenças nos finais de semana (sábado e domingo)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Criar trigger para validar dia da semana antes de inserir presença
CREATE TRIGGER check_weekday_before_attendance_insert
  BEFORE INSERT ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.validate_attendance_weekday();