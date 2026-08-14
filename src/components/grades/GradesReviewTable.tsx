import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface ReviewRow {
  student_name: string;
  subject: string;
  period: string;
  raw_value: string | null;
  value: number | null;
  page: number | null;
  confidence: number | null;
  student_id: string | null;
  matched_name: string | null;
  match_score: number;
  flags: string[];
  second_pass_value?: string | null;
  source?: 'import' | 'manual';
}

const FLAG_LABELS: Record<string, { label: string; variant: 'destructive' | 'secondary' | 'outline' }> = {
  unmatched_student: { label: 'Aluno não identificado', variant: 'destructive' },
  fuzzy_student_match: { label: 'Nome aproximado', variant: 'secondary' },
  invalid_value: { label: 'Valor inválido', variant: 'destructive' },
  out_of_scale: { label: 'Fora da escala', variant: 'destructive' },
  low_confidence: { label: 'Baixa confiança', variant: 'secondary' },
  reconciliation_divergence: { label: 'Divergência entre leituras', variant: 'destructive' },
  reconciled_match: { label: 'Confirmado 2ª leitura', variant: 'outline' },
  duplicate_cell: { label: 'Célula duplicada', variant: 'secondary' },
  conflicting_duplicate: { label: 'Duplicidade conflitante', variant: 'destructive' },
  empty_cell: { label: 'Célula vazia', variant: 'outline' },
  missing_subject: { label: 'Disciplina ausente', variant: 'destructive' },
  manual: { label: 'Corrigido manualmente', variant: 'outline' },
};

interface GradesReviewTableProps {
  rows: ReviewRow[];
  students: { id: string; full_name: string }[];
  onChangeStudent: (index: number, studentId: string | null) => void;
  onChangeValue: (index: number, raw: string) => void;
  conflictKeys: Set<string>;
}

export const GradesReviewTable = ({
  rows,
  students,
  onChangeStudent,
  onChangeValue,
  conflictKeys,
}: GradesReviewTableProps) => (
  <ScrollArea className="h-[380px] rounded-md border">
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-background z-10">
        <tr className="text-left text-xs text-muted-foreground border-b">
          <th className="py-2 px-3">Aluno</th>
          <th className="py-2 px-2">Disciplina</th>
          <th className="py-2 px-2">Período</th>
          <th className="py-2 px-2 w-24">Nota</th>
          <th className="py-2 px-2">Confiança / Alerta</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => {
          const key = `${row.student_id}||${row.subject}||${row.period}`;
          const hasConflict = row.student_id ? conflictKeys.has(key) : false;
          const hasError = row.flags.some((f) =>
            ['unmatched_student', 'invalid_value', 'out_of_scale', 'reconciliation_divergence', 'conflicting_duplicate'].includes(f));
          return (
            <tr key={index} className={cn('border-b last:border-0', hasError && 'bg-destructive/5')}>
              <td className="py-2 px-3 min-w-[220px]">
                {row.student_id ? (
                  <div>
                    <p className="font-medium leading-tight">{row.matched_name}</p>
                    <p className="text-[11px] text-muted-foreground">PDF: {row.student_name}</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-[11px] text-destructive">PDF: {row.student_name}</p>
                    <Select value={row.student_id ?? undefined} onValueChange={(v) => onChangeStudent(index, v)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Selecionar aluno..." />
                      </SelectTrigger>
                      <SelectContent>
                        {students.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </td>
              <td className="py-2 px-2 whitespace-nowrap">{row.subject || '—'}</td>
              <td className="py-2 px-2 whitespace-nowrap">{row.period}</td>
              <td className="py-2 px-2">
                <Input
                  className="h-8 text-xs"
                  value={row.raw_value ?? ''}
                  placeholder="—"
                  onChange={(e) => onChangeValue(index, e.target.value)}
                />
              </td>
              <td className="py-2 px-2">
                <div className="flex flex-wrap gap-1 items-center">
                  {row.confidence != null && (
                    <span className="text-[11px] text-muted-foreground">{(row.confidence * 100).toFixed(0)}%</span>
                  )}
                  {row.flags.map((flag) => {
                    const meta = FLAG_LABELS[flag];
                    if (!meta) return null;
                    return (
                      <Badge key={flag} variant={meta.variant} className="text-[10px]">{meta.label}</Badge>
                    );
                  })}
                  {hasConflict && (
                    <Badge variant="secondary" className="text-[10px] bg-amber-500/15 text-amber-600">
                      Nota já existente
                    </Badge>
                  )}
                  {row.second_pass_value !== undefined && row.second_pass_value !== null && (
                    <span className="text-[10px] text-muted-foreground">2ª leitura: {row.second_pass_value}</span>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </ScrollArea>
);