// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 税务域服务:税种核定 + 申报日历。
 *
 * 目的(对 2026-11-23 前现状的修正):
 *   过去"什么时候必须报什么"只活在人脑和钉钉群里,系统既不生成任务也没有到期提醒,
 *   于是"AI 自动报税"缺了最前面的"知道今天该报什么"。本文件把它变成台账:
 *     税种核定(客户级) → 按周期生成申报任务(防漏) → 截止日/逾期可查 → 状态可追。
 *
 * 口径:
 *   monthly   period=YYYY-MM,截止日=次月 due_day
 *   quarterly period=YYYY-Qn,截止日=季后次月 due_day
 *   annual    period=YYYY,截止日=次年 1 月 due_day
 *   due_day 超过当月天数时回退月末(与 rrule BYMONTHDAY 的月末语义一致)。
 *
 * 不做节假日顺延:中国申报期遇法定节假日会顺延,但顺延规则每年由税务总局公告,
 * 没有权威数据源就不能"猜"。到期待办到点由人确认改期(updateFilingTask 可改 dueDate)。
 */

import { and, asc, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm'

import { db } from '../../db/index.js'
import { AppError } from '../../errors/AppError.js'
import { finClient, finFilingTask, finLedger, finTaxProfile } from '@ihui/database'
import { FILING_CYCLES, dueDateOf, periodsBetween, type FilingCycle } from './tax-period.js'
import { getClient } from './ledger-service.js'
import { fromCents, toCents } from './money.js'

export { dueDateOf, periodsBetween } from './tax-period.js'

export type TaxType =
  | 'VAT'
  | 'CIT'
  | 'IIT'
  | 'SURTAX'
  | 'STAMP'
  | 'CONSUMPTION'
  | 'PROPERTY'
  | 'LAND_USE'
  | 'VEHICLE_VESSEL'
  | 'CULTURE'
  | 'OTHER'
export type FilingStatus = 'pending' | 'computed' | 'drafted' | 'submitted' | 'accepted' | 'failed'

const TAX_TYPES: TaxType[] = [
  'VAT',
  'CIT',
  'IIT',
  'SURTAX',
  'STAMP',
  'CONSUMPTION',
  'PROPERTY',
  'LAND_USE',
  'VEHICLE_VESSEL',
  'CULTURE',
  'OTHER',
]
const CYCLES: FilingCycle[] = FILING_CYCLES
const STATUSES: FilingStatus[] = [
  'pending',
  'computed',
  'drafted',
  'submitted',
  'accepted',
  'failed',
]

export interface TaxProfileInput {
  taxType: TaxType
  taxpayerType?: 'general' | 'small' | undefined
  collectionMethod?: 'audit' | 'deemed' | undefined
  filingCycle?: FilingCycle | undefined
  /** 期间结束后第几个月申报(默认 1=次月;CIT 年度汇算用 5=次年 5 月) */
  dueMonthOffset?: number | undefined
  dueDay?: number | undefined
  rate?: string | number | undefined
  deemedRate?: string | number | null | undefined
  effectiveFrom?: string | undefined
  effectiveTo?: string | undefined
  remark?: string | undefined
}

/** 同一税种新建核定时自动停用旧的 active(保留历史),而不是报"已存在"让人去删。 */
export async function upsertTaxProfile(clientId: string, input: TaxProfileInput) {
  await getClient(clientId)
  if (!TAX_TYPES.includes(input.taxType))
    throw new AppError('taxType 非法', 400, 'FIN_TAX_TYPE_INVALID')
  const cycle = input.filingCycle ?? 'monthly'
  if (!CYCLES.includes(cycle))
    throw new AppError('filingCycle 必须是 monthly/quarterly/annual', 400, 'FIN_TAX_CYCLE_INVALID')
  const dueDay = input.dueDay ?? 15
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
    throw new AppError(
      'dueDay 必须是 1~31 的整数(超过当月天数的会回退月末)',
      400,
      'FIN_TAX_DUE_DAY_INVALID',
    )
  }
  const dueMonthOffset = input.dueMonthOffset ?? 1
  if (!Number.isInteger(dueMonthOffset) || dueMonthOffset < 1 || dueMonthOffset > 6) {
    throw new AppError('dueMonthOffset 必须是 1~6 的整数', 400, 'FIN_TAX_DUE_OFFSET_INVALID')
  }
  const rate = Number(input.rate ?? 0)
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
    throw new AppError('rate 必须是 0~1 之间的小数', 400, 'FIN_TAX_RATE_INVALID')
  }
  const deemed = input.deemedRate === undefined ? null : Number(input.deemedRate)
  if (deemed !== null && (!Number.isFinite(deemed) || deemed < 0 || deemed > 1)) {
    throw new AppError('deemedRate 必须是 0~1 之间的小数', 400, 'FIN_TAX_DEEMED_RATE_INVALID')
  }
  const method = input.collectionMethod ?? 'audit'
  if (method !== 'audit' && method !== 'deemed') {
    throw new AppError('collectionMethod 必须是 audit/deemed', 400, 'FIN_TAX_METHOD_INVALID')
  }
  if (input.taxpayerType && !['general', 'small'].includes(input.taxpayerType)) {
    throw new AppError('taxpayerType 必须是 general/small', 400, 'FIN_TAX_TAXPAYER_INVALID')
  }

  return db.transaction(async (tx) => {
    const replaced = await tx
      .update(finTaxProfile)
      .set({ status: 'inactive', updatedAt: new Date() })
      .where(
        and(
          eq(finTaxProfile.clientId, clientId),
          eq(finTaxProfile.taxType, input.taxType),
          eq(finTaxProfile.status, 'active'),
          isNull(finTaxProfile.deletedAt),
        ),
      )
      .returning({ id: finTaxProfile.id })
    const [row] = await tx
      .insert(finTaxProfile)
      .values({
        clientId,
        taxType: input.taxType,
        taxpayerType: input.taxpayerType ?? null,
        collectionMethod: method,
        filingCycle: cycle,
        dueMonthOffset,
        dueDay,
        rate: rate.toFixed(4),
        deemedRate: deemed === null ? null : deemed.toFixed(4),
        effectiveFrom: input.effectiveFrom ?? null,
        effectiveTo: input.effectiveTo ?? null,
        remark: input.remark?.trim() || null,
      })
      .returning()
    return { profile: row!, replacedActive: replaced.length > 0 }
  })
}

