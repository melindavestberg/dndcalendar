import { beforeAll, describe, expect, it } from 'vitest';
import { call, db, migrate, roleOf, setup, addUser } from './helpers';

beforeAll(() => migrate());

const owners = async (cal: string) =>
  (await db.prepare("SELECT COUNT(*) AS n FROM calendar_members WHERE calendar_id = ? AND role = 'owner'").bind(cal).first<{ n: number }>())!.n;

describe('transfer ownership', () => {
  it('moves ownership to an admin atomically and demotes the old owner to admin', async () => {
    const { cal, owner, admin } = await setup();
    const res = await call('POST', `/api/calendars/${cal}/transfer`, owner.token, { userId: admin.id });
    expect(res.status).toBe(200);
    expect(await roleOf(cal, admin.id)).toBe('owner');
    expect(await roleOf(cal, owner.id)).toBe('admin');
    expect(await owners(cal)).toBe(1);
    const row = await db.prepare('SELECT owner_user_id FROM calendars WHERE id = ?').bind(cal).first<{ owner_user_id: string }>();
    expect(row!.owner_user_id).toBe(admin.id);
  });

  it('refuses a plain member as the target', async () => {
    const { cal, owner, member } = await setup();
    const res = await call('POST', `/api/calendars/${cal}/transfer`, owner.token, { userId: member.id });
    expect(res.status).toBe(400);
    expect(await roleOf(cal, owner.id)).toBe('owner');
  });

  it('refuses a non-member as the target', async () => {
    const { cal, owner } = await setup();
    const stranger = await addUser('stranger');
    const res = await call('POST', `/api/calendars/${cal}/transfer`, owner.token, { userId: stranger.id });
    expect(res.status).toBe(400);
  });

  it('is owner-only', async () => {
    const { cal, admin, admin2, member } = await setup();
    expect((await call('POST', `/api/calendars/${cal}/transfer`, admin.token, { userId: admin2.id })).status).toBe(403);
    expect((await call('POST', `/api/calendars/${cal}/transfer`, member.token, { userId: admin2.id })).status).toBe(403);
    expect(await owners(cal)).toBe(1);
  });
});

describe('set role', () => {
  it('lets the owner promote and demote', async () => {
    const { cal, owner, member } = await setup();
    expect((await call('POST', `/api/calendars/${cal}/role`, owner.token, { userId: member.id, role: 'admin' })).status).toBe(200);
    expect(await roleOf(cal, member.id)).toBe('admin');
    expect((await call('POST', `/api/calendars/${cal}/role`, owner.token, { userId: member.id, role: 'member' })).status).toBe(200);
    expect(await roleOf(cal, member.id)).toBe('member');
  });

  it('stops admins and members from adding admins', async () => {
    const { cal, admin, member } = await setup();
    expect((await call('POST', `/api/calendars/${cal}/role`, admin.token, { userId: member.id, role: 'admin' })).status).toBe(403);
    expect((await call('POST', `/api/calendars/${cal}/role`, member.token, { userId: member.id, role: 'admin' })).status).toBe(403);
    expect(await roleOf(cal, member.id)).toBe('member');
  });

  it("never changes the owner's role or accepts 'owner' as a role", async () => {
    const { cal, owner, member } = await setup();
    expect((await call('POST', `/api/calendars/${cal}/role`, owner.token, { userId: owner.id, role: 'member' })).status).toBe(400);
    expect((await call('POST', `/api/calendars/${cal}/role`, owner.token, { userId: member.id, role: 'owner' })).status).toBe(400);
    expect(await owners(cal)).toBe(1);
  });
});

