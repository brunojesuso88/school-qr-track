-- Add weekly_hours column to mapping_classes table
ALTER TABLE mapping_classes ADD COLUMN weekly_hours integer NOT NULL DEFAULT 30;

-- Update existing classes based on shift
UPDATE mapping_classes SET weekly_hours = 25 WHERE shift = 'evening';
UPDATE mapping_classes SET weekly_hours = 30 WHERE shift IN ('morning', 'afternoon');