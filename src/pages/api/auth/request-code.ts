import type { APIRoute } from 'astro';
import { getDB } from '../../../db';
import { issueEmailCode } from '../../../lib/auth';
import { sendCodeEmail } from '../../../lib/mail';

export const POST: APIRoute = async ({ request, locals }) => {
  let email = '';
  let purpose: 'register' | 'login' | 'reset' = 'register';

  try {
    const body = await request.json();
    email = String(body.email || '').trim();
    if (body.purpose === 'login' || body.purpose === 'reset') purpose = body.purpose;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: '请求格式错误' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ ok: false, error: '邮箱格式不正确' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDB();
  const code = await issueEmailCode(db, email, purpose);
  const sent = await sendCodeEmail(email, code);

  return new Response(
    JSON.stringify({ ok: sent, error: sent ? null : '邮件发送失败，请稍后重试' }),
    { status: sent ? 200 : 500, headers: { 'Content-Type': 'application/json' } },
  );
};
