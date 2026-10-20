import { beforeAll, expect, it } from 'vitest';
import { call, db, migrate, setup } from './helpers';

beforeAll(() => migrate());

type Meta = { members: { userId: { id: string }; lastSeenAt?: string | null; lastEditAt?: string | null }[] };
const meta = async (cal: string, token: string) => (await (await call('GET', `/api/calendars/${cal}`, token)).json()) as Meta;
const row = (cal: string, user: string) =>
  db.prepare('SELECT last_seen_at, last_edit_at FROM calendar_members WHERE calendar_id = ? AND user_id = ?').bind(cal, user).first<{ last_seen_at: string | null; last_edit_at: string | null }>();

it('saving availability stamps last edit, and admins see it', async () => {
  const { cal, admin, member } = await setup();
  expect((await row(cal, member.id))!.last_edit_at).toBeNull();

  expect((await call('POST', `/api/availability/${cal}/toggle`, member.token, { date: '2030-03-01' })).status).toBe(200);
  expect((await row(cal, member.id))!.last_edit_at).not.toBeNull();

  const seen = (await meta(cal, admin.token)).members.find((m) => m.userId.id === member.id)!;
  expect(seen.lastEditAt).toBe((await row(cal, member.id))!.last_edit_at);
});

it('opening the calendar stamps last seen, throttled to one write per 5 minutes', async () => {
  const { cal, member } = await setup();
  await meta(cal, member.token);
  const first = (await row(cal, member.id))!.last_seen_at;
  expect(first).not.toBeNull();

  await meta(cal, member.token);
  expect((await row(cal, member.id))!.last_seen_at).toBe(first);

  await db.prepare('UPDATE calendar_members SET last_seen_at = ? WHERE calendar_id = ? AND user_id = ?').bind('2020-01-01T00:00:00.000Z', cal, member.id).run();
  await meta(cal, member.token);
  expect((await row(cal, member.id))!.last_seen_at).not.toBe('2020-01-01T00:00:00.000Z');
});

it('plain members never receive activity fields', async () => {
  const { cal, member } = await setup();
  for (const m of (await meta(cal, member.token)).members) {
    expect(m).not.toHaveProperty('lastSeenAt');
    expect(m).not.toHaveProperty('lastEditAt');
  }
});

it('activity stays in the response after an admin kicks someone', async () => {
  const { cal, admin, member } = await setup();
  const res = (await (await call('POST', `/api/calendars/${cal}/kick`, admin.token, { userId: member.id })).json()) as Meta;
  expect(res.members[0]).toHaveProperty('lastSeenAt');
});
