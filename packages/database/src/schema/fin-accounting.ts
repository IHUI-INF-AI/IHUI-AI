// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

import { users } from './users.js'

/**
 * 财务代账核心账套模型(RP-48,2026-11-23 立)。
 *
 * 设计边界(与 ai-service finance_tools 的分工):
 *   · AI 工具负责"算"(规则引擎 + Decimal 计算 + 草案产物),不写生产库;
 *   · 本模型负责"存"(客户 → 账套 → 科目 → 期初 → 凭证 → 余额 → 结账),
 *     让跨期连续账成立:上期期末余额 = 下期期初余额。
 *
 * 三条不变量(**任何写入路径都不得绕过**):
 *   1. 凭证必须借贷平衡才能过账;不平衡时只允许留在 draft,绝不静默配平。
 *   2. 已结账期间拒绝任何凭证增删改;红冲只能按"反向凭证"追加,不能改历史。
 *   3. 一个账套同一期间同一凭证号唯一;外部来源凭证以 source_ref 幂等。
 */

/** 代账客户(纳税主体)。一个客户可有多个账套(重建账/多准则并行)。 */
export const finClient = pgTable(
  'fin_client',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** 企业全称 */
    name: varchar('name', { length: 200 }).notNull(),
    shortName: varchar('short_name', { length: 100 }),
    /** 统一社会信用代码(未办证时可空;唯一索引只对非空值生效) */
    taxNo: varchar('tax_no', { length: 50 }),
    /** general=一般纳税人 / small=小规模纳税人 */
    taxpayerType: varchar('taxpayer_type', { length: 20 }).default('small').notNull(),
    /** 所属行业(用于选科目模板与行业报表) */
    industry: varchar('industry', { length: 100 }),
    /** 主管税务机关所在地区(城市/省) */
    region: varchar('region', { length: 100 }),
    /** 主管税务机关名称 */
    taxAuthority: varchar('tax_authority', { length: 200 }),
    legalPerson: varchar('legal_person', { length: 100 }),
    contactName: varchar('contact_name', { length: 100 }),
    contactPhone: varchar('contact_phone', { length: 50 }),
    /** active=在服务 / paused=暂停 / closed=已终止 */
    status: varchar('status', { length: 20 }).default('active').notNull(),
    /** 委托开始日 */
    startDate: date('start_date'),
    remark: text('remark'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    statusIdx: index('ix_fin_client_status').on(t.status),
    nameIdx: index('ix_fin_client_name').on(t.name),
    taxNoUq: uniqueIndex('uq_fin_client_tax_no')
      .on(t.taxNo)
      .where(sql`${t.deletedAt} IS NULL AND ${t.taxNo} IS NOT NULL`),
  }),
)

/** 账套:一个客户在某个准则下的一套账。 */
export const finLedger = pgTable(
  'fin_ledger',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => finClient.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    /** small_business=小企业会计准则 / general=企业会计准则 */
    accountingStandard: varchar('accounting_standard', { length: 30 })
      .default('small_business')
      .notNull(),
    baseCurrency: varchar('base_currency', { length: 8 }).default('CNY').notNull(),
    /** 启用期间 YYYY-MM(期初余额挂在此期间的上一期) */
    startPeriod: varchar('start_period', { length: 7 }).notNull(),
    /** 当前未结账期间 YYYY-MM */
    currentPeriod: varchar('current_period', { length: 7 }).notNull(),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    /**
     * 复核闸:true ⇒ 凭证必须先"复核通过"(fin_voucher.review_status=2)才能过账。
     * 默认 false 保持旧链路可用(自动记账/期初导入不需要复核);
     * 代账所与内控场景应在账套维度打开。
     */
    reviewRequired: boolean('review_required').default(false).notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    clientIdx: index('ix_fin_ledger_client').on(t.clientId),
    nameUq: uniqueIndex('uq_fin_ledger_client_name')
      .on(t.clientId, t.name)
      .where(sql`${t.deletedAt} IS NULL`),
  }),
)

/**
 * 会计科目(账套级)。
 *
 * category 六档:asset/liability/equity/revenue/expense/cost。
 * `cost` 独立于 expense:生产成本/制造费用在结转前是存货性支出,混进损益会让毛利失真。
 */
