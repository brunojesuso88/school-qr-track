/**
 * Fixtures de boletim SIAEP/SEDUC-MA em tokens + coordenadas.
 * Reproduzem a geometria real do boletim de 45 páginas usado na importação
 * (uma página por aluno, Nota + Faltas por período), com os casos-limite exigidos.
 */
import { TextToken } from '../../types';

export interface ColumnSpec {
  label: string;
  x: number;
  width: number;
  /** false quando o período não possui subcoluna de faltas (colunas finais) */
  hasAbsence?: boolean;
}

export interface RowSpec {
  subject: string;
  /** por coluna: nota (null = célula vazia) e falta (sempre descartada) */
  cells: { nota: string | null; falta?: string | null }[];
}

export interface PageSpec {
  page: number;
  header: {
    name: string;
    code: string;
    birth: string;
    mother: string;
    father: string;
    classCode: string;
  };
  columns: ColumnSpec[];
  rows: RowSpec[];
}

export const DEFAULT_COLUMNS: ColumnSpec[] = [
  { label: '1º Período', x: 200, width: 60, hasAbsence: true },
  { label: '2º Período', x: 300, width: 60, hasAbsence: true },
  { label: '3º Período', x: 400, width: 60, hasAbsence: true },
  { label: '4º Período', x: 500, width: 60, hasAbsence: true },
  { label: 'Média Final', x: 600, width: 60, hasAbsence: false },
];

export const DEFAULT_SUBJECTS = [
  'ARTE', 'BIOLOGIA', 'EDUCACAO FISICA', 'FILOSOFIA', 'FISICA',
  'GEOGRAFIA', 'HISTORIA', 'LINGUA PORTUGUESA', 'MATEMATICA', 'QUIMICA',
];

const token = (text: string, x: number, y: number, w = text.length * 5, h = 9): TextToken => ({ text, x, y, w, h });

/** Gera os tokens da página conforme a geometria do boletim. */
export function buildPageTokens(spec: PageSpec): TextToken[] {
  const tokens: TextToken[] = [];
  tokens.push(token('SECRETARIA DE ESTADO DA EDUCACAO', 40, 800, 220));
  tokens.push(token('BOLETIM ESCOLAR', 40, 785, 110));
  tokens.push(token(`Aluno(a): ${spec.header.name}`, 40, 760, 260));
  tokens.push(token(`Código: ${spec.header.code}`, 40, 745, 120));
  tokens.push(token(`Data de Nascimento: ${spec.header.birth}`, 200, 745, 200));
  tokens.push(token(`Mãe: ${spec.header.mother}`, 40, 730, 240));
  tokens.push(token(`Pai: ${spec.header.father}`, 40, 715, 240));
  tokens.push(token(`Turma: ${spec.header.classCode}`, 400, 715, 150));

  // cabeçalho da grade
  tokens.push(token('Disciplina', 40, 680, 60));
  spec.columns.forEach((c) => tokens.push(token(c.label, c.x, 680, c.width)));

  // subcolunas Nota / Faltas
  spec.columns.forEach((c) => {
    tokens.push(token('Nota', c.x + 5, 665, 25));
    if (c.hasAbsence !== false) tokens.push(token('Faltas', c.x + 40, 665, 30));
  });

  spec.rows.forEach((row, index) => {
    const y = 640 - index * 18;
    tokens.push(token(row.subject, 40, y, 100));
    row.cells.forEach((cell, ci) => {
      const column = spec.columns[ci];
      if (!column) return;
      if (cell.nota != null) tokens.push(token(cell.nota, column.x + 10, y, 20));
      if (column.hasAbsence !== false && cell.falta != null) tokens.push(token(cell.falta, column.x + 45, y, 18));
    });
  });

  tokens.push(token('Legenda: Nota / Faltas por período', 40, 120, 200));
  tokens.push(token('Assinatura do Diretor', 40, 90, 140));
  return tokens;
}

