import { describe, expect, it } from 'vitest';
import {
  PERMISSION_CATALOG,
  groupByModule,
  resolvePermissions,
} from '@/lib/permissions/catalog';

describe('catálogo de permissões escolares', () => {
  it('usa o padrão do papel quando não há override da escola', () => {
    const resolved = resolvePermissions('teacher', {});
    for (const def of PERMISSION_CATALOG) {
      expect(resolved[def.key]).toBe(def.defaults.teacher);
    }
  });

  it('override da escola vence o padrão (deny e allow)', () => {
    const deny = resolvePermissions('teacher', { 'students.view': false });
    expect(deny['students.view']).toBe(false);

    const allow = resolvePermissions('teacher', { 'students.delete': true });
    expect(allow['students.delete']).toBe(true);
  });

  it('direção tem padrão mais amplo que professor', () => {
    const direction = resolvePermissions('direction', {});
    const teacher = resolvePermissions('teacher', {});
    const directionCount = Object.values(direction).filter(Boolean).length;
    const teacherCount = Object.values(teacher).filter(Boolean).length;
    expect(directionCount).toBeGreaterThan(teacherCount);
  });

  it('agrupa permissões por módulo sem perder itens', () => {
    const groups = groupByModule(PERMISSION_CATALOG);
    const total = groups.reduce((acc, [, defs]) => acc + defs.length, 0);
    expect(total).toBe(PERMISSION_CATALOG.length);
  });
});
