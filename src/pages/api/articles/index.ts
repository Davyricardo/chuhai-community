import type { APIRoute } from 'astro';
import { desc, eq } from 'drizzle-orm';
import { getDB } from '../../../db';
import { articles } from '../../../db/schema';
import { getSessionUser, newId, sessionCookieName } from '../../../lib/auth';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** 文章列表（公开） */
export const GET: APIRoute = async ({ url }) => {
  const db = getDB();
  const limit = Math.min(Number(url.searchParams.get('limit') || 20), 100);
  const rows = await db
    .select()
    .from(articles)
    .where(eq(articles.published, 1))
    .orderBy(desc(articles.publishedAt))
    .limit(limit);
  return json({ ok: true, articles: rows });
};

/** 新建文章（仅管理员） */
export const POST: APIRoute = async ({ request, cookies }) => {
  const db = getDB();
  const user = await getSessionUser(db, cookies.get(sessionCookieName())?.value);
  if (!user) return json({ ok: false, error: '请先登录' }, 401);
  if (user.role !== 'admin') return json({ ok: false, error: '需要管理员权限' }, 403);

  const body = await request.json().catch(() => ({}));
  const title = String(body.title || '').trim();
  const slugInput = String(body.slug || '').trim();
  const summary = String(body.summary || '').trim() || null;
  const content = String(body.content || '').trim() || null;
  const link = String(body.link || '').trim() || null;
  const tags = String(body.tags || '').trim() || null;

  if (!title) return json({ ok: false, error: '标题必填' }, 400);
  if (!content && !link) return json({ ok: false, error: '正文或外链至少填一个' }, 400);

  const slug =
    slugInput ||
    title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) ||
    newId().slice(0, 8);

  const existing = await db.select({ id: articles.id }).from(articles).where(eq(articles.slug, slug)).limit(1);
  if (existing.length) return json({ ok: false, error: 'slug 已存在，换一个' }, 409);

  const ts = Date.now();
  const row = {
    id: newId(),
    title,
    slug,
    summary,
    content,
    link,
    coverUrl: null,
    tags,
    authorId: user.id,
    published: 1,
    publishedAt: ts,
    createdAt: ts,
  };
  await db.insert(articles).values(row);
  return json({ ok: true, article: { id: row.id, slug: row.slug } });
};
