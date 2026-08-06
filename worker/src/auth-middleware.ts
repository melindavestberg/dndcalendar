import { SignJWT, jwtVerify } from 'jose';
import { Env, JwtPayload, AuthContext, AuthError, CalendarRow } from './types';
import { getBearerToken } from './utils';

export type AuthResult = AuthContext | AuthError;

export const isAuthError = (auth: AuthResult): auth is AuthError => 'error' in auth;

const encoder = new TextEncoder();

export const createToken = async (env: Env, payload: JwtPayload): Promise<string> => {
  const key = encoder.encode(env.JWT_SECRET);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(key);
};

export const verifyToken = async (env: Env, token: string): Promise<JwtPayload | null> => {
  const key = encoder.encode(env.JWT_SECRET);
  try {
    const { payload } = await jwtVerify(token, key);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
};

export const requireAuth = async (request: Request, env: Env): Promise<AuthResult> => {
  const token = getBearerToken(request);
  if (!token) {
    return { error: 'No token', status: 401 };
  }

  const payload = await verifyToken(env, token);
  if (!payload) {
    return { error: 'Invalid token', status: 401 };
  }

  return { userId: payload.userId, isAdmin: payload.isAdmin };
};

export const requireCalendarOwner = async (env: Env, calendarId: string, userId: string, isAdmin: number) => {
  const calendar = await env.DB.prepare('SELECT * FROM calendars WHERE id = ?').bind(calendarId).first<CalendarRow>();

  if (!calendar) {
    return { error: 'Calendar not found', status: 404 } as const;
  }

  if (calendar.owner_user_id !== userId && !isAdmin) {
    return { error: 'Only the calendar owner can do this', status: 403 } as const;
  }

  return { calendar };
};
