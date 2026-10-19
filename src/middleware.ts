import { defineMiddleware } from 'astro:middleware';

/** 全局安全响应头：防点击劫持、MIME 嗅探、Referrer 泄漏 */
export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  const h = response.headers;
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('X-Frame-Options', 'DENY');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  h.set('X-XSS-Protection', '0');
  return response;
});
