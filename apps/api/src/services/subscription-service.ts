/**
 * 连续包月定时扣款服务。
 * 由 scheduler-worker 每日调用,扫描到期签约并触发委托代扣扣款。
 *
 * 业务流程:
 * 1. 查询 status='active' AND next_charge_time <= now 的签约记录
 * 2. 对每条调 deductRecurring 受理扣款(同步只返回受理结果,扣款状态通过 webhook 异步通知)
 * 3. 单条失败不影响其他,记录到 errors
 */

import { env } from 'node:process'
import { eq, and, isNotNull, lte } from 'drizzle-orm'
import { db } from '../db/index.js'
import { wechatPayContracts, plans } from '@ihui/database'
import { deductRecurring, generateOutTradeNo } from './wechat-pay.js'

export interface ScanAndChargeResult {
  scanned: number
  charged: number
  failed: number
  skipped: number
  errors: string[]
}

export async function scanAndChargeDueContracts(): Promise<ScanAndChargeResult> {
  const errors: string[] = []
  let charged = 0
  let failed = 0
  let skipped = 0

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
    return { scanned: 0, charged: 0, failed: 0, skipped: 0, errors: [] }
  }

  const notifyUrl = env.WX_PAY_RECURRING_NOTIFY_URL ?? env.WX_PAY_NOTIFY_URL ?? ''
  const appid = env.WX_MINI_APPID ?? env.WX_APP_APPID ?? ''

  for (const contract of dueContracts) {
    try {
      let amount = 0
      let description = '连续包月自动扣款'
      if (contract.planId) {
        const [plan] = await db.select().from(plans).where(eq(plans.id, contract.planId)).limit(1)
        if (plan) {
          amount = plan.price
          description = `连续包月自动扣款 - ${plan.name}`
        }
      }

      if (amount <= 0) {
        skipped++
        continue
      }

      if (!contract.contractId) {
        skipped++
        continue
      }

      const outTradeNo = generateOutTradeNo('RC')
      await deductRecurring({
        appid,
        contractId: contract.contractId,
        outTradeNo,
        amount,
        description,
        transactionNotifyUrl: notifyUrl,
      })

      charged++
      await db
        .update(wechatPayContracts)
        .set({
          lastChargeTime: now,
          lastChargeStatus: 'pending',
          outTradeNo,
          updatedAt: now,
        })
        .where(eq(wechatPayContracts.id, contract.id))
    } catch (err) {
      errors.push(
        `Failed to charge contract ${contract.id} (${contract.contractId}): ${String(err)}`,
      )
      failed++
    }
  }

  return { scanned, charged, failed, skipped, errors }
}
