import type { APIRoute } from 'astro';
import { and, eq, sql } from 'drizzle-orm';
import { getDB } from '../../../../db';
import { topicVotes, topics } from '../../../../db/schema';
import { getSessionUser, newId, sessionCookieName } from '../../../../lib/auth';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** 投票 / 取消投票（同一用户对同一话题只投一票） */
export const POST: APIRoute = async ({ params, cookies }) => {
  const topicId = params.id || '';
  const db = getDB();
  const user = await getSessionUser(db, cookies.get(sessionCookieName())?.value);
  if (!user) return json({ ok: false, error: '请先登录' }, 401);

  const topicRows = await db.select().from(topics).where(eq(topics.id, topicId)).limit(1);
  if (!topicRows.length) return json({ ok: false, error: '话题不存在' }, 404);

  const existing = await db
    .select()
    .from(topicVotes)
    .where(and(eq(topicVotes.topicId, topicId), eq(topicVotes.userId, user.id)))
    .limit(1);

  if (existing.length) {
    await db.delete(topicVotes).where(eq(topicVotes.id, existing[0].id));
    await db.update(topics).set({ voteCount: sql`MAX(${topics.voteCount} - 1, 0)` }).where(eq(topics.id, topicId));
    const after = await db.select({ c: topics.voteCount }).from(topics).where(eq(topics.id, topicId)).limit(1);
    return json({ ok: true, voted: false, voteCount: after[0]?.c ?? 0 });
  }

  await db.insert(topicVotes).values({
    id: newId(),
    topicId,
    userId: user.id,
    createdAt: Date.now(),
  });
  await db.update(topics).set({ voteCount: sql`${topics.voteCount} + 1` }).where(eq(topics.id, topicId));
  const after = await db.select({ c: topics.voteCount }).from(topics).where(eq(topics.id, topicId)).limit(1);
  return json({ ok: true, voted: true, voteCount: after[0]?.c ?? 0 });
};
