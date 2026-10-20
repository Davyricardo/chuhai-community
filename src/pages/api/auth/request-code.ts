import type { APIRoute } from 'astro';
import { getDB } from '../../../db';
import { issueEmailCode, isValidEmail } from '../../../lib/auth';
import { sendCodeEmail } from '../../../lib/mail';
import { checkRate, clientIp } from '../../../lib/ratelimit';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  let email = '';
  // 登录已改为邮箱 + 密码，不再发登录验证码；仅保留 register 与 reset
  let purpose: 'register' | 'reset' = 'register';

  try {
    const body = await request.json();
    email = String(body.email || '').trim();
    if (body.purpose === 'reset') purpose = body.purpose;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: '请求格式错误' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!isValidEmail(email)) {
    return new Response(JSON.stringify({ ok: false, error: '邮箱格式不正确' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDB();

  // 限流：同一 IP 每小时最多 10 次，同一邮箱每 10 分钟最多 3 次
  const ip = clientIp(request);
  const ipLimit = await checkRate(db, `code:ip:${ip}`, 10, 3600_000);
  if (!ipLimit.ok) {
    return json({ ok: false, error: `请求过于频繁，请 ${ipLimit.retryAfter} 秒后再试` }, 429);
  }
  const emailLimit = await checkRate(db, `code:email:${email.toLowerCase()}`, 3, 600_000);
  if (!emailLimit.ok) {
    return json({ ok: false, error: '该邮箱请求过于频繁，请稍后再试' }, 429);
  }

  const code = await issueEmailCode(db, email, purpose);
  const sent = await sendCodeEmail(email, code);

  return new Response(
    JSON.stringify({ ok: sent, error: sent ? null : '邮件发送失败，请稍后重试' }),
    { status: sent ? 200 : 500, headers: { 'Content-Type': 'application/json' } },
  );
};
