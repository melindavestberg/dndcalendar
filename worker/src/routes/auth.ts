import bcryptjs from 'bcryptjs';
import { Env, UserRow } from '../types';
import { json, parseBody, generateId, sanitizeUser, ResponseHeaders } from '../utils';
import { createToken, requireAuth, isAuthError } from '../auth-middleware';

export const register = async (request: Request, env: Env, responseHeaders: ResponseHeaders): Promise<Response> => {
  const { username, email, password } = await parseBody(request);

  if (!username || !email || !password) {
    return json({ error: 'Missing required fields' }, 400, responseHeaders);
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedUsername = String(username).trim();

  const existing = await env.DB.prepare(
    'SELECT id FROM users WHERE email = ? OR username = ?'
  )
    .bind(normalizedEmail, normalizedUsername)
    .first();

  if (existing) {
    return json({ error: 'User already exists' }, 400, responseHeaders);
  }

  const passwordHash = await bcryptjs.hash(password, 10);

  const userId = generateId();
  const now = new Date().toISOString();

  await env.DB.prepare(
    'INSERT INTO users (id, username, email, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  )
    .bind(userId, normalizedUsername, normalizedEmail, passwordHash, 0, now)
    .run();

  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<UserRow>();

  const token = await createToken(env, { userId: user!.id, isAdmin: user!.is_admin });

  return json({ token, user: sanitizeUser(user!) }, 201, responseHeaders);
};

export const login = async (request: Request, env: Env, responseHeaders: ResponseHeaders): Promise<Response> => {
  const { emailOrUsername, password } = await parseBody(request);

  if (!emailOrUsername || !password) {
    return json({ error: 'Email/username and password required' }, 400, responseHeaders);
  }

  const normalizedInput = String(emailOrUsername).trim().toLowerCase();

  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ? OR username = ?')
    .bind(normalizedInput, String(emailOrUsername).trim())
    .first<UserRow>();

  if (!user) {
    return json({ error: 'Invalid credentials' }, 401, responseHeaders);
  }

  const validPassword = await bcryptjs.compare(password, user.password_hash || '');
  if (!validPassword) {
    return json({ error: 'Invalid credentials' }, 401, responseHeaders);
  }

  const token = await createToken(env, { userId: user.id, isAdmin: user.is_admin });

  return json({ token, user: sanitizeUser(user) }, 200, responseHeaders);
};

export const me = async (request: Request, env: Env, responseHeaders: ResponseHeaders): Promise<Response> => {
  const auth = await requireAuth(request, env);
  if (isAuthError(auth)) {
    return json({ error: auth.error }, auth.status, responseHeaders);
  }

  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(auth.userId).first<UserRow>();

  if (!user) {
    return json({ error: 'User not found' }, 404, responseHeaders);
  }

  return json(sanitizeUser(user), 200, responseHeaders);
};

export const updateUsername = async (request: Request, env: Env, responseHeaders: ResponseHeaders): Promise<Response> => {
  const auth = await requireAuth(request, env);
  if (isAuthError(auth)) {
    return json({ error: auth.error }, auth.status, responseHeaders);
  }

  const { username } = await parseBody(request);
  const normalizedUsername = String(username).trim();

  if (!normalizedUsername) {
    return json({ error: 'Username cannot be empty' }, 400, responseHeaders);
  }

  if (normalizedUsername.length > 50) {
    return json({ error: 'Username must be 50 characters or less' }, 400, responseHeaders);
  }

  const existing = await env.DB.prepare(
    'SELECT id FROM users WHERE username = ? AND id != ?'
  )
    .bind(normalizedUsername, auth.userId)
    .first();

  if (existing) {
    return json({ error: 'Username already taken' }, 400, responseHeaders);
  }

  await env.DB.prepare('UPDATE users SET username = ? WHERE id = ?')
    .bind(normalizedUsername, auth.userId)
    .run();

  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(auth.userId).first<UserRow>();

  return json({ user: sanitizeUser(user!) }, 200, responseHeaders);
};

export const updateEmail = async (request: Request, env: Env, responseHeaders: ResponseHeaders): Promise<Response> => {
  const auth = await requireAuth(request, env);
  if (isAuthError(auth)) {
    return json({ error: auth.error }, auth.status, responseHeaders);
  }

  const { email } = await parseBody(request);
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!normalizedEmail) {
    return json({ error: 'Email cannot be empty' }, 400, responseHeaders);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return json({ error: 'Invalid email address' }, 400, responseHeaders);
  }

  const existing = await env.DB.prepare(
    'SELECT id FROM users WHERE email = ? AND id != ?'
  )
    .bind(normalizedEmail, auth.userId)
    .first();

  if (existing) {
    return json({ error: 'Email already in use' }, 400, responseHeaders);
  }

  await env.DB.prepare('UPDATE users SET email = ? WHERE id = ?')
    .bind(normalizedEmail, auth.userId)
    .run();

  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(auth.userId).first<UserRow>();

  return json({ user: sanitizeUser(user!) }, 200, responseHeaders);
};

export const updatePassword = async (request: Request, env: Env, responseHeaders: ResponseHeaders): Promise<Response> => {
  const auth = await requireAuth(request, env);
  if (isAuthError(auth)) {
    return json({ error: auth.error }, auth.status, responseHeaders);
  }

  const { currentPassword, newPassword } = await parseBody(request);

  if (!currentPassword || !newPassword) {
    return json({ error: 'Current and new password are required' }, 400, responseHeaders);
  }

  if (String(newPassword).length < 8) {
    return json({ error: 'New password must be at least 8 characters' }, 400, responseHeaders);
  }

  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(auth.userId).first<UserRow>();

  if (!user) {
    return json({ error: 'User not found' }, 404, responseHeaders);
  }

  const validPassword = await bcryptjs.compare(currentPassword, user.password_hash || '');
  if (!validPassword) {
    return json({ error: 'Current password is incorrect' }, 401, responseHeaders);
  }

  const passwordHash = await bcryptjs.hash(newPassword, 10);

  await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .bind(passwordHash, auth.userId)
    .run();

  return json({ success: true }, 200, responseHeaders);
};
