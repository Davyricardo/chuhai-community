/**
 * 邮件发送：走 Resend HTTP API（Workers 原生支持 fetch，无需 SMTP）。
 * API Key 通过 Workers secret 注入：wrangler secret put RESEND_API_KEY
 */
import { env } from 'cloudflare:workers';

const FROM = 'ChatSI <noreply@kittywizards.com>';

async function send(to: string, subject: string, text: string): Promise<boolean> {
  const key = (env as { RESEND_API_KEY?: string }).RESEND_API_KEY;
  if (!key) {
    console.error('[mail] 缺少 RESEND_API_KEY，请用 wrangler secret put 注入');
    return false;
  }
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, text }),
  });
  if (!resp.ok) {
    console.error('[mail] 发送失败', resp.status, await resp.text().catch(() => ''));
    return false;
  }
  return true;
}

/** 发送注册/登录验证码 */
export function sendCodeEmail(to: string, code: string): Promise<boolean> {
  return send(
    to,
    '【ChatSI】你的验证码',
    `你的验证码是 ${code}，10 分钟内有效。\n\n如果不是你本人操作，请忽略此邮件。`,
  );
}
