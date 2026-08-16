import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Loader2, ScanSearch } from 'lucide-react';
import { DivergenceDetail } from './gradesAutoAccept';

interface GradesDivergencePanelProps {
  divergences: DivergenceDetail[];
  /** Regra "usar leitura local" já ativa na sessão. */
  ruleActive: boolean;
  /** Todas as divergências podem adotar a leitura local com segurança. */
  allLocallyEligible: boolean;
  /** Existem outras pendências além da divergência. */
  hasOtherBlockers: boolean;
  applying?: boolean;
  onUseLocalReading?: () => void;
  /** Células vazias que só a IA listou e foram descartadas (não são notas). */
  aiEmptyIgnored?: number;
  /** Disciplinas reconhecidas pela matriz da turma sem notas lançadas. */
  anchoredSubjects?: string[];
}

const fmt = (raw: string | null) => (raw && raw.trim() ? raw : 'vazio (não informado no boletim)');

export const GradesDivergencePanel = ({
  divergences,
  ruleActive,
  allLocallyEligible,
  hasOtherBlockers,
  applying = false,
  onUseLocalReading,
  aiEmptyIgnored = 0,
  anchoredSubjects = [],
}: GradesDivergencePanelProps) => {
  const info = aiEmptyIgnored > 0 || anchoredSubjects.length > 0;
  if (divergences.length === 0 && !info) return null;

  const infoBlock = info ? (
    <div className="rounded-md border bg-background/60 p-2 space-y-1 text-muted-foreground">
      {aiEmptyIgnored > 0 && (
        <p>
          {aiEmptyIgnored} célula(s) vazia(s) apontada(s) apenas pela IA foram desconsideradas: célula sem nota no
          boletim não é divergência.
        </p>
      )}
      {anchoredSubjects.length > 0 && (
        <p>
          Disciplinas reconhecidas pela matriz da turma sem notas lançadas: {anchoredSubjects.join(', ')}.
        </p>
      )}
    </div>
  ) : null;

  if (divergences.length === 0) {
    return (
      <Alert>
        <ScanSearch className="w-4 h-4" />
        <AlertTitle className="text-sm">Conferência das leituras</AlertTitle>
        <AlertDescription className="text-xs space-y-2">{infoBlock}</AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert variant="destructive">
      <ScanSearch className="w-4 h-4" />
      <AlertTitle className="text-sm">
        Divergência entre leituras — {divergences.length} célula(s)
      </AlertTitle>
      <AlertDescription className="text-xs space-y-2">
        <p className="text-muted-foreground">
          <span className="font-medium">Leitura local</span> = valor extraído diretamente do PDF do boletim.{' '}
          <span className="font-medium">IA</span> = segunda leitura, usada apenas para validar. A IA nunca substitui a
          leitura local automaticamente.
        </p>
        <ScrollArea className="max-h-[220px] rounded-md border bg-background/60">
          <ul className="divide-y">
            {divergences.map((d) => (
              <li key={`${d.index}-${d.subject}-${d.period}`} className="p-2 space-y-1">
                <p className="font-medium text-foreground">
                  {d.subject} — {d.period} — pág. {d.page ?? '—'}
                </p>
                {d.ai_only ? (
                  <>
                    <p>Validação IA: <span className="font-semibold">{fmt(d.ai_raw)}</span></p>
                    <p className="text-destructive font-medium">
                      Somente a IA identificou esta célula — não existe valor local para autoaceite.
                    </p>
                  </>
                ) : (
                  <>
                    <p>Leitura local do boletim: <span className="font-semibold">{fmt(d.local_raw)}</span></p>
                    <p>Validação IA: <span className="font-semibold">{fmt(d.ai_raw)}</span></p>
                    {d.confidence != null && (
                      <p className="text-muted-foreground">
                        Confiança local: {(d.confidence * 100).toFixed(0)}%
                      </p>
                    )}
                  </>
                )}
                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  <Badge variant="outline" className="text-[10px]">
                    Origem: {d.source === 'ai' ? 'IA' : 'leitura local'}
                  </Badge>
                  {!d.local_eligible && !d.ai_only && d.reasons.map((r) => (
                    <Badge key={r} variant="destructive" className="text-[10px]">{r}</Badge>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </ScrollArea>
        {infoBlock}
        {allLocallyEligible ? (
          <div className="space-y-1">
            {onUseLocalReading && !ruleActive && (
              <Button size="sm" onClick={onUseLocalReading} disabled={applying}>
                {applying && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                Usar leitura local do boletim e continuar automaticamente
              </Button>
            )}
            {hasOtherBlockers && (
              <p className="flex items-center gap-1 text-amber-600">
                <AlertTriangle className="w-3.5 h-3.5" />
                Ainda existem outras pendências nesta página — ela não será confirmada automaticamente até que sejam
                resolvidas.
              </p>
            )}
          </div>
        ) : (
          <p className="font-medium">
            Estas divergências exigem decisão manual: não há leitura local segura para adotar automaticamente.
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
};
