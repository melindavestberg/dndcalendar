import { Env, AvailabilityRow, AvailabilityWithUserRow, DisabledDateRow } from '../types';
import { json, parseBody, formatDateYmd, ResponseHeaders } from '../utils';
import { requireAuth, isAuthError } from '../auth-middleware';

export const toggleAvailability = async (request: Request, env: Env, responseHeaders: ResponseHeaders, calendarId: string): Promise<Response> => {
  const auth = await requireAuth(request, env);
  if (isAuthError(auth)) {
    return json({ error: auth.error }, auth.status, responseHeaders);
  }

  const { date } = await parseBody(request);
  if (!date) {
    return json({ error: 'Date required' }, 400, responseHeaders);
  }

  const isMember = await env.DB.prepare('SELECT * FROM calendar_members WHERE calendar_id = ? AND user_id = ?')
    .bind(calendarId, auth.userId)
    .first();

  if (!isMember) {
    return json({ error: 'Not a member of this calendar' }, 403, responseHeaders);
  }

  const dateYmd = formatDateYmd(date);

  const disabledDate = await env.DB.prepare('SELECT * FROM disabled_dates WHERE calendar_id = ? AND date_ymd = ?')
    .bind(calendarId, dateYmd)
    .first();

  if (disabledDate) {
    return json({ error: 'This date is disabled by admin' }, 400, responseHeaders);
  }

  const existing = await env.DB.prepare(
    'SELECT * FROM availability WHERE calendar_id = ? AND user_id = ? AND date_ymd = ?'
  )
    .bind(calendarId, auth.userId, dateYmd)
    .first<AvailabilityRow>();

  const now = new Date().toISOString();

  if (existing) {
    await env.DB.prepare('UPDATE availability SET available = ? WHERE calendar_id = ? AND user_id = ? AND date_ymd = ?')
      .bind(existing.available ? 0 : 1, calendarId, auth.userId, dateYmd)
      .run();
  } else {
    await env.DB.prepare(
      'INSERT INTO availability (calendar_id, user_id, date_ymd, available, created_at) VALUES (?, ?, ?, ?, ?)'
    )
      .bind(calendarId, auth.userId, dateYmd, 1, now)
      .run();
  }

  const updated = await env.DB.prepare(
    'SELECT * FROM availability WHERE calendar_id = ? AND user_id = ? AND date_ymd = ?'
  )
    .bind(calendarId, auth.userId, dateYmd)
    .first();

  return json(updated, 200, responseHeaders);
};

export const getMonthAvailability = async (
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

  const isMember = await env.DB.prepare('SELECT * FROM calendar_members WHERE calendar_id = ? AND user_id = ?')
    .bind(calendarId, auth.userId)
    .first();

  if (!isMember) {
    return json({ error: 'Not a member of this calendar' }, 403, responseHeaders);
  }

  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 1));

  const startYmd = formatDateYmd(startDate);
  const endYmd = formatDateYmd(endDate);

  const myAvailabilities = await env.DB.prepare(
    'SELECT * FROM availability WHERE calendar_id = ? AND user_id = ? AND date_ymd >= ? AND date_ymd < ?'
  )
    .bind(calendarId, auth.userId, startYmd, endYmd)
    .all<AvailabilityRow>();

  const allAvailabilities = await env.DB.prepare(
    `SELECT a.*, u.username, cm.color FROM availability a
     JOIN users u ON a.user_id = u.id
     JOIN calendar_members cm ON a.calendar_id = cm.calendar_id AND a.user_id = cm.user_id
     WHERE a.calendar_id = ? AND a.available = 1 AND a.date_ymd >= ? AND a.date_ymd < ?`
  )
    .bind(calendarId, startYmd, endYmd)
    .all<AvailabilityWithUserRow>();

  const disabledDates = await env.DB.prepare(
    'SELECT * FROM disabled_dates WHERE calendar_id = ? AND date_ymd >= ? AND date_ymd < ?'
  )
    .bind(calendarId, startYmd, endYmd)
    .all<DisabledDateRow>();

  const availabilityByDate: Record<string, { userId: string; username: string; color: string }[]> = {};
  for (const av of allAvailabilities.results) {
    const dateStr = av.date_ymd;
    if (!availabilityByDate[dateStr]) availabilityByDate[dateStr] = [];

    availabilityByDate[dateStr].push({
      userId: av.user_id,
      username: av.username,
      color: av.color
    });
  }

  return json(
    {
      myAvailabilities: myAvailabilities.results,
      disabledDates: disabledDates.results,
      availabilityByDate
    },
    200,
    responseHeaders
  );
};
