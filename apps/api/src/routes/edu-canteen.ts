// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 教育食堂采购记账路由(2026-09-19 立)。
 *
 * 挂载于 /api/edu-canteen,配合 ai-service 的 /api/edu-canteen-receipt 三轮核对流水线:
 * - POST /procurement/ai-analyze     一站式:图 → 抽取 → 交叉核对 → (有差异则)仲裁 → 落台账
 * - POST /procurement/:id/ai-verify    手动重跑第2轮交叉核对(不覆盖人工编辑的明细)
 * - POST /procurement/:id/ai-arbitrate 手动跑第3轮差异仲裁(仲裁结果自动应用)
 * - 台账 CRUD + confirm(记账)/void(作废)
 * - 供应商 CRUD + options
 * - 统计(汇总/品类/供应商/月度) + 导出(xlsx 真 Excel / CSV,按明细行)
 *
 * 状态机: draft → ai_extracted → ai_verified / ai_conflict → confirmed → voided。
 * 权限: 读=requireAnyPermission(edu:view, edu:manage), 写=requirePermission(edu:manage)。
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import {
  eq,
  and,
  desc,
  isNull,
  gte,
  lte,
  count,
  sql,
  ilike,
  or,
  inArray,
  type SQL,
} from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  eduCanteenSupplier,
  eduCanteenProcurement,
  eduCanteenProcurementItem,
  type CanteenAiVerification,
} from '@ihui/database'
import { requirePermission, requireAnyPermission } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { aiServiceFetch } from '../utils/ai-service-fetch.js'
import { exportToExcel } from '../services/excel-export-service.js'

const requireEduManage: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown> =
  requirePermission('edu:manage')

const requireEduView: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown> =
  requireAnyPermission(['edu:view', 'edu:manage'])

// =============================================================================
// 通用 Schema & 辅助
// =============================================================================

const uuidParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

/** 图片以 data URI 直传 JSON body(全局 bodyLimit 10MB;base64 膨胀后限 13MB 字符)。 */
const imageField = z
  .string()
  .min(16, '图片不能为空')
  .max(13 * 1024 * 1024, '图片过大')

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

