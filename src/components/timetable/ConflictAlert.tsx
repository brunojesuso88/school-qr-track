import { AlertCircle, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Conflict } from '@/contexts/TimetableContext';
import { cn } from '@/lib/utils';

interface ConflictAlertProps {
  conflicts: Conflict[];
  className?: string;
}

const ConflictAlert = ({ conflicts, className }: ConflictAlertProps) => {
  if (conflicts.length === 0) return null;

  const errors = conflicts.filter(c => c.severity === 'error');
  const warnings = conflicts.filter(c => c.severity === 'warning');

  return (
    <div className={cn("space-y-2", className)}>
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>
            {errors.length} {errors.length === 1 ? 'Conflito' : 'Conflitos'} Encontrado{errors.length === 1 ? '' : 's'}
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1 text-sm">
              {errors.slice(0, 5).map((conflict, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-destructive">•</span>
                  {conflict.message}
                </li>
              ))}
              {errors.length > 5 && (
                <li className="text-muted-foreground">
                  E mais {errors.length - 5} conflitos...
                </li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {warnings.length > 0 && (
        <Alert className="border-warning bg-warning/10">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertTitle className="text-warning">
            {warnings.length} {warnings.length === 1 ? 'Aviso' : 'Avisos'}
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1 text-sm">
              {warnings.slice(0, 3).map((conflict, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-warning">•</span>
                  {conflict.message}
                </li>
              ))}
              {warnings.length > 3 && (
                <li className="text-muted-foreground">
                  E mais {warnings.length - 3} avisos...
                </li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default ConflictAlert;
