-- Add end_date column for medical certificate date range
ALTER TABLE public.occurrences 
ADD COLUMN end_date date NULL;

-- Add teacher_name column to store who created the occurrence
ALTER TABLE public.occurrences 
ADD COLUMN teacher_name text NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.occurrences.end_date IS 'End date for date range occurrences like medical certificates';
COMMENT ON COLUMN public.occurrences.teacher_name IS 'Name of the teacher who registered the occurrence';