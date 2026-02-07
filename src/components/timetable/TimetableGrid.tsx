import React, { useMemo, useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import TimetableCard from './TimetableCard';
import TimetableSlot from './TimetableSlot';
import { TimetableEntry, useTimetable } from '@/contexts/TimetableContext';
import { useSchoolMapping, MappingTeacher } from '@/contexts/SchoolMappingContext';
import { cn } from '@/lib/utils';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  highlightTeacherId?: string;
}

const TimetableGrid = ({ classId, className, highlightTeacherId }: TimetableGridProps) => {
  const { settings, entries, conflicts, moveEntry, teacherAvailability } = useTimetable();
  const { teachers, classes } = useSchoolMapping();
  const [activeEntry, setActiveEntry] = useState<TimetableEntry | null>(null);

  // Determine shift offset for availability periods
  const shiftOffset = useMemo(() => {
    const cls = classes.find(c => c.id === classId);
    const shift = cls?.shift || 'Manhã';
    if (shift === 'Tarde') return 6;
    if (shift === 'Noite') return 12;
    return 0; // Manhã
  }, [classes, classId]);

  const getTeachersForDayPeriod = (day: number, period: number) => {
    const actualPeriod = period + shiftOffset;
    return teachers.map(teacher => {
      const record = teacherAvailability.find(
        a => a.teacher_id === teacher.id && a.day_of_week === day && a.period_number === actualPeriod
      );
      // No record means available by default
      const available = record ? record.available : true;
      return { ...teacher, available };
    });
  };

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
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="hover:text-primary underline-offset-2 hover:underline cursor-pointer transition-colors w-full">
                        {day.label}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-0" align="center">
                      <div className="p-3 border-b border-border">
                        <p className="text-sm font-semibold">{day.label}-feira — Disponibilidade</p>
                      </div>
                      <ScrollArea className="h-[280px]" onWheel={(e) => e.stopPropagation()}>
                        <div className="p-2 space-y-2">
                          {periods.map(period => {
                            const teachersList = getTeachersForDayPeriod(day.id, period.id);
                            const available = teachersList.filter(t => t.available);
                            const unavailable = teachersList.filter(t => !t.available);
                            return (
                              <div key={period.id} className="text-xs">
                                <p className="font-medium text-muted-foreground mb-1">{period.label} Horário</p>
                                {available.length === 0 && unavailable.length === 0 ? (
                                  <p className="text-muted-foreground italic ml-2">Nenhum professor cadastrado</p>
                                ) : (
                                  <div className="ml-2 space-y-0.5">
                                    {available.map(t => (
                                      <div key={t.id} className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                                        <span>{t.name}</span>
                                      </div>
                                    ))}
                                    {unavailable.map(t => (
                                      <div key={t.id} className="flex items-center gap-1.5 text-muted-foreground line-through opacity-50">
                                        <span className="w-2 h-2 rounded-full shrink-0 bg-muted-foreground" />
                                        <span>{t.name}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
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
                            isHighlighted={highlightTeacherId ? entry.teacher_id === highlightTeacherId : false}
                            isDimmed={highlightTeacherId ? entry.teacher_id !== highlightTeacherId : false}
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
