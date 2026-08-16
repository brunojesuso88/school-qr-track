/**
 * ESPELHO da matriz curricular oficial semeada em `curriculum_matrix_subjects`.
 *
 * Serve de referência documental e de base para os testes. A fonte da verdade em
 * tempo de execução é sempre o banco (`fetchCurriculumMatrix`).
 */
import { HighSchoolSeries } from '@/lib/series';

export interface OfficialMatrixSubject {
  name: string;
  abbreviation: string;
  aliases: string[];
  /** Carga semanal por série; ausente => componente não pertence à série. */
  weekly: Partial<Record<HighSchoolSeries, number>>;
}

export const APROFUNDAMENTO_AXES = ['CHL', 'CNS', 'ETT'] as const;

const aprofundamentoAliases = (roman: 'I' | 'II') =>
  APROFUNDAMENTO_AXES.flatMap((axis) => [
    `APROFUNDAMENTO IF - ${axis} - ${roman}`,
    `APROFUNDAMENTO IF ${axis} ${roman}`,
  ]);

export const OFFICIAL_CURRICULUM_MATRIX: OfficialMatrixSubject[] = [
  { name: 'ARTE', abbreviation: 'ART', aliases: ['ARTES'], weekly: { '1': 2, '2': 1, '3': 1 } },
  { name: 'BIOLOGIA', abbreviation: 'BIO', aliases: [], weekly: { '1': 2, '2': 2, '3': 2 } },
  { name: 'EDUCACAO DIGITAL', abbreviation: 'ED', aliases: ['EDUCAÇÃO DIGITAL'], weekly: { '1': 1, '2': 1, '3': 1 } },
  { name: 'EDUCACAO FISICA', abbreviation: 'EF', aliases: ['EDUCAÇÃO FÍSICA', 'ED FISICA'], weekly: { '1': 1, '2': 1, '3': 1 } },
  { name: 'FILOSOFIA', abbreviation: 'FIL', aliases: [], weekly: { '1': 1, '2': 2, '3': 1 } },
  { name: 'FISICA', abbreviation: 'FIS', aliases: ['FÍSICA'], weekly: { '1': 2, '2': 2, '3': 2 } },
  { name: 'GEOGRAFIA', abbreviation: 'GEO', aliases: [], weekly: { '1': 2, '2': 2, '3': 2 } },
  { name: 'HISTORIA', abbreviation: 'HIS', aliases: ['HISTÓRIA'], weekly: { '1': 2, '2': 2, '3': 2 } },
  { name: 'IDENTIDADE E PROTAGONISMO', abbreviation: 'IP', aliases: [], weekly: { '1': 1, '2': 1, '3': 1 } },
  {
    name: 'LETRAMENTO EM LINGUA PORTUGUESA', abbreviation: 'Let. LP',
    aliases: ['LETRAMENTO EM LÍNGUA PORTUGUESA', 'LETRAMENTO LINGUA PORTUGUESA'], weekly: { '1': 1 },
  },
  {
    name: 'LETRAMENTO EM MATEMATICA', abbreviation: 'Let. Mat',
    aliases: ['LETRAMENTO EM MATEMÁTICA', 'LETRAMENTO MATEMATICA'], weekly: { '1': 1 },
  },
  { name: 'LINGUA INGLESA', abbreviation: 'ING', aliases: ['LÍNGUA INGLESA', 'INGLES', 'INGLÊS'], weekly: { '1': 1, '2': 1, '3': 2 } },
  { name: 'LINGUA PORTUGUESA', abbreviation: 'LP', aliases: ['LÍNGUA PORTUGUESA', 'PORTUGUES', 'PORTUGUÊS'], weekly: { '1': 4, '2': 4, '3': 4 } },
  { name: 'MATEMATICA', abbreviation: 'MAT', aliases: ['MATEMÁTICA'], weekly: { '1': 4, '2': 4, '3': 4 } },
  { name: 'QUIMICA', abbreviation: 'QUI', aliases: ['QUÍMICA'], weekly: { '1': 2, '2': 2, '3': 2 } },
  { name: 'SOCIOLOGIA', abbreviation: 'SOC', aliases: [], weekly: { '1': 1, '2': 1, '3': 1 } },
  { name: 'APROFUNDAMENTO IF - I', abbreviation: 'AP I', aliases: aprofundamentoAliases('I'), weekly: { '2': 2, '3': 2 } },
  { name: 'APROFUNDAMENTO IF - II', abbreviation: 'AP II', aliases: aprofundamentoAliases('II'), weekly: { '2': 2, '3': 2 } },
];

/** Componentes oficiais de uma série, com a carga daquela série. Todos entram no IRA. */
export const officialMatrixForSeries = (series: HighSchoolSeries) =>
  OFFICIAL_CURRICULUM_MATRIX
    .filter((s) => s.weekly[series] != null)
    .map((s) => ({
      name: s.name,
      abbreviation: s.abbreviation,
      aliases: s.aliases,
      weekly_classes: s.weekly[series] as number,
      include_in_ira: true,
    }));