export const finAccount = pgTable(
  'fin_account',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ledgerId: uuid('ledger_id')
      .notNull()
      .references(() => finLedger.id, { onDelete: 'cascade' }),
    /** 科目编码(4/6/8 位层级编码,父级前缀即父科目) */
    code: varchar('code', { length: 20 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    category: varchar('category', { length: 20 }).notNull(),
    /** debit=借方科目 / credit=贷方科目(余额方向,不随业务改变) */
    direction: varchar('direction', { length: 10 }).notNull(),
    parentCode: varchar('parent_code', { length: 20 }),
    level: integer('level').default(1).notNull(),
    isLeaf: boolean('is_leaf').default(true).notNull(),
    /** 辅助核算开关:{customer,project,department,employee} */
    auxConfig: jsonb('aux_config').$type<Record<string, boolean>>().default({}).notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    /** 系统模板科目:不允许删除,只允许停用 */
    isSystem: boolean('is_system').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    codeUq: uniqueIndex('uq_fin_account_ledger_code').on(t.ledgerId, t.code),
    ledgerIdx: index('ix_fin_account_ledger').on(t.ledgerId, t.enabled),
  }),
)

/**
 * 期初余额:挂在账套启用期间(YYYY-MM)。
 *
 * 借贷分列而不是存一个带符号的余额 —— 会计恒等式要求借贷两边各自可加总,
 * 用符号表示余额会在"方向相反(如贷方余额的应收账款)"时算错合计。
 */
export const finOpeningBalance = pgTable(
  'fin_opening_balance',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ledgerId: uuid('ledger_id')
      .notNull()
      .references(() => finLedger.id, { onDelete: 'cascade' }),
    period: varchar('period', { length: 7 }).notNull(),
    accountCode: varchar('account_code', { length: 20 }).notNull(),
    debitAmount: numeric('debit_amount', { precision: 16, scale: 2 }).default('0.00').notNull(),
    creditAmount: numeric('credit_amount', { precision: 16, scale: 2 }).default('0.00').notNull(),
    /** 辅助核算维度值(如 {"customer":"某公司"}) */
    aux: jsonb('aux').$type<Record<string, string>>().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    periodUq: uniqueIndex('uq_fin_opening_ledger_period_code').on(
      t.ledgerId,
      t.period,
      t.accountCode,
    ),
  }),
)

/** 记账凭证头。 */
export const finVoucher = pgTable(
  'fin_voucher',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ledgerId: uuid('ledger_id')
      .notNull()
      .references(() => finLedger.id, { onDelete: 'cascade' }),
    /** 会计期间 YYYY-MM */
    period: varchar('period', { length: 7 }).notNull(),
    /** 凭证号:记-0001(账套+期间内唯一) */
    voucherNo: varchar('voucher_no', { length: 30 }).notNull(),
    voucherDate: date('voucher_date').notNull(),
    summary: varchar('summary', { length: 500 }),
    /** manual=手工 / auto=规则引擎 / import=导入 / payroll=人事交割 / closing=期末结转 / reverse=红冲 */
    source: varchar('source', { length: 20 }).default('manual').notNull(),
    /** 外部幂等键(如同一张工资交割单、同一笔平台流水) */
    sourceRef: varchar('source_ref', { length: 200 }),
    /** draft=草稿(允许不平) / posted=已过账(必平) / reversed=已红冲 */
    status: varchar('status', { length: 20 }).default('draft').notNull(),
    totalDebit: numeric('total_debit', { precision: 16, scale: 2 }).default('0.00').notNull(),
    totalCredit: numeric('total_credit', { precision: 16, scale: 2 }).default('0.00').notNull(),
    attachmentCount: integer('attachment_count').default(0).notNull(),
    /** 复核:0=未提交 / 1=待复核 / 2=复核通过 / 3=复核驳回 */
    reviewStatus: integer('review_status').default(0).notNull(),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewComment: text('review_comment'),
    /** 红冲指向的原凭证 */
    reversesVoucherId: uuid('reverses_voucher_id'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    postedBy: uuid('posted_by').references(() => users.id, { onDelete: 'set null' }),
    postedAt: timestamp('posted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    noUq: uniqueIndex('uq_fin_voucher_ledger_period_no')
      .on(t.ledgerId, t.period, t.voucherNo)
      .where(sql`${t.deletedAt} IS NULL`),
    sourceRefUq: uniqueIndex('uq_fin_voucher_source_ref')
      .on(t.ledgerId, t.sourceRef)
      .where(sql`${t.deletedAt} IS NULL AND ${t.sourceRef} IS NOT NULL`),
    periodIdx: index('ix_fin_voucher_ledger_period').on(t.ledgerId, t.period, t.status),
  }),
)

