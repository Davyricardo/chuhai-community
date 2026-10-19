import { defineMiddleware } from 'astro:middleware';
import { getDB } from './db';
import { getSessionUser, sessionCookieName } from './lib/auth';

/** 全局安全响应头：防点击劫持、MIME 嗅探、Referrer 泄漏 */
export const onRequest = defineMiddleware(async (context, next) => {
  // 注入登录态（必须在 next() 之前：next() 会渲染页面，晚于此赋值页面读不到）
  // 仅页面请求；API 自行解析 cookie，响应契约不变
  const path = context.url.pathname;
  if (!path.startsWith('/api/') && !path.startsWith('/_')) {
    try {
      const db = getDB();
      const user = await getSessionUser(db, context.cookies.get(sessionCookieName())?.value);
      context.locals.user = user ?? null;
    } catch {
      context.locals.user = null;
    }
  }

  const response = await next();

  const h = response.headers;
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('X-Frame-Options', 'DENY');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  h.set('X-XSS-Protection', '0');

  return response;
});
