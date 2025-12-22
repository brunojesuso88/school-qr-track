-- Create classes table
CREATE TABLE public.classes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  shift TEXT NOT NULL DEFAULT 'morning',
  description TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- Allow public read access (since no login required)
CREATE POLICY "Anyone can view classes" 
ON public.classes 
FOR SELECT 
USING (true);

-- Allow public insert access
CREATE POLICY "Anyone can insert classes" 
ON public.classes 
FOR INSERT 
WITH CHECK (true);

-- Allow public update access
CREATE POLICY "Anyone can update classes" 
ON public.classes 
FOR UPDATE 
USING (true);

-- Allow public delete access
CREATE POLICY "Anyone can delete classes" 
ON public.classes 
FOR DELETE 
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_classes_updated_at
BEFORE UPDATE ON public.classes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();