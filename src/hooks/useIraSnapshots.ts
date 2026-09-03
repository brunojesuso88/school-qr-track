/**
 * Leitura do IRA/medalhas PERSISTIDOS (sem qualquer recálculo).
 *
 * A tela Alunos usa apenas este hook: nenhuma query de notas é disparada ao
 * abrir/filtrar a página. O recálculo acontece só no botão "Atualizar IRA".
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { StudentMedal } from '@/lib/medals/compute';
import { IraDisplayState, StalenessRow, resolveDisplayState, resolveIraFreshness } from '@/lib/iraSnapshot/core';
import { useActiveSchoolId } from '@/contexts/SchoolContext';

export interface SnapshotEntry {
  value: number | null;
  status: string;
  reason: string | null;
  eligible: boolean;
  medals: StudentMedal[];
  computedAt: string;
}

export function useIraSnapshots(students: { id: string; class: string }[]) {
  const activeSchoolId = useActiveSchoolId();
  const [snapshotByStudent, setSnapshotByStudent] = useState<Record<string, SnapshotEntry>>({});
  const [stale, setStale] = useState(false);
  const [lastComputedAt, setLastComputedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const classNames = useMemo(
    () => [...new Set(students.map((s) => s.class).filter(Boolean))].sort(),
    [students],
  );
  const classKey = classNames.join('|');

  const load = useCallback(async () => {
    if (classNames.length === 0 || !activeSchoolId) {
      setSnapshotByStudent({});
      setStale(false);
      return;
    }
    setLoading(true);
    try {
      const { data: snapRows, error } = await supabase
        .from('ira_snapshots')
        .select('student_id, ira_value, ira_status, ira_reason, eligible, medals, computed_at, class_name')
        .eq('school_id', activeSchoolId);
      if (error) throw error;

      const map: Record<string, SnapshotEntry> = {};
      (snapRows || []).forEach((row: Record<string, unknown>) => {
        map[row.student_id as string] = {
          value: row.eligible ? (row.ira_value as number | null) : null,
          status: row.ira_status as string,
          reason: row.ira_reason as string | null,
          eligible: Boolean(row.eligible),
          medals: row.eligible ? ((row.medals as StudentMedal[]) ?? []) : [],
          computedAt: row.computed_at as string,
        };
      });
      setSnapshotByStudent(map);

      const { data: classRows } = await supabase.from('classes').select('id, name').eq('school_id', activeSchoolId);
      const ids = (classRows || [])
        .filter((c: { name: string }) => classNames.includes(c.name))
        .map((c: { id: string }) => c.id);
      if (ids.length === 0) {
        setStale(false);
        setLastComputedAt(null);
        return;
      }
      const { data: stRows } = await supabase
        .from('ira_staleness')
        .select('class_id, stale, last_computed_at')
        .eq('school_id', activeSchoolId)
        .in('class_id', ids);
      const rows = (stRows || []) as StalenessRow[];
      // Falta de linha = "nunca calculado" (nunca "desatualizado").
      const freshness = resolveIraFreshness({ hasSnapshot: Object.keys(map).length > 0, rows });
      setStale(freshness.stale);
      setLastComputedAt(freshness.lastComputedAt);
    } catch (e) {
      console.error('Falha ao ler o IRA persistido:', e);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classKey, activeSchoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasSnapshot = Object.keys(snapshotByStudent).length > 0;
  const displayState: IraDisplayState = resolveDisplayState({ hasSnapshot, stale });

  return { snapshotByStudent, stale, displayState, lastComputedAt, loading, reload: load };
}
