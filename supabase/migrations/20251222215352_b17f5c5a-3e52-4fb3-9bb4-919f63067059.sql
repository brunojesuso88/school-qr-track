-- Add has_medical_report column to students table
ALTER TABLE public.students ADD COLUMN has_medical_report boolean NOT NULL DEFAULT false;