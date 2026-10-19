import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

/** 用户表：邮箱注册，密码可空（支持纯验证码登录） */
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash'),
    displayName: text('display_name').notNull(),
    avatarUrl: text('avatar_url'),
    role: text('role').notNull().default('user'), // user | admin
    emailVerified: integer('email_verified').notNull().default(0),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('users_email_idx').on(t.email)],
);

/** 邮箱验证码：注册 / 登录 / 重置密码共用 */
export const emailCodes = sqliteTable(
  'email_codes',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    code: text('code').notNull(),
    purpose: text('purpose').notNull().default('register'), // register | login | reset
    expiresAt: integer('expires_at').notNull(),
    usedAt: integer('used_at'),
    attempts: integer('attempts').notNull().default(0),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('email_codes_email_idx').on(t.email)],
);

/** 会话：cookie 里存 session id */
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    expiresAt: integer('expires_at').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

/** 文章：可自带正文，也可只放外链 */
export const articles = sqliteTable(
  'articles',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    slug: text('slug').notNull().unique(),
    summary: text('summary'),
    content: text('content'),
    link: text('link'),
    coverUrl: text('cover_url'),
    tags: text('tags'), // JSON 数组字符串
    authorId: text('author_id').references(() => users.id),
    published: integer('published').notNull().default(1),
    publishedAt: integer('published_at').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [
    index('articles_slug_idx').on(t.slug),
    index('articles_pub_idx').on(t.publishedAt),
  ],
);

/** 话题：投票征集 */
export const topics = sqliteTable(
  'topics',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    userId: text('user_id').references(() => users.id),
    status: text('status').notNull().default('open'), // open | planned | done
    voteCount: integer('vote_count').notNull().default(0),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('topics_vote_idx').on(t.voteCount)],
);

/** 话题投票：联合唯一索引防重复投 */
export const topicVotes = sqliteTable(
  'topic_votes',
  {
    id: text('id').primaryKey(),
    topicId: text('topic_id')
      .notNull()
      .references(() => topics.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [uniqueIndex('topic_votes_uniq').on(t.topicId, t.userId)],
);

/** 评论：挂在文章或话题下，支持一层回复 */
export const comments = sqliteTable(
  'comments',
  {
    id: text('id').primaryKey(),
    targetType: text('target_type').notNull(), // article | topic
    targetId: text('target_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    content: text('content').notNull(),
    parentId: text('parent_id'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('comments_target_idx').on(t.targetType, t.targetId)],
);

/** 点赞：文章 / 话题通用，联合唯一索引防重复 */
export const likes = sqliteTable(
  'likes',
  {
    id: text('id').primaryKey(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [uniqueIndex('likes_uniq').on(t.targetType, t.targetId, t.userId)],
);

/** 速率限制：固定窗口计数 */
export const rateLimits = sqliteTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  windowStart: integer('window_start').notNull(),
});

export type User = typeof users.$inferSelect;
export type Article = typeof articles.$inferSelect;
export type Topic = typeof topics.$inferSelect;
export type Comment = typeof comments.$inferSelect;
