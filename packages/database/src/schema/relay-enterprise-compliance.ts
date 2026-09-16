import { sql } from 'drizzle-orm'
import { pgTable, uuid, varchar, integer, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core'

/**
 * 中转站企业合规四表(2026-09-17 立,补强 61,差异化:竞品为个人订阅分发,此块完全缺)。
 *
 * 1. relayEnterpriseProfiles —— 企业认证档案:用户提交(公司/信用代码/联系人/执照),
 *    admin 审核;同用户唯一,重复提交覆盖并回到 pending。
 * 2. relayInvoiceRequests —— 发票申请:必须绑定本人已支付订单;同一订单同时仅一条
 *    非被拒发票(部分唯一索引 WHERE status <> 'rejected')。
 * 3. relayContracts —— 企业合同:admin 建档(合同号唯一)→ 用户签署 → active。
 * 4. relayCorporatePayments —— 对公打款凭证:用户登记 → admin 确认后走既有
 *    completeOrder + activateOrderSubscription 支付闭环(订阅自动激活)。
 *
 * userId 软引用 users.id(不建外键,同 relay_user_attributes 先例);金额一律整数分。
 */

export const relayEnterpriseProfiles = pgTable(
  'relay_enterprise_profiles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    companyName: varchar('company_name', { length: 200 }).notNull(),
    /** 统一社会信用代码 */
    creditCode: varchar('credit_code', { length: 64 }).notNull(),
    legalPerson: varchar('legal_person', { length: 100 }),
    contactName: varchar('contact_name', { length: 100 }).notNull(),
    contactPhone: varchar('contact_phone', { length: 32 }).notNull(),
    /** 营业执照文件地址 */
    licenseUrl: varchar('license_url', { length: 500 }),
    /** pending | approved | rejected */
    status: varchar('status', { length: 16 }).default('pending').notNull(),
    rejectReason: varchar('reject_reason', { length: 500 }),
    reviewedBy: varchar('reviewed_by', { length: 64 }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userUniq: uniqueIndex('relay_enterprise_profiles_user_uniq_idx').on(t.userId),
    statusIdx: index('relay_enterprise_profiles_status_idx').on(t.status),
  }),
)

export const relayInvoiceRequests = pgTable(
  'relay_invoice_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    orderId: uuid('order_id').notNull(),
    orderNo: varchar('order_no', { length: 64 }).notNull(),
    /** plain=电子普通发票 | vat_special=增值税专用发票 */
    invoiceType: varchar('invoice_type', { length: 16 }).default('plain').notNull(),
    /** 发票抬头(企业全称) */
    title: varchar('title', { length: 200 }).notNull(),
    /** 纳税人识别号 */
    taxId: varchar('tax_id', { length: 64 }).notNull(),
    /** 接收电子发票的邮箱 */
    email: varchar('email', { length: 200 }).notNull(),
    /** 开票金额(分,冗余订单实付金额) */
    amountCents: integer('amount_cents').default(0).notNull(),
    /** pending | issued | rejected | voided */
    status: varchar('status', { length: 16 }).default('pending').notNull(),
    invoiceNo: varchar('invoice_no', { length: 64 }),
    invoiceUrl: varchar('invoice_url', { length: 500 }),
    rejectReason: varchar('reject_reason', { length: 500 }),
    issuedBy: varchar('issued_by', { length: 64 }),
    issuedAt: timestamp('issued_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orderActiveUniq: uniqueIndex('relay_invoice_requests_order_active_uniq_idx')
      .on(t.orderId)
      .where(sql`"status" <> 'rejected'`),
    userIdx: index('relay_invoice_requests_user_idx').on(t.userId),
    statusIdx: index('relay_invoice_requests_status_idx').on(t.status),
  }),
)

export const relayContracts = pgTable(
  'relay_contracts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    /** 合同号(HT-YYYYMMDD-XXXX,service 生成,唯一) */
    contractNo: varchar('contract_no', { length: 64 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    /** api_subscription | custom */
    contractType: varchar('contract_type', { length: 32 }).default('api_subscription').notNull(),
    amountCents: integer('amount_cents').default(0).notNull(),
    periodStart: timestamp('period_start', { withTimezone: true }),
    periodEnd: timestamp('period_end', { withTimezone: true }),
    fileUrl: varchar('file_url', { length: 500 }),
    /** pending_sign | active | expired | terminated */
    status: varchar('status', { length: 16 }).default('pending_sign').notNull(),
    signedAt: timestamp('signed_at', { withTimezone: true }),
    remark: varchar('remark', { length: 500 }),
    createdBy: varchar('created_by', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    contractNoUniq: uniqueIndex('relay_contracts_no_uniq_idx').on(t.contractNo),
    userIdx: index('relay_contracts_user_idx').on(t.userId),
    statusIdx: index('relay_contracts_status_idx').on(t.status),
  }),
)

export const relayCorporatePayments = pgTable(
  'relay_corporate_payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    orderId: uuid('order_id').notNull(),
    orderNo: varchar('order_no', { length: 64 }).notNull(),
    /** 打款金额(分,登记时默认订单应付金额) */
    amountCents: integer('amount_cents').default(0).notNull(),
    /** 付款企业全称(对公账户户名) */
    payerCompany: varchar('payer_company', { length: 200 }).notNull(),
    /** 转账回单凭证地址 */
    voucherUrl: varchar('voucher_url', { length: 500 }),
    remark: varchar('remark', { length: 500 }),
    /** pending | confirmed | rejected */
    status: varchar('status', { length: 16 }).default('pending').notNull(),
    rejectReason: varchar('reject_reason', { length: 500 }),
    confirmedBy: varchar('confirmed_by', { length: 64 }),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('relay_corporate_payments_user_idx').on(t.userId),
    orderIdx: index('relay_corporate_payments_order_idx').on(t.orderNo),
    statusIdx: index('relay_corporate_payments_status_idx').on(t.status),
  }),
)

export type RelayEnterpriseProfile = typeof relayEnterpriseProfiles.$inferSelect
export type NewRelayEnterpriseProfile = typeof relayEnterpriseProfiles.$inferInsert
export type RelayInvoiceRequest = typeof relayInvoiceRequests.$inferSelect
export type NewRelayInvoiceRequest = typeof relayInvoiceRequests.$inferInsert
export type RelayContract = typeof relayContracts.$inferSelect
export type NewRelayContract = typeof relayContracts.$inferInsert
export type RelayCorporatePayment = typeof relayCorporatePayments.$inferSelect
export type NewRelayCorporatePayment = typeof relayCorporatePayments.$inferInsert
