/**
 * Condecorações acadêmicas — medalhas SVG originais (fita + medalhão + símbolo).
 * Design institucional/heráldico próprio, sem imagens externas.
 */
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { StudentMedal } from '@/lib/medals/compute';
import { MedalAreaId } from '@/lib/medals/areas';
import { formatIra } from '@/lib/ira';
import { cn } from '@/lib/utils';

interface Palette {
  ribbon: string;
  ribbonDark: string;
  metal: string;
  metalDark: string;
  symbol: string;
}

const PALETTES: Record<MedalAreaId, Palette> = {
  linguagens: { ribbon: '#1d4ed8', ribbonDark: '#1e3a8a', metal: '#dbeafe', metalDark: '#60a5fa', symbol: '#1e3a8a' },
  matematica: { ribbon: '#0f766e', ribbonDark: '#134e4a', metal: '#ccfbf1', metalDark: '#2dd4bf', symbol: '#134e4a' },
  humanas: { ribbon: '#b45309', ribbonDark: '#78350f', metal: '#fef3c7', metalDark: '#f59e0b', symbol: '#78350f' },
  natureza: { ribbon: '#15803d', ribbonDark: '#14532d', metal: '#dcfce7', metalDark: '#4ade80', symbol: '#14532d' },
  diversificada: { ribbon: '#6d28d9', ribbonDark: '#4c1d95', metal: '#ede9fe', metalDark: '#a78bfa', symbol: '#4c1d95' },
};

function Symbol({ areaId, color }: { areaId: MedalAreaId; color: string }) {
  const stroke = { stroke: color, strokeWidth: 1.6, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (areaId) {
    case 'linguagens': // livro aberto + pena
      return (
        <g {...stroke}>
          <path d="M8 20c3-2 6-2 8 0 2-2 5-2 8 0v-8c-3-2-6-2-8 0-2-2-5-2-8 0z" />
          <path d="M16 12v8" />
          <path d="M20.5 9.5 24 6" />
        </g>
      );
    case 'matematica': // pi + formas
      return (
        <g {...stroke}>
          <path d="M10 12h12" />
          <path d="M13 12v9" />
          <path d="M19 12v9" />
          <circle cx="16" cy="24" r="1.4" fill={color} stroke="none" />
        </g>
      );
    case 'humanas': // coluna clássica
      return (
        <g {...stroke}>
          <path d="M9 11h14" />
          <path d="M10 22h12" />
          <path d="M12.5 11v11M16 11v11M19.5 11v11" />
          <path d="M11 24h10" />
        </g>
      );
    case 'natureza': // átomo + folha
      return (
        <g {...stroke}>
          <circle cx="16" cy="16" r="3" />
          <ellipse cx="16" cy="16" rx="8" ry="3.6" />
          <ellipse cx="16" cy="16" rx="8" ry="3.6" transform="rotate(60 16 16)" />
          <path d="M16 24c2-1.5 3.5-3.5 3.5-5.5" />
        </g>
      );
    case 'diversificada': // estrela + bússola
    default:
      return (
        <g {...stroke}>
          <circle cx="16" cy="16" r="7.5" />
          <path d="M16 8.5l2.2 5.3 5.3 2.2-5.3 2.2L16 23.5l-2.2-5.3L8.5 16l5.3-2.2z" fill={color} stroke="none" />
        </g>
      );
  }
}

export function AcademicMedal({
  areaId,
  size = 36,
  className,
}: {
  areaId: MedalAreaId;
  size?: number;
  className?: string;
}) {
  const p = PALETTES[areaId];
  const gid = `medal-${areaId}`;
  return (
    <svg
      width={size}
      height={size * 1.35}
      viewBox="0 0 32 43"
      className={className}
      role="presentation"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${gid}-metal`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={p.metal} />
          <stop offset="100%" stopColor={p.metalDark} />
        </linearGradient>
      </defs>
      {/* Fita */}
      <rect x="9" y="0" width="14" height="13" rx="1.5" fill={p.ribbon} />
      <rect x="13" y="0" width="2" height="13" fill={p.ribbonDark} />
      <rect x="17" y="0" width="2" height="13" fill={p.ribbonDark} />
      {/* Medalhão */}
      <circle cx="16" cy="27" r="14" fill={p.ribbonDark} opacity="0.18" />
      <circle cx="16" cy="27" r="12.5" fill={`url(#${gid}-metal)`} stroke={p.ribbonDark} strokeWidth="1.4" />
      <circle cx="16" cy="27" r="9.8" fill="none" stroke={p.ribbonDark} strokeWidth="0.7" opacity="0.6" />
      <g transform="translate(0, 11)">
        <Symbol areaId={areaId} color={p.symbol} />
      </g>
    </svg>
  );
}

function MedalBadge({ medal }: { medal: StudentMedal }) {
  const label = `${medal.title} — ${medal.seriesLabel}`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          className="shrink-0 rounded-md p-0.5 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <AcademicMedal areaId={medal.areaId} size={30} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 text-xs" align="start">
        <div className="flex items-start gap-3">
          <AcademicMedal areaId={medal.areaId} size={34} />
          <div className="space-y-1">
            <p className="text-sm font-medium leading-tight">{medal.title}</p>
            <p className="text-muted-foreground">{medal.seriesLabel}</p>
            <p>
              <span className="font-medium">IRA da área:</span> {formatIra(medal.value)}
            </p>
            <p className="text-muted-foreground">
              {medal.shared ? '1º lugar compartilhado' : '1º lugar da série'}
            </p>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Disciplinas:</span>{' '}
              {medal.subjects.join(', ') || '—'}
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Faixa "Condecorações" — renderiza apenas quando há medalhas. */
export function StudentMedalsStrip({
  medals,
  className,
}: {
  medals: StudentMedal[] | undefined;
  className?: string;
}) {
  if (!medals || medals.length === 0) return null;
  return (
    <div className={cn('mb-4', className)} onClick={(e) => e.stopPropagation()}>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Condecorações
      </p>
      <div className="flex items-end gap-1.5 overflow-x-auto pb-1">
        {medals.map((m) => (
          <MedalBadge key={m.areaId} medal={m} />
        ))}
      </div>
    </div>
  );
}
