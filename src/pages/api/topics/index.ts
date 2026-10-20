import type { APIRoute } from 'astro';
import { desc } from 'drizzle-orm';
import { getDB } from '../../../db';
import { topics } from '../../../db/schema';
import { getSessionUser, newId, sessionCookieName } from '../../../lib/auth';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async () => {
  const db = getDB();
  const rows = await db.select().from(topics).orderBy(desc(topics.voteCount), desc(topics.createdAt)).limit(100);
  return json({ ok: true, topics: rows });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const db = getDB();
  const user = await getSessionUser(db, cookies.get(sessionCookieName())?.value);
  if (!user) return json({ ok: false, error: '请先登录' }, 401);
  if (!user.emailVerified) return json({ ok: false, error: '邮箱未验证，请先完成邮箱验证' }, 403);

  const body = await request.json().catch(() => ({}));
  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim() || null;

  if (!title) return json({ ok: false, error: '标题必填' }, 400);
  if (title.length > 120) return json({ ok: false, error: '标题太长' }, 400);

  const row = {
    id: newId(),
    title,
    description,
    userId: user.id,
    status: 'open' as const,
    voteCount: 0,
    createdAt: Date.now(),
  };
  await db.insert(topics).values(row);
  return json({ ok: true, topic: row });
};
