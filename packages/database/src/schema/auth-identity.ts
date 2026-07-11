import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 实名认证表。
 * status: 0=待审核 1=已通过 2=已拒绝 3=已过期
 * type: 1=个人 2=企业
 */
export const authIdentities = pgTable('auth_identities', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  realName: varchar('real_name', { length: 50 }).notNull(),
  idCard: varchar('id_card', { length: 20 }).notNull(),
  idCardFront: varchar('id_card_front', { length: 500 }),
  idCardBack: varchar('id_card_back', { length: 500 }),
  phone: varchar('phone', { length: 20 }),
  status: integer('status').default(0).notNull(),
  auditUser: varchar('audit_user', { length: 64 }),
  auditTime: timestamp('audit_time', { withTimezone: true }),
  auditRemark: varchar('audit_remark', { length: 500 }),
  expireTime: timestamp('expire_time', { withTimezone: true }),
  type: integer('type').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type AuthIdentity = typeof authIdentities.$inferSelect
export type NewAuthIdentity = typeof authIdentities.$inferInsert
