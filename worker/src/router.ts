import { Env } from './types';
import { json, ResponseHeaders } from './utils';
import { register, login, me, updateUsername, updateEmail, updatePassword } from './routes/auth';
import {
  createCalendar,
  joinCalendar,
  listMyCalendars,
  getCalendar,
  leaveCalendar,
  deleteCalendar,
  updateMemberColor,
  kickMember
} from './routes/calendars';
import { toggleAvailability, getMonthAvailability } from './routes/availability';
import { disableDate, enableDate, getDisabledDates, getAvailabilitySummary } from './routes/admin';

const health = (responseHeaders: ResponseHeaders): Response =>
  json({ status: 'Worker API is running' }, 200, responseHeaders);

export const router = async (request: Request, env: Env, responseHeaders: ResponseHeaders): Promise<Response> => {
  const { pathname } = new URL(request.url);
  const { method } = request;

  // Health
  if (method === 'GET' && pathname === '/api/health') {
    return health(responseHeaders);
  }

  // Auth
  if (method === 'POST' && pathname === '/api/auth/register') {
    return register(request, env, responseHeaders);
  }
  if (method === 'POST' && pathname === '/api/auth/login') {
    return login(request, env, responseHeaders);
  }
  if (method === 'GET' && pathname === '/api/auth/me') {
    return me(request, env, responseHeaders);
  }
  if (method === 'PATCH' && pathname === '/api/auth/me/username') {
    return updateUsername(request, env, responseHeaders);
  }
  if (method === 'PATCH' && pathname === '/api/auth/me/email') {
    return updateEmail(request, env, responseHeaders);
  }
  if (method === 'PATCH' && pathname === '/api/auth/me/password') {
    return updatePassword(request, env, responseHeaders);
  }

  // Calendars
  if (method === 'POST' && pathname === '/api/calendars/create') {
    return createCalendar(request, env, responseHeaders);
  }
  if (method === 'POST' && pathname === '/api/calendars/join') {
    return joinCalendar(request, env, responseHeaders);
  }
  if (method === 'GET' && pathname === '/api/calendars/mine') {
    return listMyCalendars(request, env, responseHeaders);
  }

  const leaveMatch = pathname.match(/^\/api\/calendars\/([^/]+)\/leave$/);
  if (method === 'POST' && leaveMatch) {
    return leaveCalendar(request, env, responseHeaders, leaveMatch[1]);
  }

  const colorMatch = pathname.match(/^\/api\/calendars\/([^/]+)\/color$/);
  if (method === 'PATCH' && colorMatch) {
    return updateMemberColor(request, env, responseHeaders, colorMatch[1]);
  }

  const kickMatch = pathname.match(/^\/api\/calendars\/([^/]+)\/kick$/);
  if (method === 'POST' && kickMatch) {
    return kickMember(request, env, responseHeaders, kickMatch[1]);
  }

  const calendarMatch = pathname.match(/^\/api\/calendars\/([^/]+)$/);
  if (calendarMatch) {
    if (method === 'GET') {
      return getCalendar(request, env, responseHeaders, calendarMatch[1]);
    }
    if (method === 'DELETE') {
      return deleteCalendar(request, env, responseHeaders, calendarMatch[1]);
    }
  }

  // Availability
  const availToggleMatch = pathname.match(/^\/api\/availability\/([^/]+)\/toggle$/);
  if (method === 'POST' && availToggleMatch) {
    return toggleAvailability(request, env, responseHeaders, availToggleMatch[1]);
  }

  const monthMatch = pathname.match(/^\/api\/availability\/([^/]+)\/month\/(\d+)\/(\d+)$/);
  if (method === 'GET' && monthMatch) {
    return getMonthAvailability(request, env, responseHeaders, monthMatch[1], parseInt(monthMatch[2]), parseInt(monthMatch[3]));
  }

  // Admin
  const adminDisableMatch = pathname.match(/^\/api\/admin\/([^/]+)\/disable-date$/);
  if (method === 'POST' && adminDisableMatch) {
    return disableDate(request, env, responseHeaders, adminDisableMatch[1]);
  }

  const adminEnableMatch = pathname.match(/^\/api\/admin\/([^/]+)\/enable-date$/);
  if (method === 'POST' && adminEnableMatch) {
    return enableDate(request, env, responseHeaders, adminEnableMatch[1]);
  }

  const adminDisabledMatch = pathname.match(/^\/api\/admin\/([^/]+)\/disabled-dates$/);
  if (method === 'GET' && adminDisabledMatch) {
    return getDisabledDates(request, env, responseHeaders, adminDisabledMatch[1]);
  }

  const adminSummaryMatch = pathname.match(/^\/api\/admin\/([^/]+)\/availability-summary\/(\d+)\/(\d+)$/);
  if (method === 'GET' && adminSummaryMatch) {
    return getAvailabilitySummary(request, env, responseHeaders, adminSummaryMatch[1], parseInt(adminSummaryMatch[2]), parseInt(adminSummaryMatch[3]));
  }

  return json({ error: 'Route not found' }, 404, responseHeaders);
};
