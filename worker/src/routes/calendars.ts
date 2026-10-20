import { pickLeastUsedColor, USER_COLOR_PALETTE } from '../userColors';
import { Env, CalendarRow, MemberWithUserRow, UserRow, ColorCountRow } from '../types';
import { json, parseBody, generateId, generateJoinCode, sanitizeUser, ResponseHeaders } from '../utils';
import { requireAuth, isAuthError, requireCalendarCan, getMemberRole } from '../auth-middleware';
import { RANK, Role, can } from '../permissions';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

// Activity timestamps are only included for viewers who may see them.
const buildCalendarResponse = async (env: Env, calendar: CalendarRow, viewerRole?: Role) => {
  const owner = await env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(calendar.owner_user_id)
    .first<UserRow>();

  const members = await env.DB.prepare(
    'SELECT u.*, cm.color, cm.role, cm.last_seen_at, cm.last_edit_at FROM users u JOIN calendar_members cm ON u.id = cm.user_id WHERE cm.calendar_id = ?'
  )
    .bind(calendar.id)
    .all<MemberWithUserRow>();

  const showActivity = viewerRole !== undefined && can(viewerRole, 'members.viewActivity');

  return {
    ...calendar,
    owner: sanitizeUser(owner!),
    members: members.results.map((u) => ({
      userId: { ...sanitizeUser(u), color: u.color },
      role: u.role,
      ...(showActivity && { lastSeenAt: u.last_seen_at, lastEditAt: u.last_edit_at })
    }))
  };
};