export async function listTaxProfiles(clientId: string) {
  await getClient(clientId)
  return db
    .select()
    .from(finTaxProfile)
    .where(and(eq(finTaxProfile.clientId, clientId), isNull(finTaxProfile.deletedAt)))
    .orderBy(asc(finTaxProfile.taxType), desc(finTaxProfile.createdAt))
}

export async function updateTaxProfile(
  id: string,
  patch: Partial<
    Pick<
      TaxProfileInput,
      'filingCycle' | 'dueMonthOffset' | 'dueDay' | 'rate' | 'deemedRate' | 'remark'
    >
  > & {
    status?: 'active' | 'inactive'
  },
) {
  const values: Record<string, unknown> = { updatedAt: new Date() }
  if (patch.filingCycle !== undefined) {
    if (!CYCLES.includes(patch.filingCycle))
      throw new AppError('filingCycle 非法', 400, 'FIN_TAX_CYCLE_INVALID')
    values['filingCycle'] = patch.filingCycle
  }
  if (patch.dueMonthOffset !== undefined) {
    if (
      !Number.isInteger(patch.dueMonthOffset) ||
      patch.dueMonthOffset < 1 ||
      patch.dueMonthOffset > 6
    ) {
      throw new AppError('dueMonthOffset 必须是 1~6 的整数', 400, 'FIN_TAX_DUE_OFFSET_INVALID')
    }
    values['dueMonthOffset'] = patch.dueMonthOffset
  }
  if (patch.dueDay !== undefined) {
    if (!Number.isInteger(patch.dueDay) || patch.dueDay < 1 || patch.dueDay > 31) {
      throw new AppError('dueDay 必须是 1~31 的整数', 400, 'FIN_TAX_DUE_DAY_INVALID')
    }
    values['dueDay'] = patch.dueDay
  }
  if (patch.rate !== undefined) values['rate'] = Number(patch.rate).toFixed(4)
  if (patch.deemedRate !== undefined)
    values['deemedRate'] = patch.deemedRate === null ? null : Number(patch.deemedRate).toFixed(4)
  if (patch.remark !== undefined) values['remark'] = patch.remark.trim() || null
  if (patch.status !== undefined) values['status'] = patch.status
  const [row] = await db
    .update(finTaxProfile)
    .set(values)
    .where(eq(finTaxProfile.id, id))
    .returning()
  if (!row) throw new AppError('税种核定不存在', 404, 'FIN_TAX_PROFILE_NOT_FOUND')
  return row
}

