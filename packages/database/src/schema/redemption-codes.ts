import { pgTable, uuid, varchar, integer, bigint, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 兑换码表(2026-07-31 立,P0-5 刮刮卡式裂变充值)。
 * status: 'unused'(未使用) / 'used'(已使用) / 'expired'(已过期) / 'disabled'(管理员禁用)
 * code: 16 位大写字母+数字,带 hyphen 分隔(如 IHUI-XXXX-XXXX-XXXX),全局唯一
 * face_value_cents: 面值(分,用于展示)
 * token_amount: 兑换后到账的 token 数
 */
export const redemptionCodes = pgTable(
  'redemption_codes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** 16 位兑换码,格式 IHUI-XXXX-XXXX-XXXX */
    code: varchar('code', { length: 32 }).notNull().unique(),
    /** 批次 ID(同批次生成的码共享) */
    batchId: uuid('batch_id'),
    /** 面值(分,展示用,如 990 = ¥9.90) */
    faceValueCents: integer('face_value_cents').notNull(),
    /** 兑换后到账 token 数 */
    tokenAmount: bigint('token_amount', { mode: 'number' }).notNull(),
    /** 状态:unused/used/expired/disabled */
    status: varchar('status', { length: 16 }).default('unused').notNull(),
    /** 创建者(admin user_id) */
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    /** 使用者(user_id,兑换后填入) */
    usedBy: uuid('used_by').references(() => users.id, { onDelete: 'set null' }),
    usedAt: timestamp('used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    codeIdx: index('redemption_codes_code_idx').on(t.code),
    batchIdx: index('redemption_codes_batch_idx').on(t.batchId),
    statusIdx: index('redemption_codes_status_idx').on(t.status),
  }),
)

export type RedemptionCode = typeof redemptionCodes.$inferSelect
export type NewRedemptionCode = typeof redemptionCodes.$inferInsert
