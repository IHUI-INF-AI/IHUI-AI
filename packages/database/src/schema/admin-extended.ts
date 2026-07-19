/**
 * D 盘管理后台表补迁移 schema（supplement）。
 * 迁移自 D:\历史项目存档\code\edu\service\service\init_database.sql
 * 6 张表：t_certificate / t_certificate_template / t_department / t_lecturer / t_manager / t_sensitive_word
 *
 * 注意：与 certificate.ts 中现代版表（certificates / certificate_templates，UUID 版）共存，
 * 与 sensitive-words.ts 中现代版表（sensitive_words，UUID 版）共存。
 * 本文件保留 D 盘历史表名与字段（bigint 主键），用于历史数据迁移与对账。
 */
import {
  pgTable,
  bigserial,
  bigint,
  varchar,
  integer,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// 证书 / 证书模板
// ---------------------------------------------------------------------------

/**
 * 证书表（D 盘: t_certificate）
 * 字段最完整的证书记录，包含颁发机构、人员、有效期、关联课程/报名等。
 * - deleted: 0=未删除 1=已删除
 * - version: 乐观锁版本号
 * - status: 证书状态（有效/已过期/作废等）
 */
export const tCertificate = pgTable(
  't_certificate',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(), // D 盘: id bigint AUTO_INCREMENT
    createTime: timestamp('create_time', { withTimezone: true }).defaultNow().notNull(), // D 盘: create_time datetime NOT NULL
    updateTime: timestamp('update_time', { withTimezone: true }).defaultNow().notNull(), // D 盘: update_time datetime NOT NULL
    deleted: boolean('deleted').default(false).notNull(), // D 盘: deleted tinyint DEFAULT 0
    version: integer('version').default(1).notNull(), // D 盘: version int DEFAULT 1
    certificateId: bigint('certificate_id', { mode: 'number' }), // D 盘: certificate_id bigint NULL
    code: varchar('code', { length: 64 }), // D 盘: code varchar(64)
    name: varchar('name', { length: 128 }), // D 盘: name varchar(128)
    description: varchar('description', { length: 2000 }), // D 盘: description varchar(2000)
    awardingOrganization: varchar('awarding_organization', { length: 128 }), // D 盘: awarding_organization
    awarderName: varchar('awarder_name', { length: 64 }), // D 盘: awarder_name varchar(64)
    awarderPosition: varchar('awarder_position', { length: 64 }), // D 盘: awarder_position varchar(64)
    design: varchar('design', { length: 512 }), // D 盘: design varchar(512)
    awardConditions: varchar('award_conditions', { length: 2000 }), // D 盘: award_conditions varchar(2000)
    validityPolicy: varchar('validity_policy', { length: 1024 }), // D 盘: validity_policy varchar(1024)
    awardDate: timestamp('award_date', { withTimezone: true }), // D 盘: award_date datetime NULL
    validity: timestamp('validity', { withTimezone: true }), // D 盘: validity datetime NULL
    status: varchar('status', { length: 32 }), // D 盘: status varchar(32)
    memberId: bigint('member_id', { mode: 'number' }), // D 盘: member_id bigint NULL
    lessonId: bigint('lesson_id', { mode: 'number' }), // D 盘: lesson_id bigint NULL
    lessonSignId: bigint('lesson_sign_id', { mode: 'number' }), // D 盘: lesson_sign_id bigint NULL
    lessonSignTime: timestamp('lesson_sign_time', { withTimezone: true }), // D 盘: lesson_sign_time datetime NULL
    lessonCompleteTime: timestamp('lesson_complete_time', { withTimezone: true }), // D 盘: lesson_complete_time datetime NULL
    score: varchar('score', { length: 32 }), // D 盘: score varchar(32)
    companyId: bigint('company_id', { mode: 'number' }), // D 盘: company_id bigint NULL
    createUserId: bigint('create_user_id', { mode: 'number' }), // D 盘: create_user_id bigint NULL
    createUserName: varchar('create_user_name', { length: 64 }), // D 盘: create_user_name varchar(64)
    updateUserId: bigint('update_user_id', { mode: 'number' }), // D 盘: update_user_id bigint NULL
    updateUserName: varchar('update_user_name', { length: 64 }), // D 盘: update_user_name varchar(64)
  },
  (t) => ({
    certificateIdIdx: index('t_certificate_certificate_id_idx').on(t.certificateId),
    memberIdx: index('t_certificate_member_idx').on(t.memberId),
    lessonIdx: index('t_certificate_lesson_idx').on(t.lessonId),
    statusIdx: index('t_certificate_status_idx').on(t.status),
    companyIdx: index('t_certificate_company_idx').on(t.companyId),
  }),
)

/**
 * 证书模板表（D 盘: t_certificate_template）
 * - status: active=启用, inactive=禁用, deleted=已删除
 */
