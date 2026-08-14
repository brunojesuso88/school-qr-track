import { IraResult, formatGrade, formatIra } from '@/lib/ira';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface IRABreakdownProps {
  ira: IraResult;
  periodLabel?: string | null;
}

export const IRABreakdown = ({ ira, periodLabel }: IRABreakdownProps) => {
  const eligible = ira.lines.filter((l) => l.eligible);
  const excluded = ira.lines.filter((l) => !l.eligible);

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">
        Nota usada no IRA: {periodLabel ? <strong>{periodLabel}</strong> : 'período não definido'}
      </div>

      {eligible.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b">
                <th className="py-2 pr-2">Disciplina</th>
                <th className="py-2 pr-2">Nota</th>
                <th className="py-2 pr-2">Peso</th>
                <th className="py-2 pr-2">Nota × Peso</th>
                <th className="py-2">Contribuição</th>
              </tr>
            </thead>
            <tbody>
              {eligible.map((line) => (
                <tr key={line.subjectId} className="border-b last:border-0">
                  <td className="py-2 pr-2 font-medium">{line.name}</td>
                  <td className="py-2 pr-2">{formatGrade(line.value)}</td>
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
    </div>
  );
};