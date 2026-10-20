import { expect, it } from 'vitest';
import { db, migrate, addUser } from './helpers';

it('0001 copes with duplicate member rows from a table that had no primary key', async () => {
  await migrate((n) => n.startsWith('0000'));
  // Recreate calendar_members the way an older database might have it: no primary key.
  await db.batch([
    db.prepare('DROP TABLE calendar_members'),
    db.prepare('CREATE TABLE calendar_members (calendar_id TEXT NOT NULL, user_id TEXT NOT NULL, color TEXT NOT NULL, joined_at TEXT NOT NULL)')
  ]);

  const u = await addUser('dupe-owner');
  const ts = new Date().toISOString();
  await db.batch([
    db.prepare('INSERT INTO calendars (id, name, description, owner_user_id, join_code, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind('CAL-D', 'D', '', u.id, 'D', ts),
    db.prepare('INSERT INTO calendar_members (calendar_id, user_id, color, joined_at) VALUES (?, ?, ?, ?)').bind('CAL-D', u.id, '#111111', ts),
    db.prepare('INSERT INTO calendar_members (calendar_id, user_id, color, joined_at) VALUES (?, ?, ?, ?)').bind('CAL-D', u.id, '#111111', ts)
  ]);

  await migrate();

  const rows = await db.prepare("SELECT role FROM calendar_members WHERE calendar_id = 'CAL-D'").all<{ role: string }>();
  expect(rows.results).toEqual([{ role: 'owner' }]);
});