export async function deactivateTaxProfile(id: string) {
  const [row] = await db
    .update(finTaxProfile)
    .set({ status: 'inactive', updatedAt: new Date() })
    .where(eq(finTaxProfile.id, id))
    .returning()
  if (!row) throw new AppError('税种核定不存在', 404, 'FIN_TAX_PROFILE_NOT_FOUND')
  return row
}

// 期间展开与截止日推算的唯一实现在 tax-period.ts(纯函数),本文件只做 re-export。

/**
 * 生成/补齐申报日历(幂等)。
 *
 * 对每个 active 核定,把 [fromMonth, toMonth] 覆盖的期间逐格 upsert;
 * 已存在的格子只校 dueDate 漂移(调过 dueDay 的历史格子会更新),不重置状态。
 */
export async function ensureFilingCalendar(
  clientId: string,
  range: { fromMonth: string; toMonth: string },
  options?: { ledgerId?: string },
) {
  await getClient(clientId)
  const profiles = await db
    .select()
    .from(finTaxProfile)
    .where(
      and(
        eq(finTaxProfile.clientId, clientId),
        eq(finTaxProfile.status, 'active'),
        isNull(finTaxProfile.deletedAt),
      ),
    )
  if (profiles.length === 0) {
    return {
      created: 0,
      updated: 0,
      profiles: 0,
      note: '该客户没有生效中的税种核定,未生成任何任务',
    }
  }
  let created = 0
  let updated = 0
  for (const profile of profiles) {
    const periods = periodsBetween(
      profile.filingCycle as FilingCycle,
      range.fromMonth,
      range.toMonth,
    )
    for (const period of periods) {
      const dueDate = dueDateOf(period, profile.dueDay, profile.dueMonthOffset)
      const existing = await db
        .select({ id: finFilingTask.id, dueDate: finFilingTask.dueDate })
        .from(finFilingTask)
        .where(and(eq(finFilingTask.taxProfileId, profile.id), eq(finFilingTask.period, period)))
      if (existing.length > 0) {
        if (existing[0]!.dueDate !== dueDate) {
          await db
            .update(finFilingTask)
            .set({ dueDate, updatedAt: new Date() })
            .where(eq(finFilingTask.id, existing[0]!.id))
          updated += 1
        }
        continue
      }
      await db.insert(finFilingTask).values({
        clientId,
        ledgerId: options?.ledgerId ?? null,
        taxProfileId: profile.id,
        taxType: profile.taxType,
        period,
        dueDate,
        status: 'pending',
      })
      created += 1
    }
  }
  return { created, updated, profiles: profiles.length, note: '' }
}

export async function listFilingTasks(params: {
  clientId?: string
  status?: string
  dueFrom?: string
  dueTo?: string
  includeCompleted?: boolean
  page?: number
  limit?: number
}) {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(200, Math.max(1, params.limit ?? 20))
  const where = [sql`true`]
  if (params.clientId) where.push(eq(finFilingTask.clientId, params.clientId))
  if (params.status) {
    if (!STATUSES.includes(params.status as FilingStatus)) {
      throw new AppError('status 非法', 400, 'FIN_FILING_BAD_STATUS')
    }
    where.push(eq(finFilingTask.status, params.status))
  } else if (!params.includeCompleted) {
    // 只有在"没点名状态"时才默认隐藏已受理;点 status=accepted 时必须真能查到
    where.push(sql`${finFilingTask.status} NOT IN ('accepted')`)
  }
  if (params.dueFrom) where.push(gte(finFilingTask.dueDate, params.dueFrom))
  if (params.dueTo) where.push(lte(finFilingTask.dueDate, params.dueTo))
  const cond = and(...where)
  const [rows, count] = await Promise.all([
    db
      .select()
      .from(finFilingTask)
      .where(cond)
      .orderBy(asc(finFilingTask.dueDate), asc(finFilingTask.taxType))
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(finFilingTask)
      .where(cond),
  ])
  return { list: rows, page, limit, total: count[0]?.n ?? 0 }
}

