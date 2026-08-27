import { describe, it, expect } from 'vitest';
import { audienceRolesForEvent, CONFIGURABLE_EVENTS, getEventDefinition, isInappMandatory } from './events';
import { detectPushPlatform } from './platform';
import { buildDedupeKey, buildNotificationContent, containsSensitiveValue, DEFAULT_ROUTE, safeRoute } from './payload';
import { parsePushPayload } from './swPayload';
import { classifyPushResponse, MAX_DELIVERY_ATTEMPTS, shouldDisableDevice, shouldRetry } from './delivery';
import { filterItems, formatBadge, markAllItemsRead, markItemRead, unreadCount, type NotificationItem } from './center';

const item = (over: Partial<NotificationItem> = {}): NotificationItem => ({
  id: over.id ?? 'r1',
  notification_id: 'n1',
  read_at: null,
  seen_at: null,
  created_at: '2026-01-01T10:00:00Z',
  event_type: 'management_announcement',
  title: 'Aviso',
  body: 'Corpo',
  route: null,
  severity: 'info',
  ...over,
});

describe('eventos de notificação', () => {
  it('resolve audiência por evento', () => {
    expect(audienceRolesForEvent('new_user_signup')).toEqual(['admin']);
    expect(audienceRolesForEvent('inexistente')).toEqual([]);
  });

  it('mantém a central interna obrigatória para atestados', () => {
    expect(isInappMandatory('medical_certificate_created')).toBe(true);
    expect(isInappMandatory('management_announcement')).toBe(false);
  });

  it('não expõe o teste de push nas preferências', () => {
    expect(CONFIGURABLE_EVENTS.some((e) => e.type === 'push_test')).toBe(false);
    expect(getEventDefinition('push_test')?.configurable).toBe(false);
  });
});

describe('plataforma de push', () => {
  it('exige instalação no iOS fora do modo standalone', () => {
    const info = detectPushPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', false);
    expect(info.isIOS).toBe(true);
    expect(info.requiresInstall).toBe(true);
  });

  it('libera iOS instalado na tela de início', () => {
    expect(detectPushPlatform('iPhone', true).requiresInstall).toBe(false);
  });

  it('não exige instalação em Android/desktop', () => {
    expect(detectPushPlatform('Linux; Android 14', false).requiresInstall).toBe(false);
    expect(detectPushPlatform('Windows NT 10.0', false).platformLabel).toBe('Desktop');
  });
});

describe('central interna', () => {
  it('conta e filtra não lidas', () => {
    const items = [item({ id: 'a' }), item({ id: 'b', read_at: '2026-01-02T10:00:00Z' })];
    expect(unreadCount(items)).toBe(1);
    expect(filterItems(items, 'unread').map((i) => i.id)).toEqual(['a']);
    expect(filterItems(items, 'all')).toHaveLength(2);
  });

  it('marca uma e todas como lidas sem sobrescrever data anterior', () => {
    const items = [item({ id: 'a' }), item({ id: 'b', read_at: '2020-01-01T00:00:00Z' })];
    const one = markItemRead(items, 'a', '2026-01-03T00:00:00Z');
    expect(one[0].read_at).toBe('2026-01-03T00:00:00Z');
    const all = markAllItemsRead(items, '2026-01-03T00:00:00Z');
    expect(all[1].read_at).toBe('2020-01-01T00:00:00Z');
    expect(unreadCount(all)).toBe(0);
  });

  it('limita o badge a 99+', () => {
    expect(formatBadge(0)).toBe('');
    expect(formatBadge(5)).toBe('5');
    expect(formatBadge(150)).toBe('99+');
  });
});

