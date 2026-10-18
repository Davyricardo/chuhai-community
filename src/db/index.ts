import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

/**
 * 在 Astro + Cloudflare 下，D1 通过 locals.runtime.env.DB 拿到。
 * 用法：const db = getDB(Astro.locals);
 */
export function getDB(locals: App.Locals | { runtime?: { env?: { DB?: D1Database } } }) {
  const env = (locals as { runtime?: { env?: { DB?: D1Database } } }).runtime?.env;
  if (!env?.DB) {
    throw new Error('D1 绑定缺失：检查 wrangler.jsonc 的 d1_databases 是否配置了 binding "DB"');
  }
  return drizzle(env.DB, { schema });
}

export { schema };
