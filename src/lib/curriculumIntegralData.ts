/**
 * ESPELHO da "Matriz Integral" semeada em `curriculum_matrix_subjects`
 * (`curriculum_matrices.system_key = 'integral'`).
 *
 * Percursos próprios (nunca colapsam para 1/2/3):
 *   ept1 = 1º ano EPT · eve2 = 2º ano EVE · sec2 = 2º ano SEC · eve3 = 3º ano EVE · sec3 = 3º ano SEC
 *
 * Os nomes abaixo são os NOMES CANÔNICOS EXATOS fornecidos pela escola (maiúsculas,
 * sem acentos, pontuação preservada). Não são "corrigidos": variações de OCR/espaço
 * são tratadas por normalização/alias no parser, nunca alterando o canônico.
 *
 * Carga semanal NÃO foi fornecida e NÃO se aplica ao IRA desta matriz
 * (`ira_calculation_mode = 'arithmetic'`): cada componente pesa 1.
 *
 * Serve de referência documental e de base para os testes. A fonte da verdade em
 * tempo de execução é sempre o banco (`fetchCurriculumMatrix`).
 */
import { IntegralSeries } from '@/lib/series';

export const INTEGRAL_MATRIX_NAME = 'Matriz Integral';
export const INTEGRAL_SYSTEM_KEY = 'integral';