export const createCalendar = async (request: Request, env: Env, responseHeaders: ResponseHeaders): Promise<Response> => {
  const auth = await requireAuth(request, env);
  if (isAuthError(auth)) {
    return json({ error: auth.error }, auth.status, responseHeaders);
  }

  const { name, description } = await parseBody(request);
  if (!name) {
    return json({ error: 'Calendar name required' }, 400, responseHeaders);
  }

  const calendarId = generateId();
  const joinCode = generateJoinCode();
  const now = new Date().toISOString();

  await env.DB.prepare(
    'INSERT INTO calendars (id, name, description, owner_user_id, join_code, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(calendarId, name, description || '', auth.userId, joinCode, now)
    .run();

  const colorCounts = await env.DB.prepare(
    'SELECT color as _id, COUNT(*) as count FROM calendar_members WHERE color IN (' +
      USER_COLOR_PALETTE.map(() => '?').join(',') +
      ') GROUP BY color'
  )
    .bind(...USER_COLOR_PALETTE)
    .all<ColorCountRow>();

  const assignedColor = pickLeastUsedColor(colorCounts.results);

  await env.DB.prepare(
    "INSERT INTO calendar_members (calendar_id, user_id, color, joined_at, role) VALUES (?, ?, ?, ?, 'owner')"
  ).bind(calendarId, auth.userId, assignedColor, now).run();

  const calendar = await env.DB.prepare('SELECT * FROM calendars WHERE id = ?').bind(calendarId).first<CalendarRow>();

  return json(await buildCalendarResponse(env, calendar!), 201, responseHeaders);
};

export const joinCalendar = async (request: Request, env: Env, responseHeaders: ResponseHeaders): Promise<Response> => {
  const auth = await requireAuth(request, env);
  if (isAuthError(auth)) {
    return json({ error: auth.error }, auth.status, responseHeaders);
  }

  const { joinCode } = await parseBody(request);
  if (!joinCode) {
    return json({ error: 'Join code required' }, 400, responseHeaders);
  }

  const calendar = await env.DB.prepare('SELECT * FROM calendars WHERE join_code = ?')
    .bind(joinCode.toUpperCase())
    .first<CalendarRow>();

  if (!calendar) {
    return json({ error: 'Calendar not found - check your join code' }, 404, responseHeaders);
  }

  const existing = await env.DB.prepare(
    'SELECT * FROM calendar_members WHERE calendar_id = ? AND user_id = ?'
  ).bind(calendar.id, auth.userId)
    .first();

  if (!existing) {
    const colorCounts = await env.DB.prepare(
      'SELECT color as _id, COUNT(*) as count FROM calendar_members WHERE calendar_id = ? AND color IN (' +
        USER_COLOR_PALETTE.map(() => '?').join(',') +
        ') GROUP BY color'
    )
      .bind(calendar.id, ...USER_COLOR_PALETTE)
      .all<ColorCountRow>();

    const assignedColor = pickLeastUsedColor(colorCounts.results);

    const now = new Date().toISOString();
    await env.DB.prepare(
      'INSERT INTO calendar_members (calendar_id, user_id, color, joined_at) VALUES (?, ?, ?, ?)'
    ).bind(calendar.id, auth.userId, assignedColor, now)
      .run();
  }

  return json(await buildCalendarResponse(env, calendar), 200, responseHeaders);
};

export const listMyCalendars = async (request: Request, env: Env, responseHeaders: ResponseHeaders): Promise<Response> => {
  const auth = await requireAuth(request, env);
  if (isAuthError(auth)) {
    return json({ error: auth.error }, auth.status, responseHeaders);
  }

  const calendars = await env.DB.prepare(
    `SELECT c.* FROM calendars c
     JOIN calendar_members cm ON c.id = cm.calendar_id
     WHERE cm.user_id = ?
     ORDER BY c.created_at DESC`
  )
    .bind(auth.userId)
    .all<CalendarRow>();

  const result = [];
  for (const calendar of calendars.results) {
    result.push(await buildCalendarResponse(env, calendar));
  }

  return json(result, 200, responseHeaders);
};

export const getCalendar = async (request: Request, env: Env, responseHeaders: ResponseHeaders, calendarId: string): Promise<Response> => {
  const auth = await requireAuth(request, env);
  if (isAuthError(auth)) {
    return json({ error: auth.error }, auth.status, responseHeaders);
  }

  const calendar = await env.DB.prepare('SELECT * FROM calendars WHERE id = ?').bind(calendarId).first<CalendarRow>();

  if (!calendar) {
    return json({ error: 'Calendar not found' }, 404, responseHeaders);
  }

  const role = await getMemberRole(env, calendarId, auth.userId);
  if (!role) {
    return json({ error: 'You are not a member of this calendar' }, 403, responseHeaders);
  }

  // Throttled to one write per 5 minutes so opening the page does not write every time.
  const now = new Date().toISOString();
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  await env.DB.prepare(
    'UPDATE calendar_members SET last_seen_at = ? WHERE calendar_id = ? AND user_id = ? AND (last_seen_at IS NULL OR last_seen_at < ?)'
  )
    .bind(now, calendarId, auth.userId, cutoff)
    .run();

  return json(await buildCalendarResponse(env, calendar, role), 200, responseHeaders);
};

export const leaveCalendar = async (request: Request, env: Env, responseHeaders: ResponseHeaders, calendarId: string): Promise<Response> => {
  const auth = await requireAuth(request, env);
  if (isAuthError(auth)) {
    return json({ error: auth.error }, auth.status, responseHeaders);
  }

  const calendar = await env.DB.prepare('SELECT * FROM calendars WHERE id = ?').bind(calendarId).first<CalendarRow>();

  if (!calendar) {
    return json({ error: 'Calendar not found' }, 404, responseHeaders);
  }

  if ((await getMemberRole(env, calendarId, auth.userId)) === 'owner') {
    return json({ error: 'Owner cannot leave — delete the calendar instead' }, 400, responseHeaders);
  }

  await env.DB.prepare('DELETE FROM calendar_members WHERE calendar_id = ? AND user_id = ?')
    .bind(calendarId, auth.userId)
    .run();

  return json({ message: 'Left calendar' }, 200, responseHeaders);
};

export const deleteCalendar = async (request: Request, env: Env, responseHeaders: ResponseHeaders, calendarId: string): Promise<Response> => {
  const auth = await requireAuth(request, env);
  if (isAuthError(auth)) {
    return json({ error: auth.error }, auth.status, responseHeaders);
  }

  const access = await requireCalendarCan(env, calendarId, auth.userId, 'calendar.delete');
  if ('error' in access) {
    return json({ error: access.error }, access.status, responseHeaders);
  }

  await env.DB.prepare('DELETE FROM calendars WHERE id = ?').bind(calendarId).run();

  return json({ message: 'Calendar deleted' }, 200, responseHeaders);
};

export const kickMember = async (request: Request, env: Env, responseHeaders: ResponseHeaders, calendarId: string): Promise<Response> => {
  const auth = await requireAuth(request, env);
  if (isAuthError(auth)) {
    return json({ error: auth.error }, auth.status, responseHeaders);
  }

  const access = await requireCalendarCan(env, calendarId, auth.userId, 'members.kick');
  if ('error' in access) {
    return json({ error: access.error }, access.status, responseHeaders);
  }

  const { userId } = await parseBody(request);
  if (!userId) {
    return json({ error: 'userId required' }, 400, responseHeaders);
  }

  const targetRole = await getMemberRole(env, calendarId, userId);
  if (!targetRole) {
    return json({ error: 'That user is not a member of this calendar' }, 404, responseHeaders);
  }

  if (targetRole === 'owner') {
    return json({ error: 'Owner cannot be kicked' }, 400, responseHeaders);
  }

  if (RANK[targetRole] >= RANK[access.role]) {
    return json({ error: 'You can only kick members ranked below you' }, 403, responseHeaders);
  }

  await env.DB.prepare('DELETE FROM calendar_members WHERE calendar_id = ? AND user_id = ?')
    .bind(calendarId, userId)
    .run();

  return json(await buildCalendarResponse(env, access.calendar, access.role), 200, responseHeaders);
};

export const setMemberRole = async (request: Request, env: Env, responseHeaders: ResponseHeaders, calendarId: string): Promise<Response> => {
  const auth = await requireAuth(request, env);
  if (isAuthError(auth)) {
    return json({ error: auth.error }, auth.status, responseHeaders);
  }

  const access = await requireCalendarCan(env, calendarId, auth.userId, 'members.setRole');
  if ('error' in access) {
    return json({ error: access.error }, access.status, responseHeaders);
  }

  const { userId, role } = await parseBody(request);
  if (!userId || (role !== 'admin' && role !== 'member')) {
    return json({ error: "userId and role ('admin' or 'member') required" }, 400, responseHeaders);
  }

  const targetRole = await getMemberRole(env, calendarId, userId);
  if (!targetRole) {
    return json({ error: 'That user is not a member of this calendar' }, 404, responseHeaders);
  }

  if (targetRole === 'owner') {
    return json({ error: "The owner's role can only change by transferring ownership" }, 400, responseHeaders);
  }

  await env.DB.prepare('UPDATE calendar_members SET role = ? WHERE calendar_id = ? AND user_id = ?')
    .bind(role, calendarId, userId)
    .run();

  return json(await buildCalendarResponse(env, access.calendar, access.role), 200, responseHeaders);
};

export const transferOwnership = async (request: Request, env: Env, responseHeaders: ResponseHeaders, calendarId: string): Promise<Response> => {
  const auth = await requireAuth(request, env);
  if (isAuthError(auth)) {
    return json({ error: auth.error }, auth.status, responseHeaders);
  }

  const access = await requireCalendarCan(env, calendarId, auth.userId, 'calendar.transfer');
  if ('error' in access) {
    return json({ error: access.error }, access.status, responseHeaders);
  }

  const { userId } = await parseBody(request);
  if (!userId) {
    return json({ error: 'userId required' }, 400, responseHeaders);
  }

  if ((await getMemberRole(env, calendarId, userId)) !== 'admin') {
    return json({ error: 'Ownership can only be transferred to an admin' }, 400, responseHeaders);
  }

  // One atomic batch so the calendar never has zero or two owners. Demote first: the unique index allows one owner.
  await env.DB.batch([
    env.DB.prepare("UPDATE calendar_members SET role = 'admin' WHERE calendar_id = ? AND user_id = ?").bind(calendarId, auth.userId),
    env.DB.prepare("UPDATE calendar_members SET role = 'owner' WHERE calendar_id = ? AND user_id = ?").bind(calendarId, userId),
    env.DB.prepare('UPDATE calendars SET owner_user_id = ? WHERE id = ?').bind(userId, calendarId)
  ]);

  const updated = await env.DB.prepare('SELECT * FROM calendars WHERE id = ?').bind(calendarId).first<CalendarRow>();
  return json(await buildCalendarResponse(env, updated!, 'admin'), 200, responseHeaders);
};

export const updateMemberColor = async (request: Request, env: Env, responseHeaders: ResponseHeaders, calendarId: string): Promise<Response> => {
  const auth = await requireAuth(request, env);
  if (isAuthError(auth)) {
    return json({ error: auth.error }, auth.status, responseHeaders);
  }

  const { color } = await parseBody(request);
  if (!color || !HEX_COLOR.test(color)) {
    return json({ error: 'A valid hex color is required' }, 400, responseHeaders);
  }

  const isMember = await env.DB.prepare('SELECT * FROM calendar_members WHERE calendar_id = ? AND user_id = ?')
    .bind(calendarId, auth.userId)
    .first();

  if (!isMember) {
    return json({ error: 'Not a member of this calendar' }, 403, responseHeaders);
  }

  await env.DB.prepare('UPDATE calendar_members SET color = ? WHERE calendar_id = ? AND user_id = ?')
    .bind(color, calendarId, auth.userId)
    .run();

  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(auth.userId).first<UserRow>();

  return json({ user: { ...sanitizeUser(user!), color } }, 200, responseHeaders);
};