/** 凭证分录(借贷分列)。 */
export const finVoucherLine = pgTable(
  'fin_voucher_line',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    voucherId: uuid('voucher_id')
      .notNull()
      .references(() => finVoucher.id, { onDelete: 'cascade' }),
    lineNo: integer('line_no').notNull(),
    accountCode: varchar('account_code', { length: 20 }).notNull(),
    accountName: varchar('account_name', { length: 100 }).notNull(),
    /** debit / credit */
    direction: varchar('direction', { length: 10 }).notNull(),
    amount: numeric('amount', { precision: 16, scale: 2 }).notNull(),
    summary: varchar('summary', { length: 500 }),
    aux: jsonb('aux').$type<Record<string, string>>().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    lineUq: uniqueIndex('uq_fin_voucher_line_no').on(t.voucherId, t.lineNo),
    accountIdx: index('ix_fin_line_account').on(t.accountCode),
  }),
)

/**
 * 科目余额物化缓存(按期)。
 *
 * **不是**真相源:真相源 = 期初 + 已过账分录。本表在结账/查询时按真相源重算并 upsert,
 * 用于报表快路径与"余额被谁改过"的对账。任何写路径都不得只改本表不改分录。
 */
export const finAccountBalance = pgTable(
  'fin_account_balance',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ledgerId: uuid('ledger_id')
      .notNull()
      .references(() => finLedger.id, { onDelete: 'cascade' }),
    period: varchar('period', { length: 7 }).notNull(),
    accountCode: varchar('account_code', { length: 20 }).notNull(),
    openingDebit: numeric('opening_debit', { precision: 16, scale: 2 }).default('0.00').notNull(),
    openingCredit: numeric('opening_credit', { precision: 16, scale: 2 }).default('0.00').notNull(),
    periodDebit: numeric('period_debit', { precision: 16, scale: 2 }).default('0.00').notNull(),
    periodCredit: numeric('period_credit', { precision: 16, scale: 2 }).default('0.00').notNull(),
    closingDebit: numeric('closing_debit', { precision: 16, scale: 2 }).default('0.00').notNull(),
    closingCredit: numeric('closing_credit', { precision: 16, scale: 2 }).default('0.00').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    periodUq: uniqueIndex('uq_fin_balance_ledger_period_code').on(
      t.ledgerId,
      t.period,
      t.accountCode,
    ),
  }),
)

/** 期间结账台账。closed 之后该期间任何凭证都拒绝写入。 */
export const finPeriodClose = pgTable(
  'fin_period_close',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ledgerId: uuid('ledger_id')
      .notNull()
      .references(() => finLedger.id, { onDelete: 'cascade' }),
    period: varchar('period', { length: 7 }).notNull(),
    /** open / closed */
    status: varchar('status', { length: 20 }).default('open').notNull(),
    /** 本期损益(收入-费用),结账时冻结 */
    profitAmount: numeric('profit_amount', { precision: 16, scale: 2 }).default('0.00').notNull(),
    voucherCount: integer('voucher_count').default(0).notNull(),
    closedBy: uuid('closed_by').references(() => users.id, { onDelete: 'set null' }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    reopenedBy: uuid('reopened_by').references(() => users.id, { onDelete: 'set null' }),
    reopenedAt: timestamp('reopened_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    periodUq: uniqueIndex('uq_fin_period_ledger_period').on(t.ledgerId, t.period),
  }),
)

