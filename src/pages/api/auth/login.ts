import type { APIRoute } from 'astro';
import { getDB } from '../../../db';
import {
  createSession,
  findUserByEmail,
  sessionCookieName,
  verifyPassword,
} from '../../../lib/auth';
import { checkRate, clientIp } from '../../../lib/ratelimit';

export const POST: APIRoute = async ({ request, locals }) => {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').trim();
  const password = String(body.password || '');

  const db = getDB();

  // 限流：同一 IP 每分钟最多 10 次登录尝试
  const ip = clientIp(request);
  const limit = await checkRate(db, `login:ip:${ip}`, 10, 60_000);
  if (!limit.ok) {
    return json({ ok: false, error: `尝试过于频繁，请 ${limit.retryAfter} 秒后再试` }, 429);
  }

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
