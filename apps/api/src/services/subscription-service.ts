/**
 * 连续包月定时扣款服务。
 * 由 scheduler-worker 每日调用,扫描到期签约并触发委托代扣扣款。
 *
 * 业务流程:
 * 1. 查询 status='active' AND next_charge_time <= now 的签约记录
 * 2. 对每条调 deductRecurring 受理扣款(同步只返回受理结果,扣款状态通过 webhook 异步通知)
 * 3. 单条失败不影响其他,记录到 errors
 * 4. 若签约处于试用期(trialEndAt <= now),自动延长一个计费周期(7/30/365 天)避免
 *    trial 边界当天扣款 + 试用到期双重扣款
 *
 * 并发控制:使用 worker pool 模式,默认并发 3(可由环境变量 SUBSCRIPTION_CHARGE_CONCURRENCY 调整),
 * 避免对微信支付 API 触发限流,同时最大化吞吐量。
 */

import { eq, and, or, ne, isNull, isNotNull, lt, lte } from 'drizzle-orm'
import { env } from 'node:process'
import { db } from '../db/index.js'
import { wechatPayContracts, plans } from '@ihui/database'
import {
  deductRecurring,
  generateOutTradeNo,
  type DeductSettleMode,
  type DeductRecurringResult,
} from './wechat-pay.js'

/** 并发上限:微信支付 V3 委托扣款限流约 30 QPS,单租户 3 并发足以饱和带宽,过高易触发 429 */
const DEFAULT_CONCURRENCY = 3
const MAX_CONCURRENCY = 10

/**
 * P1 修复(2026-08-06):扣款受理后 pending 状态视为"在途",此窗口内禁止再次发起扣款,
 * 防止 webhook 失败/丢失时定时扫描重试造成同一周期重复扣款。超时后允许重新发起。
 */
const PENDING_CHARGE_TIMEOUT_MS = 60 * 60 * 1000 // 1 小时

export interface ScanAndChargeResult {
  scanned: number
  charged: number
  failed: number
  skipped: number
  /** 试用期自动续期的签约数 */
  trialExtended: number
  errors: string[]
}

export interface ChargeOptions {
  /** 默认 'async'(批量扫扣);'wait' 模式会同步轮询终态,仅单签约场景使用 */
  deductMode?: DeductSettleMode
  /** 并发上限(1-10),默认 3;批量场景建议 2-3,降低 WX 限流风险 */
  concurrency?: number
}

/**
 * 扫描到期签约并触发委托扣款(批量模式,默认 'async' settle mode)。
 */
export async function scanAndChargeDueContracts(
  opts: ChargeOptions = {},
): Promise<ScanAndChargeResult> {
  const errors: string[] = []
  let charged = 0
  let failed = 0
  let skipped = 0
  let trialExtended = 0

  const now = new Date()
  const dueContracts = await db
    .select()
    .from(wechatPayContracts)
    .where(
      and(
        eq(wechatPayContracts.status, 'active'),
        isNotNull(wechatPayContracts.nextChargeTime),
        lte(wechatPayContracts.nextChargeTime, now),
      ),
    )

  const scanned = dueContracts.length
  if (scanned === 0) {
    return { scanned: 0, charged: 0, failed: 0, skipped: 0, trialExtended: 0, errors: [] }
  }

  const notifyUrl = env.WX_PAY_RECURRING_NOTIFY_URL ?? env.WX_PAY_NOTIFY_URL ?? ''
  const appid = env.WX_MINI_APPID ?? env.WX_APP_APPID ?? ''
  const deductMode: DeductSettleMode = opts.deductMode ?? 'async'
  const concurrency = clampConcurrency(opts.concurrency)

  // worker pool 并发控制:N 个 worker 共享 cursor 抢占式消费
  const results = await runWithConcurrency(dueContracts, concurrency, async (contract) =>
    chargeOne(contract, { appid, notifyUrl, now, deductMode }),
  )

  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    if (!r) continue
    if (r.status === 'fulfilled') {
      const v = r.value
      if (v.outcome === 'charged') charged++
      else if (v.outcome === 'skipped') skipped++
      else if (v.outcome === 'trial-extended') trialExtended++
    } else {
      failed++
      const reason = r.reason instanceof Error ? r.reason.message : String(r.reason)
      const contract = dueContracts[i]
      errors.push(
        `Failed to charge contract ${contract?.id ?? '?'} (${contract?.contractId ?? '?'}): ${reason}`,
      )
    }
  }

  return { scanned, charged, failed, skipped, trialExtended, errors }
}