export type FinClient = typeof finClient.$inferSelect
export type NewFinClient = typeof finClient.$inferInsert
export type FinLedger = typeof finLedger.$inferSelect
export type NewFinLedger = typeof finLedger.$inferInsert
export type FinAccount = typeof finAccount.$inferSelect
export type NewFinAccount = typeof finAccount.$inferInsert
export type FinOpeningBalance = typeof finOpeningBalance.$inferSelect
export type NewFinOpeningBalance = typeof finOpeningBalance.$inferInsert
export type FinVoucher = typeof finVoucher.$inferSelect
export type NewFinVoucher = typeof finVoucher.$inferInsert
export type FinVoucherLine = typeof finVoucherLine.$inferSelect
export type NewFinVoucherLine = typeof finVoucherLine.$inferInsert
export type FinAccountBalance = typeof finAccountBalance.$inferSelect
export type NewFinAccountBalance = typeof finAccountBalance.$inferInsert
export type FinPeriodClose = typeof finPeriodClose.$inferSelect
export type NewFinPeriodClose = typeof finPeriodClose.$inferInsert

/**
 * 发票台账(进项/销项)。
 *
 * 为什么必须持久化:报税的前置是"本期销项、进项、可抵扣"三个数,
 * 没有台账就只能每次现场从税局拉,拉不到就整条链断(2026-11-23 前的现状)。
 *
 * status 流转:
 *   unchecked(已采集未勾选) → checked(已勾选未抵扣/当期确认) → certified(已认证抵扣)
 *   → voided(作废/红冲)
 */
export const finInvoice = pgTable(
  'fin_invoice',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ledgerId: uuid('ledger_id')
      .notNull()
      .references(() => finLedger.id, { onDelete: 'cascade' }),
    /** output=销项(本企业开出) / input=进项(本企业收到) */
    direction: varchar('direction', { length: 10 }).notNull(),
    /** special=专票 / general=普票 / electronic=电子普票 / electronic_special=电子专票 */
    invoiceType: varchar('invoice_type', { length: 20 }).default('general').notNull(),
    invoiceCode: varchar('invoice_code', { length: 20 }),
    invoiceNo: varchar('invoice_no', { length: 20 }).notNull(),
    invoiceDate: date('invoice_date').notNull(),
    period: varchar('period', { length: 7 }).notNull(),
    sellerName: varchar('seller_name', { length: 200 }),
    sellerTaxNo: varchar('seller_tax_no', { length: 50 }),
    buyerName: varchar('buyer_name', { length: 200 }),
    buyerTaxNo: varchar('buyer_tax_no', { length: 50 }),
    /** 不含税金额 */
    amountExclTax: numeric('amount_excl_tax', { precision: 16, scale: 2 }).notNull(),
    /** 税率,如 0.13 / 0.06 / 0.03 / 0.01 */
    taxRate: numeric('tax_rate', { precision: 6, scale: 4 }).default('0.0000').notNull(),
    taxAmount: numeric('tax_amount', { precision: 16, scale: 2 }).default('0.00').notNull(),
    totalAmount: numeric('total_amount', { precision: 16, scale: 2 }).notNull(),
    /** unchecked / checked / certified / voided */
    status: varchar('status', { length: 20 }).default('unchecked').notNull(),
    /** 是否可抵扣(进项专用:普票/用于福利的不可抵) */
    deductible: boolean('deductible').default(false).notNull(),
    checkPeriod: varchar('check_period', { length: 7 }),
    certifiedAt: timestamp('certified_at', { withTimezone: true }),
    /** 已生凭证回填 */
    voucherId: uuid('voucher_id').references(() => finVoucher.id, { onDelete: 'set null' }),
    /** platform=税局取数 / import=导入 / manual=手工 */
    source: varchar('source', { length: 20 }).default('manual').notNull(),
    sourceRef: varchar('source_ref', { length: 200 }),
    remark: text('remark'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    periodIdx: index('ix_fin_invoice_ledger_period').on(t.ledgerId, t.period, t.direction),
    noUq: uniqueIndex('uq_fin_invoice_ledger_no')
      .on(t.ledgerId, t.direction, t.invoiceNo)
      .where(sql`${t.deletedAt} IS NULL`),
    statusIdx: index('ix_fin_invoice_status').on(t.ledgerId, t.status),
  }),
)

