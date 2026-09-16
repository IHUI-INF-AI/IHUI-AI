import { pgTable, uuid, varchar, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core'

/**
 * 用户自定义属性表(relay_user_attributes,2026-09-17 立,补强 55,对标竞品 /user-attributes)。
 *
 * 用途:给中转站用户挂 KV 属性(如 tier=vip、source=referral、industry=edu),
 * 供分组、风控、运营筛选与导出使用——避免把业务标签硬编码进代码或塞进 email 等字段。
 * 唯一约束 (user_id, key):同一用户同键只保留一个值(PUT 语义覆盖)。
 */
export const relayUserAttributes = pgTable(
  'relay_user_attributes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** 所属用户 id(软引用 users.id,不建外键以免级联影响既有数据) */
    userId: varchar('user_id', { length: 64 }).notNull(),
    /** 属性键(小写字母/数字/下划线,长度 ≤ 64) */
    attrKey: varchar('attr_key', { length: 64 }).notNull(),
    /** 属性值(字符串存储,长度 ≤ 255) */
    attrValue: varchar('attr_value', { length: 255 }).notNull(),
    updatedBy: varchar('updated_by', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userKeyUniq: uniqueIndex('relay_user_attributes_user_key_uniq_idx').on(t.userId, t.attrKey),
    userIdx: index('relay_user_attributes_user_idx').on(t.userId),
  }),
)

export type RelayUserAttribute = typeof relayUserAttributes.$inferSelect
export type NewRelayUserAttribute = typeof relayUserAttributes.$inferInsert
