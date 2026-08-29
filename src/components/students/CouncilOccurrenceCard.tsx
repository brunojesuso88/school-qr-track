import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Users, Pencil, Trash2 } from 'lucide-react';
import { councilPresetLabel, normalizeCouncilItems } from '@/lib/occurrences/councilPresets';

export interface CouncilOccurrenceLike {
  id: string;
  date: string;
  description: string | null;
  teacher_name: string | null;
  council_items?: string[] | null;
}

interface Props {
  occurrence: CouncilOccurrenceLike;
  longDate?: boolean;
  onEdit?: (occurrence: CouncilOccurrenceLike) => void;
  onDelete?: (id: string) => void;
}

/** Card de um registro de Conselho de Classe (presets como badges + observação livre). */
export const CouncilOccurrenceCard = ({ occurrence, longDate, onEdit, onDelete }: Props) => {
  const items = normalizeCouncilItems(occurrence.council_items);
  const parsed = parse(occurrence.date, 'yyyy-MM-dd', new Date());

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="bg-amber-500/20 text-amber-700 dark:text-amber-400">
                <Users className="w-3 h-3 mr-1" />
                Conselho de Classe
              </Badge>
              <span className="text-xs text-muted-foreground font-medium">
                {longDate
                  ? format(parsed, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                  : format(parsed, 'dd/MM/yyyy')}
              </span>
            </div>

            {items.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {items.map((key) => (
                  <Badge key={key} variant="outline" className="text-xs font-normal">
                    {councilPresetLabel(key)}
                  </Badge>
                ))}
              </div>
            )}

            {occurrence.description && (
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {occurrence.description}
              </p>
            )}

            {items.length === 0 && !occurrence.description && (
              <p className="text-sm text-muted-foreground italic">Sem detalhes registrados</p>
            )}

            {occurrence.teacher_name && (
              <p className="text-xs text-muted-foreground/70">
                Registrado por: {occurrence.teacher_name}
              </p>
            )}
          </div>

          {(onEdit || onDelete) && (
            <div className="flex items-center gap-1 shrink-0">
              {onEdit && (
                <Button variant="ghost" size="sm" onClick={() => onEdit(occurrence)} aria-label="Editar registro do conselho">
                  <Pencil className="w-3 h-3" />
                </Button>
              )}
              {onDelete && (
                <Button variant="ghost" size="sm" onClick={() => onDelete(occurrence.id)} aria-label="Excluir registro do conselho">
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CouncilOccurrenceCard;
