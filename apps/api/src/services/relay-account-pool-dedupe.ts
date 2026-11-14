// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池跨池重复自愈(2026-11-14 立)。
 *
 * 立因(真机事故):同一个上游账号被两次导入后,池里出现两条行(一条运营池、一条个人池)。
 * 轮换式 refreshToken 是一次性票 —— 两条行各自续期会互相消费,先刷的吃掉轮换票,后刷的那条
 * 必然 401 并被摘除,随后每 24h 报一封「号池保活摘除」邮件。2026-11-12 22:19 的一次不带
 * --owner 的批量导入就造了 6 组这样的副本(1 枚 trae 因此假死、5 枚 qoder 双份计额度)。
 *
 * 为什么必须自动:唯一索引只约束「同一归属内」(ops / user 两套部分唯一索引),跨归属这层
 * 结构上本来就允许重复 ⇒ 只能由业务侧收敛。挂在 5 分钟一轮的 sweep 里,不依赖人工发现。
 *
 * 合并语义(不丢任何信息):
 * 1. 幸存行:有个人池行 ⇒ 留个人池行(归属是用户可见资产,删了就找不回);多人各持一行(归属
 *    冲突)或只有运营池行 ⇒ 留「最健康最新」的那行。
 * 2. 凭证:从「最健康 + 票最晚到期」的那行搬到幸存行 —— 已知失效(down)的行永远不会盖掉活行
 *    的票;搬完 cred_version +1、健康状态重置为 unknown 并解摘,下一轮 sweep 用新票重探。
 * 3. shared_to_ops:组内取或 —— 只要有一行曾对所有人开放,合并后仍对所有人开放(可用性不减)。
 * 4. 其余行物理删除(签到侧由 O64 对账收敛器扫差集兜底,本模块只置脏标记)。
 */
import { and, eq, inArray, sql } from 'drizzle-orm'
import { aiRelayAccountPool } from '@ihui/database'
import { db } from '../db/index.js'
import { logger } from '../utils/logger.js'

/** 参与合并判定的行投影(只带决策需要的列) */
export interface DedupeRow {
  id: string
  providerCode: string
  uid: string
  ownerUserId: string | null
  healthStatus: string
  hasRefreshToken: boolean
  tokenExpiresAt: Date | null
  lastRefreshAt: Date | null
  updatedAt: Date
  sharedToOps: boolean
  /** 原查询顺序下标:同一批数据重复跑必得同一结论(稳定排序尾键) */
  order?: number
}

export interface DedupePlan {
  survivorId: string
  dropIds: string[]
  /** 凭证取自哪一行;null ⇒ 幸存行自己的票就是最新的,不搬 */
  credSourceId: string | null
  /** 合并后幸存行的 shared_to_ops(组内取或) */
  sharedToOps: boolean
}

export interface DedupeGroupResult {
  providerCode: string
  /** uid 只回前 4 位:日志与返回值不进完整账号标识 */
  uidHead: string
  survivorId: string
  droppedIds: string[]
  credMoved: boolean
}

export interface DedupeReport {
  /** 扫到的重复组数 */
  groups: number
  /** 实际合并的组数 */
  merged: number
  /** 物理删除的行数 */
  droppedRows: number
  acted: DedupeGroupResult[]
}

const HEALTH_RANK: Record<string, number> = { healthy: 4, degraded: 3, unknown: 2, down: 1 }

function healthRank(s: string): number {
  return HEALTH_RANK[s] ?? 0
}

/** null 时间排最后(取极小值) */
function timeRank(d: Date | null): number {
  return d ? d.getTime() : Number.NEGATIVE_INFINITY
}

/** 越靠前越该活:健康 → 票晚到期 → 最近刷新 → 最近变更 → 查询序稳定 */
function byFreshness(a: DedupeRow, b: DedupeRow): number {
  return (
    healthRank(b.healthStatus) - healthRank(a.healthStatus) ||
    timeRank(b.tokenExpiresAt) - timeRank(a.tokenExpiresAt) ||
    timeRank(b.lastRefreshAt) - timeRank(a.lastRefreshAt) ||
    b.updatedAt.getTime() - a.updatedAt.getTime() ||
    (a.order ?? 0) - (b.order ?? 0)
  )
}

/**
 * 逐组决策(纯函数,零 IO —— 单测直接钉判据)。
 */
export function planDedupeGroup(rows: DedupeRow[]): DedupePlan | null {
  if (rows.length < 2) return null
  const owned = rows.filter((r) => r.ownerUserId !== null)
  // 有且只有一个用户持有时,归属优先;否则(纯运营池 / 多人冲突)按新鲜度选
  const survivorPool = owned.length >= 1 ? owned : rows
  const survivor = [...survivorPool].sort(byFreshness)[0]
  if (!survivor) return null
  // 凭证源在全组里挑:健康优先,其次「有 refreshToken」,再按票面新鲜度
  const credSource = [...rows].sort(
    (a, b) =>
      healthRank(b.healthStatus) - healthRank(a.healthStatus) ||
      Number(b.hasRefreshToken) - Number(a.hasRefreshToken) ||
      byFreshness(a, b),
  )[0]
  return {
    survivorId: survivor.id,
    dropIds: rows.filter((r) => r.id !== survivor.id).map((r) => r.id),
    credSourceId: credSource && credSource.id !== survivor.id ? credSource.id : null,
    sharedToOps: rows.some((r) => r.sharedToOps),
  }
}

