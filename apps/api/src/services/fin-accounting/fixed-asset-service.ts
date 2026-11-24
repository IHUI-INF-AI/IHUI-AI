// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 固定资产台账与月折旧(2026-11-24 补口)。
 *
 * 折旧只做直线法(年限平均),口径全部显式:
 *   月折旧额 = (原值 - 原值×残值率) ÷ 预计使用月数,尾差进最后一个月,
 *   全期累计严格等于应计总额(分口径,无浮点)。
 * 入账为**每账套每期一张汇总凭证**(借:各费用科目汇总,贷:1602),批次幂等键
 *   sourceRef = asset-dep:<ledgerId>:<period> ⇒ 重复触发不再产凭证。
 * 已结账期间由 createVoucher(post) 走既有硬闸,本层不复算结账逻辑。
 */
import { and, asc, eq, isNull, sql } from 'drizzle-orm'

import { db } from '../../db/index.js'
import { finFixedAsset, finVoucher, type FinFixedAsset } from '@ihui/database'
import { AppError } from '../../errors/AppError.js'
import { fromCents, toCents } from './money.js'
import { assertPeriod, lastDayOf, PERIOD_RE } from './period.js'
import { createVoucher } from './voucher-service.js'

export interface DepreciationInput {
  code: string
  name: string
  category?: string
  originalCost: string
  startPeriod: string
  usefulMonths: number
  salvageRate?: string
  expenseAccountCode?: string
  disposalPeriod?: string | null
  note?: string | null
}

/** 期间差(月)。与 period.ts 同源口径:YYYY-MM 相减。 */
export function monthsBetween(fromPeriod: string, toPeriod: string): number {
  const fy = Number(fromPeriod.slice(0, 4))
  const fm = Number(fromPeriod.slice(5, 7))
  const ty = Number(toPeriod.slice(0, 4))
  const tm = Number(toPeriod.slice(5, 7))
  return (ty - fy) * 12 + (tm - fm)
}

/**
 * 直线法某期间折旧额(分)。seq 为该期间是第几个计提月(从 1 起)。
 * 纯函数,测试单钉尾差与越界。
 */
export function straightLinePeriodCents(
  originalCostCents: number,
  salvageRate: number,
  usefulMonths: number,
  seq: number,
): number {
  if (!Number.isInteger(usefulMonths) || usefulMonths <= 0) return 0
  if (seq < 1 || seq > usefulMonths) return 0
  const depreciable = originalCostCents - Math.round(originalCostCents * salvageRate)
  if (depreciable <= 0) return 0
  const monthly = Math.floor(depreciable / usefulMonths)
  if (seq < usefulMonths) return monthly
  // 最后一个月吃尾差,保证全期合计严格等于 depreciable
  return depreciable - monthly * (usefulMonths - 1)
}

/** 资产在指定期间应计提的期序号(1 起);不计提返回 null。处置期起停提。 */
export function depreciationSequence(
  asset: Pick<
    FinFixedAsset,
    'startPeriod' | 'usefulMonths' | 'status' | 'disposalPeriod'
  >,
  period: string,
): number | null {
  if (asset.status === 'disposed' && asset.disposalPeriod && period >= asset.disposalPeriod) {
    return null
  }
  if (!PERIOD_RE.test(asset.startPeriod)) return null
  const seq = monthsBetween(asset.startPeriod, period) + 1
  return seq >= 1 ? seq : null
}

export async function createAsset(
  ledgerId: string,
  input: DepreciationInput,
  _userId?: string | null,
) {
  assertPeriod(input.startPeriod, 'startPeriod')
  if (input.disposalPeriod) assertPeriod(input.disposalPeriod, 'disposalPeriod')
  if (!Number.isInteger(input.usefulMonths) || input.usefulMonths < 1 || input.usefulMonths > 600) {
    throw new AppError('usefulMonths 必须是 1~600 的整数', 400, 'FIN_ASSET_USEFUL_INVALID')
  }
  const costCents = toCents(input.originalCost)
  if (costCents <= 0) throw new AppError('原值必须大于 0', 400, 'FIN_ASSET_COST_INVALID')
  const salvage = input.salvageRate === undefined ? 0.05 : Number(input.salvageRate)
  if (!(salvage >= 0 && salvage <= 0.2)) {
    throw new AppError('残值率必须在 0~0.2 之间(5% 记 0.05)', 400, 'FIN_ASSET_SALVAGE_INVALID')
  }
  const [dup] = await db
    .select({ id: finFixedAsset.id })
    .from(finFixedAsset)
    .where(
      and(
        eq(finFixedAsset.ledgerId, ledgerId),
        eq(finFixedAsset.code, input.code),
        isNull(finFixedAsset.deletedAt),
      ),
    )
  if (dup) throw new AppError(`资产编号 ${input.code} 已存在`, 409, 'FIN_ASSET_CODE_EXISTS')
  const [row] = await db
    .insert(finFixedAsset)
    .values({
      ledgerId,
      code: input.code,
      name: input.name,
      category: input.category ?? 'other',
      originalCost: fromCents(costCents),
      startPeriod: input.startPeriod,
      usefulMonths: input.usefulMonths,
      salvageRate: salvage.toFixed(4),
      expenseAccountCode: input.expenseAccountCode ?? '5502',
      depreciationAccountCode: '1602',
      disposalPeriod: input.disposalPeriod ?? null,
      note: input.note ?? null,
    })
    .returning()
  return row!
}

