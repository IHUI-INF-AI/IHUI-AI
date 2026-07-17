import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 服务预约表。
 * status: pending=待确认 / confirmed=已确认 / cancelled=已取消 / completed=已完成
 * 状态机: pending → confirmed → completed;pending/confirmed → cancelled
 */
export const serviceAppointments = pgTable(
  'service_appointments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    serviceType: varchar('service_type', { length: 50 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    appointmentTime: timestamp('appointment_time', { withTimezone: true }).notNull(),
    duration: integer('duration').default(60).notNull(),
    location: varchar('location', { length: 500 }),
    contactName: varchar('contact_name', { length: 100 }),
    contactPhone: varchar('contact_phone', { length: 20 }),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    remark: text('remark'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('service_appointments_user_idx').on(t.userId),
    statusIdx: index('service_appointments_status_idx').on(t.status),
    timeIdx: index('service_appointments_time_idx').on(t.appointmentTime),
  }),
)

export type ServiceAppointment = typeof serviceAppointments.$inferSelect
export type NewServiceAppointment = typeof serviceAppointments.$inferInsert
