import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 证书模板表。
 * template_config: JSON 配置(背景图、字体、坐标等)。
 * status: 1=启用 0=禁用。
 */
export const certificateTemplates = pgTable(
  'certificate_templates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    backgroundImage: varchar('background_image', { length: 512 }),
    templateConfig: jsonb('template_config'), // { title, subtitle, signature, fields: [{key, label, x, y}] }
    awardingOrganization: text('awarding_organization'), // 颁发机构
    awarderName: text('awarder_name'), // 颁发人姓名
    awardConditions: text('award_conditions'), // 获奖条件
    validityPolicy: text('validity_policy'), // 有效期策略
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ statusIdx: index('certificate_templates_status_idx').on(t.status) }),
)

/**
 * 证书发放记录表。
 * source: 'exam' | 'learn' | 'manual' (来源:考试通过/课程完成/手动发放)。
 * sourceId: 关联的 exam_record_id 或 lesson_sign_up_id(可空)。
 * status: 0=已撤销 1=有效。
 */
export const certificates = pgTable(
  'certificates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    templateId: uuid('template_id').references(() => certificateTemplates.id, {
      onDelete: 'set null',
    }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    certificateNo: varchar('certificate_no', { length: 100 }).notNull(), // 证书编号(唯一)
    title: varchar('title', { length: 200 }).notNull(),
    recipientName: varchar('recipient_name', { length: 100 }),
    source: varchar('source', { length: 20 }).default('manual').notNull(),
    sourceId: uuid('source_id'),
    // 旧架构有的额外字段
    issuer: varchar('issuer', { length: 100 }), // 颁发机构
    score: varchar('score', { length: 20 }), // 成绩
    validDays: integer('valid_days'), // 有效天数
    issuedAt: timestamp('issued_at', { withTimezone: true }).defaultNow().notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('certificates_user_idx').on(t.userId),
    templateIdx: index('certificates_template_idx').on(t.templateId),
    noIdx: index('certificates_no_idx').on(t.certificateNo),
  }),
)

export type CertificateTemplate = typeof certificateTemplates.$inferSelect
export type NewCertificateTemplate = typeof certificateTemplates.$inferInsert
export type Certificate = typeof certificates.$inferSelect
export type NewCertificate = typeof certificates.$inferInsert

/**
 * 证书序列号表 (certificate_serial_numbers)。
 * 记录证书的序列号及发放对象信息。
 * status: active(有效) / revoked(已撤销) / expired(已过期)。
 */
export const certificateSerialNumber = pgTable(
  'certificate_serial_numbers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    certificateId: uuid('certificate_id').references(() => certificates.id, {
      onDelete: 'cascade',
    }),
    serialNumber: varchar('serial_number', { length: 64 }).notNull(),
    issuedTo: varchar('issued_to', { length: 100 }),
    issuedAt: timestamp('issued_at', { withTimezone: true }),
    status: varchar('status', { length: 20 }).default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    certificateIdIdx: index('certificate_serial_numbers_certificate_id_idx').on(t.certificateId),
    serialNumberIdx: uniqueIndex('certificate_serial_numbers_serial_number_uniq').on(
      t.serialNumber,
    ),
  }),
)

export type CertificateSerialNumber = typeof certificateSerialNumber.$inferSelect
export type NewCertificateSerialNumber = typeof certificateSerialNumber.$inferInsert
