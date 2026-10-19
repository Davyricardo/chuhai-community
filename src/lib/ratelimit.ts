import { eq } from 'drizzle-orm';
import { rateLimits } from '../db/schema';

type DB = ReturnType<typeof import('../db').getDB>;

export type RateResult = { ok: boolean; remaining: number; retryAfter: number };

/**
 * 固定窗口限流：同一 key 在 windowMs 内最多 limit 次。
 * key 形如 `code:email:xxx` / `login:ip:1.2.3.4`。
 */
export async function checkRate(db: DB, key: string, limit: number, windowMs: number): Promise<RateResult> {
  const now = Date.now();
  const rows = await db.select().from(rateLimits).where(eq(rateLimits.key, key)).limit(1);
  const row = rows[0];

  if (!row || now - row.windowStart > windowMs) {
    await db
      .insert(rateLimits)
      .values({ key, count: 1, windowStart: now })
      .onConflictDoUpdate({ target: rateLimits.key, set: { count: 1, windowStart: now } });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }

  if (row.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfter: Math.ceil((row.windowStart + windowMs - now) / 1000),
    };
  }

  await db.update(rateLimits).set({ count: row.count + 1 }).where(eq(rateLimits.key, key));
  return { ok: true, remaining: limit - row.count - 1, retryAfter: 0 };
}

/** 客户端 IP（Cloudflare 提供） */
export function clientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}