/** 扫全池,把每组跨池重复收敛成一行。零重复 ⇒ 只付一次 GROUP BY 的钱。 */
export async function dedupeCrossPoolDuplicates(
  options: { dryRun?: boolean } = {},
): Promise<DedupeReport> {
  const dupGroups = await db
    .select({
      providerCode: aiRelayAccountPool.providerCode,
      uid: aiRelayAccountPool.uid,
    })
    .from(aiRelayAccountPool)
    .groupBy(aiRelayAccountPool.providerCode, aiRelayAccountPool.uid)
    .having(sql`count(*) > 1`)

  const report: DedupeReport = { groups: dupGroups.length, merged: 0, droppedRows: 0, acted: [] }
  if (dupGroups.length === 0) return report

  for (const g of dupGroups) {
    const rows = await db
      .select({
        id: aiRelayAccountPool.id,
        providerCode: aiRelayAccountPool.providerCode,
        uid: aiRelayAccountPool.uid,
        ownerUserId: aiRelayAccountPool.ownerUserId,
        healthStatus: aiRelayAccountPool.healthStatus,
        hasRefreshToken: sql<boolean>`${aiRelayAccountPool.refreshTokenEnc} is not null`,
        tokenExpiresAt: aiRelayAccountPool.tokenExpiresAt,
        lastRefreshAt: aiRelayAccountPool.lastRefreshAt,
        updatedAt: aiRelayAccountPool.updatedAt,
        sharedToOps: aiRelayAccountPool.sharedToOps,
      })
      .from(aiRelayAccountPool)
      .where(
        and(eq(aiRelayAccountPool.providerCode, g.providerCode), eq(aiRelayAccountPool.uid, g.uid)),
      )
    const plan = planDedupeGroup(rows.map((r, i) => ({ ...r, order: i })))
    if (!plan) continue
    if (options.dryRun) {
      report.acted.push({
        providerCode: g.providerCode,
        uidHead: g.uid.slice(0, 4),
        survivorId: plan.survivorId,
        droppedIds: plan.dropIds,
        credMoved: plan.credSourceId !== null,
      })
      continue
    }

    const now = new Date()
    const outcome = await db.transaction(async (tx): Promise<number | null> => {
      if (plan.credSourceId) {
        const [src] = await tx
          .select({
            tokenEnc: aiRelayAccountPool.tokenEnc,
            refreshTokenEnc: aiRelayAccountPool.refreshTokenEnc,
            cookiesEnc: aiRelayAccountPool.cookiesEnc,
            secretsEnc: aiRelayAccountPool.secretsEnc,
            deviceId: aiRelayAccountPool.deviceId,
            machineId: aiRelayAccountPool.machineId,
            tokenExpiresAt: aiRelayAccountPool.tokenExpiresAt,
            refreshExpiresAt: aiRelayAccountPool.refreshExpiresAt,
          })
          .from(aiRelayAccountPool)
          .where(eq(aiRelayAccountPool.id, plan.credSourceId))
          .limit(1)
        // 源行在决策与落库之间被删 ⇒ 本组本轮放弃(返回 null 表示未合并),下一轮重算
        if (!src) {
          logger.warn('[relay-account-pool] 合并源行已消失,本组本轮跳过', {
            providerCode: g.providerCode,
            uidHead: g.uid.slice(0, 4),
          })
          return null
        }
        await tx
          .update(aiRelayAccountPool)
          .set({
            ...src,
            sharedToOps: plan.sharedToOps,
            // 换了凭证 ⇒ 上一轮失败读数失效:重置 health 待重探、解摘,让下一轮真正用这张票
            healthStatus: 'unknown',
            healthCheckedAt: null,
            tempUnschedulable: false,
            refreshFailureCount: 0,
            consecutiveFailures: 0,
            lastErrorMessage: null,
            credVersion: sql`${aiRelayAccountPool.credVersion} + 1`,
            updatedAt: now,
          })
          .where(eq(aiRelayAccountPool.id, plan.survivorId))
      } else if (plan.sharedToOps && !rows.some((r) => r.id === plan.survivorId && r.sharedToOps)) {
        // 只写真实变化:幸存行本来就是共享态就不发 UPDATE(增量读不被同值空写污染)
        await tx
          .update(aiRelayAccountPool)
          .set({ sharedToOps: true, updatedAt: now })
          .where(eq(aiRelayAccountPool.id, plan.survivorId))
      }
      const dropped = await tx
        .delete(aiRelayAccountPool)
        .where(inArray(aiRelayAccountPool.id, plan.dropIds))
        .returning({ id: aiRelayAccountPool.id })
      return dropped.length
    })
    if (outcome === null) continue
    report.droppedRows += outcome
    report.merged++
    report.acted.push({
      providerCode: g.providerCode,
      uidHead: g.uid.slice(0, 4),
      survivorId: plan.survivorId,
      droppedIds: plan.dropIds,
      credMoved: plan.credSourceId !== null,
    })
    logger.warn('[relay-account-pool] 跨池重复已自动合并(同一上游账号只保留一条续期链)', {
      providerCode: g.providerCode,
      uidHead: g.uid.slice(0, 4),
      survivorId: plan.survivorId,
      dropped: plan.dropIds.length,
      credMoved: plan.credSourceId !== null,
    })
  }
  return report
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
