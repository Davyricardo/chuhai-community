import type { APIRoute } from 'astro';
import { getDB } from '../../../db';
import { destroySession, sessionCookieName } from '../../../lib/auth';

export const POST: APIRoute = async ({ cookies, locals }) => {
  const sid = cookies.get(sessionCookieName())?.value;
  if (sid) {
    await destroySession(getDB(), sid);
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `${sessionCookieName()}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    },
  });
};
