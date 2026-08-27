import { describe, it, expect } from 'vitest';
import { audienceRolesForEvent, CONFIGURABLE_EVENTS, getEventDefinition, isInappMandatory } from './events';
import { detectPushPlatform } from './platform';
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
