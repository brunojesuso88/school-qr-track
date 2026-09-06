/**
 * Medalhas configuráveis POR ESCOLA (`medal_definitions` + `medal_definition_subjects`).
 *
 * Os componentes de cada medalha são referenciados por ID ESTRUTURAL
 * (`curriculum_matrix_subjects.id`) da matriz da própria escola — nunca por nome.
 * Para o cálculo, as medalhas são convertidas em `MedalArea` (mesmo motor de
 * sempre), com os nomes dos componentes como aliases de casamento.
 */
import { supabase } from '@/integrations/supabase/client';
import { MEDAL_AREAS, MedalArea } from './areas';

export interface MedalDefinitionSubject {
  /** `curriculum_matrix_subjects.id` */
  matrixSubjectId: string;
  name: string;
  series: string;
  matrixId: string;
}

export interface MedalDefinitionRecord {
  id: string;
  name: string;
  symbol: string;
  description: string | null;
  active: boolean;
  sortOrder: number;
  subjects: MedalDefinitionSubject[];
}

interface RawDefinition {
  id: string;
  name: string;
  symbol: string | null;
  description: string | null;
  active: boolean;
  sort_order: number | null;
}

interface RawLink {
  medal_id: string;
  matrix_subject_id: string;
  curriculum_matrix_subjects: {
    id: string;
    series: string;
    matrix_id: string;
    mapping_global_subjects: { name: string } | null;
  } | null;
}

/** Medalhas cadastradas na escola (com seus componentes da matriz). */
export async function fetchSchoolMedals(schoolId: string): Promise<MedalDefinitionRecord[]> {
  const [defsRes, linksRes] = await Promise.all([
    supabase.from('medal_definitions')
      .select('id, name, symbol, description, active, sort_order')
      .eq('school_id', schoolId)
      .order('sort_order')
      .order('name'),
    supabase.from('medal_definition_subjects')
      .select('medal_id, matrix_subject_id, curriculum_matrix_subjects(id, series, matrix_id, mapping_global_subjects(name))')
      .eq('school_id', schoolId),
  ]);
  if (defsRes.error) throw defsRes.error;
  if (linksRes.error) throw linksRes.error;

  const links = (linksRes.data || []) as unknown as RawLink[];
  const byMedal = new Map<string, MedalDefinitionSubject[]>();
  links.forEach((l) => {
    const cms = l.curriculum_matrix_subjects;
    if (!cms) return;
    byMedal.set(l.medal_id, [
      ...(byMedal.get(l.medal_id) || []),
      {
        matrixSubjectId: cms.id,
        name: cms.mapping_global_subjects?.name ?? '',
        series: cms.series,
        matrixId: cms.matrix_id,
      },
    ]);
  });

  return ((defsRes.data || []) as unknown as RawDefinition[]).map((d) => ({
    id: d.id,
    name: d.name,
    symbol: d.symbol || '🏅',
    description: d.description,
    active: d.active,
    sortOrder: d.sort_order ?? 0,
    subjects: (byMedal.get(d.id) || []).filter((s) => s.name).sort((a, b) => a.name.localeCompare(b.name)),
  }));
}

/** Converte as medalhas da escola em áreas de cálculo. */
export function medalAreasFromDefinitions(defs: MedalDefinitionRecord[]): MedalArea[] {
  return defs
    .filter((d) => d.active && d.subjects.length > 0)
    .map((d) => ({
      id: d.id,
      label: d.name,
      title: `Melhor aluno de ${d.name}`,
      symbol: d.symbol,
      aliases: [...new Set(d.subjects.map((s) => s.name))],
    }));
}

/**
 * Áreas efetivas da escola: configuração da escola quando existir, caso
 * contrário as áreas padrão históricas (nenhum histórico é perdido).
 */
export async function resolveSchoolMedalAreas(schoolId: string): Promise<MedalArea[]> {
  try {
    const areas = medalAreasFromDefinitions(await fetchSchoolMedals(schoolId));
    return areas.length > 0 ? areas : MEDAL_AREAS;
  } catch {
    return MEDAL_AREAS;
  }
}