/** 申报任务状态机:只能沿这条链向前,退回只允许到 pending。accepted 是终态。 */
const TRANSITIONS: Record<FilingStatus, FilingStatus[]> = {
  pending: ['computed', 'drafted', 'failed'],
  computed: ['drafted', 'failed', 'pending'],
  drafted: ['submitted', 'failed', 'pending'],
  submitted: ['accepted', 'failed'],
  accepted: [],
  failed: ['pending'],
}

export async function updateFilingTask(
  id: string,
  patch: {
    status?: FilingStatus
    taxableBase?: string | number | null
    taxAmount?: string | number | null
    paidAmount?: string | number | null
    draftRef?: string | null
    dueDate?: string
    assignee?: string | null
    note?: string | null
    receiptNo?: string | null
    receiptPayload?: Record<string, unknown> | null
  },
) {
  const [task] = await db.select().from(finFilingTask).where(eq(finFilingTask.id, id))
  if (!task) throw new AppError('申报任务不存在', 404, 'FIN_FILING_TASK_NOT_FOUND')
  const values: Record<string, unknown> = { updatedAt: new Date() }
  if (patch.status !== undefined) {
    if (!STATUSES.includes(patch.status))
      throw new AppError('status 非法', 400, 'FIN_FILING_BAD_STATUS')
    const from = task.status as FilingStatus
    if (patch.status !== from && !TRANSITIONS[from].includes(patch.status)) {
      throw new AppError(
        `申报任务不允许从 ${from} 直接改为 ${patch.status}(允许:${TRANSITIONS[from].join('/') || '无,已是终态'})`,
        409,
        'FIN_FILING_TRANSITION_INVALID',
      )
    }
    values['status'] = patch.status
    if (patch.status === 'submitted') values['submittedAt'] = new Date()
    if (patch.status === 'accepted') {
      values['acceptedAt'] = new Date()
      if (!task.submittedAt) values['submittedAt'] = new Date()
    }
  }
  if (patch.taxableBase !== undefined)
    values['taxableBase'] = patch.taxableBase === null ? null : centsString(patch.taxableBase)
  if (patch.taxAmount !== undefined)
    values['taxAmount'] = patch.taxAmount === null ? null : centsString(patch.taxAmount)
  if (patch.paidAmount !== undefined)
    values['paidAmount'] = patch.paidAmount === null ? null : centsString(patch.paidAmount)
  if (patch.draftRef !== undefined) values['draftRef'] = patch.draftRef
  if (patch.dueDate !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(patch.dueDate))
      throw new AppError('dueDate 必须是 YYYY-MM-DD', 400, 'FIN_FILING_BAD_DATE')
    values['dueDate'] = patch.dueDate
  }
  if (patch.assignee !== undefined) {
    if (
      patch.assignee !== null &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(patch.assignee)
    ) {
      throw new AppError('assignee 必须是用户 UUID', 400, 'FIN_FILING_BAD_ASSIGNEE')
    }
    values['assignee'] = patch.assignee
  }
  if (patch.note !== undefined) values['note'] = patch.note
  if (patch.receiptNo !== undefined) values['receiptNo'] = patch.receiptNo
  if (patch.receiptPayload !== undefined) values['receiptPayload'] = patch.receiptPayload
  const [row] = await db
    .update(finFilingTask)
    .set(values)
    .where(eq(finFilingTask.id, id))
    .returning()
  return row!
}

