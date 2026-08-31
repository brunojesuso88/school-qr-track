import { describe, it, expect } from 'vitest';
import {
  absenceBreakdown,
  areDatesValid,
  attendanceDisplayLabel,
  buildCoverageMap,
  buildCoverageMapFromFlags,
  coverageKey,
  derivedStatus,
  durationInDays,
  durationFromDates,
  endDateFromDuration,
  isValidDuration,
  addDaysToDateKey,
  parseDateKey,
  findActiveOverlap,
  isCovered,
  isDateInRange,
  rangesOverlap,
  toDateKey,
} from '../status';

describe('datas e duração', () => {
  it('toDateKey não desloca timezone', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('valida ordem das datas', () => {
    expect(areDatesValid('2026-03-01', '2026-03-05')).toBe(true);
    expect(areDatesValid('2026-03-05', '2026-03-01')).toBe(false);
    expect(areDatesValid('2026-03-05', '2026-03-05')).toBe(true);
    expect(areDatesValid('', '2026-03-05')).toBe(false);
  });

  it('duração é inclusiva nas duas pontas', () => {
    expect(durationInDays('2026-03-01', '2026-03-01')).toBe(1);
    expect(durationInDays('2026-03-01', '2026-03-03')).toBe(3);
    expect(durationInDays('2026-02-27', '2026-03-02')).toBe(4);
    expect(durationInDays('x', '2026-03-02')).toBe(0);
  });

  it('isDateInRange é inclusivo', () => {
    expect(isDateInRange('2026-03-01', '2026-03-01', '2026-03-05')).toBe(true);
    expect(isDateInRange('2026-03-05', '2026-03-01', '2026-03-05')).toBe(true);
    expect(isDateInRange('2026-03-06', '2026-03-01', '2026-03-05')).toBe(false);
  });
});

describe('derivedStatus', () => {
  const period = { start_date: '2026-03-10', end_date: '2026-03-15' };

  it('cancelado tem precedência sobre as datas', () => {
    expect(derivedStatus({ ...period, status_manual: 'cancelled' }, '2026-03-12')).toBe('cancelled');
  });

  it('futuro, ativo e encerrado', () => {
    expect(derivedStatus(period, '2026-03-09')).toBe('future');
    expect(derivedStatus(period, '2026-03-10')).toBe('active');
    expect(derivedStatus(period, '2026-03-15')).toBe('active');
    expect(derivedStatus(period, '2026-03-16')).toBe('ended');
  });
});

describe('sobreposição', () => {
  it('rangesOverlap detecta toque nas bordas', () => {
    expect(rangesOverlap('2026-03-01', '2026-03-05', '2026-03-05', '2026-03-09')).toBe(true);
    expect(rangesOverlap('2026-03-01', '2026-03-05', '2026-03-06', '2026-03-09')).toBe(false);
  });

  it('ignora cancelados e o próprio registro em edição', () => {
    const existing = [
      { id: 'a', start_date: '2026-03-01', end_date: '2026-03-05', status_manual: 'active' },
      { id: 'b', start_date: '2026-04-01', end_date: '2026-04-05', status_manual: 'cancelled' },
    ];
    expect(findActiveOverlap(existing, { start_date: '2026-03-04', end_date: '2026-03-08' })?.id).toBe('a');
    expect(findActiveOverlap(existing, { start_date: '2026-04-02', end_date: '2026-04-03' })).toBeNull();
    expect(
      findActiveOverlap(existing, { id: 'a', start_date: '2026-03-02', end_date: '2026-03-06' }),
    ).toBeNull();
  });
});

describe('cobertura', () => {
  it('buildCoverageMap expande períodos e ignora não ativos', () => {
    const dates = ['2026-03-01', '2026-03-02', '2026-03-03'];
    const map = buildCoverageMap(
      [
        { student_id: 's1', start_date: '2026-03-02', end_date: '2026-03-03', status: 'active' },
        { student_id: 's2', start_date: '2026-03-01', end_date: '2026-03-03', status: 'cancelled' },
      ],
      dates,
    );
    expect(isCovered(map, 's1', '2026-03-01')).toBe(false);
    expect(isCovered(map, 's1', '2026-03-02')).toBe(true);
    expect(isCovered(map, 's1', '2026-03-03')).toBe(true);
    expect(isCovered(map, 's2', '2026-03-01')).toBe(false);
    expect(map.has(coverageKey('s1', '2026-03-02'))).toBe(true);
  });

  it('buildCoverageMapFromFlags usa apenas flags verdadeiras', () => {
    const map = buildCoverageMapFromFlags([
      { student_id: 's1', date: '2026-03-02', covered: true },
      { student_id: 's2', date: '2026-03-02', covered: false },
    ]);
    expect(isCovered(map, 's1', '2026-03-02')).toBe(true);
    expect(isCovered(map, 's2', '2026-03-02')).toBe(false);
    expect(map.size).toBe(1);
  });
});

describe('rótulos e estatísticas', () => {
  it('nunca transforma presença em falta', () => {
    expect(attendanceDisplayLabel('present', true)).toBe('Presente');
    expect(attendanceDisplayLabel('absent', true)).toBe('Ausente — Atestado');
    expect(attendanceDisplayLabel('absent', false)).toBe('Ausente');
    expect(attendanceDisplayLabel('justified', true)).toBe('Justificado — Atestado');
    expect(attendanceDisplayLabel('justified', false)).toBe('Justificado');
  });

  it('absenceBreakdown separa faltas com e sem atestado', () => {
    const coverage = buildCoverageMapFromFlags([
      { student_id: 's1', date: '2026-03-02', covered: true },
    ]);
    const result = absenceBreakdown(
      [
        { student_id: 's1', date: '2026-03-02', status: 'absent' },
        { student_id: 's1', date: '2026-03-03', status: 'absent' },
        { student_id: 's2', date: '2026-03-02', status: 'present' },
      ],
      coverage,
    );
    expect(result).toEqual({ totalAbsent: 2, withCertificate: 1, withoutCertificate: 1 });
  });
});

describe('duração inclusiva <-> data final', () => {
  it('duração 1 mantém a data inicial', () => {
    expect(endDateFromDuration('2026-08-31', 1)).toBe('2026-08-31');
  });

  it('3 dias iniciando em 2026-08-31 termina em 2026-09-02 (virada de mês)', () => {
    expect(endDateFromDuration('2026-08-31', 3)).toBe('2026-09-02');
  });

  it('múltiplos dias', () => {
    expect(endDateFromDuration('2026-03-01', 5)).toBe('2026-03-05');
  });

  it('virada de ano', () => {
    expect(endDateFromDuration('2026-12-30', 4)).toBe('2027-01-02');
  });

  it('ano bissexto', () => {
    expect(endDateFromDuration('2028-02-28', 3)).toBe('2028-03-01');
    expect(endDateFromDuration('2027-02-28', 3)).toBe('2027-03-02');
  });

  it('rejeita duração inválida', () => {
    expect(endDateFromDuration('2026-03-01', 0)).toBeNull();
    expect(endDateFromDuration('2026-03-01', -2)).toBeNull();
    expect(endDateFromDuration('2026-03-01', 1.5)).toBeNull();
    expect(isValidDuration(1)).toBe(true);
    expect(isValidDuration(0)).toBe(false);
  });

  it('deriva duração de registros existentes', () => {
    expect(durationFromDates('2026-08-31', '2026-09-02')).toBe(3);
    expect(durationFromDates('2026-08-31', '2026-08-31')).toBe(1);
    expect(durationFromDates('2026-09-02', '2026-08-31')).toBeNull();
  });

  it('addDays e parseDateKey são seguros', () => {
    expect(addDaysToDateKey('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDaysToDateKey('invalida', 1)).toBeNull();
    expect(parseDateKey('2026-02-10')?.getDate()).toBe(10);
  });
});
