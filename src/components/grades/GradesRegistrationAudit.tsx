import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import {
  DetectedStudent, FieldDecision, RegistrationDecision, formatDate, hasRegistrationData,
} from './gradesConflicts';

interface Props {
  entries: DetectedStudent[];
  decisions: Record<string, RegistrationDecision>;
  onDecide: (key: string, field: keyof RegistrationDecision, decision: FieldDecision) => void;
}

const FieldRow = ({
  label, current, pdfValue, decision, onDecide,
}: {
  label: string;
  current: string;
  pdfValue: string;
  decision: FieldDecision | null;
  onDecide: ((d: FieldDecision) => void) | null;
}) => (
  <div className="grid grid-cols-1 sm:grid-cols-[130px_1fr_1fr_auto] items-center gap-2 py-1 text-xs">
    <span className="text-muted-foreground">{label}</span>
    <span>Cadastro: <span className="font-medium">{current}</span></span>
    <span>Boletim: <span className="font-medium">{pdfValue}</span></span>
    {onDecide ? (
      <div className="flex gap-1">
        <Button size="sm" variant={decision === 'keep' ? 'default' : 'outline'} className="h-7 text-[11px]"
          onClick={() => onDecide('keep')}>Manter cadastro</Button>
        <Button size="sm" variant={decision === 'update' ? 'default' : 'outline'} className="h-7 text-[11px]"
          onClick={() => onDecide('update')}>Atualizar com boletim</Button>
      </div>
    ) : (
      <Badge variant="outline" className="text-[10px] justify-self-start">
        {decision === 'update' ? 'Será preenchido' : 'Sem alteração'}
      </Badge>
    )}
  </div>
);

export const GradesRegistrationAudit = ({ entries, decisions, onDecide }: Props) => {
  const list = entries.filter((d) => d.student_id && hasRegistrationData(d));
  if (list.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        O boletim não trouxe dados cadastrais (Código, nascimento, mãe ou pai) para os alunos vinculados.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <Alert>
        <Info className="w-4 h-4" />
        <AlertDescription className="text-xs">
          A atualização cadastral só acontece na confirmação final. Campos vazios no cadastro são preenchidos com o boletim;
          divergências exigem sua escolha. O <span className="font-medium">Código</span> do boletim é gravado como código escolar e
          nunca substitui a matrícula do aluno.
        </AlertDescription>
      </Alert>
      <ScrollArea className="h-[300px] rounded-md border">
        <div className="divide-y">
          {list.map((d) => {
            const dec = decisions[d.key];
            const need = (pdfValue: string | null, current: string | null) => Boolean(pdfValue && current && pdfValue !== current);
            return (
              <div key={d.key} className="p-3 space-y-1">
                <p className="text-sm font-medium">{d.matched_name}</p>
                <p className="text-[11px] text-muted-foreground">PDF: {d.pdf_name} · página(s) {d.pages.join(', ') || '—'}</p>
                <FieldRow
                  label="Código"
                  current={d.current?.school_code ?? '—'}
                  pdfValue={d.pdf_code ?? '—'}
                  decision={dec?.code ?? null}
                  onDecide={d.pdf_code && need(d.pdf_code, d.current?.school_code ?? null) ? (v) => onDecide(d.key, 'code', v) : null}
                />
                <FieldRow
                  label="Nascimento"
                  current={formatDate(d.current?.birth_date ?? null)}
                  pdfValue={formatDate(d.pdf_birth_date)}
                  decision={dec?.birth_date ?? null}
                  onDecide={d.pdf_birth_date && need(d.pdf_birth_date, d.current?.birth_date ?? null) ? (v) => onDecide(d.key, 'birth_date', v) : null}
                />
                <FieldRow
                  label="Mãe"
                  current={d.current?.mother_name ?? '—'}
                  pdfValue={d.pdf_mother_name ?? '—'}
                  decision={dec?.mother ?? null}
                  onDecide={d.pdf_mother_name && need(d.pdf_mother_name, d.current?.mother_name ?? null) ? (v) => onDecide(d.key, 'mother', v) : null}
                />
                <FieldRow
                  label="Pai"
                  current={d.current?.father_name ?? '—'}
                  pdfValue={d.pdf_father_name ?? '—'}
                  decision={dec?.father ?? null}
                  onDecide={d.pdf_father_name && need(d.pdf_father_name, d.current?.father_name ?? null) ? (v) => onDecide(d.key, 'father', v) : null}
                />
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
