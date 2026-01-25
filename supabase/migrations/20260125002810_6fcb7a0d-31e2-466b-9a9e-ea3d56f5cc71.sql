-- Adicionar novos campos à tabela students
ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS aee_laudo_attachment_url TEXT,
ADD COLUMN IF NOT EXISTS aee_adaptation_suggestions TEXT;

-- Criar bucket para documentos de laudo
INSERT INTO storage.buckets (id, name, public)
VALUES ('aee-documents', 'aee-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS para upload de documentos AEE
CREATE POLICY "Admin/Direction/Teachers can upload AEE documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'aee-documents' 
  AND user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role, 'teacher'::app_role])
);

-- RLS para visualizar documentos AEE
CREATE POLICY "Staff can view AEE documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'aee-documents' 
  AND user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role, 'teacher'::app_role, 'staff'::app_role])
);

-- RLS para deletar documentos AEE
CREATE POLICY "Admin/Direction/Teachers can delete AEE documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'aee-documents' 
  AND user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role, 'teacher'::app_role])
);

-- RLS para atualizar documentos AEE
CREATE POLICY "Admin/Direction/Teachers can update AEE documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'aee-documents' 
  AND user_has_any_role(ARRAY['admin'::app_role, 'direction'::app_role, 'teacher'::app_role])
);