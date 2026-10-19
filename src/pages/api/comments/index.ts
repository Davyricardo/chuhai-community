import type { APIRoute } from 'astro';
import { and, desc, eq } from 'drizzle-orm';
import { getDB } from '../../../db';
import { comments, users } from '../../../db/schema';
import { getSessionUser, newId, sessionCookieName } from '../../../lib/auth';
import { checkRate } from '../../../lib/ratelimit';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** 列出评论：?targetType=article&targetId=xxx */
export const GET: APIRoute = async ({ url }) => {
  const targetType = url.searchParams.get('targetType') || '';
  const targetId = url.searchParams.get('targetId') || '';
  if (!targetType || !targetId) return json({ ok: false, error: '缺少参数' }, 400);

  const db = getDB();
  const rows = await db
    .select({
      id: comments.id,
      content: comments.content,
      createdAt: comments.createdAt,
      displayName: users.displayName,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(and(eq(comments.targetType, targetType), eq(comments.targetId, targetId)))
    .orderBy(desc(comments.createdAt))
    .limit(200);

  return json({ ok: true, comments: rows });
};

/** 发表评论（需登录） */
export const POST: APIRoute = async ({ request, cookies }) => {
  const db = getDB();
  const user = await getSessionUser(db, cookies.get(sessionCookieName())?.value);
  if (!user) return json({ ok: false, error: '请先登录' }, 401);

  // 限流：同一用户每 10 秒最多 5 条评论
  const limit = await checkRate(db, `comment:user:${user.id}`, 5, 10_000);
  if (!limit.ok) return json({ ok: false, error: '评论太快了，稍等一下' }, 429);

  const body = await request.json().catch(() => ({}));
  const targetType = String(body.targetType || '').trim();
  const targetId = String(body.targetId || '').trim();
  const content = String(body.content || '').trim();

  if (!['article', 'topic'].includes(targetType)) return json({ ok: false, error: '类型不合法' }, 400);
  if (!targetId) return json({ ok: false, error: '缺少目标' }, 400);
  if (!content) return json({ ok: false, error: '内容不能为空' }, 400);
  if (content.length > 2000) return json({ ok: false, error: '内容太长' }, 400);

  const row = {
    id: newId(),
    targetType,
    targetId,
    userId: user.id,
    content,
    parentId: null,
    createdAt: Date.now(),
  };
  await db.insert(comments).values(row);
  return json({ ok: true, comment: { ...row, displayName: user.displayName } });
};
