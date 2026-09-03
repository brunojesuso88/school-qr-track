import { describe, expect, it } from 'vitest';
import {
  highestRoleRank,
  roleRank,
  sortMembersByRole,
  sortUsersByRole,
} from '../userHierarchy';

describe('roleRank', () => {
  it('coloca admin global no topo', () => {
    expect(roleRank('staff', true)).toBe(0);
    expect(roleRank('admin')).toBeLessThan(roleRank('direction'));
    expect(roleRank('direction')).toBeLessThan(roleRank('teacher'));
    expect(roleRank('teacher')).toBeLessThan(roleRank('staff'));
    expect(roleRank(null)).toBeGreaterThan(roleRank('staff'));
  });
});

describe('highestRoleRank', () => {
  it('usa o maior nível entre vínculos', () => {
    expect(
      highestRoleRank({ memberships: [{ role: 'teacher' }, { role: 'direction' }] }),
    ).toBe(roleRank('direction'));
  });

  it('sem vínculo fica por último', () => {
    expect(highestRoleRank({ memberships: [] })).toBe(99);
  });
});

describe('sortUsersByRole', () => {
  it('ordena por hierarquia e nome', () => {
    const users = [
      { full_name: 'Zeca Staff', email: 'z@x', memberships: [{ role: 'staff', status: 'active' }] },
      { full_name: 'Ana Professora', email: 'a@x', memberships: [{ role: 'teacher', status: 'pending' }] },
      { full_name: 'Bruno Global', email: 'b@x', is_global_admin: true, memberships: [] },
      { full_name: 'Carla Direção', email: 'c@x', memberships: [{ role: 'teacher' }, { role: 'direction' }] },
      { full_name: 'Ivo Admin', email: 'i@x', memberships: [{ role: 'admin', status: 'active' }] },
      { full_name: null, email: 'sem@vinculo', memberships: [] },
      { full_name: 'Bia Professora', email: 'bia@x', memberships: [{ role: 'teacher' }] },
    ];
    expect(sortUsersByRole(users).map((u) => u.email)).toEqual([
      'b@x', 'i@x', 'c@x', 'a@x', 'bia@x', 'z@x', 'sem@vinculo',
    ]);
  });

  it('não muta o array original', () => {
    const users = [{ full_name: 'B', memberships: [{ role: 'staff' }] }, { full_name: 'A', memberships: [{ role: 'admin' }] }];
    const sorted = sortUsersByRole(users);
    expect(users[0].full_name).toBe('B');
    expect(sorted[0].full_name).toBe('A');
  });
});

describe('sortMembersByRole', () => {
  it('admin → direction → teacher → staff, desempate por nome', () => {
    const members = [
      { role: 'staff', full_name: 'Ana' },
      { role: 'teacher', full_name: 'Zeca' },
      { role: 'teacher', full_name: 'Bia' },
      { role: 'admin', full_name: 'Caio' },
      { role: 'direction', full_name: 'Dora' },
    ];
    expect(sortMembersByRole(members).map((m) => m.full_name)).toEqual([
      'Caio', 'Dora', 'Bia', 'Zeca', 'Ana',
    ]);
  });

  it('status pendente não altera a hierarquia', () => {
    const members = [
      { role: 'teacher', full_name: 'Ativo Professor' },
      { role: 'admin', full_name: 'Pendente Admin' },
    ];
    expect(sortMembersByRole(members)[0].full_name).toBe('Pendente Admin');
  });
});
