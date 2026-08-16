import { pgTable, uuid, varchar, text, timestamp, index } from 'drizzle-orm/pg-core'

export const serviceInquiries = pgTable(
  'service_inquiries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 50 }).notNull(),
    company: varchar('company', { length: 100 }),
    email: varchar('email', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 30 }),
    serviceType: varchar('service_type', { length: 20 }).notNull(),
    budget: varchar('budget', { length: 20 }).notNull(),
    description: text('description').notNull(),
    timeline: varchar('timeline', { length: 20 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    statusIdx: index('service_inquiries_status_idx').on(table.status),
    emailIdx: index('service_inquiries_email_idx').on(table.email),
  }),
)

export type ServiceInquiry = typeof serviceInquiries.$inferSelect
export type NewServiceInquiry = typeof serviceInquiries.$inferInsert