export async function listAssets(ledgerId: string, status?: 'active' | 'disposed') {
  const conds = [eq(finFixedAsset.ledgerId, ledgerId), isNull(finFixedAsset.deletedAt)]
  if (status) conds.push(eq(finFixedAsset.status, status))
  return db
    .select()
    .from(finFixedAsset)
    .where(and(...conds))
    .orderBy(asc(finFixedAsset.code))
}

export async function getAsset(assetId: string) {
  const [asset] = await db
    .select()
    .from(finFixedAsset)
    .where(and(eq(finFixedAsset.id, assetId), isNull(finFixedAsset.deletedAt)))
  if (!asset) throw new AppError('资产不存在或已删除', 404, 'FIN_ASSET_NOT_FOUND')
  return asset
}

/** 截至某期间的累计折旧(分)。处置期后冻结。 */
export function accumulatedCentsAt(
  asset: Pick<
    FinFixedAsset,
    'originalCost' | 'salvageRate' | 'usefulMonths' | 'startPeriod' | 'disposalPeriod' | 'status'
  >,
  throughPeriod: string,
): number {
  const cost = toCents(asset.originalCost)
  const salvage = Number(asset.salvageRate)
  const months = asset.usefulMonths
  let seq = monthsBetween(asset.startPeriod, throughPeriod) + 1
  if (asset.status === 'disposed' && asset.disposalPeriod) {
    const cutoff = monthsBetween(asset.startPeriod, asset.disposalPeriod)
    seq = Math.min(seq, cutoff)
  }
  seq = Math.min(Math.max(seq, 0), months)
  let acc = 0
  for (let i = 1; i <= seq; i++) acc += straightLinePeriodCents(cost, salvage, months, i)
  return acc
}

export async function updateAsset(assetId: string, patch: Partial<DepreciationInput>) {
  const asset = await getAsset(assetId)
  const set: Partial<FinFixedAsset> = { updatedAt: new Date() }
  if (patch.name !== undefined) set.name = patch.name
  if (patch.category !== undefined) set.category = patch.category
  if (patch.note !== undefined) set.note = patch.note
  if (patch.expenseAccountCode !== undefined) set.expenseAccountCode = patch.expenseAccountCode
  if (patch.originalCost !== undefined) {
    if (accumulatedCentsAt(asset, asset.startPeriod) > 0) {
      throw new AppError('已计提折旧的资产不能改原值(先红冲折旧凭证或停用新建)', 409, 'FIN_ASSET_COST_LOCKED')
    }
    set.originalCost = fromCents(toCents(patch.originalCost))
  }
  if (patch.startPeriod !== undefined) {
    assertPeriod(patch.startPeriod, 'startPeriod')
    set.startPeriod = patch.startPeriod
  }
  if (patch.usefulMonths !== undefined) {
    if (!Number.isInteger(patch.usefulMonths) || patch.usefulMonths < 1 || patch.usefulMonths > 600) {
      throw new AppError('usefulMonths 必须是 1~600 的整数', 400, 'FIN_ASSET_USEFUL_INVALID')
    }
    set.usefulMonths = patch.usefulMonths
  }
  const [row] = await db.update(finFixedAsset).set(set).where(eq(finFixedAsset.id, assetId)).returning()
  return row!
}

