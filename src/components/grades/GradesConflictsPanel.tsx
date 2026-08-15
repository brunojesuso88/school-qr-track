import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import {
  CONFLICT_LABELS, DetectedStudent, Resolution, ResolutionAction, formatDate, isResolved, needsResolution,
} from './gradesConflicts';

interface Props {
  detected: DetectedStudent[];
  missingInPdf: { id: string; full_name: string; student_id?: string | null }[];
  classStudents: { id: string; full_name: string; student_id?: string | null }[];
  resolutions: Record<string, Resolution>;
  onResolve: (key: string, action: ResolutionAction, studentId?: string | null) => void;
}

const ACTION_LABEL: Record<ResolutionAction, string> = {
  confirm: 'Vínculo confirmado',
  link: 'Vinculado manualmente',
  create: 'Cadastrar novo aluno',
  ignore: 'Ignorar (notas não serão importadas)',
};

export const GradesConflictsPanel = ({ detected, missingInPdf, classStudents, resolutions, onResolve }: Props) => {
  const pending = detected.filter((d) => needsResolution(d) && !isResolved(d, resolutions[d.key]));
  const conflictRows = detected.filter((d) => needsResolution(d));

  return (
    <div className="space-y-4">
      <Alert variant={pending.length > 0 ? 'destructive' : 'default'}>
        {pending.length > 0 ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
        <AlertTitle className="text-sm">
          {pending.length > 0
            ? `${pending.length} conflito(s) sem resolução explícita`
            : 'Todos os conflitos do boletim têm resolução explícita'}
        </AlertTitle>
        <AlertDescription className="text-xs">
          Conferência página por página: {detected.length} aluno(s) detectado(s) no PDF ·
          {' '}{detected.filter((d) => d.status === 'matched').length} idêntico(s) ao cadastro ·
          {' '}{missingInPdf.length} aluno(s) da turma não encontrado(s) no boletim.
          Nenhuma divergência é resolvida automaticamente.
        </AlertDescription>
      </Alert>

      {conflictRows.length > 0 && (
        <ScrollArea className="h-[300px] rounded-md border">
          <div className="divide-y">
            {conflictRows.map((d) => {
              const res = resolutions[d.key];
              const resolved = isResolved(d, res);
              return (
                <div key={d.key} className="p-3 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">PDF: {d.pdf_name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Código: {d.pdf_code ?? '—'} · Nasc.: {formatDate(d.pdf_birth_date)} ·
                        {' '}Página(s): {d.pages.join(', ') || '—'} · {d.cells} célula(s) de nota
                      </p>
                      {d.matched_name && (
                        <p className="text-[11px] text-muted-foreground">
                          Cadastro sugerido: <span className="font-medium">{d.matched_name}</span>
                          {d.current?.student_id ? ` · matrícula ${d.current.student_id}` : ''}
                          {d.current?.school_code ? ` · código ${d.current.school_code}` : ''}
                          {' '}(semelhança {(d.match_score * 100).toFixed(0)}%)
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {d.conflicts.map((c) => (
                          <Badge key={c} variant={c === 'not_in_class' || c === 'duplicate_link' ? 'destructive' : 'secondary'} className="text-[10px]">
                            {CONFLICT_LABELS[c] ?? c}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {resolved && res?.action && (
                      <Badge variant="outline" className="text-[10px]">{ACTION_LABEL[res.action]}</Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {d.status === 'fuzzy' && (
                      <Button size="sm" variant={res?.action === 'confirm' ? 'default' : 'outline'}
                        onClick={() => onResolve(d.key, 'confirm', d.student_id)}>
                        Confirmar vínculo
                      </Button>
                    )}
                    <Select
                      value={res?.action === 'link' ? res.student_id ?? undefined : undefined}
                      onValueChange={(v) => onResolve(d.key, 'link', v)}
                    >
                      <SelectTrigger className="h-8 w-[240px] text-xs">
                        <SelectValue placeholder="Vincular a um aluno existente..." />
                      </SelectTrigger>
                      <SelectContent>
                        {classStudents.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant={res?.action === 'create' ? 'default' : 'outline'}
                      onClick={() => onResolve(d.key, 'create')}>
                      Cadastrar novo aluno
                    </Button>
                    <Button size="sm" variant={res?.action === 'ignore' ? 'secondary' : 'ghost'}
                      onClick={() => onResolve(d.key, 'ignore')}>
                      Ignorar registro
                    </Button>
                  </div>
                  {res?.action === 'ignore' && (
                    <p className="text-[11px] text-destructive">
                      As notas deste nome não serão importadas para nenhum aluno cadastrado.
                    </p>
                  )}
                  {res?.action === 'create' && (
                    <p className="text-[11px] text-muted-foreground">
                      O aluno será cadastrado nesta turma com os dados do boletim (nome, Código, nascimento, mãe e pai) na confirmação final.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {missingInPdf.length > 0 && (
        <div className="rounded-md border p-3 space-y-1">
          <p className="text-sm font-medium flex items-center gap-2">
            <Info className="w-4 h-4 text-muted-foreground" />
            Alunos da turma não encontrados no boletim ({missingInPdf.length})
          </p>
          <p className="text-[11px] text-muted-foreground">
            Apenas sinalizados — nenhum aluno é excluído ou alterado por isso.
          </p>
          <div className="flex flex-wrap gap-1 pt-1">
            {missingInPdf.map((s) => (
              <Badge key={s.id} variant="outline" className="text-[10px]">{s.full_name}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
