import { Env, AvailabilitySummaryRow, DisabledDateWithUserRow } from '../types';
import { json, parseBody, formatDateYmd, ResponseHeaders } from '../utils';
import { requireAuth, isAuthError, requireCalendarOwner } from '../auth-middleware';

export const disableDate = async (request: Request, env: Env, responseHeaders: ResponseHeaders, calendarId: string): Promise<Response> => {
  const auth = await requireAuth(request, env);
  if (isAuthError(auth)) {
    return json({ error: auth.error }, auth.status, responseHeaders);
  }

  const ownerCheck = await requireCalendarOwner(env, calendarId, auth.userId, auth.isAdmin);
  if ('error' in ownerCheck) {
    return json({ error: ownerCheck.error }, ownerCheck.status, responseHeaders);
  }

  const { date, reason } = await parseBody(request);
  if (!date) {
    return json({ error: 'Date required' }, 400, responseHeaders);
  }

  const dateYmd = formatDateYmd(date);

  const existing = await env.DB.prepare('SELECT * FROM disabled_dates WHERE calendar_id = ? AND date_ymd = ?')
    .bind(calendarId, dateYmd)
    .first();

  if (existing) {
    return json({ error: 'Date already disabled' }, 400, responseHeaders);
  }

  const now = new Date().toISOString();

  await env.DB.prepare(
    'INSERT INTO disabled_dates (calendar_id, date_ymd, reason, disabled_by_user_id, created_at) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(calendarId, dateYmd, reason || 'Date disabled by admin', auth.userId, now)
    .run();

  await env.DB.prepare('DELETE FROM availability WHERE calendar_id = ? AND date_ymd = ?')
    .bind(calendarId, dateYmd)
    .run();

  const disabled = await env.DB.prepare('SELECT * FROM disabled_dates WHERE calendar_id = ? AND date_ymd = ?')
    .bind(calendarId, dateYmd)
    .first();

  return json(disabled, 201, responseHeaders);
};

export const enableDate = async (request: Request, env: Env, responseHeaders: ResponseHeaders, calendarId: string): Promise<Response> => {
  const auth = await requireAuth(request, env);
  if (isAuthError(auth)) {
    return json({ error: auth.error }, auth.status, responseHeaders);
  }

  const ownerCheck = await requireCalendarOwner(env, calendarId, auth.userId, auth.isAdmin);
  if ('error' in ownerCheck) {
    return json({ error: ownerCheck.error }, ownerCheck.status, responseHeaders);
  }

  const { date } = await parseBody(request);
  if (!date) {
    return json({ error: 'Date required' }, 400, responseHeaders);
  }

  const dateYmd = formatDateYmd(date);

  const result = await env.DB.prepare('DELETE FROM disabled_dates WHERE calendar_id = ? AND date_ymd = ?')
    .bind(calendarId, dateYmd)
    .run();

  if (result.success && result.meta.changes === 0) {
    return json({ error: 'Date not found in disabled list' }, 404, responseHeaders);
  }

  return json({ message: 'Date enabled' }, 200, responseHeaders);
};

export const getDisabledDates = async (request: Request, env: Env, responseHeaders: ResponseHeaders, calendarId: string): Promise<Response> => {
  const auth = await requireAuth(request, env);
  if (isAuthError(auth)) {
    return json({ error: auth.error }, auth.status, responseHeaders);
  }

  const ownerCheck = await requireCalendarOwner(env, calendarId, auth.userId, auth.isAdmin);
  if ('error' in ownerCheck) {
    return json({ error: ownerCheck.error }, ownerCheck.status, responseHeaders);
  }

  const disabledDates = await env.DB.prepare(
    'SELECT dd.*, u.username FROM disabled_dates dd JOIN users u ON dd.disabled_by_user_id = u.id WHERE dd.calendar_id = ?'
  )
    .bind(calendarId)
    .all<DisabledDateWithUserRow>();

  return json(disabledDates.results, 200, responseHeaders);
};

export const getAvailabilitySummary = async (
  request: Request,
  env: Env,
  responseHeaders: ResponseHeaders,
  calendarId: string,
  year: number,
  month: number
): Promise<Response> => {
  const auth = await requireAuth(request, env);
  if (isAuthError(auth)) {
    return json({ error: auth.error }, auth.status, responseHeaders);
  }

  const ownerCheck = await requireCalendarOwner(env, calendarId, auth.userId, auth.isAdmin);
  if ('error' in ownerCheck) {
    return json({ error: ownerCheck.error }, ownerCheck.status, responseHeaders);
  }

  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 1));

  const startYmd = formatDateYmd(startDate);
  const endYmd = formatDateYmd(endDate);

  const availabilities = await env.DB.prepare(
    `SELECT a.date_ymd, u.username, u.email, cm.color FROM availability a
     JOIN users u ON a.user_id = u.id
     JOIN calendar_members cm ON a.calendar_id = cm.calendar_id AND a.user_id = cm.user_id
     WHERE a.calendar_id = ? AND a.available = 1 AND a.date_ymd >= ? AND a.date_ymd < ?`
  )
    .bind(calendarId, startYmd, endYmd)
    .all<AvailabilitySummaryRow>();

  const summary: Record<string, { username: string; email: string; color: string }[]> = {};
  for (const av of availabilities.results) {
    if (!summary[av.date_ymd]) summary[av.date_ymd] = [];
    summary[av.date_ymd].push({
      username: av.username,
      email: av.email,
      color: av.color
    });
  }

  return json(summary, 200, responseHeaders);
};