/** 银行账户(对账的主键之一)。 */
export const finBankAccount = pgTable(
  'fin_bank_account',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ledgerId: uuid('ledger_id')
      .notNull()
      .references(() => finLedger.id, { onDelete: 'cascade' }),
    bankName: varchar('bank_name', { length: 100 }).notNull(),
    accountNo: varchar('account_no', { length: 50 }).notNull(),
    accountName: varchar('account_name', { length: 200 }),
    currency: varchar('currency', { length: 8 }).default('CNY').notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    accountUq: uniqueIndex('uq_fin_bank_account_ledger_no').on(t.ledgerId, t.accountNo),
  }),
)

/**
 * 银行流水。
 *
 * matchStatus 三态:unmatched / matched / ignored(用户确认与账无关,如内部调头寸)。
 * 一笔流水最多对一张凭证(一笔存款通常对应一张收款凭证);多笔流水合并入账时,
 * 由凭证侧挂多张流水,所以关系仍落在"流水 → 凭证"单向。
 */
export const finBankStatement = pgTable(
  'fin_bank_statement',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ledgerId: uuid('ledger_id')
      .notNull()
      .references(() => finLedger.id, { onDelete: 'cascade' }),
    bankAccountId: uuid('bank_account_id')
      .notNull()
      .references(() => finBankAccount.id, { onDelete: 'cascade' }),
    txnDate: date('txn_date').notNull(),
    period: varchar('period', { length: 7 }).notNull(),
    /** in=收入(存款增加) / out=支出 */
    direction: varchar('direction', { length: 10 }).notNull(),
    amount: numeric('amount', { precision: 16, scale: 2 }).notNull(),
    balance: numeric('balance', { precision: 16, scale: 2 }),
    counterparty: varchar('counterparty', { length: 200 }),
    summary: varchar('summary', { length: 500 }),
    /** 银行流水号/回单号(幂等键来源) */
    serialNo: varchar('serial_no', { length: 100 }),
    /** unmatched / matched / ignored */
    matchStatus: varchar('match_status', { length: 20 }).default('unmatched').notNull(),
    matchedVoucherId: uuid('matched_voucher_id').references(() => finVoucher.id, {
      onDelete: 'set null',
    }),
    matchedAt: timestamp('matched_at', { withTimezone: true }),
    matchMode: varchar('match_mode', { length: 20 }),
    source: varchar('source', { length: 20 }).default('import').notNull(),
    sourceRef: varchar('source_ref', { length: 200 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    periodIdx: index('ix_fin_bank_ledger_period').on(t.ledgerId, t.period, t.matchStatus),
    srcUq: uniqueIndex('uq_fin_bank_source_ref')
      .on(t.ledgerId, t.sourceRef)
      .where(sql`${t.deletedAt} IS NULL AND ${t.sourceRef} IS NOT NULL`),
  }),
)

export type FinInvoice = typeof finInvoice.$inferSelect
export type NewFinInvoice = typeof finInvoice.$inferInsert
export type FinBankAccount = typeof finBankAccount.$inferSelect
export type NewFinBankAccount = typeof finBankAccount.$inferInsert
export type FinBankStatement = typeof finBankStatement.$inferSelect
export type NewFinBankStatement = typeof finBankStatement.$inferInsert

/**
 * 税种核定(客户级)。
 *
 * 一张核定的要素决定"什么时候必须报什么":
 *   tax_type(税种) + filing_cycle(月/季/年) + due_month_offset + due_day + collection_method(查账/核定)。
 * 例:增值税月度 due_month_offset=1/due_day=15(次月 15 日);企业所得税年度 5/31(次年 5 月 31 日汇算)。
 *
 * 这是"申报日历"的唯一生成来源:没有核定的客户不会凭空长出任务,
 * 也不会因为漏核定而静默少报一个税种(有核定但任务缺失会被 ensureCalendar 补出来并报数)。
 */
