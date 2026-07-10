import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';

/**
 * 图形验证码表（Redis 为主存储，此表为持久化 fallback）。
 * code: 4 位字符。5 分钟过期。一次性。
 */
export const captchas = pgTable(
  'captchas',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    captchaKey: varchar('captcha_key', { length: 64 }).notNull(),
    code: varchar('code', { length: 8 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    keyIdx: index('captchas_key_idx').on(t.captchaKey),
  }),
);

export type Captcha = typeof captchas.$inferSelect;
export type NewCaptcha = typeof captchas.$inferInsert;
