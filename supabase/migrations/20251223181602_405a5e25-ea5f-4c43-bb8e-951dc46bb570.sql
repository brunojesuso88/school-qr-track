-- Fix 1: Restrict notification_logs to admin-only access
DROP POLICY IF EXISTS "Authenticated users can view notification logs" ON public.notification_logs;
DROP POLICY IF EXISTS "Authenticated users can insert notification logs" ON public.notification_logs;

-- Admin-only SELECT policy for notification logs
CREATE POLICY "Admin-only notification logs select"
  ON public.notification_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admin-only INSERT policy for notification logs  
CREATE POLICY "Admin-only notification logs insert"
  ON public.notification_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Fix 2: Make student-photos bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'student-photos';

-- Drop the public view policy for student photos
DROP POLICY IF EXISTS "Anyone can view student photos" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;

-- Create authenticated-only policy for viewing student photos
CREATE POLICY "Authenticated users can view student photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'student-photos' AND
  auth.uid() IS NOT NULL
);

-- Ensure authenticated users can still upload student photos
DROP POLICY IF EXISTS "Authenticated users can upload student photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload student photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'student-photos' AND
  auth.uid() IS NOT NULL
);

-- Ensure authenticated users can update their uploads
DROP POLICY IF EXISTS "Authenticated users can update student photos" ON storage.objects;
CREATE POLICY "Authenticated users can update student photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'student-photos' AND auth.uid() IS NOT NULL);

-- Ensure authenticated users can delete student photos
DROP POLICY IF EXISTS "Authenticated users can delete student photos" ON storage.objects;
CREATE POLICY "Authenticated users can delete student photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'student-photos' AND auth.uid() IS NOT NULL);