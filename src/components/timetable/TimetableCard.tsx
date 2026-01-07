import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { Lock, GripVertical } from 'lucide-react';
import { TimetableEntry } from '@/contexts/TimetableContext';

interface TimetableCardProps {
  entry: TimetableEntry;
  teacherName?: string;
  teacherColor?: string;
  hasConflict?: boolean;
  isDragging?: boolean;
}

const TimetableCard = ({ entry, teacherName, teacherColor, hasConflict, isDragging }: TimetableCardProps) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: entry.id,
    disabled: entry.is_locked,
    data: { entry }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    backgroundColor: teacherColor ? `${teacherColor}20` : undefined,
    borderColor: teacherColor || undefined
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-2 rounded-md border-2 transition-all text-xs",
        "bg-card hover:shadow-md",
        entry.is_locked && "opacity-70",
        hasConflict && "border-destructive bg-destructive/10 animate-pulse",
        isDragging && "opacity-50 shadow-lg z-50",
        !entry.is_locked && "cursor-grab active:cursor-grabbing"
      )}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate" title={entry.subject_name}>
            {entry.subject_name}
          </p>
          {teacherName && (
            <p 
              className="text-muted-foreground truncate text-[10px]" 
              title={teacherName}
              style={{ color: teacherColor }}
            >
              {teacherName}
            </p>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {entry.is_locked ? (
            <Lock className="h-3 w-3 text-muted-foreground" />
          ) : (
            <GripVertical className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
      </div>
    </div>
  );
};

export default TimetableCard;
