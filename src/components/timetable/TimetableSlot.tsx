import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface TimetableSlotProps {
  id: string;
  day: number;
  period: number;
  isBreak?: boolean;
  children?: ReactNode;
}

const TimetableSlot = ({ id, day, period, isBreak, children }: TimetableSlotProps) => {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { day, period }
  });

  if (isBreak) {
    return (
      <td className="p-1 border border-border bg-muted/50 text-center">
        <span className="text-xs text-muted-foreground">Intervalo</span>
      </td>
    );
  }

  return (
    <td
      ref={setNodeRef}
      className={cn(
        "p-1 border border-border min-h-[60px] h-[60px] align-top transition-colors",
        isOver && "bg-primary/10 border-primary",
        !children && "hover:bg-muted/30"
      )}
    >
      {children}
    </td>
  );
};

export default TimetableSlot;
