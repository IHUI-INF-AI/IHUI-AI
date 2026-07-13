import { pgTable, serial, uuid, varchar, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core'

/**
 * 分析事件表 - 记录用户行为埋点事件。
 */
export const analyticsEvents = pgTable(
  'analytics_events',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id'),
    event: varchar('event', { length: 100 }).notNull(),
    properties: jsonb('properties'),
    ip: varchar('ip', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('analytics_events_user_idx').on(t.userId),
  }),
)

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect
export type NewAnalyticsEvent = typeof analyticsEvents.$inferInsert