const grades = (values: (string | null)[], faltas: (string | null)[] = []) =>
  values.map((v, i) => ({ nota: v, falta: faltas[i] ?? String((i + 1) * 2) }));

const fullRow = (subject: string, values: (string | null)[]): RowSpec => ({ subject, cells: grades(values) });

/** Página 1 — boletim completo, com zero explícito. */
export const PAGE_1: PageSpec = {
  page: 1,
  header: {
    name: 'ADRIANO SOUSA LIMA', code: '000123456', birth: '14/03/2009',
    mother: 'MARIA SOUSA LIMA', father: 'JOSE LIMA', classCode: '26RMM100',
  },
  columns: DEFAULT_COLUMNS,
  rows: [
    fullRow('ARTE', ['3,17', '7,50', '8,00', '9,00', '6,92']),
    fullRow('BIOLOGIA', ['0,00', '6,00', '7,25', '8,10', '5,34']),
    fullRow('EDUCACAO FISICA', ['10,00', '9,50', '9,00', '10,00', '9,63']),
    fullRow('FILOSOFIA', ['7,00', '7,00', '7,00', '7,00', '7,00']),
    fullRow('FISICA', ['5,50', '6,50', '4,00', '8,00', '6,00']),
    fullRow('GEOGRAFIA', ['8,25', '8,00', '7,75', '9,10', '8,28']),
    fullRow('HISTORIA', ['9,00', '8,50', '8,00', '7,50', '8,25']),
    fullRow('LINGUA PORTUGUESA', ['7,80', '8,20', '6,40', '9,00', '7,85']),
    fullRow('MATEMATICA', ['4,50', '5,00', '6,00', '7,00', '5,63']),
    fullRow('QUIMICA', ['6,00', '0,00', '7,00', '8,00', '5,25']),
  ],
};

/** Página 18 — várias células vazias (sem nota lançada) e marcador "—". */
export const PAGE_18: PageSpec = {
  page: 18,
  header: {
    name: 'BRUNA MELO CARVALHO', code: '000456789', birth: '02/07/2008',
    mother: 'ANA MELO', father: 'PEDRO CARVALHO', classCode: '26RMM100',
  },
  columns: DEFAULT_COLUMNS,
  rows: [
    fullRow('ARTE', ['7,00', null, null, null, null]),
    fullRow('BIOLOGIA', ['6,50', '—', null, null, null]),
    fullRow('EDUCACAO FISICA', ['9,00', '9,00', null, null, null]),
    fullRow('FILOSOFIA', [null, null, null, null, null]),
    fullRow('FISICA', ['5,00', '5,50', null, null, null]),
    fullRow('GEOGRAFIA', ['8,00', '7,00', null, null, null]),
    fullRow('HISTORIA', ['7,50', '8,00', null, null, null]),
    fullRow('LINGUA PORTUGUESA', ['6,00', '6,50', null, null, null]),
    fullRow('MATEMATICA', ['0,00', null, null, null, null]),
    fullRow('QUIMICA', ['7,00', '7,50', null, null, null]),
  ],
};

/** Página 24 — disciplina preenchida tardiamente (só 3º e 4º períodos). */
export const PAGE_24: PageSpec = {
  page: 24,
  header: {
    name: 'CARLOS EDUARDO ROCHA', code: '000998877', birth: '25/11/2008',
    mother: 'LUCIA ROCHA', father: 'ANTONIO ROCHA', classCode: '26RMM100',
  },
  columns: DEFAULT_COLUMNS,
  rows: [
    fullRow('ARTE', ['7,00', '7,00', '7,00', '7,00', '7,00']),
    fullRow('BIOLOGIA', ['6,00', '6,00', '6,00', '6,00', '6,00']),
    fullRow('EDUCACAO FISICA', ['9,00', '9,00', '9,00', '9,00', '9,00']),
    fullRow('FILOSOFIA', [null, null, '8,00', '9,00', '4,25']),
    fullRow('FISICA', ['5,00', '5,00', '5,00', '5,00', '5,00']),
    fullRow('GEOGRAFIA', ['8,00', '8,00', '8,00', '8,00', '8,00']),
    fullRow('HISTORIA', ['7,00', '7,00', '7,00', '7,00', '7,00']),
    fullRow('LINGUA PORTUGUESA', ['6,00', '6,00', '6,00', '6,00', '6,00']),
    fullRow('MATEMATICA', ['5,00', '5,00', '5,00', '5,00', '5,00']),
    fullRow('QUIMICA', [null, null, null, '7,50', '1,88']),
  ],
};