/** numeric 列(返回 string)→ number | null。 */
function toNum(v: string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// =============================================================================
// AI 服务响应类型(与 apps/ai-service/app/routers/edu_canteen_receipt.py 对齐)
// =============================================================================

interface AiReceiptItem {
  name: string
  category: string | null
  quantity: number | null
  unit: string | null
  unitPrice: number | null
  amount: number | null
}

interface AiReceiptData {
  supplierName: string | null
  receiptDate: string | null
  receiptNo: string | null
  totalAmount: number | null
  items: AiReceiptItem[]
}

interface AiRoundResp {
  ok: boolean
  verification: CanteenAiVerification | null
  error: string | null
  agreement?: number
  preferred?: string
}

async function callAi(
  request: FastifyRequest,
  path: string,
  body: Record<string, unknown>,
): Promise<AiRoundResp | null> {
  try {
    const resp = await aiServiceFetch(request, path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!resp.ok) return null
    return (await resp.json()) as AiRoundResp
  } catch (_err) {
    return null
  }
}

/** 把 AI receipt 结构映射为明细行插入值。 */
function receiptToItemValues(procurementId: string, receipt: AiReceiptData) {
  return (receipt.items ?? []).map((it, idx) => ({
    procurementId,
    itemName: it.name,
    category: it.category ?? null,
    quantity: it.quantity !== null && it.quantity !== undefined ? String(it.quantity) : null,
    unit: it.unit ?? null,
    unitPrice: it.unitPrice !== null && it.unitPrice !== undefined ? String(it.unitPrice) : null,
    amount: it.amount !== null && it.amount !== undefined ? String(it.amount) : '0',
    verifyStatus: 'ok' as const,
    sortOrder: idx,
  }))
}

/** 以最新轮 receipt 为主表聚合口径(总额缺省时按明细合计回填)。 */
function receiptTotals(receipt: AiReceiptData): { totalAmount: string; itemCount: number } {
  const items = receipt.items ?? []
  const sum = items.reduce((acc, it) => acc + (it.amount ?? 0), 0)
  const total = receipt.totalAmount ?? (items.length > 0 ? Number(sum.toFixed(2)) : 0)
  return { totalAmount: String(total), itemCount: items.length }
}

// =============================================================================
// 台账 Schema
// =============================================================================

const procurementListQuerySchema = z.object({
  startDate: z.transform(emptyToUndefined).pipe(z.string().optional()),
  endDate: z.transform(emptyToUndefined).pipe(z.string().optional()),
  status: z.transform(emptyToUndefined).pipe(z.string().max(30).optional()),
  supplierId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  keyword: z.transform(emptyToUndefined).pipe(z.string().max(100).optional()),
})

const aiAnalyzeSchema = z.object({
  image: imageField,
  hint: z.string().max(200).optional(),
  /** 是否把 data URI 图片存入台账(false 则只走识别,不落图,节省行体积)。 */
  saveImage: z.boolean().optional().default(true),
  notes: z.string().max(1000).optional(),
})

const aiVerifySchema = z.object({
  hint: z.string().max(200).optional(),
})

const procurementItemSchema = z.object({
  itemName: z.string().min(1, '品名不能为空').max(200),
  category: z.string().max(50).nullable().optional(),
  quantity: z.number().nullable().optional(),
  unit: z.string().max(20).nullable().optional(),
  unitPrice: z.number().nullable().optional(),
  amount: z.number().min(0).optional(),
})

const updateProcurementSchema = z.object({
  procurementDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式 YYYY-MM-DD')
    .optional(),
  supplierId: z.string().uuid().nullable().optional(),
  supplierName: z.string().max(200).nullable().optional(),
  receiptNo: z.string().max(100).nullable().optional(),
  totalAmount: z.number().min(0).optional(),
  notes: z.string().max(1000).nullable().optional(),
  items: z.array(procurementItemSchema).max(500).optional(),
})

// =============================================================================
// 供应商 Schema
// =============================================================================

const supplierListQuerySchema = z.object({
  keyword: z.transform(emptyToUndefined).pipe(z.string().max(100).optional()),
  category: z.transform(emptyToUndefined).pipe(z.string().max(50).optional()),
  status: z.transform(emptyToUndefined).pipe(z.string().max(20).optional()),
})

const createSupplierSchema = z.object({
  name: z.string().min(1, '供应商名称不能为空').max(200),
  category: z.string().max(50).optional(),
  contactPerson: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
  address: z.string().optional(),
  licenseInfo: z.string().max(300).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  notes: z.string().optional(),
})

const updateSupplierSchema = createSupplierSchema.partial()

// =============================================================================
// 统计/导出 Schema
// =============================================================================

const statsQuerySchema = z.object({
  startDate: z.transform(emptyToUndefined).pipe(z.string().optional()),
  endDate: z.transform(emptyToUndefined).pipe(z.string().optional()),
  /** 统计口径:confirmed(默认,仅已记账)/ all(含草稿与冲突)。 */
  scope: z.transform(emptyToUndefined).pipe(z.enum(['confirmed', 'all']).optional()),
  /** 导出格式(仅 /export 使用):xlsx(默认,真 Excel)/ csv(UTF-8 BOM)。 */
  format: z.transform(emptyToUndefined).pipe(z.enum(['xlsx', 'csv']).optional()),
})

// =============================================================================
// 分页辅助(与 edu-ai-management.ts 同模式,模块私有)
// =============================================================================

async function paginateProcurement(where: SQL | undefined, page: number, pageSize: number) {
  const [totalResult] = await db
    .select({ count: count() })
    .from(eduCanteenProcurement)
    .where(where ?? sql`true`)
  const total = Number(totalResult?.count ?? 0)
  const totalPages = Math.ceil(total / pageSize)
  const list = await db
    .select()
    .from(eduCanteenProcurement)
    .where(where ?? sql`true`)
    .orderBy(desc(eduCanteenProcurement.procurementDate), desc(eduCanteenProcurement.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
  return { list, total, page, pageSize, totalPages }
}

// =============================================================================
// 路由
// =============================================================================

const eduCanteenRoutes: FastifyPluginAsync = async (server) => {
  // ===========================================================================
  // 0. AI 编排 — 一站式拍照记账(抽取 → 核对 → 仲裁 → 落台账)
  // ===========================================================================

  server.post(
    '/procurement/ai-analyze',
    { bodyLimit: 14 * 1024 * 1024 },
    async (request, reply) => {
      await requireEduManage(request, reply)
      if (reply.sent) return
      const parsed = aiAnalyzeSchema.safeParse(request.body)
      if (!parsed.success)
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      const { image, hint, saveImage, notes } = parsed.data

      // ---- 第1轮:结构化抽取 ----
      const r1 = await callAi(request, '/api/edu-canteen-receipt/extract', { image, hint })
      if (!r1) return reply.status(502).send(error(502, 'AI 服务不可用(第1轮抽取)'))
      if (!r1.ok || !r1.verification?.receipt)
        return reply.status(502).send(error(502, r1.error ?? '小票识别失败,请重拍或换清晰图片'))
      const verifications: CanteenAiVerification[] = [r1.verification]
      const round1Receipt = r1.verification.receipt as AiReceiptData
      let final = round1Receipt
      let status = 'ai_extracted'
      let aiRounds = 1

      // ---- 第2轮:独立交叉核对 ----
      const r2 = await callAi(request, '/api/edu-canteen-receipt/verify', {
        image,
        first: round1Receipt,
        hint,
      })
      if (r2 && r2.verification && r2.verification.receipt) {
        verifications.push(r2.verification)
        aiRounds = 2
        final = r2.verification.receipt as AiReceiptData
        if (r2.verification.ok) {
          status = 'ai_verified'
        } else {
          // ---- 第3轮:差异仲裁 ----
          const r3 = await callAi(request, '/api/edu-canteen-receipt/arbitrate', {
            image,
            round1: round1Receipt,
            round2: r2.verification.receipt,
            differences: r2.verification.differences ?? [],
          })
          if (r3 && r3.verification) {
            verifications.push(r3.verification)
            aiRounds = 3
            if (r3.verification.receipt) final = r3.verification.receipt as AiReceiptData
            status = r3.verification.ok ? 'ai_verified' : 'ai_conflict'
          } else {
            status = 'ai_conflict'
          }
        }
      }
      // r2 调用失败 → 保持 ai_extracted,前端可手动重试 /procurement/:id/ai-verify

      const last = verifications[verifications.length - 1]
      const totals = receiptTotals(final)
      try {
        const created = await db.transaction(async (tx) => {
          const [proc] = await tx
            .insert(eduCanteenProcurement)
            .values({
              procurementDate: final.receiptDate || todayStr(),
              supplierName: final.supplierName ?? null,
              receiptNo: final.receiptNo ?? null,
              totalAmount: totals.totalAmount,
              itemCount: totals.itemCount,
              receiptImageUrl: saveImage ? image : null,
              status,
              aiRounds,
              aiVerifications: verifications,
              aiConfidence: last?.confidence ?? null,
              notes: notes ?? null,
              createdBy: request.userId ?? null,
            })
            .returning()
          if (!proc) throw new Error('台账创建失败')
          if (totals.itemCount > 0) {
            await tx.insert(eduCanteenProcurementItem).values(receiptToItemValues(proc.id, final))
          }
          return proc
        })
        const items = await db
          .select()
          .from(eduCanteenProcurementItem)
          .where(eq(eduCanteenProcurementItem.procurementId, created.id))
          .orderBy(eduCanteenProcurementItem.sortOrder)
        return reply.status(201).send(
          success({
            procurement: { ...created, totalAmount: toNum(created.totalAmount) },
            items: items.map((it) => ({
              ...it,
              quantity: toNum(it.quantity),
              unitPrice: toNum(it.unitPrice),
              amount: toNum(it.amount),
            })),
          }),
        )
      } catch (_err) {
        return reply.status(500).send(error(500, '台账落库失败'))
      }
    },
  )

  // ===========================================================================
  // 1. 台账 CRUD
  // ===========================================================================

  server.get('/procurement', async (request, reply) => {
    await requireEduView(request, reply)
    if (reply.sent) return
    const parsed = procurementListQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { page, pageSize } = paginationSchema.parse(request.query)
    const conds: SQL[] = [isNull(eduCanteenProcurement.deletedAt)]
    const q = parsed.data
    if (q.startDate) conds.push(gte(eduCanteenProcurement.procurementDate, q.startDate))
    if (q.endDate) conds.push(lte(eduCanteenProcurement.procurementDate, q.endDate))
    if (q.status) conds.push(eq(eduCanteenProcurement.status, q.status))
    if (q.supplierId) conds.push(eq(eduCanteenProcurement.supplierId, q.supplierId))
    if (q.keyword) {
      const like = `%${q.keyword}%`
      const cond = or(
        ilike(eduCanteenProcurement.supplierName, like),
        ilike(eduCanteenProcurement.receiptNo, like),
      )
      if (cond) conds.push(cond)
    }
    const result = await paginateProcurement(and(...conds), page, pageSize)
    return reply.send(
      success({
        ...result,
        list: result.list.map((row) => ({
          ...row,
          totalAmount: toNum(row.totalAmount),
          // 列表不回传大字段(图片 base64 与全量核对记录体积大,详情端点按需返回)
          receiptImageUrl: row.receiptImageUrl ? '__stored__' : null,
          aiVerifications: (row.aiVerifications ?? []).map((v) => ({
            round: v.round,
            type: v.type,
            model: v.model,
            at: v.at,
            confidence: v.confidence,
            ok: v.ok,
            differences: v.differences?.length ?? 0,
          })),
        })),
      }),
    )
  })

  server.get('/procurement/:id', async (request, reply) => {
    await requireEduView(request, reply)
    if (reply.sent) return
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db
      .select()
      .from(eduCanteenProcurement)
      .where(
        and(eq(eduCanteenProcurement.id, parsed.data.id), isNull(eduCanteenProcurement.deletedAt)),
      )
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '采购单不存在'))
    const items = await db
      .select()
      .from(eduCanteenProcurementItem)
      .where(eq(eduCanteenProcurementItem.procurementId, row.id))
      .orderBy(eduCanteenProcurementItem.sortOrder)
    return reply.send(
      success({
        procurement: { ...row, totalAmount: toNum(row.totalAmount) },
        items: items.map((it) => ({
          ...it,
          quantity: toNum(it.quantity),
          unitPrice: toNum(it.unitPrice),
          amount: toNum(it.amount),
        })),
      }),
    )
  })

  server.put('/procurement/:id', async (request, reply) => {
    await requireEduManage(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = updateProcurementSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduCanteenProcurement)
      .where(
        and(
          eq(eduCanteenProcurement.id, idParsed.data.id),
          isNull(eduCanteenProcurement.deletedAt),
        ),
      )
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '采购单不存在'))
    if (existing.status === 'confirmed' || existing.status === 'voided')
      return reply.status(400).send(error(400, `当前状态(${existing.status})不可编辑`))

    const data = parsed.data
    // 明细替换 + 汇总重算(明细提供时以明细合计为准,totalAmount 显式传入优先)
    let itemCount = existing.itemCount
    let totalAmount =
      data.totalAmount !== null && data.totalAmount !== undefined
        ? String(data.totalAmount)
        : undefined
    if (data.items) {
      itemCount = data.items.length
      const sum = data.items.reduce((acc, it) => acc + (it.amount ?? 0), 0)
      if (totalAmount === undefined) totalAmount = String(Number(sum.toFixed(2)))
    }
    try {
      const [row] = await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(eduCanteenProcurement)
          .set({
            ...(data.procurementDate !== undefined
              ? { procurementDate: data.procurementDate }
              : {}),
            ...(data.supplierId !== undefined ? { supplierId: data.supplierId } : {}),
            ...(data.supplierName !== undefined ? { supplierName: data.supplierName } : {}),
            ...(data.receiptNo !== undefined ? { receiptNo: data.receiptNo } : {}),
            ...(data.notes !== undefined ? { notes: data.notes } : {}),
            ...(totalAmount !== undefined ? { totalAmount } : {}),
            ...(itemCount !== existing.itemCount ? { itemCount } : {}),
            updatedAt: new Date(),
          })
          .where(eq(eduCanteenProcurement.id, idParsed.data.id))
          .returning()
        if (data.items) {
          await tx
            .delete(eduCanteenProcurementItem)
            .where(eq(eduCanteenProcurementItem.procurementId, idParsed.data.id))
          if (data.items.length > 0) {
            await tx.insert(eduCanteenProcurementItem).values(
              data.items.map((it, idx) => ({
                procurementId: idParsed.data.id,
                itemName: it.itemName,
                category: it.category ?? null,
                quantity:
                  it.quantity !== null && it.quantity !== undefined ? String(it.quantity) : null,
                unit: it.unit ?? null,
                unitPrice:
                  it.unitPrice !== null && it.unitPrice !== undefined ? String(it.unitPrice) : null,
                amount: it.amount !== null && it.amount !== undefined ? String(it.amount) : '0',
                verifyStatus: 'edited',
                sortOrder: idx,
              })),
            )
          }
        }
        return [updated]
      })
      return reply.send(success({ procurement: { ...row, totalAmount: toNum(row?.totalAmount) } }))
    } catch (_err) {
      return reply.status(500).send(error(500, '采购单更新失败'))
    }
  })

  server.post('/procurement/:id/confirm', async (request, reply) => {
    await requireEduManage(request, reply)
    if (reply.sent) return
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduCanteenProcurement)
      .where(
        and(eq(eduCanteenProcurement.id, parsed.data.id), isNull(eduCanteenProcurement.deletedAt)),
      )
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '采购单不存在'))
    if (existing.status === 'confirmed')
      return reply.status(400).send(error(400, '已记账,勿重复确认'))
    if (existing.status === 'voided')
      return reply.status(400).send(error(400, '已作废单据不可记账'))
    if (existing.itemCount === 0)
      return reply.status(400).send(error(400, '无明细,请先补录明细再记账'))
    const [row] = await db
      .update(eduCanteenProcurement)
      .set({
        status: 'confirmed',
        confirmedBy: request.userId ?? null,
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(eduCanteenProcurement.id, parsed.data.id))
      .returning()
    return reply.send(success({ procurement: { ...row, totalAmount: toNum(row?.totalAmount) } }))
  })

  server.post('/procurement/:id/void', async (request, reply) => {
    await requireEduManage(request, reply)
    if (reply.sent) return
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduCanteenProcurement)
      .where(
        and(eq(eduCanteenProcurement.id, parsed.data.id), isNull(eduCanteenProcurement.deletedAt)),
      )
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '采购单不存在'))
    if (existing.status === 'voided') return reply.status(400).send(error(400, '已作废,勿重复操作'))
    const [row] = await db
      .update(eduCanteenProcurement)
      .set({ status: 'voided', updatedAt: new Date() })
      .where(eq(eduCanteenProcurement.id, parsed.data.id))
      .returning()
    return reply.send(success({ procurement: { ...row, totalAmount: toNum(row?.totalAmount) } }))
  })

  server.delete('/procurement/:id', async (request, reply) => {
    await requireEduManage(request, reply)
    if (reply.sent) return
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduCanteenProcurement)
      .where(
        and(eq(eduCanteenProcurement.id, parsed.data.id), isNull(eduCanteenProcurement.deletedAt)),
      )
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '采购单不存在'))
    const removed = await db
      .update(eduCanteenProcurement)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(eduCanteenProcurement.id, parsed.data.id))
      .returning({ id: eduCanteenProcurement.id })
    return reply.send(success({ deleted: removed.length > 0 }))
  })

  // ===========================================================================
  // 2. 手动 AI 重核对(第2轮)/仲裁(第3轮)
  // ===========================================================================

  server.post('/procurement/:id/ai-verify', async (request, reply) => {
    await requireEduManage(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = aiVerifySchema.safeParse(request.body ?? {})
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduCanteenProcurement)
      .where(
        and(
          eq(eduCanteenProcurement.id, idParsed.data.id),
          isNull(eduCanteenProcurement.deletedAt),
        ),
      )
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '采购单不存在'))
    if (existing.status === 'confirmed' || existing.status === 'voided')
      return reply.status(400).send(error(400, `当前状态(${existing.status})不可重核对`))
    if (!existing.receiptImageUrl)
      return reply.status(400).send(error(400, '该单据未保存小票图,无法重核对'))

    const vs = (existing.aiVerifications ?? []) as CanteenAiVerification[]
    // 上一轮(抽取/仲裁)的 receipt 作为比对基准
    const lastWithReceipt = [...vs].reverse().find((v) => v.receipt)
    if (!lastWithReceipt?.receipt)
      return reply.status(400).send(error(400, '无历史识别结果可作比对基准'))

    const r2 = await callAi(request, '/api/edu-canteen-receipt/verify', {
      image: existing.receiptImageUrl,
      first: lastWithReceipt.receipt,
      hint: parsed.data.hint,
    })
    if (!r2 || !r2.verification)
      return reply.status(502).send(error(502, r2?.error ?? 'AI 服务不可用(交叉核对)'))

    const newVerifications = [...vs, r2.verification]
    const newStatus = r2.verification.ok ? 'ai_verified' : 'ai_conflict'
    const [row] = await db
      .update(eduCanteenProcurement)
      .set({
        aiVerifications: newVerifications,
        aiRounds: existing.aiRounds + 1,
        aiConfidence: r2.verification.confidence,
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(eduCanteenProcurement.id, idParsed.data.id))
      .returning()
    // 语义说明:重核对只追加核对记录与状态,不覆盖既有明细(保护人工编辑);
    // 若需机器值覆盖,走 ai-arbitrate 或编辑页手动修改
    return reply.send(
      success({
        procurement: { ...row, totalAmount: toNum(row?.totalAmount) },
        verification: r2.verification,
        agreement: r2.agreement ?? null,
        preferred: r2.preferred ?? null,
      }),
    )
  })

  server.post('/procurement/:id/ai-arbitrate', async (request, reply) => {
    await requireEduManage(request, reply)
    if (reply.sent) return
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduCanteenProcurement)
      .where(
        and(eq(eduCanteenProcurement.id, parsed.data.id), isNull(eduCanteenProcurement.deletedAt)),
      )
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '采购单不存在'))
    if (existing.status === 'confirmed' || existing.status === 'voided')
      return reply.status(400).send(error(400, `当前状态(${existing.status})不可仲裁`))
    if (!existing.receiptImageUrl)
      return reply.status(400).send(error(400, '该单据未保存小票图,无法仲裁'))

    const vs = (existing.aiVerifications ?? []) as CanteenAiVerification[]
    const round1 = vs.find((v) => v.type === 'extract' && v.receipt)
    const round2 = [...vs].reverse().find((v) => v.type === 'verify' && v.receipt)
    if (!round1?.receipt || !round2?.receipt)
      return reply.status(400).send(error(400, '缺少两轮识别结果,请先完成抽取与交叉核对'))
    const differences = round2.differences ?? []

    const r3 = await callAi(request, '/api/edu-canteen-receipt/arbitrate', {
      image: existing.receiptImageUrl,
      round1: round1.receipt,
      round2: round2.receipt,
      differences,
    })
    if (!r3 || !r3.verification || !r3.verification.receipt)
      return reply.status(502).send(error(502, r3?.error ?? 'AI 服务不可用(差异仲裁)'))

    const final = r3.verification.receipt as AiReceiptData
    const totals = receiptTotals(final)
    const newVerifications = [...vs, r3.verification]
    try {
      const row = await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(eduCanteenProcurement)
          .set({
            procurementDate: final.receiptDate || existing.procurementDate,
            supplierName: final.supplierName ?? existing.supplierName,
            receiptNo: final.receiptNo ?? existing.receiptNo,
            totalAmount: totals.totalAmount,
            itemCount: totals.itemCount,
            aiVerifications: newVerifications,
            aiRounds: existing.aiRounds + 1,
            aiConfidence: r3.verification!.confidence,
            status: r3.verification!.ok ? 'ai_verified' : 'ai_conflict',
            updatedAt: new Date(),
          })
          .where(eq(eduCanteenProcurement.id, parsed.data.id))
          .returning()
        // 仲裁结果自动应用:以最终 receipt 重建明细(verifyStatus=ok)
        if (totals.itemCount > 0) {
          await tx
            .delete(eduCanteenProcurementItem)
            .where(eq(eduCanteenProcurementItem.procurementId, parsed.data.id))
          await tx
            .insert(eduCanteenProcurementItem)
            .values(receiptToItemValues(parsed.data.id, final))
        }
        return updated
      })
      return reply.send(
        success({
          procurement: { ...row, totalAmount: toNum(row?.totalAmount) },
          verification: r3.verification,
        }),
      )
    } catch (_err) {
      return reply.status(500).send(error(500, '仲裁结果落库失败'))
    }
  })

  // ===========================================================================
  // 3. 供应商 CRUD
  // ===========================================================================

  server.get('/supplier', async (request, reply) => {
    await requireEduView(request, reply)
    if (reply.sent) return
    const parsed = supplierListQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { page, pageSize } = paginationSchema.parse(request.query)
    const conds: SQL[] = [isNull(eduCanteenSupplier.deletedAt)]
    if (parsed.data.keyword) conds.push(ilike(eduCanteenSupplier.name, `%${parsed.data.keyword}%`))
    if (parsed.data.category) conds.push(eq(eduCanteenSupplier.category, parsed.data.category))
    if (parsed.data.status) conds.push(eq(eduCanteenSupplier.status, parsed.data.status))
    const where = and(...conds)
    const [totalResult] = await db
      .select({ count: count() })
      .from(eduCanteenSupplier)
      .where(where ?? sql`true`)
    const total = Number(totalResult?.count ?? 0)
    const list = await db
      .select()
      .from(eduCanteenSupplier)
      .where(where ?? sql`true`)
      .orderBy(desc(eduCanteenSupplier.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    return reply.send(
      success({ list, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }),
    )
  })

  server.get('/supplier/options', async (request, reply) => {
    await requireEduView(request, reply)
    if (reply.sent) return
    const list = await db
      .select({
        id: eduCanteenSupplier.id,
        name: eduCanteenSupplier.name,
        category: eduCanteenSupplier.category,
        phone: eduCanteenSupplier.phone,
      })
      .from(eduCanteenSupplier)
      .where(and(eq(eduCanteenSupplier.status, 'active'), isNull(eduCanteenSupplier.deletedAt)))
      .orderBy(eduCanteenSupplier.name)
      .limit(500)
    return reply.send(success({ options: list }))
  })

  server.post('/supplier', async (request, reply) => {
    await requireEduManage(request, reply)
    if (reply.sent) return
    const parsed = createSupplierSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db
      .insert(eduCanteenSupplier)
      .values({ ...parsed.data, createdBy: request.userId ?? null })
      .returning()
    return reply.status(201).send(success({ supplier: row }))
  })

  server.put('/supplier/:id', async (request, reply) => {
    await requireEduManage(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = updateSupplierSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduCanteenSupplier)
      .where(and(eq(eduCanteenSupplier.id, idParsed.data.id), isNull(eduCanteenSupplier.deletedAt)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '供应商不存在'))
    const [row] = await db
      .update(eduCanteenSupplier)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(eduCanteenSupplier.id, idParsed.data.id))
      .returning()
    return reply.send(success({ supplier: row }))
  })

  server.delete('/supplier/:id', async (request, reply) => {
    await requireEduManage(request, reply)
    if (reply.sent) return
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduCanteenSupplier)
      .where(and(eq(eduCanteenSupplier.id, parsed.data.id), isNull(eduCanteenSupplier.deletedAt)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '供应商不存在'))
    const removed = await db
      .update(eduCanteenSupplier)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(eduCanteenSupplier.id, parsed.data.id))
      .returning({ id: eduCanteenSupplier.id })
    return reply.send(success({ deleted: removed.length > 0 }))
  })

  // ===========================================================================
  // 4. 统计(汇总/品类/供应商/月度)
  // ===========================================================================

  server.get('/statistics', async (request, reply) => {
    await requireEduView(request, reply)
    if (reply.sent) return
    const parsed = statsQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { startDate, endDate, scope } = parsed.data

    const conds: SQL[] = [isNull(eduCanteenProcurement.deletedAt)]
    if (scope !== 'all') conds.push(eq(eduCanteenProcurement.status, 'confirmed'))
    if (startDate) conds.push(gte(eduCanteenProcurement.procurementDate, startDate))
    if (endDate) conds.push(lte(eduCanteenProcurement.procurementDate, endDate))
    const where = and(...conds)

    try {
      const [summaryRow] = await db
        .select({
          totalAmount: sql<string>`coalesce(sum(${eduCanteenProcurement.totalAmount}), 0)`,
          procurementCount: count(),
          itemCount: sql<string>`coalesce(sum(${eduCanteenProcurement.itemCount}), 0)`,
        })
        .from(eduCanteenProcurement)
        .where(where)

      const byCategory = await db
        .select({
          category: sql<string>`coalesce(${eduCanteenProcurementItem.category}, '未分类')`,
          amount: sql<string>`coalesce(sum(${eduCanteenProcurementItem.amount}), 0)`,
          itemCount: count(),
        })
        .from(eduCanteenProcurementItem)
        .innerJoin(
          eduCanteenProcurement,
          eq(eduCanteenProcurementItem.procurementId, eduCanteenProcurement.id),
        )
        .where(where)
        .groupBy(sql`coalesce(${eduCanteenProcurementItem.category}, '未分类')`)
        .orderBy(desc(sql`coalesce(sum(${eduCanteenProcurementItem.amount}), 0)`))

      const bySupplier = await db
        .select({
          supplierName: sql<string>`coalesce(${eduCanteenProcurement.supplierName}, '未知供应商')`,
          amount: sql<string>`coalesce(sum(${eduCanteenProcurement.totalAmount}), 0)`,
          procurementCount: count(),
        })
        .from(eduCanteenProcurement)
        .where(where)
        .groupBy(sql`coalesce(${eduCanteenProcurement.supplierName}, '未知供应商')`)
        .orderBy(desc(sql`coalesce(sum(${eduCanteenProcurement.totalAmount}), 0)`))
        .limit(10)

      const byMonth = await db
        .select({
          month: sql<string>`to_char(date_trunc('month', ${eduCanteenProcurement.procurementDate}::timestamp), 'YYYY-MM')`,
          amount: sql<string>`coalesce(sum(${eduCanteenProcurement.totalAmount}), 0)`,
          procurementCount: count(),
        })
        .from(eduCanteenProcurement)
        .where(where)
        .groupBy(
          sql`to_char(date_trunc('month', ${eduCanteenProcurement.procurementDate}::timestamp), 'YYYY-MM')`,
        )
        .orderBy(
          sql`to_char(date_trunc('month', ${eduCanteenProcurement.procurementDate}::timestamp), 'YYYY-MM')`,
        )

      const totalAmount = toNum(summaryRow?.totalAmount) ?? 0
      const procurementCount = Number(summaryRow?.procurementCount ?? 0)
      return reply.send(
        success({
          scope: scope ?? 'confirmed',
          dateRange: { startDate: startDate ?? null, endDate: endDate ?? null },
          summary: {
            totalAmount,
            procurementCount,
            itemCount: Number(summaryRow?.itemCount ?? 0),
            avgAmount:
              procurementCount > 0 ? Number((totalAmount / procurementCount).toFixed(2)) : 0,
          },
          byCategory: byCategory.map((r) => ({
            category: r.category,
            amount: toNum(r.amount) ?? 0,
            itemCount: Number(r.itemCount),
          })),
          bySupplier: bySupplier.map((r) => ({
            supplierName: r.supplierName,
            amount: toNum(r.amount) ?? 0,
            procurementCount: Number(r.procurementCount),
          })),
          byMonth: byMonth.map((r) => ({
            month: r.month,
            amount: toNum(r.amount) ?? 0,
            procurementCount: Number(r.procurementCount),
          })),
        }),
      )
    } catch (_err) {
      return reply.status(500).send(error(500, '统计查询失败'))
    }
  })

  // ===========================================================================
  // 5. 导出:xlsx(真 Excel,带表头样式/冻结首行) / csv(UTF-8 BOM),按明细行
  // ===========================================================================

  server.get('/export', async (request, reply) => {
    await requireEduView(request, reply)
    if (reply.sent) return
    const parsed = statsQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { startDate, endDate, scope, format = 'xlsx' } = parsed.data
    const conds: SQL[] = [isNull(eduCanteenProcurement.deletedAt)]
    if (scope !== 'all') conds.push(eq(eduCanteenProcurement.status, 'confirmed'))
    if (startDate) conds.push(gte(eduCanteenProcurement.procurementDate, startDate))
    if (endDate) conds.push(lte(eduCanteenProcurement.procurementDate, endDate))

    try {
      const procs = await db
        .select()
        .from(eduCanteenProcurement)
        .where(and(...conds))
        .orderBy(eduCanteenProcurement.procurementDate)
        .limit(10000)
      const items =
        procs.length > 0
          ? await db
              .select()
              .from(eduCanteenProcurementItem)
              .where(
                inArray(
                  eduCanteenProcurementItem.procurementId,
                  procs.map((p) => p.id),
                ),
              )
              .orderBy(eduCanteenProcurementItem.sortOrder)
          : []
      const itemsByProc = new Map<string, typeof items>()
      for (const it of items) {
        const arr = itemsByProc.get(it.procurementId) ?? []
        arr.push(it)
        itemsByProc.set(it.procurementId, arr)
      }

      // 扁平化明细行(共用):一单多明细按行展开,无明细单据补"(无明细)"占位行
      const rows: Array<Record<string, unknown>> = []
      for (const p of procs) {
        const prows = itemsByProc.get(p.id) ?? []
        if (prows.length === 0) {
          rows.push({
            date: p.procurementDate,
            supplier: p.supplierName ?? '',
            receiptNo: p.receiptNo ?? '',
            status: p.status,
            itemName: '(无明细)',
            category: '',
            quantity: '',
            unit: '',
            unitPrice: '',
            amount: '',
            totalAmount: p.totalAmount,
            aiConfidence: p.aiConfidence ?? '',
            notes: p.notes ?? '',
          })
          continue
        }
        for (const it of prows) {
          rows.push({
            date: p.procurementDate,
            supplier: p.supplierName ?? '',
            receiptNo: p.receiptNo ?? '',
            status: p.status,
            itemName: it.itemName,
            category: it.category ?? '',
            quantity: toNum(it.quantity) ?? '',
            unit: it.unit ?? '',
            unitPrice: toNum(it.unitPrice) ?? '',
            amount: toNum(it.amount),
            totalAmount: p.totalAmount,
            aiConfidence: p.aiConfidence ?? '',
            notes: p.notes ?? '',
          })
        }
      }

      if (format === 'xlsx') {
        const buf = await exportToExcel(rows, {
          sheetName: '采购台账',
          columns: [
            { header: '日期', field: 'date', width: 12 },
            { header: '供应商', field: 'supplier', width: 22 },
            { header: '单号', field: 'receiptNo', width: 18 },
            { header: '状态', field: 'status', width: 12 },
            { header: '品名', field: 'itemName', width: 16 },
            { header: '类别', field: 'category', width: 10 },
            { header: '数量', field: 'quantity', width: 8, type: 'float' },
            { header: '单位', field: 'unit', width: 8 },
            { header: '单价(元)', field: 'unitPrice', width: 10, type: 'float' },
            { header: '小计(元)', field: 'amount', width: 10, type: 'float' },
            { header: '单据总额(元)', field: 'totalAmount', width: 14, type: 'float' },
            { header: 'AI置信度', field: 'aiConfidence', width: 10 },
            { header: '备注', field: 'notes', width: 24 },
          ],
        })
        reply.header(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        reply.header(
          'Content-Disposition',
          `attachment; filename="canteen-procurement-${todayStr()}.xlsx"`,
        )
        return reply.send(buf)
      }

      // ---- CSV(UTF-8 BOM,Excel 友好) ----
      const csvEscape = (v: unknown): string => {
        const s = v === null || v === undefined ? '' : String(v)
        return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
      }
      const header = [
        '日期',
        '供应商',
        '单号',
        '状态',
        '品名',
        '类别',
        '数量',
        '单位',
        '单价(元)',
        '小计(元)',
        '单据总额(元)',
        'AI置信度',
        '备注',
      ]
      const fields = [
        'date',
        'supplier',
        'receiptNo',
        'status',
        'itemName',
        'category',
        'quantity',
        'unit',
        'unitPrice',
        'amount',
        'totalAmount',
        'aiConfidence',
        'notes',
      ]
      const lines = [header.map(csvEscape).join(',')]
      for (const row of rows) {
        lines.push(fields.map((f) => csvEscape(row[f])).join(','))
      }
      const csv = '\ufeff' + lines.join('\r\n')
      reply.header('Content-Type', 'text/csv; charset=utf-8')
      reply.header(
        'Content-Disposition',
        `attachment; filename="canteen-procurement-${todayStr()}.csv"`,
      )
      return reply.send(csv)
    } catch (_err) {
      return reply.status(500).send(error(500, '导出失败'))
    }
  })
}

export default eduCanteenRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
