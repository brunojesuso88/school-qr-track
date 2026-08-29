/**
 * Áreas de condecoração acadêmica (medalhas por série).
 *
 * Camada PARALELA ao IRA global: não altera o motor nem os dados.
 * O casamento das disciplinas é feito por identidade canônica/normalizada
 * (`canonicalSubjectKey`), com aliases explícitos por área.
 */
import { canonicalSubjectKey } from '@/lib/gradePageLocal/normalize';

export type MedalAreaId = 'linguagens' | 'matematica' | 'humanas' | 'natureza' | 'diversificada';

export interface MedalArea {
  id: MedalAreaId;
  /** Nome curto exibido na medalha. */
  label: string;
  /** Nome completo da conquista (sem a série). */
  title: string;
  /** Aliases aceitos (serão normalizados). */
  aliases: string[];
}

export const MEDAL_AREAS: MedalArea[] = [
  {
    id: 'linguagens',
    label: 'Linguagens',
    title: 'Melhor aluno de Linguagens',
    aliases: [
      'Português',
      'Portugues',
      'Língua Portuguesa',
      'Língua Portuguesa e Literatura',
      'LETRAMENTO EM LÍNGUA PORTUGUESA',
      'Educação Física',
    ],
  },
  {
    id: 'matematica',
    label: 'Matemática',
    title: 'Melhor aluno de Matemática',
    aliases: ['Matemática', 'Letramento em Matemática'],
  },
  {
    id: 'humanas',
    label: 'Humanas',
    title: 'Melhor aluno de Humanas',
    aliases: ['História', 'Geografia', 'Filosofia', 'Sociologia'],
  },
  {
    id: 'natureza',
    label: 'Natureza',
    title: 'Melhor aluno de Natureza',
    aliases: ['Física', 'Química', 'Biologia'],
  },
  {
    id: 'diversificada',
    label: 'Parte Diversificada',
    title: 'Melhor aluno da Parte Diversificada',
    // LETRAMENTO EM LÍNGUA PORTUGUESA participa das DUAS áreas, por regra.
    aliases: ['EDUCAÇÃO DIGITAL', 'IDENTIDADE E PROTAGONISMO', 'LETRAMENTO EM LÍNGUA PORTUGUESA'],
  },
];

const KEYS_BY_AREA = new Map<MedalAreaId, Set<string>>(
  MEDAL_AREAS.map((a) => [a.id, new Set(a.aliases.map((n) => canonicalSubjectKey(n)))]),
);

export const getMedalArea = (id: MedalAreaId): MedalArea =>
  MEDAL_AREAS.find((a) => a.id === id) as MedalArea;

/** `true` quando o nome da disciplina pertence à área. */
export function subjectBelongsToArea(subjectName: string, areaId: MedalAreaId): boolean {
  const key = canonicalSubjectKey(subjectName);
  return KEYS_BY_AREA.get(areaId)?.has(key) ?? false;
}

/** Áreas às quais uma disciplina pertence (pode ser mais de uma). */
export function areasForSubject(subjectName: string): MedalAreaId[] {
  return MEDAL_AREAS.filter((a) => subjectBelongsToArea(subjectName, a.id)).map((a) => a.id);
}