/** Página 41 — faltas com valores que "parecem nota" (2, 4, 8...). Nada de faltas pode entrar. */
export const PAGE_41: PageSpec = {
  page: 41,
  header: {
    name: 'DANIEL ALVES PEREIRA', code: '000112233', birth: '09/01/2009',
    mother: 'RITA ALVES', father: 'MARCOS PEREIRA', classCode: '26RMM100',
  },
  columns: DEFAULT_COLUMNS,
  rows: DEFAULT_SUBJECTS.map((subject, i) => ({
    subject,
    cells: [
      { nota: '7,00', falta: '2' },
      { nota: '8,00', falta: '4' },
      { nota: '9,00', falta: '6' },
      { nota: '10,00', falta: String(i % 9) },
      { nota: '8,50', falta: null },
    ],
  })),
};

/** Página 42 — muitos zeros reais (0,00) em todos os períodos. */
export const PAGE_42: PageSpec = {
  page: 42,
  header: {
    name: 'ELIANE BARROS DIAS', code: '000445566', birth: '30/05/2008',
    mother: 'SONIA BARROS', father: 'PAULO DIAS', classCode: '26RMM100',
  },
  columns: DEFAULT_COLUMNS,
  rows: DEFAULT_SUBJECTS.map((subject) => fullRow(subject, ['0,00', '0,00', '0,00', '0,00', '0,00'])),
};

/** Página 45 — última página, boletim completo. */
export const PAGE_45: PageSpec = {
  page: 45,
  header: {
    name: 'ZULMIRA NUNES SANTOS', code: '000778899', birth: '18/09/2008',
    mother: 'IRACEMA NUNES', father: 'RAIMUNDO SANTOS', classCode: '26RMM100',
  },
  columns: DEFAULT_COLUMNS,
  rows: DEFAULT_SUBJECTS.map((subject, i) => fullRow(subject, [
    `${(i % 10)},00`, '7,50', '8,00', '0,00', '5,00',
  ])),
};

export const REGRESSION_PAGES: PageSpec[] = [PAGE_1, PAGE_18, PAGE_24, PAGE_41, PAGE_42, PAGE_45];

/** Boletim sintético de 45 páginas com as variações acima distribuídas. */
export function buildFullBooklet(): PageSpec[] {
  const pages: PageSpec[] = [];
  for (let i = 1; i <= 45; i++) {
    const template = REGRESSION_PAGES.find((p) => p.page === i);
    if (template) { pages.push(template); continue; }
    const base = i % 3 === 0 ? PAGE_24 : i % 3 === 1 ? PAGE_1 : PAGE_45;
    pages.push({
      ...base,
      page: i,
      header: { ...base.header, name: `ALUNO TESTE ${i}`, code: String(900000 + i) },
    });
  }
  return pages;
}

/** Contexto da turma coerente com as fixtures. */
export function contextForPages(pages: PageSpec[]) {
  return {
    students: pages.map((p, i) => ({
      id: `student-${i + 1}`,
      full_name: p.header.name,
      student_id: `ID-${i + 1}`,
      school_code: p.header.code,
      birth_date: `${p.header.birth.slice(6)}-${p.header.birth.slice(3, 5)}-${p.header.birth.slice(0, 2)}`,
      mother_name: p.header.mother,
      father_name: p.header.father,
    })),
    expectedSubjects: DEFAULT_SUBJECTS.map((name) => ({ name, weekly_classes: 2 })),
  };
}