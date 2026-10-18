import { drizzle } from 'drizzle-orm/d1';
import { env } from 'cloudflare:workers';
import * as schema from './schema';

/**
 * Astro v6+ 起 locals.runtime.env 已移除，改用 cloudflare:workers 的 env。
 */
export function getDB() {
  const DB = (env as { DB?: D1Database }).DB;
  if (!DB) {
    throw new Error('D1 绑定缺失：检查 wrangler.jsonc 的 d1_databases 是否配置了 binding "DB"');
  }
  return drizzle(DB, { schema });
}

export { schema };
