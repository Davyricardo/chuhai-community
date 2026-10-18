import type { APIRoute } from 'astro';
import { getDB } from '../../../db';
import {
  createSession,
  findUserByEmail,
  sessionCookieName,
  verifyPassword,
} from '../../../lib/auth';

export const POST: APIRoute = async ({ request, locals }) => {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').trim();
  const password = String(body.password || '');

  const db = getDB(locals);
  const user = await findUserByEmail(db, email);

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return json({ ok: false, error: '邮箱或密码不正确' }, 401);
  }

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
