import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { buildCoverageMap, CoverageMap, CoverageRow } from '@/lib/medicalCertificates/status';

/**
 * Busca em LOTE a cobertura de atestados para um conjunto de alunos e datas.
 * Usa a RPC segura `get_certificate_coverage`, que não retorna CID nem anexo.
 */
export async function fetchCoverage(
  studentIds: string[],
  dates: string[],
): Promise<CoverageMap> {
  if (studentIds.length === 0 || dates.length === 0) return new Set();
  const sorted = [...dates].sort();
  const { data, error } = await supabase.rpc('get_certificate_coverage', {
    _student_ids: studentIds,
    _start_date: sorted[0],
    _end_date: sorted[sorted.length - 1],
  });
  if (error || !data) return new Set();
  return buildCoverageMap(data as CoverageRow[], sorted);
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
  const [coverage, setCoverage] = useState<CoverageMap>(new Set());
  const [loading, setLoading] = useState(false);

  const idsKey = studentIds.join(',');
  const datesKey = dates.join(',');

  const reload = useCallback(async () => {
    setLoading(true);
    const map = await fetchCoverage(idsKey ? idsKey.split(',') : [], datesKey ? datesKey.split(',') : []);
    setCoverage(map);
    setLoading(false);
  }, [idsKey, datesKey]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { coverage, loading, reload };
}

/** Set de alunos com atestado ativo hoje, para badges em lote. */
export function useActiveCertificateStudents(onDate: string) {
  const [studentIds, setStudentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetchActiveCertificateStudents(onDate).then((set) => {
      if (!cancelled) setStudentIds(set);
    });
    return () => {
      cancelled = true;
    };
  }, [onDate]);

  return studentIds;
}
