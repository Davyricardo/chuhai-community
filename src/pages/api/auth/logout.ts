import type { APIRoute } from 'astro';
import { getDB } from '../../../db';
import { destroySession, sessionCookieName } from '../../../lib/auth';

/** 清除会话 cookie 的响应头，两条分支共用 */
const CLEAR_COOKIE = `${sessionCookieName()}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

export const POST: APIRoute = async ({ cookies, request }) => {
  const sid = cookies.get(sessionCookieName())?.value;
  if (sid) {
    await destroySession(getDB(), sid);
  }

  // 内容协商：
  // - 浏览器直接提交表单（导航栏按钮 / 退出页）时 Accept 含 text/html
  //   → 303 跳回首页，否则用户会停在一个显示裸 JSON {"ok":true} 的接口页上。
  // - 程序化请求（fetch / JSON）保持原有契约不变：200 + {"ok":true}。
  const wantsHtml = (request.headers.get('accept') || '').includes('text/html');
  if (wantsHtml) {
    return new Response(null, {
      status: 303,
      headers: {
        Location: '/',
        'Set-Cookie': CLEAR_COOKIE,
      },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': CLEAR_COOKIE,
    },
  });
};