interface ChargeOneResult {
  outcome: 'charged' | 'skipped' | 'trial-extended'
}

interface ChargeOneContext {
  appid: string
  notifyUrl: string
  now: Date
  deductMode: DeductSettleMode
}

async function chargeOne(
  contract: typeof wechatPayContracts.$inferSelect,
  ctx: ChargeOneContext,
): Promise<ChargeOneResult> {
  // 试用期自动续期:若 trialEndAt 已过(签约仍 active),延后 nextChargeTime 一个计费周期,
  // 避免 trial 边界当天被扫扣 + 试用到期双重扣款/误判。
  if (contract.trialEndAt && contract.trialEndAt <= ctx.now) {
    const billingPeriod = await getPlanBillingPeriodSafe(contract.planId)
    const extended = calculateNextChargeTimeFrom(billingPeriod, contract.trialEndAt)
    await db
      .update(wechatPayContracts)
      .set({
        nextChargeTime: extended,
        trialEndAt: null,
        updatedAt: ctx.now,
      })
      .where(eq(wechatPayContracts.id, contract.id))
    return { outcome: 'trial-extended' }
  }

  // P1 修复(2026-08-06):上一轮扣款已受理(pending)且未超时 → 跳过,防 webhook 失败后重复扣款。
  // 扣款受理成功但 webhook 因网络/DB 异常未落地时,lastChargeStatus 停在 pending,
  // 定时扫描若重新发起会生成新 outTradeNo 造成同周期重复扣款,此检查从源头拦截。
  if (
    contract.lastChargeStatus === 'pending' &&
    contract.lastChargeTime &&
    ctx.now.getTime() - contract.lastChargeTime.getTime() < PENDING_CHARGE_TIMEOUT_MS
  ) {
    return { outcome: 'skipped' }
  }

  let amount = 0
  let description = '连续包月自动扣款'
  if (contract.planId) {
    const plan = await getPlanSafe(contract.planId)
    if (plan) {
      amount = plan.price
      description = `连续包月自动扣款 - ${plan.name}`
    }
  }
  if (amount <= 0) return { outcome: 'skipped' }
  if (!contract.contractId) return { outcome: 'skipped' }

  const outTradeNo = generateOutTradeNo('RC')

  // P1 修复(2026-08-06):发起扣款前先条件 UPDATE 占位(lastChargeStatus='pending'),
  // 0 行影响 = 并发 worker/重试已占用本周期扣款 → 跳过,保证同一签约同一周期只发起一次扣款。
  // 占位在 deductRecurring 之前完成:即便请求超时抛错,状态也保持 pending,
  // 等 webhook 回写终态或超时后重试,杜绝"已受理但响应丢失"导致的重复扣款。
  const claimed = await db
    .update(wechatPayContracts)
    .set({
      lastChargeStatus: 'pending',
      lastChargeTime: ctx.now,
      outTradeNo,
      updatedAt: ctx.now,
    })
    .where(
      and(
        eq(wechatPayContracts.id, contract.id),
        or(
          isNull(wechatPayContracts.lastChargeStatus),
          ne(wechatPayContracts.lastChargeStatus, 'pending'),
          lt(
            wechatPayContracts.lastChargeTime,
            new Date(ctx.now.getTime() - PENDING_CHARGE_TIMEOUT_MS),
          ),
        ),
      ),
    )
    .returning({ id: wechatPayContracts.id })
  if (claimed.length === 0) return { outcome: 'skipped' }

  await deductRecurring({
    appid: ctx.appid,
    contractId: contract.contractId,
    outTradeNo,
    amount,
    description,
    transactionNotifyUrl: ctx.notifyUrl,
    settleMode: ctx.deductMode,
  })
  // deductRecurring 受理成功或抛错,lastChargeStatus 均保持 pending:
  // 成功等 webhook 更新终态,失败防下次扫描重复扣款(超时后自动重试)。

  return { outcome: 'charged' }
}

/**
 * 单签约即时扣款(用于"用户主动触发扣款"场景)。
 * 与批量扫扣不同,此函数只处理一条签约,settleMode 强制 'wait' 同步等终态,
 * 适合前端按钮点击后即时反馈。
 */
