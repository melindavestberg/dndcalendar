export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  ALLOWED_ORIGIN: string;
}

export interface UserRow {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  is_admin: number;
  created_at: string;
}

export interface CalendarRow {
  id: string;
  name: string;
  description: string;
  owner_user_id: string;
  join_code: string;
  created_at: string;
}

export interface CalendarMemberRow {
  calendar_id: string;
  user_id: string;
  color: string;
  joined_at: string;
}

export interface MemberWithUserRow extends UserRow {
  color: string;
}

export interface AvailabilityRow {
  calendar_id: string;
  user_id: string;
  date_ymd: string;
  available: number;
  created_at: string;
}

export interface AvailabilityWithUserRow extends AvailabilityRow {
  username: string;
  color: string;
}

export interface AvailabilitySummaryRow {
  date_ymd: string;
  username: string;
  email: string;
  color: string;
}

export interface DisabledDateRow {
  calendar_id: string;
  date_ymd: string;
  reason: string;
  disabled_by_user_id: string;
  created_at: string;
}

export interface DisabledDateWithUserRow extends DisabledDateRow {
  username: string;
}

export interface ColorCountRow {
  _id: string;
  count: number;
}

export interface SanitizedUser {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
}

export interface JwtPayload {
  userId: string;
  isAdmin: number;
  [key: string]: unknown;
}

export interface AuthContext {
  userId: string;
  isAdmin: number;
}

export interface AuthError {
  error: string;
  status: number;
}
