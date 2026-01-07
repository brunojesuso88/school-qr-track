import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface TeacherAvailabilitySectionProps {
  teacherId?: string;
  onChange: (availability: { day: number; period: number; available: boolean }[]) => void;
}

const DAYS = [
  { id: 1, label: 'Seg' },
  { id: 2, label: 'Ter' },
  { id: 3, label: 'Qua' },
  { id: 4, label: 'Qui' },
  { id: 5, label: 'Sex' },
];

const PERIODS = [
  { id: 1, label: '1º' },
  { id: 2, label: '2º' },
  { id: 3, label: '3º' },
  { id: 4, label: '4º' },
  { id: 5, label: '5º' },
  { id: 6, label: '6º' },
];

const TeacherAvailabilitySection: React.FC<TeacherAvailabilitySectionProps> = ({ 
  teacherId, 
  onChange 
}) => {
  const [grid, setGrid] = useState<Map<string, boolean>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  // Initialize grid with all slots available
  useEffect(() => {
    const initGrid = new Map<string, boolean>();
    DAYS.forEach(day => {
      PERIODS.forEach(period => {
        initGrid.set(`${day.id}-${period.id}`, true);
      });
    });
    setGrid(initGrid);
  }, []);

  // Load existing availability if editing
  useEffect(() => {
    if (teacherId) {
      setIsLoading(true);
      supabase
        .from('teacher_availability')
        .select('*')
        .eq('teacher_id', teacherId)
        .then(({ data }) => {
          if (data && data.length > 0) {
            const newGrid = new Map<string, boolean>();
            // Initialize all as available
            DAYS.forEach(day => {
              PERIODS.forEach(period => {
                newGrid.set(`${day.id}-${period.id}`, true);
              });
            });
            // Apply saved unavailability
            data.forEach(a => {
              newGrid.set(`${a.day_of_week}-${a.period_number}`, a.available);
            });
            setGrid(newGrid);
          }
          setIsLoading(false);
        });
    }
  }, [teacherId]);

  // Notify parent of changes
  useEffect(() => {
    const availability: { day: number; period: number; available: boolean }[] = [];
    grid.forEach((available, key) => {
      const [day, period] = key.split('-').map(Number);
      availability.push({ day, period, available });
    });
    onChange(availability);
  }, [grid, onChange]);

  const toggleSlot = (day: number, period: number) => {
    const key = `${day}-${period}`;
    setGrid(prev => {
      const newGrid = new Map(prev);
      newGrid.set(key, !prev.get(key));
      return newGrid;
    });
  };

  const selectAll = () => {
    const newGrid = new Map<string, boolean>();
    DAYS.forEach(day => {
      PERIODS.forEach(period => {
        newGrid.set(`${day.id}-${period.id}`, true);
      });
    });
    setGrid(newGrid);
  };

  const clearAll = () => {
    const newGrid = new Map<string, boolean>();
    DAYS.forEach(day => {
      PERIODS.forEach(period => {
        newGrid.set(`${day.id}-${period.id}`, false);
      });
    });
    setGrid(newGrid);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Label>Disponibilidade por Horário</Label>
        <div className="text-sm text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Disponibilidade por Horário</Label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="text-xs text-primary hover:underline"
          >
            Todos
          </button>
          <span className="text-muted-foreground">|</span>
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-primary hover:underline"
          >
            Nenhum
          </button>
        </div>
      </div>
      
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="p-2 text-center border-r text-muted-foreground">Horário</th>
              {DAYS.map(day => (
                <th key={day.id} className="p-2 text-center font-medium">
                  {day.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map(period => (
              <tr key={period.id} className="border-t">
                <td className="p-2 text-center border-r bg-muted/30 font-medium text-muted-foreground">
                  {period.label}
                </td>
                {DAYS.map(day => {
                  const key = `${day.id}-${period.id}`;
                  const isAvailable = grid.get(key) ?? true;
                  return (
                    <td key={day.id} className="p-1 text-center">
                      <button
                        type="button"
                        onClick={() => toggleSlot(day.id, period.id)}
                        className={cn(
                          'w-8 h-8 rounded transition-colors',
                          isAvailable 
                            ? 'bg-primary/20 hover:bg-primary/30 text-primary' 
                            : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                        )}
                      >
                        {isAvailable ? '✓' : '✗'}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <p className="text-xs text-muted-foreground">
        Clique nos horários para marcar disponibilidade. Verde = Disponível, Cinza = Indisponível.
      </p>
    </div>
  );
};

export default TeacherAvailabilitySection;
