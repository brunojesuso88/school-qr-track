import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';

const DAYS = [
  { id: 1, label: 'Seg', fullLabel: 'Segunda' },
  { id: 2, label: 'Ter', fullLabel: 'Terça' },
  { id: 3, label: 'Qua', fullLabel: 'Quarta' },
  { id: 4, label: 'Qui', fullLabel: 'Quinta' },
  { id: 5, label: 'Sex', fullLabel: 'Sexta' }
];

const PERIODS = [
  { id: 1, label: '1º' },
  { id: 2, label: '2º' },
  { id: 3, label: '3º' },
  { id: 4, label: '4º' },
  { id: 5, label: '5º' },
  { id: 6, label: '6º' }
];

interface AvailabilityCell {
  day: number;
  period: number;
  available: boolean;
}

interface TeacherAvailabilityGridProps {
  availability: AvailabilityCell[];
  onChange: (availability: AvailabilityCell[]) => void;
  readOnly?: boolean;
}

const TeacherAvailabilityGrid = ({ availability, onChange, readOnly = false }: TeacherAvailabilityGridProps) => {
  const [grid, setGrid] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    const newGrid = new Map<string, boolean>();
    // Initialize all cells as available
    DAYS.forEach(day => {
      PERIODS.forEach(period => {
        newGrid.set(`${day.id}-${period.id}`, true);
      });
    });
    // Override with provided availability
    availability.forEach(cell => {
      newGrid.set(`${cell.day}-${cell.period}`, cell.available);
    });
    setGrid(newGrid);
  }, [availability]);

  const toggleCell = (day: number, period: number) => {
    if (readOnly) return;
    
    const key = `${day}-${period}`;
    const currentValue = grid.get(key) ?? true;
    const newGrid = new Map(grid);
    newGrid.set(key, !currentValue);
    setGrid(newGrid);

    // Convert grid to availability array
    const newAvailability: AvailabilityCell[] = [];
    newGrid.forEach((available, key) => {
      const [d, p] = key.split('-').map(Number);
      newAvailability.push({ day: d, period: p, available });
    });
    onChange(newAvailability);
  };

  const toggleDay = (day: number) => {
    if (readOnly) return;
    
    // Check if all periods are available
    const allAvailable = PERIODS.every(period => grid.get(`${day}-${period.id}`) !== false);
    const newGrid = new Map(grid);
    
    PERIODS.forEach(period => {
      newGrid.set(`${day}-${period.id}`, !allAvailable);
    });
    setGrid(newGrid);

    const newAvailability: AvailabilityCell[] = [];
    newGrid.forEach((available, key) => {
      const [d, p] = key.split('-').map(Number);
      newAvailability.push({ day: d, period: p, available });
    });
    onChange(newAvailability);
  };

  const togglePeriod = (period: number) => {
    if (readOnly) return;
    
    // Check if all days are available
    const allAvailable = DAYS.every(day => grid.get(`${day.id}-${period}`) !== false);
    const newGrid = new Map(grid);
    
    DAYS.forEach(day => {
      newGrid.set(`${day.id}-${period}`, !allAvailable);
    });
    setGrid(newGrid);

    const newAvailability: AvailabilityCell[] = [];
    newGrid.forEach((available, key) => {
      const [d, p] = key.split('-').map(Number);
      newAvailability.push({ day: d, period: p, available });
    });
    onChange(newAvailability);
  };

  const isAvailable = (day: number, period: number) => {
    return grid.get(`${day}-${period}`) !== false;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-success/20 border border-success/50" />
          <span>Disponível</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-destructive/20 border border-destructive/50" />
          <span>Indisponível</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-xs font-medium text-muted-foreground border border-border bg-muted/30">
                Horário
              </th>
              {DAYS.map(day => (
                <th 
                  key={day.id} 
                  className={cn(
                    "p-2 text-xs font-medium border border-border bg-muted/30",
                    !readOnly && "cursor-pointer hover:bg-muted/50"
                  )}
                  onClick={() => toggleDay(day.id)}
                  title={`Clique para alternar ${day.fullLabel}`}
                >
                  <span className="hidden sm:inline">{day.fullLabel}</span>
                  <span className="sm:hidden">{day.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map(period => (
              <tr key={period.id}>
                <td 
                  className={cn(
                    "p-2 text-xs font-medium text-center border border-border bg-muted/30",
                    !readOnly && "cursor-pointer hover:bg-muted/50"
                  )}
                  onClick={() => togglePeriod(period.id)}
                  title="Clique para alternar este horário"
                >
                  {period.label} Horário
                </td>
                {DAYS.map(day => {
                  const available = isAvailable(day.id, period.id);
                  return (
                    <td
                      key={`${day.id}-${period.id}`}
                      className={cn(
                        "p-2 text-center border border-border transition-colors",
                        available 
                          ? "bg-success/10 hover:bg-success/20" 
                          : "bg-destructive/10 hover:bg-destructive/20",
                        !readOnly && "cursor-pointer"
                      )}
                      onClick={() => toggleCell(day.id, period.id)}
                    >
                      {available ? (
                        <Check className="w-4 h-4 mx-auto text-success" />
                      ) : (
                        <X className="w-4 h-4 mx-auto text-destructive" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TeacherAvailabilityGrid;
