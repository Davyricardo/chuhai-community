import { env } from 'cloudflare:workers';

/** 验证 Cloudflare Turnstile token */
export async function verifyTurnstile(token: string | null | undefined, ip: string): Promise<boolean> {
  if (!token) return false;
  const secret = (env as { TURNSTILE_SECRET?: string }).TURNSTILE_SECRET;
  if (!secret) {
    console.error('[turnstile] 缺少 TURNSTILE_SECRET');
    return false;
  }
  const form = new URLSearchParams({ secret, response: token, remoteip: ip });
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (e) {
    console.error('[turnstile] 校验异常', e);
    return false;
  }
}

export const TURNSTILE_SITEKEY = '0x4AAAAAAFa6NXpqnS6MFmGQ';
