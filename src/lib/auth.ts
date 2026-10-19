import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { emailCodes, sessions, users, type User } from '../db/schema';

type DB = ReturnType<typeof import('../db').getDB>;

export function newId(): string {
  return crypto.randomUUID();
}

export function now(): number {
  return Date.now();
}

/** 密码哈希（bcryptjs 为纯 JS，Workers 可用） */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string | null): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

/** 会话：30 天有效，cookie 名 chuhai_session */
const SESSION_COOKIE = 'chuhai_session';
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000;

export async function createSession(db: DB, userId: string): Promise<string> {
  const id = newId();
  const createdAt = now();
  await db.insert(sessions).values({
    id,
    userId,
    expiresAt: createdAt + SESSION_TTL,
    createdAt,
  });
  return id;
}

export async function getSessionUser(db: DB, sessionId: string | undefined): Promise<User | null> {
  if (!sessionId) return null;
  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now())))
    .limit(1);
  return rows[0]?.user ?? null;
}

export async function destroySession(db: DB, sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export function sessionCookieName(): string {
  return SESSION_COOKIE;
}

/** 6 位数字验证码，10 分钟有效 */
const CODE_TTL = 10 * 60 * 1000;

export function generateCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 1000000).padStart(6, '0');
}

export async function issueEmailCode(
  db: DB,
  email: string,
  purpose: 'register' | 'login' | 'reset' = 'register',
): Promise<string> {
  const code = generateCode();
  const createdAt = now();
  await db.insert(emailCodes).values({
    id: newId(),
    email: email.toLowerCase(),
    code,
    purpose,
    expiresAt: createdAt + CODE_TTL,
    createdAt,
  });
  return code;
}

/** 校验验证码：正确则标记已使用；同一验证码错 5 次即作废（防爆破） */
export async function consumeEmailCode(
  db: DB,
  email: string,
  code: string,
  purpose: 'register' | 'login' | 'reset' = 'register',
): Promise<boolean> {
  const normalized = email.toLowerCase().trim();
  const rows = await db
    .select()
    .from(emailCodes)
    .where(
      and(
        eq(emailCodes.email, normalized),
        eq(emailCodes.purpose, purpose),
        gt(emailCodes.expiresAt, now()),
        isNull(emailCodes.usedAt),
      ),
    )
    .orderBy(desc(emailCodes.createdAt))
    .limit(1);

  const row = rows[0];
  if (!row) return false;

  // 已被试错 5 次：直接作废，防止继续爆破
  if (row.attempts >= 5) {
    await db.update(emailCodes).set({ usedAt: now() }).where(eq(emailCodes.id, row.id));
    return false;
  }

  if (row.code !== code.trim()) {
    await db.update(emailCodes).set({ attempts: row.attempts + 1 }).where(eq(emailCodes.id, row.id));
    return false;
  }

  await db.update(emailCodes).set({ usedAt: now() }).where(eq(emailCodes.id, row.id));
  return true;
}

export async function findUserByEmail(db: DB, email: string): Promise<User | null> {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);
  return rows[0] ?? null;
}

export async function createUser(
  db: DB,
  email: string,
  displayName: string,
  passwordHash: string | null,
  role: 'user' | 'admin' = 'user',
): Promise<User> {
  const user = {
    id: newId(),
    email: email.toLowerCase().trim(),
    passwordHash,
    displayName,
    role,
    emailVerified: 1,
    createdAt: now(),
  };
  await db.insert(users).values(user);
  return user as User;
}

/** 是否还没有任何用户（第一个注册者自动成为管理员） */
export async function isFirstUser(db: DB): Promise<boolean> {
  const rows = await db.select({ id: users.id }).from(users).limit(1);
  return rows.length === 0;
}