export const INTEGRAL_MATRIX_BY_SERIES: Record<IntegralSeries, string[]> = {
  ept1: [
    'ARTE',
    'BIOLOGIA',
    'CRIATIVIDADE E INOVACAO NO EMPREENDEDORISMO',
    'EDUCACAO DIGITAL(IS)',
    'EDUCACAO FISICA',
    'EMPREENDEDORISMO',
    'ESTUDO ORIENTADO E AVALIACAO SEMANAL',
    'FILOSOFIA',
    'FISICA',
    'FUNDAMENTOS DA EDUCACAO FINANCEIRA',
    'FUNDAMENTOS DE EDUCACAO FINANCEIRA',
    'GEOGRAFIA',
    'HISTORIA',
    'LETRAMENTO EM LINGUA PORTUGUESA',
    'LETRAMENTO EM MATEMATICA',
    'LINGUA ESPANHOLA',
    'LINGUA INGLESA',
    'LINGUA PORTUGUESA',
    'MATEMATICA',
    'PROJETO DE VIDA',
    'QUIMICA',
    'SOCIOLOGIA',
    'TUTORIA',
  ],
  eve2: [
    'ARTE',
    'ASPECTOS CULTURAIS E DIMENSOES DO TURISMO DEEVENTOS',
    'BIOLOGIA',
    'CERIMONIAL, ETIQUETA E PROTOCOLO',
    'DECORACAO DE AMBIENTES E INTERIORES PARA EVENTOS',
    'EDUCACAO FISICA',
    'ESTUDO ORIENTADO E AVALIACAO SEMANAL',
    'FILOSOFIA',
    'FISICA',
    'GEOGRAFIA',
    'GESTAO DE ALIMENTOS E BEBIDAS EM EVENTOS',
    'GESTAO DE EVENTOS: PLANEJAMENTO E EXECUCAO',
    'HISTORIA',
    'LETRAMENTO EM LINGUA PORTUGUESA',
    'LETRAMENTO EM MATEMATICA',
    'LINGUA ESPANHOLA',
    'LINGUA INGLESA',
    'LINGUA PORTUGUESA',
    'MARKETING EM EVENTOS',
    'MATEMATICA',
    'PROJETO DE VIDA',
    'QUIMICA',
    'SOCIOLOGIA',
  ],
  sec2: [
    'ARTE',
    'BIOLOGIA',
    'CONTABILIDADE BASICA E GESTAO FINANCEIRA',
    'EDUCACAO FISICA',
    'ESTUDO ORIENTADO E AVALIACAO SEMANAL',
    'FILOSOFIA',
    'FISICA',
    'FUNDAMENTOS DE ECONOMIA',
    'FUNDAMENTOS DO SECRETARIADO',
    'GEOGRAFIA',
    'HISTORIA',
    'LETRAMENTO EM LINGUA PORTUGUESA',
    'LETRAMENTO EM MATEMATICA',
    'LINGUA ESPANHOLA',
    'LINGUA INGLESA',
    'LINGUA PORTUGUESA',
    'MATEMATICA',
    'NOCOES DE DIREITO E SEGURANCA DO TRABALHO',
    'ORGANIZACAO EMPRESARIAL, GESTAO DE PESSOAS E EQUIPES',
    'PROJETO DE VIDA',
    'QUIMICA',
    'REDACAO DE DOCUMENTOS OFICIAIS E ARQUIVISTICA',
    'ROTINAS E SERVICOS DO SECRETARIADO',
    'SOCIOLOGIA',
  ],
  eve3: [
    'ARTE',
    'BIOLOGIA',
    'DIREITO DO ENTRETENIMENTO',
    'EDUCACAO FISICA',
    'ELABORACAO DE PROJETOS DE EVENTOS',
    'ESTUDO ORIENTADO E AVALIACAO SEMANAL',
    'FILOSOFIA',
    'FISICA',
    'GEOGRAFIA',
    'GESTAO OPERACIONAL E LOGISTICA EM EVENTOS',
    'HIGIENE E SEGURANCA DO TRABALHO',
    'HISTORIA',
    'LETRAMENTO EM LINGUA PORTUGUESA',
    'LETRAMENTO EM MATEMATICA',
    'LINGUA ESPANHOLA',
    'LINGUA INGLESA',
    'LINGUA PORTUGUESA',
    'MATEMATICA',
    'MIDIA E COMUNICACAO EM EVENTOS',
    'PLANEJAMENTO, CAPTACAO E EXECUCAO DE RECURSOS',
    'POS MEDIO',
    'PROJETO INTEGRADOR',
    'QUIMICA',
    'SEGURANCA E ACESSIBILIDADE EM EVENTOS',
    'SOCIOLOGIA',
    'TECNICAS DE NEGOCIACAO PARA EVENTOS',
  ],
  sec3: [
    'ARTE',
    'BIOLOGIA',
    'CERIMONIAL E ORGANIZACAO DE EVENTOS',
    'EDUCACAO FISICA',
    'ESTUDO ORIENTADO E AVALIACAO SEMANAL',
    'FILOSOFIA',
    'FISICA',
    'FUNDAMENTOS DO MARKETING',
    'GEOGRAFIA',
    'HISTORIA',
    'LETRAMENTO EM LINGUA PORTUGUESA',
    'LETRAMENTO EM MATEMATICA',
    'LINGUA ESPANHOLA',
    'LINGUA INGLESA',
    'LINGUA PORTUGUESA',
    'MATEMATICA',
    'MATEMATICA FINANCEIRA E ESTATISTICA APLICADA',
    'NOCOES DE ADMINISTRACAO',
    'POS MEDIO',
    'PROJETO INTEGRADOR',
    'QUIMICA',
    'RELACOES INTERPESSOAIS E TECNICAS DE ATENDIMENTO',
    'SOCIOLOGIA',
  ],
};

/** Contagens oficiais por percurso (fonte: listas fornecidas pela escola). */
export const INTEGRAL_EXPECTED_COUNTS: Record<IntegralSeries, number> = {
  ept1: 23, eve2: 23, sec2: 24, eve3: 26, sec3: 23,
};

/** Componentes de um percurso Integral (todos entram no IRA, carga não se aplica). */
export const integralMatrixForSeries = (series: IntegralSeries) =>
  INTEGRAL_MATRIX_BY_SERIES[series].map((name, index) => ({
    name,
    weekly_classes: null as number | null,
    include_in_ira: true,
    slot_index: 1,
    sort_order: index,
  }));

/** Todos os nomes canônicos distintos da Matriz Integral (catálogo por escola). */
export const integralCatalogNames = (): string[] =>
  [...new Set(Object.values(INTEGRAL_MATRIX_BY_SERIES).flat())].sort((a, b) => a.localeCompare(b, 'pt-BR'));