export const tCertificateTemplate = pgTable(
  't_certificate_template',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    name: varchar('name', { length: 200 }).default('').notNull(), // D 盘: name varchar(200) DEFAULT ''
    description: varchar('description', { length: 1000 }).default(''), // D 盘: description varchar(1000) DEFAULT ''
    awardingOrganization: varchar('awarding_organization', { length: 200 }).default(''), // D 盘: awarding_organization
    awarderName: varchar('awarder_name', { length: 100 }).default(''), // D 盘: awarder_name varchar(100)
    awarderPosition: varchar('awarder_position', { length: 100 }).default(''), // D 盘: awarder_position varchar(100)
    design: varchar('design', { length: 1000 }).default(''), // D 盘: design varchar(1000)
    awardConditions: varchar('award_conditions', { length: 500 }).default(''), // D 盘: award_conditions varchar(500)
    validityPolicy: varchar('validity_policy', { length: 500 }).default(''), // D 盘: validity_policy varchar(500)
    status: varchar('status', { length: 30 }).default('inactive').notNull(), // D 盘: status varchar(30) DEFAULT 'inactive'
    companyId: bigint('company_id', { mode: 'number' }), // D 盘: company_id bigint NULL
    createUserId: bigint('create_user_id', { mode: 'number' }), // D 盘: create_user_id bigint NULL
    createUserName: varchar('create_user_name', { length: 100 }).default(''), // D 盘: create_user_name varchar(100)
    updateUserId: bigint('update_user_id', { mode: 'number' }), // D 盘: update_user_id bigint NULL
    updateUserName: varchar('update_user_name', { length: 100 }).default(''), // D 盘: update_user_name varchar(100)
    createTime: timestamp('create_time', { withTimezone: true }).defaultNow(),
    updateTime: timestamp('update_time', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    statusIdx: index('t_certificate_template_status_idx').on(t.status),
    companyIdx: index('t_certificate_template_company_idx').on(t.companyId),
    createTimeIdx: index('t_certificate_template_create_time_idx').on(t.createTime),
  }),
)

// ---------------------------------------------------------------------------
// 部门 / 讲师 / 上级领导
// ---------------------------------------------------------------------------

/**
 * 部门表（D 盘: t_department）
 * 注意：D 盘 id 为 bigint NOT NULL DEFAULT 0（非自增），手工分配主键。
 * - enabled: 0=弃用, 1=启用
 */
export const tDepartment = pgTable('t_department', {
  id: bigint('id', { mode: 'number' }).default(0).notNull().primaryKey(), // D 盘: id bigint NOT NULL DEFAULT 0
  code: varchar('code', { length: 50 }).notNull(), // D 盘: code varchar(50)
  name: varchar('name', { length: 50 }).notNull(), // D 盘: name varchar(50)
  shortName: varchar('short_name', { length: 50 }).default('').notNull(), // D 盘: short_name varchar(50) DEFAULT ''
  enabled: boolean('enabled').default(true).notNull(), // D 盘: enabled tinyint DEFAULT 1
  createTime: timestamp('create_time', { withTimezone: true }).defaultNow(),
  updateTime: timestamp('update_time', { withTimezone: true }).defaultNow(),
})

/**
 * 讲师表（D 盘: t_lecturer）
 * 讲师扩展信息（头衔、介绍），关联 user_id。
 */
export const tLecturer = pgTable(
  't_lecturer',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: bigint('user_id', { mode: 'number' }).notNull(), // D 盘: user_id bigint
    title: varchar('title', { length: 100 }).default('').notNull(), // D 盘: title varchar(100) DEFAULT ''
    introduction: varchar('introduction', { length: 2000 }).default('').notNull(), // D 盘: introduction varchar(2000) DEFAULT ''
    createTime: timestamp('create_time', { withTimezone: true }).defaultNow(),
    updateTime: timestamp('update_time', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    userIdx: index('t_lecturer_user_idx').on(t.userId),
  }),
)

/**
 * 上级领导关联表（D 盘: t_manager）
 * 记录用户的上级领导关系。
 */
export const tManager = pgTable(
  't_manager',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: bigint('user_id', { mode: 'number' }).notNull(), // D 盘: user_id bigint
    managerId: bigint('manager_id', { mode: 'number' }).notNull(), // D 盘: manager_id bigint（上级领导id）
    createTime: timestamp('create_time', { withTimezone: true }).defaultNow(),
    updateTime: timestamp('update_time', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    userIdx: index('t_manager_user_idx').on(t.userId),
    managerIdx: index('t_manager_manager_idx').on(t.managerId),
  }),
)

// ---------------------------------------------------------------------------
// 敏感词
// ---------------------------------------------------------------------------

/**
 * 敏感词表（D 盘 legacy: t_sensitive_word）
 * 与 sensitive-words.ts 中 sensitive_words（UUID 现代版，含 category/level/replacement）字段更简。
 * 本表保留 D 盘原始结构，仅含 name 字段，用于历史数据对账。
 */
export const tSensitiveWord = pgTable(
  't_sensitive_word',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    name: varchar('name', { length: 100 }).notNull(), // D 盘: name varchar(100)
    createTime: timestamp('create_time', { withTimezone: true }).defaultNow(),
    updateTime: timestamp('update_time', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    nameIdx: index('t_sensitive_word_name_idx').on(t.name),
  }),
)

// ---------------------------------------------------------------------------
// 类型导出
// ---------------------------------------------------------------------------

export type TCertificate = typeof tCertificate.$inferSelect
export type NewTCertificate = typeof tCertificate.$inferInsert
export type TCertificateTemplate = typeof tCertificateTemplate.$inferSelect
export type NewTCertificateTemplate = typeof tCertificateTemplate.$inferInsert
export type TDepartment = typeof tDepartment.$inferSelect
export type NewTDepartment = typeof tDepartment.$inferInsert
export type TLecturer = typeof tLecturer.$inferSelect
export type NewTLecturer = typeof tLecturer.$inferInsert
export type TManager = typeof tManager.$inferSelect
export type NewTManager = typeof tManager.$inferInsert
export type TSensitiveWord = typeof tSensitiveWord.$inferSelect
export type NewTSensitiveWord = typeof tSensitiveWord.$inferInsert