export async function disposeAsset(assetId: string, disposalPeriod: string) {
  assertPeriod(disposalPeriod, 'disposalPeriod')
  const asset = await getAsset(assetId)
  if (asset.status === 'disposed') return { ...asset, idempotent: true }
  const [row] = await db
    .update(finFixedAsset)
    .set({ status: 'disposed', disposalPeriod, updatedAt: new Date() })
    .where(eq(finFixedAsset.id, assetId))
    .returning()
  return { ...row!, idempotent: false }
}

export interface DepreciationPreviewItem {
  assetId: string
  code: string
  name: string
  seq: number
  amount: string
  expenseAccountCode: string
}

/** 当期应提明细(不落库,管理端/AI 先看后提)。 */
export async function previewPeriodDepreciation(ledgerId: string, period: string) {
  assertPeriod(period, 'period')
  const assets = await listAssets(ledgerId, 'active')
  const items: DepreciationPreviewItem[] = []
  const skipped: string[] = []
  for (const a of assets) {
    const seq = depreciationSequence(a, period)
    if (seq === null || seq > a.usefulMonths) {
      skipped.push(`${a.code}(不在计提区间)`)
      continue
    }
    const cents = straightLinePeriodCents(toCents(a.originalCost), Number(a.salvageRate), a.usefulMonths, seq)
    if (cents <= 0) {
      skipped.push(`${a.code}(应计总额为 0)`)
      continue
    }
    items.push({
      assetId: a.id,
      code: a.code,
      name: a.name,
      seq,
      amount: fromCents(cents),
      expenseAccountCode: a.expenseAccountCode,
    })
  }
  const totalCents = items.reduce((s, i) => s + toCents(i.amount), 0)
  return { ledgerId, period, items, total: fromCents(totalCents), skipped }
}

/**
 * 计提当期折旧并生成一张汇总凭证(post=true)。幂等:同账套同期已有资产折旧凭证
 * (sourceRef 命中)⇒ 不再产出,返回既有凭证号。
 */
export async function postPeriodDepreciation(
  ledgerId: string,
  period: string,
  userId?: string | null,
) {
  const preview = await previewPeriodDepreciation(ledgerId, period)
  const sourceRef = `asset-dep:${ledgerId}:${period}`
  const [existing] = await db
    .select({ id: finVoucher.id, voucherNo: finVoucher.voucherNo })
    .from(finVoucher)
    .where(and(eq(finVoucher.sourceRef, sourceRef), isNull(finVoucher.deletedAt)))
  if (existing) {
    return { voucherId: existing.id, voucherNo: existing.voucherNo, idempotent: true, preview }
  }
  if (preview.items.length === 0 || toCents(preview.total) === 0) {
    return { voucherId: null, voucherNo: null, idempotent: false, preview, skipped: true }
  }
  // 费用借方按科目聚合,贷方 1602 一行,借贷严格等值(分口径)
  const byExpense = new Map<string, number>()
  let creditCents = 0
  for (const it of preview.items) {
    byExpense.set(it.expenseAccountCode, (byExpense.get(it.expenseAccountCode) ?? 0) + toCents(it.amount))
    creditCents += toCents(it.amount)
  }
  const lines = [
    ...[...byExpense.entries()].map(([code, cents]) => ({
      accountCode: code,
      direction: 'debit' as const,
      amount: fromCents(cents),
      summary: `固定资产折旧 ${period}(贷 累计折旧)`,
    })),
    {
      accountCode: '1602',
      direction: 'credit' as const,
      amount: fromCents(creditCents),
      summary: `固定资产折旧 ${period}`,
    },
  ]
  const voucher = await createVoucher(
    ledgerId,
    {
      period,
      voucherDate: lastDayOf(period),
      summary: `计提 ${period} 固定资产折旧(${preview.items.length} 项)`,
      source: 'asset-dep',
      sourceRef,
      post: true,
      lines,
    },
    userId,
  )
  return { voucherId: voucher.id, voucherNo: voucher.voucherNo, idempotent: false, preview }
}

/** 台账概览(多客户批量总览消费):按状态回数,不做判断。 */
export async function assetSummary(ledgerId: string, currentPeriod: string) {
  const rows = await db
    .select({
      status: finFixedAsset.status,
      count: sql<number>`count(*)::int`,
      cost: sql<string>`coalesce(sum("original_cost"), 0)::text`,
    })
    .from(finFixedAsset)
    .where(and(eq(finFixedAsset.ledgerId, ledgerId), isNull(finFixedAsset.deletedAt)))
    .groupBy(finFixedAsset.status)
  return { ledgerId, period: currentPeriod, byStatus: rows }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
