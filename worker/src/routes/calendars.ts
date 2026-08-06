import { pickLeastUsedColor, USER_COLOR_PALETTE } from '../userColors';
import { Env, CalendarRow, MemberWithUserRow, UserRow, ColorCountRow } from '../types';
import { json, parseBody, generateId, generateJoinCode, sanitizeUser, ResponseHeaders } from '../utils';
import { requireAuth, isAuthError, requireCalendarOwner } from '../auth-middleware';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const buildCalendarResponse = async (env: Env, calendar: CalendarRow) => {
  const owner = await env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(calendar.owner_user_id)
    .first<UserRow>();

  const members = await env.DB.prepare(
    'SELECT u.*, cm.color FROM users u JOIN calendar_members cm ON u.id = cm.user_id WHERE cm.calendar_id = ?'
  )
    .bind(calendar.id)
    .all<MemberWithUserRow>();

  return {
    ...calendar,
    owner: sanitizeUser(owner!),
    members: members.results.map((u) => ({ userId: { ...sanitizeUser(u), color: u.color } }))
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
    'INSERT INTO calendar_members (calendar_id, user_id, color, joined_at) VALUES (?, ?, ?, ?)'
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

  const isMember = await env.DB.prepare('SELECT * FROM calendar_members WHERE calendar_id = ? AND user_id = ?')
    .bind(calendarId, auth.userId)
    .first();

  if (!isMember) {
    return json({ error: 'You are not a member of this calendar' }, 403, responseHeaders);
  }

  return json(await buildCalendarResponse(env, calendar), 200, responseHeaders);
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

  if (calendar.owner_user_id === auth.userId) {
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

  const calendar = await env.DB.prepare('SELECT * FROM calendars WHERE id = ?').bind(calendarId).first<CalendarRow>();

  if (!calendar) {
    return json({ error: 'Calendar not found' }, 404, responseHeaders);
  }

  if (calendar.owner_user_id !== auth.userId) {
    return json({ error: 'Only the owner can delete this calendar' }, 403, responseHeaders);
  }

  await env.DB.prepare('DELETE FROM calendars WHERE id = ?').bind(calendarId).run();

  return json({ message: 'Calendar deleted' }, 200, responseHeaders);
};

export const kickMember = async (request: Request, env: Env, responseHeaders: ResponseHeaders, calendarId: string): Promise<Response> => {
  const auth = await requireAuth(request, env);
  if (isAuthError(auth)) {
    return json({ error: auth.error }, auth.status, responseHeaders);
  }

  const ownerCheck = await requireCalendarOwner(env, calendarId, auth.userId, auth.isAdmin);
  if ('error' in ownerCheck) {
    return json({ error: ownerCheck.error }, ownerCheck.status, responseHeaders);
  }

  const { userId } = await parseBody(request);
  if (!userId) {
    return json({ error: 'userId required' }, 400, responseHeaders);
  }

  if (userId === ownerCheck.calendar.owner_user_id) {
    return json({ error: 'Owner cannot be kicked' }, 400, responseHeaders);
  }

  const isMember = await env.DB.prepare('SELECT * FROM calendar_members WHERE calendar_id = ? AND user_id = ?')
    .bind(calendarId, userId)
    .first();

  if (!isMember) {
    return json({ error: 'That user is not a member of this calendar' }, 404, responseHeaders);
  }

  await env.DB.prepare('DELETE FROM calendar_members WHERE calendar_id = ? AND user_id = ?')
    .bind(calendarId, userId)
    .run();

  return json(await buildCalendarResponse(env, ownerCheck.calendar), 200, responseHeaders);
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
