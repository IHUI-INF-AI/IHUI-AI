import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * 访问记录表 - 记录页面访问日志。
 * UV 基于会话 ID(session_id) 去重, 无 session_id 时回退到 IP 去重。
 * visit_date 为字符串日期(YYYY-MM-DD), 支持区间字符串比较。
 */
export const visitLogs = pgTable(
  'visit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }), // 访客可能未登录
    ip: varchar('ip', { length: 64 }),
    city: varchar('city', { length: 100 }),
    url: varchar('url', { length: 512 }),
    referer: varchar('referer', { length: 512 }),
    userAgent: varchar('user_agent', { length: 512 }),
    sessionId: varchar('session_id', { length: 128 }),
    visitDate: varchar('visit_date', { length: 10 }), // YYYY-MM-DD
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    dateIdx: index('visit_logs_date_idx').on(t.visitDate),
    ipCityIdx: index('visit_logs_ip_city_idx').on(t.ip, t.city),
  }),
);

export type VisitLog = typeof visitLogs.$inferSelect;
export type NewVisitLog = typeof visitLogs.$inferInsert;
