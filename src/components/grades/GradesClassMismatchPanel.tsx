import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Info } from 'lucide-react';

interface Props {
  systemName: string;
  pdfName: string;
  allPdfNames: string[];
  strongEvidence: boolean;
  pdfStudents: number;
  matchedStudents: number;
  classStudents: number;
  sampleIdentifiers: { pdf_name: string; pdf_code: string | null; matched_name: string | null }[];
  renaming: boolean;
  onRename: () => void;
  onKeep: () => void;
  onCancel: () => void;
}

/** Bloqueia a importação quando a turma do PDF difere da turma selecionada. Nada é alterado automaticamente. */
export const GradesClassMismatchPanel = ({
  systemName, pdfName, allPdfNames, strongEvidence, pdfStudents, matchedStudents,
  classStudents, sampleIdentifiers, renaming, onRename, onKeep, onCancel,
}: Props) => {
  const [confirmKeep, setConfirmKeep] = useState(false);

  return (
    <div className="space-y-4">
      <Alert variant="destructive">
        <AlertTriangle className="w-4 h-4" />
        <AlertTitle className="text-sm">Divergência de turma identificada</AlertTitle>
        <AlertDescription className="text-xs space-y-1">
          <p>Turma selecionada no sistema: <span className="font-semibold">{systemName}</span></p>
          <p>Turma identificada no PDF: <span className="font-semibold">{pdfName}</span></p>
          {allPdfNames.length > 1 && (
            <p>Outras turmas no cabeçalho do PDF: {allPdfNames.filter((n) => n !== pdfName).join(', ')}</p>
          )}
          <p>Nenhuma nota foi gravada e a turma não foi alterada automaticamente.</p>
        </AlertDescription>
      </Alert>

      <div className="rounded-lg border p-3 space-y-2">
        <p className="text-sm font-medium">Comparação para confirmar se é a mesma turma</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md border p-2">
            <p className="text-lg font-semibold">{pdfStudents}</p>
            <p className="text-[11px] text-muted-foreground leading-tight">Alunos no PDF</p>
          </div>
          <div className="rounded-md border p-2">
            <p className="text-lg font-semibold">{classStudents}</p>
            <p className="text-[11px] text-muted-foreground leading-tight">Alunos na turma do sistema</p>
          </div>
          <div className="rounded-md border p-2">
            <p className="text-lg font-semibold">{matchedStudents}</p>
            <p className="text-[11px] text-muted-foreground leading-tight">Alunos que coincidem</p>
          </div>
        </div>
        {sampleIdentifiers.length > 0 && (
          <div className="space-y-1 pt-1">
            <p className="text-[11px] text-muted-foreground">Identificadores disponíveis no PDF (amostra):</p>
            {sampleIdentifiers.map((s, i) => (
              <p key={i} className="text-[11px]">
                {s.pdf_name} · Código: {s.pdf_code ?? '—'} ·{' '}
                {s.matched_name ? `cadastro: ${s.matched_name}` : 'sem correspondência na turma'}
              </p>
            ))}
          </div>
        )}
        <Badge variant={strongEvidence ? 'default' : 'secondary'} className="text-[10px]">
          {strongEvidence
            ? 'Forte evidência de que o PDF é desta mesma turma (maioria dos alunos coincide)'
            : 'Evidência fraca: poucos alunos do PDF coincidem com esta turma'}
        </Badge>
      </div>

      <div className="space-y-3">
        <div className="rounded-lg border p-3 space-y-2">
          <p className="text-sm font-medium">1. Alterar nome da turma para o nome do PDF</p>
          <p className="text-[11px] text-muted-foreground">
            A turma <span className="font-medium">{systemName}</span> passará a se chamar exatamente{' '}
            <span className="font-medium">{pdfName}</span>. Nenhuma turma nova é criada e a alteração é registrada na auditoria.
          </p>
          <Button size="sm" variant={strongEvidence ? 'default' : 'outline'} disabled={renaming} onClick={onRename}>
            {renaming ? 'Alterando...' : `Alterar nome para “${pdfName}”`}
          </Button>
        </div>

        <div className="rounded-lg border p-3 space-y-2">
          <p className="text-sm font-medium">2. Manter turma atual e continuar</p>
          <Alert>
            <Info className="w-4 h-4" />
            <AlertDescription className="text-[11px]">
              Risco: se o PDF não pertencer a esta turma, notas serão associadas a alunos errados.
              Confirme apenas se você tem certeza de que o boletim é desta turma.
            </AlertDescription>
          </Alert>
          <div className="flex items-center gap-2">
            <Checkbox id="keep-class-confirm" checked={confirmKeep} onCheckedChange={(v) => setConfirmKeep(Boolean(v))} />
            <Label htmlFor="keep-class-confirm" className="text-xs font-normal">
              Confirmo que este PDF pertence à turma {systemName}
            </Label>
          </div>
          <Button size="sm" variant="outline" disabled={!confirmKeep || renaming} onClick={onKeep}>
            Manter turma atual e continuar
          </Button>
        </div>

        <div className="rounded-lg border p-3 space-y-2">
          <p className="text-sm font-medium">3. Cancelar importação</p>
          <p className="text-[11px] text-muted-foreground">Nada será alterado no sistema.</p>
          <Button size="sm" variant="ghost" disabled={renaming} onClick={onCancel}>Cancelar importação</Button>
        </div>
      </div>
    </div>
  );
};