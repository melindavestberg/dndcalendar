export interface User {
  id: string;
  username: string;
  email: string;
  isAdmin?: boolean;
  color?: string;
}

export interface CalendarMember {
  userId: User & { color: string };
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