export async function chargeOneContractNow(
  contractId: number,
  userId: string,
): Promise<DeductRecurringResult & { contractId: number }> {
  const [contract] = await db
    .select()
    .from(wechatPayContracts)
    .where(
      and(
        eq(wechatPayContracts.id, contractId),
        eq(wechatPayContracts.userId, userId),
        eq(wechatPayContracts.status, 'active'),
      ),
    )
    .limit(1)
  if (!contract) throw new Error('签约不存在或未激活')
  if (!contract.contractId) throw new Error('签约缺少微信侧 contractId')

  // P1 修复(2026-08-06):上一笔扣款仍在受理(pending)且未超时 → 拒绝重复发起,
  // 防止用户连续点击/前端重试造成同一周期重复扣款。
  if (
    contract.lastChargeStatus === 'pending' &&
    contract.lastChargeTime &&
    Date.now() - contract.lastChargeTime.getTime() < PENDING_CHARGE_TIMEOUT_MS
  ) {
    throw new Error('上一笔扣款仍在处理中,请稍后重试')
  }

  const plan = contract.planId ? await getPlanSafe(contract.planId) : null
  const amount = plan?.price ?? 0
  if (amount <= 0) throw new Error('签约方案价格异常')

  const outTradeNo = generateOutTradeNo('IM')
  const notifyUrl = env.WX_PAY_RECURRING_NOTIFY_URL ?? env.WX_PAY_NOTIFY_URL ?? ''
  const appid = env.WX_MINI_APPID ?? env.WX_APP_APPID ?? ''

  const result = await deductRecurring({
    appid,
    contractId: contract.contractId,
    outTradeNo,
    amount,
    description: `即时扣款 - ${plan?.name ?? 'VIP'}`,
    transactionNotifyUrl: notifyUrl,
    settleMode: 'wait',
  })

  const now = new Date()
  await db
    .update(wechatPayContracts)
    .set({
      lastChargeTime: now,
      lastChargeStatus: result.tradeState === 'SUCCESS' ? 'success' : 'pending',
      outTradeNo: result.outTradeNo,
      updatedAt: now,
    })
    .where(eq(wechatPayContracts.id, contractId))

  return { ...result, contractId }
}

// =============================================================================
// 内部工具函数
// =============================================================================

function clampConcurrency(input: number | undefined): number {
  const raw = input ?? DEFAULT_CONCURRENCY
  return Math.min(MAX_CONCURRENCY, Math.max(1, raw))
}

/**
 * worker pool:对 items 数组以最大 concurrency 并发执行 worker,
 * 返回与 items 等长的 PromiseSettledResult 数组(顺序对齐)。
 * 单一签约失败不中断其他任务,所有错误收集到 reason 字段。
 */
async function runWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length)
  let cursor = 0

  async function runOne(): Promise<void> {
    while (true) {
      const idx = cursor++
      if (idx >= items.length) return
      const item = items[idx] as T
      try {
        const value = await worker(item)
        results[idx] = { status: 'fulfilled', value }
      } catch (reason) {
        results[idx] = { status: 'rejected', reason }
      }
    }
  }

  const workerCount = Math.min(concurrency, items.length)
  const workers: Promise<void>[] = []
  for (let i = 0; i < workerCount; i++) workers.push(runOne())
  await Promise.all(workers)
  return results
}

/** 从 plan.billingPeriod 推断下次扣款时间(在给定基准时间上累加) */
function calculateNextChargeTimeFrom(billingPeriod: string | null | undefined, base: Date): Date {
  const next = new Date(base)
  switch (billingPeriod) {
    case 'year':
      next.setFullYear(next.getFullYear() + 1)
      break
    case 'week':
      next.setDate(next.getDate() + 7)
      break
    case 'month':
    default:
      next.setMonth(next.getMonth() + 1)
  }
  return next
}

async function getPlanBillingPeriodSafe(planId: string | null): Promise<string | null> {
  if (!planId) return null
  const plan = await getPlanSafe(planId)
  return plan?.billingPeriod ?? null
}

async function getPlanSafe(planId: string): Promise<{
  price: number
  name: string
  billingPeriod: string | null
} | null> {
  const [plan] = await db
    .select({
      price: plans.price,
      name: plans.name,
      billingPeriod: plans.billingPeriod,
    })
    .from(plans)
    .where(and(eq(plans.id, planId), eq(plans.isActive, true)))
    .limit(1)
  if (!plan) return null
  return plan
}
