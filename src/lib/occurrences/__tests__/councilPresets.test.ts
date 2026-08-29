import { describe, it, expect } from 'vitest';
import {
  COUNCIL_PRESETS,
  CLASS_COUNCIL_TYPE,
  councilPresetLabel,
  isKnownCouncilPreset,
  normalizeCouncilItems,
  validateCouncilDraft,
  splitOccurrences,
  findCouncilDuplicate,
  isCouncilOccurrence,
} from '../councilPresets';

describe('presets do conselho', () => {
  it('mantém as três chaves estáveis da V1 com rótulos aprovados', () => {
    expect(COUNCIL_PRESETS.map((p) => p.key)).toEqual([
      'no_classwork',
      'no_homework',
      'infrequent',
    ]);
    expect(councilPresetLabel('no_classwork')).toBe('Não realiza atividades em sala de aula');
    expect(councilPresetLabel('no_homework')).toBe('Não realiza atividades de casa');
    expect(councilPresetLabel('infrequent')).toBe('Aluno infrequente');
  });

  it('faz fallback legível para chave desconhecida', () => {
    expect(isKnownCouncilPreset('algum_item_novo')).toBe(false);
    expect(councilPresetLabel('algum_item_novo')).toBe('Algum item novo');
    expect(councilPresetLabel('')).toBe('Item não identificado');
  });

  it('normaliza itens removendo vazios, duplicatas e não-strings', () => {
    expect(normalizeCouncilItems(['no_homework', ' ', 'no_homework', 'infrequent', 5])).toEqual([
      'no_homework',
      'infrequent',
    ]);
    expect(normalizeCouncilItems(null)).toEqual([]);
    expect(normalizeCouncilItems(undefined)).toEqual([]);
  });
});

describe('validação do registro de conselho', () => {
  it('aceita somente presets', () => {
    const r = validateCouncilDraft({ items: ['no_classwork'], note: '' });
    expect(r).toEqual({ ok: true, items: ['no_classwork'], note: null });
  });

  it('aceita somente observação livre', () => {
    const r = validateCouncilDraft({ items: [], note: '  Melhorou muito  ' });
    expect(r).toEqual({ ok: true, items: [], note: 'Melhorou muito' });
  });

  it('aceita presets + observação', () => {
    const r = validateCouncilDraft({ items: ['infrequent'], note: 'Faltou 10 dias' });
    expect(r).toEqual({ ok: true, items: ['infrequent'], note: 'Faltou 10 dias' });
  });

  it('rejeita registro vazio', () => {
    const r = validateCouncilDraft({ items: [], note: '   ' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/pelo menos um item/i);
  });

  it('rejeita observação acima de 1000 caracteres (limite do banco)', () => {
    const r = validateCouncilDraft({ items: [], note: 'a'.repeat(1001) });
    expect(r.ok).toBe(false);
  });
});

describe('separação de abas / escopo', () => {
  const list = [
    { id: '1', type: 'discipline', date: '2026-08-01' },
    { id: '2', type: CLASS_COUNCIL_TYPE, date: '2026-08-10' },
    { id: '3', type: 'medical_certificate', date: '2026-08-11' },
    { id: '4', type: CLASS_COUNCIL_TYPE, date: '2026-08-12' },
  ];

  it('conselho não aparece em ocorrências gerais e vice-versa', () => {
    const { general, council } = splitOccurrences(list);
    expect(general.map((o) => o.id)).toEqual(['1', '3']);
    expect(council.map((o) => o.id)).toEqual(['2', '4']);
    expect(general.every((o) => !isCouncilOccurrence(o))).toBe(true);
    expect(council.every(isCouncilOccurrence)).toBe(true);
  });

  it('filtro "Alunos com ocorrência" ignora class_council', () => {
    // mapa de ocorrências gerais montado a partir de tipos != class_council
    const generalIds = new Set(splitOccurrences(list).general.map((o) => o.id));
    expect(generalIds.has('2')).toBe(false);
    expect(generalIds.has('1')).toBe(true);
  });

  it('detecta duplicidade de conselho no mesmo aluno + mesma data', () => {
    expect(findCouncilDuplicate(list, '2026-08-10')?.id).toBe('2');
    expect(findCouncilDuplicate(list, '2026-08-01')).toBeNull(); // é disciplinar, não conselho
    expect(findCouncilDuplicate(list, '2026-08-10', '2')).toBeNull(); // ignora o próprio ao editar
  });
});

describe('compatibilidade retroativa', () => {
  it('registro antigo sem council_items renderiza pela observação', () => {
    const legacy = {
      id: 'old',
      type: CLASS_COUNCIL_TYPE,
      date: '2026-03-01',
      description: 'Não faz atividades\nNotas baixas',
      council_items: undefined as unknown,
    };
    const items = normalizeCouncilItems(legacy.council_items);
    expect(items).toEqual([]);
    expect(legacy.description).toBeTruthy();
    // Continua sendo classificado como conselho
    expect(isCouncilOccurrence(legacy)).toBe(true);
  });

  it('registro antigo com council_items null não quebra', () => {
    expect(normalizeCouncilItems(null)).toEqual([]);
  });
});
