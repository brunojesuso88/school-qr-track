-- Remove a constraint atual que limita period_number a 1-6
ALTER TABLE teacher_availability 
DROP CONSTRAINT IF EXISTS teacher_availability_period_number_check;

-- Adiciona nova constraint permitindo valores 1-18 para suportar 3 turnos
ALTER TABLE teacher_availability 
ADD CONSTRAINT teacher_availability_period_number_check 
CHECK ((period_number >= 1) AND (period_number <= 18));