describe('payload e privacidade', () => {
  it('atestado ignora totalmente o contexto sensível recebido', () => {
    const content = buildNotificationContent('medical_certificate_created', {
      title: 'Atestado de Maria Silva — CID J11',
      body: 'CID J11 gripe, 10/03 a 20/03',
      route: '/students?cid=J11',
    });
    expect(content.title).toBe('Novo atestado registrado');
    expect(content.body).toBe('Um novo atestado foi registrado para um aluno da escola.');
    expect(content.route).toBe('/students');
    expect(JSON.stringify(content)).not.toMatch(/maria|j11|10\/03/i);
  });

  it('detecta vazamento de valores sensíveis no payload final', () => {
    const payload = { title: 'Novo atestado', body: 'Aviso genérico' };
    expect(containsSensitiveValue(payload, ['Maria Silva', 'J11'])).toBe(false);
    expect(containsSensitiveValue({ title: 'Atestado de Maria Silva' }, ['Maria Silva'])).toBe(true);
    // Termos muito curtos são ignorados para evitar falso positivo.
    expect(containsSensitiveValue(payload, ['a', null, undefined])).toBe(false);
  });

  it('gera dedupe_key determinístico', () => {
    expect(buildDedupeKey('medical_certificate_created', 'abc')).toBe('medical_certificate_created:abc:v1');
    expect(buildDedupeKey('push_test', null)).toBe('push_test:none:v1');
    expect(buildDedupeKey('push_test', 'abc', 'v2')).toBe('push_test:abc:v2');
    expect(buildDedupeKey('x', 'y')).toBe(buildDedupeKey('x', 'y'));
  });

  it('aceita apenas rotas internas em safeRoute', () => {
    expect(safeRoute('/students')).toBe('/students');
    expect(safeRoute('https://evil.com')).toBe(DEFAULT_ROUTE);
    expect(safeRoute('//evil.com')).toBe(DEFAULT_ROUTE);
    expect(safeRoute('')).toBe(DEFAULT_ROUTE);
    expect(safeRoute(null)).toBe(DEFAULT_ROUTE);
    expect(safeRoute(undefined)).toBe(DEFAULT_ROUTE);
  });

  it('audiência de atestado cobre os quatro perfis', () => {
    expect(audienceRolesForEvent('medical_certificate_created')).toEqual([
      'admin',
      'direction',
      'teacher',
      'staff',
    ]);
  });
});

describe('payload do service worker', () => {
  it('nunca lança com payload inválido', () => {
    expect(parsePushPayload(null).title).toBe('EDUNEXUS');
    expect(parsePushPayload(undefined).body).toBe('Você tem uma nova notificação.');
    expect(parsePushPayload('texto puro').body).toBe('texto puro');
    expect(parsePushPayload('{quebrado').body).toBe('{quebrado');
    expect(parsePushPayload(12345).title).toBe('EDUNEXUS');
    expect(parsePushPayload({}).url).toBe(DEFAULT_ROUTE);
  });

  it('normaliza payload válido e bloqueia URL externa', () => {
    const parsed = parsePushPayload(
      JSON.stringify({ title: 'Aviso', body: 'Corpo', url: 'https://evil.com', notification_id: 'n1' }),
    );
    expect(parsed.title).toBe('Aviso');
    expect(parsed.url).toBe(DEFAULT_ROUTE);
    expect(parsed.notification_id).toBe('n1');
    expect(parsePushPayload({ notification_id: 7 }).notification_id).toBeNull();
  });
});

describe('entrega de push', () => {
  it('classifica respostas HTTP', () => {
    expect(classifyPushResponse(200)).toBe('sent');
    expect(classifyPushResponse(201)).toBe('sent');
    expect(classifyPushResponse(404)).toBe('expired');
    expect(classifyPushResponse(410)).toBe('expired');
    expect(classifyPushResponse(500)).toBe('failed');
    expect(shouldDisableDevice(410)).toBe(true);
    expect(shouldDisableDevice(500)).toBe(false);
  });

  it('reprocessa no máximo 3 tentativas e só falhas transitórias', () => {
    expect(MAX_DELIVERY_ATTEMPTS).toBe(3);
    expect(shouldRetry(1, 'failed')).toBe(true);
    expect(shouldRetry(2, 'failed')).toBe(true);
    expect(shouldRetry(3, 'failed')).toBe(false);
    expect(shouldRetry(4, 'failed')).toBe(false);
    expect(shouldRetry(1, 'expired')).toBe(false);
    expect(shouldRetry(1, 'sent')).toBe(false);
  });
});