describe('kick', () => {
  it('lets an admin kick a member', async () => {
    const { cal, admin, member } = await setup();
    expect((await call('POST', `/api/calendars/${cal}/kick`, admin.token, { userId: member.id })).status).toBe(200);
    expect(await roleOf(cal, member.id)).toBeNull();
  });

  it('stops an admin kicking another admin or the owner', async () => {
    const { cal, owner, admin, admin2 } = await setup();
    expect((await call('POST', `/api/calendars/${cal}/kick`, admin.token, { userId: admin2.id })).status).toBe(403);
    expect((await call('POST', `/api/calendars/${cal}/kick`, admin.token, { userId: owner.id })).status).toBe(400);
    expect(await roleOf(cal, admin2.id)).toBe('admin');
    expect(await roleOf(cal, owner.id)).toBe('owner');
  });

  it('lets the owner kick an admin but not themselves', async () => {
    const { cal, owner, admin } = await setup();
    expect((await call('POST', `/api/calendars/${cal}/kick`, owner.token, { userId: admin.id })).status).toBe(200);
    expect((await call('POST', `/api/calendars/${cal}/kick`, owner.token, { userId: owner.id })).status).toBe(400);
  });

  it('stops members and outsiders', async () => {
    const { cal, admin, member } = await setup();
    const stranger = await addUser('stranger');
    expect((await call('POST', `/api/calendars/${cal}/kick`, member.token, { userId: admin.id })).status).toBe(403);
    expect((await call('POST', `/api/calendars/${cal}/kick`, stranger.token, { userId: member.id })).status).toBe(403);
  });
});

describe('other capabilities', () => {
  it('only admins and up can block dates', async () => {
    const { cal, admin, member } = await setup();
    expect((await call('POST', `/api/admin/${cal}/disable-date`, member.token, { date: '2030-01-15' })).status).toBe(403);
    expect((await call('POST', `/api/admin/${cal}/disable-date`, admin.token, { date: '2030-01-15' })).status).toBe(201);
  });

  it('only the owner can delete the calendar', async () => {
    const { cal, owner, admin } = await setup();
    expect((await call('DELETE', `/api/calendars/${cal}`, admin.token)).status).toBe(403);
    expect((await call('DELETE', `/api/calendars/${cal}`, owner.token)).status).toBe(200);
  });

  it('the owner cannot leave', async () => {
    const { cal, owner } = await setup();
    expect((await call('POST', `/api/calendars/${cal}/leave`, owner.token)).status).toBe(400);
    expect(await roleOf(cal, owner.id)).toBe('owner');
  });

  it('a promotion applies on the next request, with no re-login', async () => {
    const { cal, owner, member } = await setup();
    expect((await call('POST', `/api/admin/${cal}/disable-date`, member.token, { date: '2030-02-01' })).status).toBe(403);
    await call('POST', `/api/calendars/${cal}/role`, owner.token, { userId: member.id, role: 'admin' });
    expect((await call('POST', `/api/admin/${cal}/disable-date`, member.token, { date: '2030-02-01' })).status).toBe(201);
  });
});

it('a site-wide is_admin user who is not in the calendar has no powers there', async () => {
  const { cal, member } = await setup();
  const root = await addUser('root', 1);
  expect((await call('POST', `/api/calendars/${cal}/kick`, root.token, { userId: member.id })).status).toBe(403);
  expect((await call('POST', `/api/admin/${cal}/disable-date`, root.token, { date: '2030-04-01' })).status).toBe(403);
  expect((await call('DELETE', `/api/calendars/${cal}`, root.token)).status).toBe(403);
});

describe('create and join', () => {
  it('a new calendar makes the creator owner; joiners are members', async () => {
    const creator = await addUser('creator');
    const joiner = await addUser('joiner');
    const created = (await (await call('POST', '/api/calendars/create', creator.token, { name: 'New' })).json()) as { id: string; join_code: string };
    expect(await roleOf(created.id, creator.id)).toBe('owner');
    expect((await call('POST', '/api/calendars/join', joiner.token, { joinCode: created.join_code })).status).toBe(200);
    expect(await roleOf(created.id, joiner.id)).toBe('member');
  });
});
