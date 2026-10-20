import { expect, it } from 'vitest';
import { db, migrate, roleOf, addUser } from './helpers';

it('0001 backfills owners from calendars.owner_user_id, including owners missing a member row', async () => {
  await migrate((n) => n.startsWith('0000'));

  const a = await addUser('legacy-owner-a');
  const b = await addUser('legacy-member-a');
  const c = await addUser('legacy-owner-b');
  const ts = new Date().toISOString();
  const cal = (id: string, owner: string) =>
    db.prepare('INSERT INTO calendars (id, name, description, owner_user_id, join_code, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(id, id, '', owner, id, ts);
  const mem = (calId: string, user: string) =>
    db.prepare('INSERT INTO calendar_members (calendar_id, user_id, color, joined_at) VALUES (?, ?, ?, ?)').bind(calId, user, '#111111', ts);

  // CAL-A has a normal owner row; CAL-B's owner has no calendar_members row at all.
  const av = (user: string, date: string, at: string) =>
    db.prepare('INSERT INTO availability (calendar_id, user_id, date_ymd, available, created_at) VALUES (?, ?, ?, 1, ?)').bind('CAL-A', user, date, at);
  await db.batch([
    cal('CAL-A', a.id), mem('CAL-A', a.id), mem('CAL-A', b.id), cal('CAL-B', c.id),
    av(b.id, '2030-01-01', '2024-01-01T10:00:00.000Z'), av(b.id, '2030-01-02', '2024-02-01T10:00:00.000Z')
  ]);

  await migrate();

  expect(await roleOf('CAL-A', a.id)).toBe('owner');
  expect(await roleOf('CAL-A', b.id)).toBe('member');
  expect(await roleOf('CAL-B', c.id)).toBe('owner');

  // 0002 seeds last_edit_at from the newest availability row; nobody else has one.
  const edit = (u: string) => db.prepare('SELECT last_edit_at FROM calendar_members WHERE user_id = ?').bind(u).first<{ last_edit_at: string | null }>();
  expect((await edit(b.id))!.last_edit_at).toBe('2024-02-01T10:00:00.000Z');
  expect((await edit(a.id))!.last_edit_at).toBeNull();

  // The unique index forbids a second owner.
  await expect(db.prepare("UPDATE calendar_members SET role = 'owner' WHERE calendar_id = 'CAL-A' AND user_id = ?").bind(b.id).run()).rejects.toThrow();
});
