import { useState } from 'react';
import { AlertCircle, AlertTriangle, Lightbulb, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Conflict } from '@/contexts/TimetableContext';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ConflictAlertProps {
  conflicts: Conflict[];
  className?: string;
}

const ConflictAlert = ({ conflicts, className }: ConflictAlertProps) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  if (conflicts.length === 0) return null;

  const errors = conflicts.filter(c => c.severity === 'error');
  const warnings = conflicts.filter(c => c.severity === 'warning');

  const handleGetSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-timetable', {
        body: { 
          action: 'suggest_fixes',
          conflicts: conflicts.map(c => ({
            type: c.type,
            message: c.message,
            severity: c.severity
          }))
        }
      });

      if (error) throw error;

      setSuggestions(data?.suggestions || ['Não foi possível gerar sugestões no momento.']);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Error getting suggestions:', error);
      toast.error('Erro ao obter sugestões');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  return (
    <>
      <div className={cn("space-y-2", className)}>
        {errors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="flex items-center justify-between">
              <span>
                {errors.length} {errors.length === 1 ? 'Conflito' : 'Conflitos'} Encontrado{errors.length === 1 ? '' : 's'}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGetSuggestions}
                disabled={loadingSuggestions}
                className="ml-2"
              >
                {loadingSuggestions ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Lightbulb className="h-4 w-4 mr-1" />
                )}
                Sugestões
              </Button>
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

      <Dialog open={showSuggestions} onOpenChange={setShowSuggestions}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-warning" />
              Sugestões para Resolver Conflitos
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-3 pr-4">
              {suggestions.map((suggestion, index) => (
                <div 
                  key={index}
                  className="p-3 rounded-lg bg-muted/50 border"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-primary font-bold">{index + 1}.</span>
                    <p className="text-sm">{suggestion}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ConflictAlert;