export const finTaxProfile = pgTable(
  'fin_tax_profile',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => finClient.id, { onDelete: 'cascade' }),
    /** VAT / CIT / IIT / SURTAX / STAMP / CONSUMPTION / PROPERTY / LAND_USE / VEHICLE_VESSEL / CULTURE / OTHER */
    taxType: varchar('tax_type', { length: 20 }).notNull(),
    /** 覆盖客户默认纳税人类型;空则取客户档 */
    taxpayerType: varchar('taxpayer_type', { length: 20 }),
    /** audit=查账征收 / deemed=核定征收 */
    collectionMethod: varchar('collection_method', { length: 20 }).default('audit').notNull(),
    /** monthly / quarterly / annual */
    filingCycle: varchar('filing_cycle', { length: 20 }).default('monthly').notNull(),
    /** 申报截止日:期间结束后的第 N 个月(默认 1=次月)的第几号 */
    dueMonthOffset: integer('due_month_offset').default(1).notNull(),
    dueDay: integer('due_day').default(15).notNull(),
    /** 适用税率/征收率(如增值税 0.13 / 0.03 / 0.01) */
    rate: numeric('rate', { precision: 6, scale: 4 }).default('0.0000').notNull(),
    /** 核定征收的应税所得率 */
    deemedRate: numeric('deemed_rate', { precision: 6, scale: 4 }),
    /** active / inactive */
    status: varchar('status', { length: 20 }).default('active').notNull(),
    effectiveFrom: date('effective_from'),
    effectiveTo: date('effective_to'),
    remark: text('remark'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    activeUq: uniqueIndex('uq_fin_tax_profile_active')
      .on(t.clientId, t.taxType)
      .where(sql`${t.deletedAt} IS NULL AND ${t.status} = 'active'`),
    clientIdx: index('ix_fin_tax_profile_client').on(t.clientId, t.status),
  }),
)

/**
 * 申报任务(申报日历的一格)。
 *
 * period 形态随 filing_cycle:
 *   monthly  → YYYY-MM
 *   quarterly→ YYYY-Q1..Q4
 *   annual   → YYYY
 * 同一(客户, 核定, 期间)唯一 —— ensureCalendar 可以反复跑,不会长出重复任务。
 *
 * status 流转:pending → computed(已算出应纳) → drafted(草案已出) → submitted(已提交)
 * → accepted(已受理/回执) ;failed 为异常态,可退回 pending。
 */
export const finFilingTask = pgTable(
  'fin_filing_task',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => finClient.id, { onDelete: 'cascade' }),
    ledgerId: uuid('ledger_id').references(() => finLedger.id, { onDelete: 'set null' }),
    taxProfileId: uuid('tax_profile_id')
      .notNull()
      .references(() => finTaxProfile.id, { onDelete: 'cascade' }),
    taxType: varchar('tax_type', { length: 20 }).notNull(),
    period: varchar('period', { length: 10 }).notNull(),
    dueDate: date('due_date').notNull(),
    /** pending / computed / drafted / submitted / accepted / failed */
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    taxableBase: numeric('taxable_base', { precision: 16, scale: 2 }),
    taxAmount: numeric('tax_amount', { precision: 16, scale: 2 }),
    paidAmount: numeric('paid_amount', { precision: 16, scale: 2 }),
    /** 草案产物引用(HTML/JSON 路径或对象键) */
    draftRef: varchar('draft_ref', { length: 500 }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    /** 受理回执号(税局返回) */
    receiptNo: varchar('receipt_no', { length: 100 }),
    receiptPayload: jsonb('receipt_payload').$type<Record<string, unknown>>(),
    assignee: uuid('assignee').references(() => users.id, { onDelete: 'set null' }),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    taskUq: uniqueIndex('uq_fin_filing_task').on(t.taxProfileId, t.period),
    dueIdx: index('ix_fin_filing_due').on(t.dueDate, t.status),
    clientIdx: index('ix_fin_filing_client').on(t.clientId, t.status),
  }),
)

export type FinTaxProfile = typeof finTaxProfile.$inferSelect
export type NewFinTaxProfile = typeof finTaxProfile.$inferInsert
export type FinFilingTask = typeof finFilingTask.$inferSelect
export type NewFinFilingTask = typeof finFilingTask.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
