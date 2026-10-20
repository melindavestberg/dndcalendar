import { env, SELF, applyD1Migrations } from 'cloudflare:test';
import { createToken } from '../src/auth-middleware';
import type { Env } from '../src/types';
import type { Role } from '../src/permissions';

const e = env as unknown as Env & { TEST_MIGRATIONS: { name: string; queries: string[] }[] };

export const db = e.DB;
export const migrations = e.TEST_MIGRATIONS;
export const migrate = (only?: (name: string) => boolean) =>
  applyD1Migrations(db, only ? migrations.filter((m) => only(m.name)) : migrations);

const now = () => new Date().toISOString();

export const addUser = async (username: string, isAdmin = 0) => {
  const id = crypto.randomUUID();
  await db
    .prepare('INSERT INTO users (id, username, email, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, username, `${username}@example.com`, 'x', isAdmin, now())
    .run();
  return { id, token: await createToken(e, { userId: id, isAdmin }) };
};

export const addCalendar = async (ownerId: string) => {
  const id = crypto.randomUUID();
  await db
    .prepare('INSERT INTO calendars (id, name, description, owner_user_id, join_code, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, 'Test', '', ownerId, id.slice(0, 6).toUpperCase(), now())
    .run();
  await addMember(id, ownerId, 'owner');
  return id;
};

export const addMember = (calendarId: string, userId: string, role: Role) =>
  db
    .prepare('INSERT INTO calendar_members (calendar_id, user_id, color, joined_at, role) VALUES (?, ?, ?, ?, ?)')
    .bind(calendarId, userId, '#123456', now(), role)
    .run();

export const roleOf = async (calendarId: string, userId: string) =>
  (await db.prepare('SELECT role FROM calendar_members WHERE calendar_id = ? AND user_id = ?').bind(calendarId, userId).first<{ role: string }>())?.role ?? null;

export const call = (method: string, path: string, token: string, body?: unknown) =>
  SELF.fetch(`http://example.com${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });

// A calendar with one user per role.
export const setup = async () => {
  const [owner, admin, admin2, member] = await Promise.all(['o', 'a', 'a2', 'm'].map((n) => addUser(`${n}-${crypto.randomUUID().slice(0, 6)}`)));
  const cal = await addCalendar(owner.id);
  await addMember(cal, admin.id, 'admin');
  await addMember(cal, admin2.id, 'admin');
  await addMember(cal, member.id, 'member');
  return { cal, owner, admin, admin2, member };
};
