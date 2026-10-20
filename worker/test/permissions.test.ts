import { describe, it, expect } from 'vitest';
import { can, CAN, Capability, Role } from '../src/permissions';

const roles: Role[] = ['member', 'admin', 'owner'];
const caps = Object.keys(CAN) as Capability[];

describe('permissions', () => {
  it('members can do none of the elevated capabilities', () => {
    for (const c of caps) expect(can('member', c)).toBe(false);
  });

  it('admin can block dates and kick, but not manage roles, transfer or delete', () => {
    expect(can('admin', 'dates.block')).toBe(true);
    expect(can('admin', 'members.kick')).toBe(true);
    expect(can('admin', 'members.setRole')).toBe(false);
    expect(can('admin', 'calendar.transfer')).toBe(false);
    expect(can('admin', 'calendar.delete')).toBe(false);
  });

  it('owner can do everything', () => {
    for (const c of caps) expect(can('owner', c)).toBe(true);
  });

  it('roles inherit: anything a lower role can do, a higher role can too', () => {
    for (const c of caps) {
      for (let i = 0; i < roles.length - 1; i++) {
        if (can(roles[i], c)) expect(can(roles[i + 1], c)).toBe(true);
      }
    }
  });
});
