import { UserRow, SanitizedUser } from './types';

export type ResponseHeaders = Record<string, string>;

export const corsHeaders = (origin: string | null, allowedOrigin: string): ResponseHeaders => {
  const useOrigin = allowedOrigin === '*' ? '*' : origin || allowedOrigin || '*';
  return {
    'Access-Control-Allow-Origin': useOrigin,
    'Access-Control-Allow-Headers': 'authorization,content-type',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
};

export const json = (body: unknown, status = 200, headers: ResponseHeaders = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  });

export const parseBody = async (request: Request): Promise<Record<string, any>> => {
  try {
    return await request.json();
  } catch {
    return {};
  }
};

export const getBearerToken = (request: Request): string | null => {
  const auth = request.headers.get('authorization') || '';
  const [, token] = auth.split(' ');
  return token || null;
};

export const generateJoinCode = (): string => {
  const array = new Uint8Array(3);
  crypto.getRandomValues(array);
  return [...array].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
};

export const generateId = (): string => {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return [...array].map((b) => b.toString(16).padStart(2, '0')).join('');
};

export const formatDateYmd = (date: string | Date): string => {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const sanitizeUser = (user: UserRow): SanitizedUser => ({
  id: user.id,
  username: user.username,
  email: user.email,
  isAdmin: Boolean(user.is_admin)
});
