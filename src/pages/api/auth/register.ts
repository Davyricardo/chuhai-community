import type { APIRoute } from 'astro';
import { getDB } from '../../../db';
import {
  consumeEmailCode,
  createSession,
  createUser,
  findUserByEmail,
  hashPassword,
  sessionCookieName,
} from '../../../lib/auth';

export const POST: APIRoute = async ({ request, locals }) => {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').trim();
  const code = String(body.code || '').trim();
  const displayName = String(body.displayName || '').trim() || email.split('@')[0];
  const password = String(body.password || '');

  if (!email || !code) {
    return json({ ok: false, error: '邮箱和验证码必填' }, 400);
  }

  const db = getDB(locals);

  if (await findUserByEmail(db, email)) {
    return json({ ok: false, error: '该邮箱已注册' }, 409);
  }

  const valid = await consumeEmailCode(db, email, code, 'register');
  if (!valid) {
    return json({ ok: false, error: '验证码错误或已过期' }, 400);
  }

  const passwordHash = password ? await hashPassword(password) : null;
  const user = await createUser(db, email, displayName, passwordHash);
  const sessionId = await createSession(db, user.id);

  return new Response(
    JSON.stringify({ ok: true, user: { id: user.id, email: user.email, displayName: user.displayName } }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `${sessionCookieName()}=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 3600}`,
      },
    },
  );
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
