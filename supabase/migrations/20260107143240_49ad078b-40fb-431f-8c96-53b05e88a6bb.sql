-- 1. Add input validation constraints to students table
ALTER TABLE public.students 
ADD CONSTRAINT students_full_name_length CHECK (char_length(full_name) >= 3 AND char_length(full_name) <= 100),
ADD CONSTRAINT students_guardian_name_length CHECK (char_length(guardian_name) >= 3 AND char_length(guardian_name) <= 100),
ADD CONSTRAINT students_guardian_phone_format CHECK (guardian_phone ~ '^\d{10,11}$'),
ADD CONSTRAINT students_medical_report_details_length CHECK (medical_report_details IS NULL OR char_length(medical_report_details) <= 1000);

-- 2. Add input validation constraints to occurrences table  
ALTER TABLE public.occurrences
ADD CONSTRAINT occurrences_type_not_empty CHECK (char_length(type) >= 1),
ADD CONSTRAINT occurrences_description_length CHECK (description IS NULL OR char_length(description) <= 1000);

-- 3. Make student-photos bucket private
UPDATE storage.buckets SET public = false WHERE id = 'student-photos';

-- 4. Drop existing storage policies for student-photos if they exist
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view student photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload student photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update student photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete student photos" ON storage.objects;
DROP POLICY IF EXISTS "Staff can view student photos" ON storage.objects;
DROP POLICY IF EXISTS "Staff can upload student photos" ON storage.objects;
DROP POLICY IF EXISTS "Staff can update student photos" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete student photos" ON storage.objects;

-- 5. Create RLS policies for student-photos bucket (staff only access)
CREATE POLICY "Staff can view student photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'student-photos' 
  AND public.user_has_any_role(ARRAY['admin'::public.app_role, 'direction'::public.app_role, 'teacher'::public.app_role, 'staff'::public.app_role])
);

CREATE POLICY "Staff can upload student photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'student-photos' 
  AND public.user_has_any_role(ARRAY['admin'::public.app_role, 'direction'::public.app_role, 'teacher'::public.app_role, 'staff'::public.app_role])
);

CREATE POLICY "Staff can update student photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'student-photos' 
  AND public.user_has_any_role(ARRAY['admin'::public.app_role, 'direction'::public.app_role, 'teacher'::public.app_role, 'staff'::public.app_role])
);

CREATE POLICY "Staff can delete student photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'student-photos' 
  AND public.user_has_any_role(ARRAY['admin'::public.app_role, 'direction'::public.app_role, 'teacher'::public.app_role])
);