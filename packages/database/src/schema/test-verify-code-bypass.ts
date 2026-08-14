/**
 * 测试验证码 bypass 表(2026-08-01 立,见 drizzle/20260801040000_admin_test_verify_code_bypass.sql)。
 *
 * 仅 NODE_ENV !== 'production' 时生效:admin 账号(email=502319984@qq.com /
 * phone=18643389808)登录使用固定验证码 123456,无需收真实验证码。
 * apps/api/src/utils/code-store.ts 的 verifyCode() 以 raw SQL 查询本表
 * (SELECT 1 FROM "test_verify_code_bypass" WHERE "identifier"=... AND "fixed_code"=... AND "is_active"=true)。
 * 补 TS schema 定义以消除 dead migration 告警,并保证该查询可走类型化 Drizzle。
 */
import { pgTable, varchar, boolean, text, timestamp, index } from 'drizzle-orm/pg-core'

export const testVerifyCodeBypass = pgTable(
  'test_verify_code_bypass',
  {
    identifier: varchar('identifier', { length: 255 }).primaryKey().notNull(),
    fixedCode: varchar('fixed_code', { length: 8 }).notNull().default('123456'),
    isActive: boolean('is_active').notNull().default(true),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    activeIdx: index('test_verify_code_bypass_active_idx').on(t.isActive),
  }),
)

export type TestVerifyCodeBypass = typeof testVerifyCodeBypass.$inferSelect
export type NewTestVerifyCodeBypass = typeof testVerifyCodeBypass.$inferInsert
