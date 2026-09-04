import { IRA_MODE_LABELS, IraResult, describePeriods, formatGrade, formatIra } from '@/lib/ira';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface IRABreakdownProps {
  ira: IraResult;
}

export const IRABreakdown = ({ ira }: IRABreakdownProps) => {
  const eligible = ira.lines.filter((l) => l.eligible);
  const excluded = ira.lines.filter((l) => !l.eligible);
  const periods = ira.selectedPeriods;
  const arithmetic = ira.mode === 'arithmetic';

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">
        <div className="mb-1">
          <Badge variant="outline">{IRA_MODE_LABELS[ira.mode]}</Badge>
          {arithmetic && (
            <span className="ml-2">
              Todas as disciplinas pesam 1 — a carga semanal não se aplica nesta matriz.
            </span>
          )}
        </div>
        Notas usadas no IRA: <strong>{describePeriods(periods)}</strong>
        {periods.length > 1 && ' — a nota de cada disciplina é a média aritmética desses períodos'}
      </div>

      {ira.missingGradeCount > 0 && (
        <div className="text-xs rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 p-2">
          {ira.missingGradeCount} disciplina(s) selecionada(s) com nota ausente em algum período — o período sem nota entra como 0,00 no IRA até o lançamento.
        </div>
      )}

      {eligible.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b">
                <th className="py-2 pr-2">Disciplina</th>
                {periods.map((p) => (
                  <th key={p.id} className="py-2 pr-2 whitespace-nowrap">{p.label}</th>
                ))}
                <th className="py-2 pr-2">Nota usada</th>
                <th className="py-2 pr-2">{arithmetic ? 'Peso (média simples)' : 'Peso'}</th>
                <th className="py-2 pr-2">Nota × Peso</th>
                <th className="py-2">Contribuição</th>
              </tr>
            </thead>
            <tbody>
              {eligible.map((line) => (
                <tr key={line.subjectId} className="border-b last:border-0">
                  <td className="py-2 pr-2 font-medium">{line.name}</td>
                  {line.periodValues.map((pv) => (
                    <td key={pv.periodId} className={cn('py-2 pr-2', pv.missing && 'text-amber-600')}>
                      {pv.missing ? '— → 0,00' : formatGrade(pv.value)}
                    </td>
                  ))}
                  <td className={cn('py-2 pr-2 font-medium', line.missingPeriodCount > 0 && 'text-amber-600')}>
                    {formatGrade(line.usedValue)}
                  </td>
                  <td className="py-2 pr-2">
                    {line.weight}
                    {line.weightSource === 'custom' && (
                      <Badge variant="outline" className="ml-2 text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                        peso personalizado
                      </Badge>
                    )}
                  </td>
                  <td className="py-2 pr-2">{formatGrade(line.product)}</td>
                  <td className="py-2 text-muted-foreground">
                    {ira.totalProduct > 0 && line.product != null
                      ? `${((line.product / ira.totalProduct) * 100).toFixed(1)}%`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-medium">
                <td className="py-2 pr-2">Total</td>
                {periods.map((p) => (
                  <td key={p.id} className="py-2 pr-2">—</td>
                ))}
                <td className="py-2 pr-2">—</td>
                <td className="py-2 pr-2">{formatGrade(ira.totalWeight)}</td>
                <td className="py-2 pr-2">{formatGrade(ira.totalProduct)}</td>
                <td className="py-2">100%</td>
              </tr>
            </tfoot>
          </table>
          <p className="text-sm mt-3">
            IRA = {formatGrade(ira.totalProduct)} ÷ {formatGrade(ira.totalWeight)} ={' '}
            <strong className={cn(ira.value != null && ira.value >= 6 ? 'text-green-600' : 'text-amber-600')}>
              {formatIra(ira.value)}
            </strong>
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {ira.reason || 'Nenhuma disciplina elegível para o cálculo.'}
        </p>
      )}

      {excluded.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Disciplinas fora do cálculo</p>
          <ul className="space-y-1">
            {excluded.map((line) => (
              <li key={line.subjectId} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{line.name}</span> — {line.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {arithmetic
          ? 'Média aritmética simples: soma das notas das disciplinas dividida pela quantidade de disciplinas. '
          : ''}
        Regra do IRA: a nota de cada disciplina é a média dos períodos selecionados e períodos sem nota entram com 0,00.
        A aba “Notas” continua mostrando a verdade do boletim (“—” quando não informado).
      </p>
    </div>
  );
};