export interface User {
  id: string;
  username: string;
  email: string;
  isAdmin?: boolean;
  color?: string;
}

export type Role = 'member' | 'admin' | 'owner';

export const RANK: Record<Role, number> = { member: 0, admin: 1, owner: 2 };

// Mirrors worker/src/permissions.ts; the server enforces it, this only decides what to show.
const CAN = {
  'dates.block': 'admin',
  'members.kick': 'admin',
  'members.viewActivity': 'admin',
  'members.setRole': 'owner',
  'calendar.transfer': 'owner'
} as const satisfies Record<string, Role>;

export const can = (role: Role, capability: keyof typeof CAN): boolean => RANK[role] >= RANK[CAN[capability]];

export interface CalendarMember {
  userId: User & { color: string };
  role: Role;
  // Only sent to admins and the owner.
  lastSeenAt?: string | null;
  lastEditAt?: string | null;
}

export interface CalendarMeta {
  id: string;
  name: string;
  description?: string;
  owner_user_id: string;
  join_code: string;
  created_at: string;
  owner: User;
  members: CalendarMember[];
}

export interface AvailabilityRecord {
  calendar_id: string;
  user_id: string;
  date_ymd: string;
  available: number;
  created_at: string;
}

export interface DisabledDateRecord {
  calendar_id: string;
  date_ymd: string;
  reason: string;
  disabled_by_user_id: string;
  created_at: string;
  username?: string;
}

export interface AvailabilityUser {
  userId: string;
  username: string;
  color: string;
}

export type AvailabilityByDate = Record<string, AvailabilityUser[]>;
