-- Add birth_date column to students table
ALTER TABLE public.students ADD COLUMN birth_date date;

-- Create occurrences table for student records
CREATE TABLE public.occurrences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.occurrences ENABLE ROW LEVEL SECURITY;

-- RLS policies for occurrences
CREATE POLICY "Anyone can view occurrences" ON public.occurrences FOR SELECT USING (true);
CREATE POLICY "Anyone can insert occurrences" ON public.occurrences FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update occurrences" ON public.occurrences FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete occurrences" ON public.occurrences FOR DELETE USING (true);