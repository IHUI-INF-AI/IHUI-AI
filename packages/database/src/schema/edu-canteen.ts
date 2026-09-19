// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‌‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​​‌​​‌‌‌‌​‌​‍‍‌‌​​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‌‌‍‍​‌​​‌​​‌‍‍‌​‌‌‌​‌‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‌‌‍‍​‌‌​​​‌‌‌‍‍​‌​​‌‌‌‌‍‍‌​‌‌​‌​‌‍‍‌​‌‌​​‌​​‌‍‍‌‌​‌​‌‌​‌‍‍​‌​​‌‌‌‌​‌‌‌‍‍‌‌​‌‌​​‌‌‌‍‍‌‌​‌​‌‌‌

/**
 * 教育机构食堂采购记账表 (2026-09-19 立)。
 *
 * edu_canteen_supplier: 供应商档案(分类/联系人/资质/状态);
 * edu_canteen_procurement: 采购单主表(小票图 + 总金额 + 状态机 + AI 多轮核对全记录 jsonb);
 * edu_canteen_procurement_item: 采购明细行(品名/数量/单位/单价/小计/核对标记), 随主表级联删除。
 *
 * 状态机: draft → ai_extracted → ai_verified / ai_conflict → confirmed(记账) → voided(作废)。
 * AI 核对流水线: 第1轮结构化抽取 → 第2轮独立交叉核对(重识别+数学自检) → 第3轮差异仲裁 → 人工确认。
 */
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  date,
  timestamp,
  numeric,
  jsonb,
  index,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

/** AI 抽取的小票结构化结果(每轮识别的输出)。 */
export interface CanteenReceiptData {
  supplierName: string | null
  receiptDate: string | null // YYYY-MM-DD
  receiptNo: string | null
  totalAmount: number | null
  items: Array<{
    name: string
    category: string | null
    quantity: number | null
    unit: string | null
    unitPrice: number | null
    amount: number | null
  }>
}

/** 程序化校验项(数学自检, 不依赖 LLM)。 */
export interface CanteenReceiptCheck {
  name: string // 如 "明细合计=总金额"
  passed: boolean
  detail: string
}

/** 轮次间字段级差异。 */
export interface CanteenReceiptDifference {
  field: string // supplierName / totalAmount / items[3].unitPrice
  previous: string
  current: string
  resolution: string | null // 第3轮仲裁结论(采纳值与理由)
}

/** 单轮 AI 核对完整记录(edu_canteen_procurement.ai_verifications 数组元素)。 */
export interface CanteenAiVerification {
  round: number
  type: 'extract' | 'verify' | 'arbitrate'
  model: string
  at: string // ISO 时间
  receipt: CanteenReceiptData | null
  checks: CanteenReceiptCheck[]
  differences: CanteenReceiptDifference[]
  confidence: number // 0-100
  ok: boolean
  error: string | null
}

/** 食堂供应商表 (edu_canteen_supplier)。 */
export const eduCanteenSupplier = pgTable(
  'edu_canteen_supplier',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 200 }).notNull(),
    category: varchar('category', { length: 50 }), // 蔬菜/肉禽/水产/粮油/调味/冻品/其他
    contactPerson: varchar('contact_person', { length: 100 }),
    phone: varchar('phone', { length: 50 }),
    address: text('address'),
    licenseInfo: varchar('license_info', { length: 300 }), // 营业执照/资质证照
    status: varchar('status', { length: 20 }).default('active').notNull(), // active/inactive
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    nameIdx: index('ix_edu_canteen_supplier_name').on(t.name),
    categoryIdx: index('ix_edu_canteen_supplier_category').on(t.category),
  }),
)

/** 食堂采购单表 (edu_canteen_procurement)。 */
export const eduCanteenProcurement = pgTable(
  'edu_canteen_procurement',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    procurementDate: date('procurement_date').notNull(),
    supplierId: uuid('supplier_id').references(() => eduCanteenSupplier.id, {
      onDelete: 'set null',
    }),
    supplierName: varchar('supplier_name', { length: 200 }), // AI 识别/人工确认的供应商名快照
    receiptNo: varchar('receipt_no', { length: 100 }),
    totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).default('0').notNull(),
    itemCount: integer('item_count').default(0).notNull(),
    receiptImageUrl: text('receipt_image_url'), // 小票图片(data URI 或 URL)
    status: varchar('status', { length: 30 }).default('draft').notNull(),
    aiRounds: integer('ai_rounds').default(0).notNull(), // 已执行的 AI 核对轮数
    aiVerifications: jsonb('ai_verifications')
      .$type<CanteenAiVerification[]>()
      .default([])
      .notNull(),
    aiConfidence: integer('ai_confidence'), // 0-100 最终置信度
    confirmedBy: uuid('confirmed_by').references(() => users.id, { onDelete: 'set null' }),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    dateIdx: index('ix_edu_canteen_proc_date').on(t.procurementDate),
    statusIdx: index('ix_edu_canteen_proc_status').on(t.status),
    supplierIdx: index('ix_edu_canteen_proc_supplier').on(t.supplierId),
  }),
)

/** 食堂采购明细表 (edu_canteen_procurement_item)。 */
export const eduCanteenProcurementItem = pgTable(
  'edu_canteen_procurement_item',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    procurementId: uuid('procurement_id')
      .notNull()
      .references(() => eduCanteenProcurement.id, { onDelete: 'cascade' }),
    itemName: varchar('item_name', { length: 200 }).notNull(),
    category: varchar('category', { length: 50 }),
    quantity: numeric('quantity', { precision: 12, scale: 3 }),
    unit: varchar('unit', { length: 20 }), // kg/斤/份/箱...
    unitPrice: numeric('unit_price', { precision: 12, scale: 2 }),
    amount: numeric('amount', { precision: 12, scale: 2 }).default('0').notNull(),
    verifyStatus: varchar('verify_status', { length: 20 }).default('ok').notNull(), // ok/edited/mismatch
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    procIdx: index('ix_edu_canteen_item_proc').on(t.procurementId),
  }),
)
