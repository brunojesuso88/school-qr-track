import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { buildCoverageMapFromFlags, CoverageFlagRow, CoverageMap } from '@/lib/medicalCertificates/status';
import { useActiveSchoolId } from '@/contexts/SchoolContext';

/**
 * Busca em LOTE a cobertura de atestados para um conjunto de alunos e datas.
 * Usa a RPC mínima `get_certificate_coverage_flags`, que retorna somente
 * student_id + date + covered — sem período, sem status, sem CID e sem anexo.
 * Funciona para os quatro perfis (admin, direção, professor e funcionário).
 */
export async function fetchCoverage(
  studentIds: string[],
  dates: string[],
): Promise<CoverageMap> {
  if (studentIds.length === 0 || dates.length === 0) return new Set();
  const uniqueIds = Array.from(new Set(studentIds));
  const uniqueDates = Array.from(new Set(dates));
  const { data, error } = await supabase.rpc('get_certificate_coverage_flags', {
    _student_ids: uniqueIds,
    _dates: uniqueDates,
  });
  if (error || !data) return new Set();
  return buildCoverageMapFromFlags(data as CoverageFlagRow[]);
}

/** Alunos com atestado ativo em uma data (padrão: hoje). Consulta única, em lote. */
export async function fetchActiveCertificateStudents(onDate: string): Promise<Set<string>> {
  const { data, error } = await supabase.rpc('get_active_certificate_students', {
    _on_date: onDate,
  });
  if (error || !data) return new Set();
  return new Set((data as { student_id: string }[]).map((r) => r.student_id));
}


export function useCertificateCoverage(studentIds: string[], dates: string[]) {
  const activeSchoolId = useActiveSchoolId();
  const [coverage, setCoverage] = useState<CoverageMap>(new Set());
  const [loading, setLoading] = useState(false);

  const idsKey = studentIds.join(',');
  const datesKey = dates.join(',');

  const reload = useCallback(async () => {
    setLoading(true);
    const map = await fetchCoverage(idsKey ? idsKey.split(',') : [], datesKey ? datesKey.split(',') : []);
    setCoverage(map);
    setLoading(false);
  }, [idsKey, datesKey, activeSchoolId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { coverage, loading, reload };
}

/** Set de alunos com atestado ativo hoje, para badges em lote. */
export function useActiveCertificateStudents(onDate: string) {
  const activeSchoolId = useActiveSchoolId();
  const [studentIds, setStudentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetchActiveCertificateStudents(onDate).then((set) => {
      if (!cancelled) setStudentIds(set);
    });
    return () => {
      cancelled = true;
    };
  }, [onDate, activeSchoolId]);

  return studentIds;
}
