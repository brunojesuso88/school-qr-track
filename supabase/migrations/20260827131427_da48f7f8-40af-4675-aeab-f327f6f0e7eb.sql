-- Professores podem CADASTRAR atestados (sem editar, cancelar ou ler detalhes)
GRANT INSERT ON public.student_medical_certificates TO authenticated;

CREATE POLICY "Teachers can insert certificates"
ON public.student_medical_certificates
FOR INSERT
TO authenticated
WITH CHECK (
  public.current_user_has_role('teacher'::app_role)
  AND created_by = auth.uid()
  AND status_manual = 'active'
  AND cancelled_reason IS NULL
  AND cancelled_by IS NULL
  AND cancelled_at IS NULL
);

-- Upload de anexo pelo professor (somente INSERT; sem SELECT/UPDATE/DELETE)
CREATE POLICY "Teachers can upload medical certificates files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'medical-certificates'
  AND public.current_user_has_role('teacher'::app_role)
);