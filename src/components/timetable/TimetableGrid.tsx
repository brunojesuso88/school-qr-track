import React, { useMemo, useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import TimetableCard from './TimetableCard';
import TimetableSlot from './TimetableSlot';
import { TimetableEntry, useTimetable } from '@/contexts/TimetableContext';
import { useSchoolMapping, MappingTeacher } from '@/contexts/SchoolMappingContext';
import { cn } from '@/lib/utils';

const DAYS = [
  { id: 1, label: 'Segunda' },
  { id: 2, label: 'Terça' },
  { id: 3, label: 'Quarta' },
  { id: 4, label: 'Quinta' },
  { id: 5, label: 'Sexta' }
];

interface TimetableGridProps {
  classId: string;
  className?: string;
}

const TimetableGrid = ({ classId, className }: TimetableGridProps) => {
  const { settings, entries, conflicts, moveEntry } = useTimetable();
  const { teachers } = useSchoolMapping();
  const [activeEntry, setActiveEntry] = useState<TimetableEntry | null>(null);

  const periodsPerDay = settings?.periods_per_day || 6;
  const breakAfterPeriod = settings?.break_after_period || [3];

  const periods = useMemo(() => {
    return Array.from({ length: periodsPerDay }, (_, i) => ({
      id: i + 1,
      label: `${i + 1}º`,
      isBreak: breakAfterPeriod.includes(i + 1)
    }));
  }, [periodsPerDay, breakAfterPeriod]);

  const classEntries = useMemo(() => {
    return entries.filter(e => e.class_id === classId);
  }, [entries, classId]);

  const getEntryForSlot = (day: number, period: number) => {
    return classEntries.find(e => e.day_of_week === day && e.period_number === period);
  };

  const getTeacher = (teacherId?: string): MappingTeacher | undefined => {
    if (!teacherId) return undefined;
    return teachers.find(t => t.id === teacherId);
  };

  const hasConflict = (entryId: string) => {
    return conflicts.some(c => c.entries.includes(entryId));
  };

  const handleDragStart = (event: DragStartEvent) => {
    const entry = event.active.data.current?.entry as TimetableEntry;
    if (entry) setActiveEntry(entry);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveEntry(null);
    
    const { active, over } = event;
    if (!over) return;

    const entry = active.data.current?.entry as TimetableEntry;
    const dropData = over.data.current as { day: number; period: number } | undefined;
    
    if (!entry || !dropData) return;
    
    // Don't move if dropping on same slot
    if (entry.day_of_week === dropData.day && entry.period_number === dropData.period) return;
    
    // Check if slot is already occupied
    const existingEntry = getEntryForSlot(dropData.day, dropData.period);
    if (existingEntry) return;

    moveEntry(entry.id, dropData.day, dropData.period);
  };

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className={cn("overflow-x-auto", className)}>
        <table className="w-full border-collapse min-w-[600px]">
          <thead>
            <tr>
              <th className="p-2 text-xs font-medium text-muted-foreground border border-border bg-muted/30 w-20">
                Horário
              </th>
              {DAYS.map(day => (
                <th 
                  key={day.id} 
                  className="p-2 text-xs font-medium border border-border bg-muted/30"
                >
                  {day.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => (
              <React.Fragment key={period.id}>
                <tr>
                  <td className="p-2 text-xs font-medium text-center border border-border bg-muted/30">
                    {period.label} Horário
                  </td>
                  {DAYS.map(day => {
                    const entry = getEntryForSlot(day.id, period.id);
                    const teacher = entry ? getTeacher(entry.teacher_id) : undefined;
                    
                    return (
                      <TimetableSlot
                        key={`${day.id}-${period.id}`}
                        id={`slot-${classId}-${day.id}-${period.id}`}
                        day={day.id}
                        period={period.id}
                      >
                        {entry && (
                          <TimetableCard
                            entry={entry}
                            teacherName={teacher?.name}
                            teacherColor={teacher?.color}
                            hasConflict={hasConflict(entry.id)}
                            isDragging={activeEntry?.id === entry.id}
                          />
                        )}
                      </TimetableSlot>
                    );
                  })}
                </tr>
                {period.isBreak && (
                  <tr>
                    <td className="p-1 text-xs text-center border border-border bg-muted/50" colSpan={6}>
                      <span className="text-muted-foreground">☕ Intervalo</span>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <DragOverlay>
        {activeEntry && (
          <div className="opacity-80">
            <TimetableCard
              entry={activeEntry}
              teacherName={getTeacher(activeEntry.teacher_id)?.name}
              teacherColor={getTeacher(activeEntry.teacher_id)?.color}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
};

export default TimetableGrid;
