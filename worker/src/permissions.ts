export type Role = 'member' | 'admin' | 'owner';

export const RANK: Record<Role, number> = { member: 0, admin: 1, owner: 2 };

// Capability -> lowest role allowed. Higher roles inherit everything below them.
export const CAN = {
  'dates.block': 'admin',
  'members.kick': 'admin',
  'members.viewSummary': 'admin',
  'members.viewActivity': 'admin',
  'members.setRole': 'owner',
  'calendar.transfer': 'owner',
  'calendar.delete': 'owner'
} as const satisfies Record<string, Role>;

export type Capability = keyof typeof CAN;

export const can = (role: Role, capability: Capability): boolean => RANK[role] >= RANK[CAN[capability]];
