import type { APIRoute } from 'astro';
import { getDB } from '../../../db';
import {
  consumeEmailCode,
  createSession,
  createUser,
  findUserByEmail,
  hashPassword,
  isFirstUser,
  isValidEmail,
  MIN_PASSWORD_LENGTH,
  sessionCookieName,
} from '../../../lib/auth';
import { checkRate, clientIp } from '../../../lib/ratelimit';
import { verifyTurnstile } from '../../../lib/turnstile';

export const POST: APIRoute = async ({ request, locals }) => {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').trim();
  const code = String(body.code || '').trim();
  const displayName = String(body.displayName || '').trim() || email.split('@')[0];
  const password = String(body.password || '');
  // 老客户端可能不发这一栏：视为空字符串，配合下面的「两边都空则跳过」
  const passwordConfirm = body.passwordConfirm === undefined ? '' : String(body.passwordConfirm);

  if (!email || !code) {
    return json({ ok: false, error: '邮箱和验证码必填' }, 400);
  }

  // 与发码接口共用同一套邮箱判据；form 关了浏览器校验，这里必须自己拦
  if (!isValidEmail(email)) {
    return json({ ok: false, error: '邮箱格式不正确' }, 400);
  }

  // 密码不再可选：登录方式是邮箱 + 密码
  if (!password) {
    return json({ ok: false, error: '请设置密码' }, 400);
  }
  if (!passwordConfirm) {
    return json({ ok: false, error: '请再次输入密码' }, 400);
  }
  if (password !== passwordConfirm) {
    return json({ ok: false, error: '两次输入的密码不一致' }, 400);
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return json({ ok: false, error: `密码至少 ${MIN_PASSWORD_LENGTH} 位` }, 400);
  }

  const turnstileToken = String(body.turnstileToken || '');
  if (!(await verifyTurnstile(turnstileToken, clientIp(request)))) {
    return json({ ok: false, error: '人机验证未通过，请刷新页面重试' }, 400);
  }

  const db = getDB();

  // 限流：同一 IP 每小时最多 5 次注册尝试
  const ip = clientIp(request);
  const regLimit = await checkRate(db, `register:ip:${ip}`, 5, 3600_000);
  if (!regLimit.ok) {
    return json({ ok: false, error: '注册过于频繁，请稍后再试' }, 429);
  }

  if (await findUserByEmail(db, email)) {
    return json({ ok: false, error: '该邮箱已注册' }, 409);
  }

  const valid = await consumeEmailCode(db, email, code, 'register');
  if (!valid) {
    return json({ ok: false, error: '验证码错误或已过期' }, 400);
  }

  const passwordHash = password ? await hashPassword(password) : null;
  const first = await isFirstUser(db);
  const user = await createUser(db, email, displayName, passwordHash, first ? 'admin' : 'user');
  const sessionId = await createSession(db, user.id);

  return new Response(
    JSON.stringify({
      ok: true,
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `${sessionCookieName()}=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 3600}`,
      },
    },
  );
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