/** 到期看板:逾期 / 今日到期 / 未来 N 天。以服务器本地日期为准(中国无夏令时,Asia/Shanghai 与系统时区一致)。 */
export async function filingDeadlines(params?: {
  clientId?: string
  today?: string
  upcomingDays?: number
}) {
  const today = assertDate(params?.today ?? new Date().toISOString().slice(0, 10), 'today')
  const days = Math.min(60, Math.max(1, params?.upcomingDays ?? 7))
  const horizon = addDays(today, days)
  const where = [sql`${finFilingTask.status} NOT IN ('accepted')`]
  if (params?.clientId) where.push(eq(finFilingTask.clientId, params.clientId))
  const rows = await db
    .select()
    .from(finFilingTask)
    .where(and(...where, lte(finFilingTask.dueDate, horizon)))
    .orderBy(asc(finFilingTask.dueDate))
  return {
    today,
    horizon,
    overdue: rows.filter((r) => r.dueDate < today),
    dueToday: rows.filter((r) => r.dueDate === today),
    upcoming: rows.filter((r) => r.dueDate > today),
  }
}

/** 客户维度看板:核定数/本月应报/待办/逾期/已受理 */
export async function filingSummary(params?: { clientId?: string; today?: string }) {
  const today = assertDate(params?.today ?? new Date().toISOString().slice(0, 10), 'today')
  const where = params?.clientId ? [eq(finFilingTask.clientId, params.clientId)] : [sql`true`]
  const rows = await db
    .select()
    .from(finFilingTask)
    .where(and(...where))
  const currentMonth = today.slice(0, 7)
  return {
    today,
    total: rows.length,
    pending: rows.filter((r) => r.status === 'pending').length,
    computed: rows.filter((r) => r.status === 'computed').length,
    drafted: rows.filter((r) => r.status === 'drafted').length,
    submitted: rows.filter((r) => r.status === 'submitted').length,
    accepted: rows.filter((r) => r.status === 'accepted').length,
    failed: rows.filter((r) => r.status === 'failed').length,
    overdue: rows.filter((r) => r.dueDate < today && r.status !== 'accepted').length,
    dueThisMonth: rows.filter((r) => r.dueDate.slice(0, 7) === currentMonth).length,
    /** 本月应报的税种清单(给人核对"是不是少报了一格") */
    dueThisMonthTypes: Array.from(
      new Set(rows.filter((r) => r.dueDate.slice(0, 7) === currentMonth).map((r) => r.taxType)),
    ).sort(),
  }
}

/** 给客户挂账套(申报任务与账套关联,便于"账 → 税"追溯) */
export async function bindLedger(clientId: string, ledgerId: string) {
  const [ledger] = await db
    .select()
    .from(finLedger)
    .where(and(eq(finLedger.id, ledgerId), isNull(finLedger.deletedAt)))
  if (!ledger) throw new AppError('账套不存在', 404, 'FIN_LEDGER_NOT_FOUND')
  if (ledger.clientId !== clientId)
    throw new AppError('账套不属于该客户', 400, 'FIN_LEDGER_CLIENT_MISMATCH')
  await db
    .update(finFilingTask)
    .set({ ledgerId, updatedAt: new Date() })
    .where(and(eq(finFilingTask.clientId, clientId), isNull(finFilingTask.ledgerId)))
  return { bound: true }
}

/** 客户维度一键铺日历(所有活跃客户 × [from,to]) */
export async function ensureAllClientsCalendar(range: { fromMonth: string; toMonth: string }) {
  const clients = await db
    .select({ id: finClient.id, name: finClient.name })
    .from(finClient)
    .where(and(eq(finClient.status, 'active'), isNull(finClient.deletedAt)))
  let created = 0
  let updated = 0
  const skipped: string[] = []
  for (const c of clients) {
    const r = await ensureFilingCalendar(c.id, range)
    created += r.created
    updated += r.updated
    if (r.profiles === 0) skipped.push(c.name)
  }
  return { clients: clients.length, created, updated, skipped }
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function assertDate(value: string, field: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(`${field} 必须是 YYYY-MM-DD`, 400, 'FIN_FILING_BAD_DATE')
  }
  const d = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    throw new AppError(`${field} 不是合法日期`, 400, 'FIN_FILING_BAD_DATE')
  }
  return value
}

function centsString(value: string | number): string {
  return fromCents(toCents(value, 'amount'))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
