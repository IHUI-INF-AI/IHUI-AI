// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyInstance } from 'fastify'
import type { Worker } from 'bullmq'
import type { Redis } from 'ioredis'
import { createWorker } from '../plugins/queue.js'
import {
  SCHEDULER_QUEUE_NAME,
  SCHEDULED_JOBS,
  runOutboxDrain,
  type ScheduledJobName,
} from '../plugins/scheduler.js'
import {
  autoCloseExpiredOrders,
  autoReconcileYesterday,
} from '../services/reconciliation-service.js'
import { DistributedLock } from '../utils/distributed-lock.js'
import { aggregateHeatStats } from '../services/heat-stats-service.js'
import { checkDailyAlerts } from '../services/alert-check-service.js'
import { archiveDailyData } from '../services/data-archive-service.js'
import { startExpirationMonitor } from '../services/expiration-monitor-service.js'
import { runFileCleanup } from '../services/cleanup-service.js'
import { cleanupExpiredUploadSessions } from '../services/upload-integrity.js'
import { expireVipMembers } from '../services/vip-expire-service.js'
import { autoCloseExpiredActivities } from '../services/activity-status-service.js'
import { calibrateCommissionSettlement } from '../services/commission-settle-service.js'
import {
  markInactiveAgents,
  cleanupOldHeatStats,
  cleanupOauthSessions,
} from '../services/scheduled-tasks-service.js'
import { pushAlert, pushAlertWithResult } from '../services/alert-notification-service.js'
import { scanAndChargeDueContracts } from '../services/subscription-service.js'
import {
  refreshWorkWechatToken,
  refreshWechatToken,
  refreshDingTalkToken,
} from '../services/token-refresh-service.js'
import {
  collectAllSources,
  processLlmBatch,
  translateTitles,
  computeTrendSignals,
  generateSnapshot,
  drainLlmBacklog,
} from '../services/ai-feed-service.js'
import { checkBudgetAlerts } from '../services/budget-alert-service.js'
import {
  externalDeliveryMissed,
  parseRemindChannels,
  scanAndRemindArrears,
} from '../services/edu-arrear-remind-service.js'
// O5(2026-09-21):llm_call_logs 到期原文清除(只清 prompt/response,计费/归因列保留)
import { purgeAllExpiredLlmCallLogRawText } from '../services/audit-log-service.js'

// ============================================================================
// 不可信外部文本 → 告警正文(AGENTS.md §5e:邮件是运维到人的**唯一**通道)
// ============================================================================
// 为什么必须有一层:本文件里 pushAlert 的 message 会被 alert-notification-service 原样
// 拼进 renderSystemAlertEmail 的正文,而它拼的是**上游资讯源返回的错误原文**
// (ai-feed-service 的 `e.message`,可能含上游响应体/URL/解析器转述)与**文件系统读回来的
// 文件名**。这些都不该未经长度上限约束地进到人收到的邮件里。
// 与本仓 monitoring/alertbridge/alert-webhook-bridge.cjs 同一条纪律:
// 「静默变短」比「变短」更糟 —— 截断必须在正文里点名丢了多少。
//
// 这四把尺子(单行封顶 / 上游原文标签 / 整条字节闸门 / 逐行闸门)住在
// `src/utils/alert-text.ts`,由本 worker 与 `alert-notification-service` 的**共同出口**
// 与 `alert-notification-service` 的共同出口共用同一把尺子,放在生产者各自头上会漏。
import { capAlertMessage, flattenUntrustedText, untrustedErrorField } from '../utils/alert-text.js'

// ============================================================================
// ai-feed-collect 失败告警的「按身份去重」
// ============================================================================
// 立因(实测):采集每 6h 一轮,而坏源不会因为又过了一小时就自己变好,原实现在此
// **无条件** pushAlert ⇒ 同一批 4 个坏源每轮各寄一封内容逐字相同的邮件(48h 内 7 封)。
// 加的是**按身份**的冷却,**不是总量闸** —— AGENTS §5e 明文禁止"每日 N 封"计数闸:
// 自设总量上限等于把"告警静默"再复制一遍,不同告警一律照寄。
//
// 状态住在 Redis(与 watch-aspect 的 dedup 键、DistributedLock 同一个 `server.redis` 出口),
// 不放进程内存:本 worker 由 nssm 服务承载,进程一重启内存里的去重记忆就清零并立刻重发。
// 也不放文件:服务身份(LocalSystem)的 TEMP 是 C:\Windows\Temp 而非已迁走的 HKCU TEMP,
// 任何"写 $env:TEMP"式落点在服务里只是往 C 盘内部挪坑(AGENTS §26)。
// 也不放 notifications 表:budget-alert-service 那套 6h cooldown 复用该表,而它的
// user_id 是 notNull + FK ⇒ 运维告警没有属主可填,那一套在本型上结构上不可复用。

/**
 * 冷却窗口。**必须严格大于采集周期(6h)**:6h 周期配 6h 窗口时两轮间隔恒 ≥ 窗口,
 * 一封也压不住 —— 现象是"去重加了,邮件没少",比不去重更难查。
 * 取 24h:坏源持续未修时人每天仍收到一封"还在坏",新坏源永远即时到人。
 */
export const AI_FEED_ALERT_COOLDOWN_SEC = 24 * 60 * 60

/**
 * 去重身份 = 单个失败源 + 该源本轮的严重度档。
 *
 * 刻意**不取"本轮失败源集合"的哈希**:那样"某个源恢复了"也会换出新身份,而那一封
 * 讲的仍是同样几个仍在坏的源(没有新信息却喊人);且源交替坏/好能让每一轮都是新身份,
 * 去重形同虚设。取单源后:清单里有**至少一个没报过的源**就送,全报过才压住;
 * warning→critical 的升档算新信息(键含 severity,与 budget-alert-service 的
 * "同 user + 同 severity 冷却"是同一判据形态)。
 */
export function aiFeedAlertIdentity(sourceCode: string, severity: string): string {
  return `alert:dedup:ai-feed-collect:${sourceCode.trim().toLowerCase()}:${severity}`
}

/** 一条失败源在本轮严重度档上的去重输入。 */
export interface AiFeedFailingSource {
  sourceCode: string
  severity: string
}

/**
 * 冷却状态存储。`isInCooldown` 返回 `null` 表示**判不出**(存储不可用),
 * 调用方必须按"没报过"处理并照送 —— 宁可重发一封,不可把坏源藏起来。
 */
export interface AlertCooldownStore {
  isInCooldown(identity: string): Promise<boolean | null>
  /** 返回 false = 登记失败(后果只是下一轮重发,不丢告警),调用方须留一行日志。 */
  markReported(identities: readonly string[]): Promise<boolean>
}

/** Redis 缺失 / 未注册 redis 插件时的降级:一律判不出。 */
function resolveAlertCooldownRedis(server: FastifyInstance): Redis | null {
  const client: Redis | undefined = server.redis
  if (!client || typeof client.get !== 'function' || typeof client.set !== 'function') {
    return null
  }
  return client
}

export function createRedisAlertCooldownStore(client: Redis | null): AlertCooldownStore {
  return {
    async isInCooldown(identity) {
      if (!client) return null
      try {
        return (await client.get(identity)) !== null
      } catch {
        return null
      }
    },
    async markReported(identities) {
      if (!client || identities.length === 0) return client !== null
      try {
        await Promise.all(
          identities.map((id) => client.set(id, '1', 'EX', AI_FEED_ALERT_COOLDOWN_SEC)),
        )
        return true
      } catch {
        return false
      }
    },
  }
}

export interface AiFeedAlertDecision {
  /** 本轮是否真的推。 */
  shouldPush: boolean
  /** 推成功后应登记的身份(本轮"没报过"的那些)。 */
  newIdentities: string[]
  /** 被窗口压住的源(抑制必须可见,逐条留日志)。 */
  suppressedSources: string[]
  /** 认不出是哪个源 ⇒ 没有可去重的身份,照送并点名。 */
  undeterminedSources: string[]
  /** 冷却存储判不出 ⇒ 全量照送。 */
  storeUnavailable: boolean
}

/**
 * 纯判据:把"该不该推"与"推谁"从推送与 Redis 里分出来(与 auto-login-policy 把判据
 * 单独成函数同一理由 —— 不拆就只能 mock 整条 BullMQ worker 才能证它)。
 */
export async function decideAiFeedCollectAlert(
  failing: readonly AiFeedFailingSource[],
  store: AlertCooldownStore,
): Promise<AiFeedAlertDecision> {
  const newIdentities: string[] = []
  const suppressedSources: string[] = []
  const undeterminedSources: string[] = []
  let storeUnavailable = false

  for (const entry of failing) {
    const code = entry.sourceCode.trim()
    if (!code) {
      undeterminedSources.push(entry.sourceCode)
      continue
    }
    const identity = aiFeedAlertIdentity(code, entry.severity)
    const inCooldown = await store.isInCooldown(identity)
    if (inCooldown === null) {
      storeUnavailable = true
      continue
    }
    if (inCooldown) {
      suppressedSources.push(code)
      continue
    }
    newIdentities.push(identity)
  }

  // 三条"照送"的通道:存储判不出 / 有认不出身份的源 / 有没报过的源。
  const shouldPush = storeUnavailable || undeterminedSources.length > 0 || newIdentities.length > 0
  return { shouldPush, newIdentities, suppressedSources, undeterminedSources, storeUnavailable }
}

export interface AiFeedAlertLog {
  info(obj: unknown, msg: string): void
  warn(obj: unknown, msg: string): void
}

/**
 * 决策 + 报送 + 登记。**只在确认送达后**登记冷却:先登记后推送的话,一次 SMTP 失败
 * 就把这封告警静默 24h,那正是 §5e 要防的"告警静默"。
 */
export async function maybePushAiFeedCollectAlert(deps: {
  failing: readonly AiFeedFailingSource[]
  store: AlertCooldownStore
  /** true = 至少一条通道确认送达。 */
  push: () => Promise<boolean>
  log: AiFeedAlertLog
}): Promise<AiFeedAlertDecision> {
  const { failing, store, push, log } = deps
  const decision = await decideAiFeedCollectAlert(failing, store)

  if (!decision.shouldPush) {
    // 抑制必须留行:否则读日志的人无从判断"这一轮是判过且压住了"还是"根本没人判"。
    log.info(
      {
        suppressedSources: decision.suppressedSources,
        cooldownSec: AI_FEED_ALERT_COOLDOWN_SEC,
      },
      'ai-feed-collect 告警按身份去重:本轮失败源均已在窗口内报过,不重复推送',
    )
    return decision
  }

  log.info(
    {
      newIdentities: decision.newIdentities.length,
      suppressedSources: decision.suppressedSources,
      undeterminedSources: decision.undeterminedSources,
      storeUnavailable: decision.storeUnavailable,
    },
    'ai-feed-collect 告警按身份去重:存在未报过的失败源,照推',
  )

  const delivered = await push()
  if (!delivered) {
    log.warn(
      { failedSources: failing.map((f) => f.sourceCode) },
      'ai-feed-collect 告警未确认送达,不进入冷却(下一轮照发)',
    )
    return decision
  }
  if (decision.newIdentities.length > 0) {
    const committed = await store.markReported(decision.newIdentities)
    if (!committed) {
      log.warn(
        { newIdentities: decision.newIdentities },
        'ai-feed-collect 告警冷却身份登记失败,下一轮会重发这些源',
      )
    }
  }
  return decision
}

/**
 * 启动定时任务 Worker（消费 scheduler 队列的 repeatable jobs）。
 *
 * 多实例部署时，BullMQ 保证每个 delayed job 只被一个 worker 抢占执行，
 * 因此同一时刻同一 cron 任务只在一个实例上运行。
 *
 * 任务分发：
 * - expired-order-cleanup: 调 autoCloseExpiredOrders 关闭超时未支付订单
 * - reconciliation-daily: 调 autoReconcileYesterday 做昨日支付对账
 * - heat-stats-hourly: 调 aggregateHeatStats 聚合 Agent 热度统计
 * - alert-check-daily: 调 checkDailyAlerts 扫描告警噪音与升级
 * - data-archive-daily: 调 archiveDailyData 归档过期历史数据
 * - expiration-monitor: 调 startExpirationMonitor 检测 Agent 过期记录并联动 Canary 回滚
 */
export function startSchedulerWorker(server: FastifyInstance): Worker {
  const worker = createWorker<Record<string, unknown>>(
    server,
    SCHEDULER_QUEUE_NAME,
    async (job) => {
      const name = job.name as ScheduledJobName
      server.log.info({ jobId: job.id, jobName: name }, 'scheduled job started')

      // 启动业务计时器，end() 时自动上报 business_job_duration_seconds
      const timer = server.startBizTimer(name)

      try {
        switch (name) {
          case 'expired-order-cleanup': {
            const result = await autoCloseExpiredOrders()
            server.log.info(
              {
                scanned: result.scanned,
                closed: result.closed.length,
                failed: result.failed.length,
              },
              'expired orders cleaned',
            )
            // 上报任务执行成功
            try {
              server.recordJobExecution(name, 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'reconciliation-daily': {
            const result = await autoReconcileYesterday()
            server.log.info(
              {
                date: result.date,
                alipayLocal: result.alipay.localCount,
                wechatLocal: result.wechat.localCount,
              },
              'daily reconciliation done',
            )
            try {
              server.recordJobExecution(name, 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'heat-stats-hourly': {
            const result = await aggregateHeatStats()
            server.log.info(
              { dateStr: result.dateStr, agents: result.aggregatedAgents, hits: result.totalHits },
              'heat stats aggregated',
            )
            try {
              server.recordJobExecution(name, 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'alert-check-daily': {
            const result = await checkDailyAlerts()
            server.log.info(
              {
                checked: result.checked,
                resolved: result.resolved,
                escalated: result.escalated,
                backupIssues: result.backupIssues,
                backupUndetermined: result.backupUndetermined,
              },
              'daily alert check done',
            )
            if (result.escalated > 0) {
              try {
                // 每个库一条告警:标题含库名 ⇒ 下游按身份去重(PagerDuty dedup_key、bridge 的
                // alertname 指纹)不会让 keycloak 的缺失被 ihui_dev 那条窗口吞掉。
                for (const one of result.backupAlerts) {
                  await pushAlert({
                    title: one.title,
                    // backupIssues 与未判定行都按库拆进 one.lines(不可信文本)
                    message: capAlertMessage(
                      one.lines.map((s) => `- ${flattenUntrustedText(s)}`).join('\n'),
                    ),
                    severity: 'critical',
                    source: 'alert-check-daily',
                    metadata: {
                      checked: result.checked,
                      resolved: result.resolved,
                      escalated: result.escalated,
                      backupTarget: one.target,
                      backupIssues: result.backupIssues,
                      backupUndetermined: result.backupUndetermined,
                    },
                  })
                }
                if (result.backupAlerts.length === 0) {
                  await pushAlert({
                    title: '告警升级通知',
                    message: `最近 24h 错误数 ${result.checked} 超过阈值,需要人工介入`,
                    severity: 'critical',
                    source: 'alert-check-daily',
                    metadata: {
                      checked: result.checked,
                      resolved: result.resolved,
                      escalated: result.escalated,
                    },
                  })
                }
              } catch (err) {
                server.log.error({ err }, 'pushAlert failed in alert-check-daily')
              }
            }
            try {
              server.recordJobExecution(name, 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'data-archive-daily': {
            const result = await archiveDailyData()
            server.log.info(
              {
                auditLogs: result.auditLogsArchived,
                messages: result.messagesArchived,
                notifications: result.notificationsArchived,
                errors: result.errors.length,
              },
              'daily data archive done',
            )
            try {
              server.recordJobExecution(name, 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'file-cleanup-hourly': {
            const result = await runFileCleanup()
            server.log.info(
              {
                scanned: result.scanned,
                deletedByAge: result.deletedByAge,
                deletedBySize: result.deletedBySize,
                totalDeleted: result.totalDeleted,
                errors: result.errors.length,
              },
              'file cleanup done',
            )
            try {
              server.recordJobExecution(name, 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'expiration-monitor': {
            const result = await startExpirationMonitor()
            server.log.info(
              {
                checkedBuy: result.checkedAgentBuy,
                expiredBuy: result.expiredAgentBuy,
                checkedSettlement: result.checkedAgentSettlement,
                expiredSettlement: result.expiredAgentSettlement,
                failStreak: result.failStreak,
                canaryTriggered: result.canaryTriggered,
                healthy: result.healthy,
              },
              'expiration monitor done',
            )
            try {
              server.recordJobExecution(name, result.healthy ? 'success' : 'failed')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'vip-expire-daily': {
            const result = await expireVipMembers()
            server.log.info(
              {
                scanned: result.scanned,
                expiredVips: result.expiredVips,
                downgradedUsers: result.downgradedUsers,
                errors: result.errors.length,
              },
              'VIP expire daily done',
            )
            try {
              server.recordJobExecution(name, 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'activity-status-hourly': {
            const result = await autoCloseExpiredActivities()
            server.log.info(
              {
                scanned: result.scanned,
                endedActivities: result.endedActivities,
                errors: result.errors.length,
              },
              'activity status hourly done',
            )
            try {
              server.recordJobExecution(name, 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'commission-settle-daily': {
            const result = await calibrateCommissionSettlement()
            server.log.info(
              {
                scanned: result.scanned,
                missedOrders: result.missedOrders,
                createdFlows: result.createdFlows,
                errors: result.errors.length,
              },
              'commission settle daily done',
            )
            try {
              server.recordJobExecution(name, 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'mark-inactive-agents': {
            const result = await markInactiveAgents()
            server.log.info(
              { scanned: result.scanned, updated: result.updated },
              'mark inactive agents done',
            )
            try {
              server.recordJobExecution(name, 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'cleanup-old-heat': {
            const result = await cleanupOldHeatStats()
            server.log.info({ deleted: result.deleted }, 'old heat stats cleaned')
            try {
              server.recordJobExecution(name, 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'oauth-session-cleanup': {
            const result = await cleanupOauthSessions()
            server.log.info({ deleted: result.deleted }, 'expired oauth sessions cleaned')
            try {
              server.recordJobExecution(name, 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'subscription-recurring-charge': {
            const result = await scanAndChargeDueContracts()
            server.log.info(
              {
                scanned: result.scanned,
                charged: result.charged,
                failed: result.failed,
                skipped: result.skipped,
                trialExtended: result.trialExtended,
              },
              'subscription recurring charge done',
            )
            // 8.3.1: 上报扣款明细到 Prometheus
            try {
              server.recordRecurringCharge({
                scanned: result.scanned,
                charged: result.charged,
                failed: result.failed,
                skipped: result.skipped,
                trialExtended: result.trialExtended,
              })
            } catch (err) {
              server.log.warn({ err }, 'recordRecurringCharge failed (non-fatal)')
            }
            try {
              server.recordJobExecution(name, 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'workwechat-token-refresh': {
            const result = await refreshWorkWechatToken()
            server.log.info(
              {
                provider: result.provider,
                refreshed: result.refreshed,
                expiresAt: result.expiresAt,
                reason: result.reason,
              },
              'workwechat token refresh done',
            )
            try {
              server.recordJobExecution(name, result.reason ? 'failed' : 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'wechat-token-refresh': {
            const result = await refreshWechatToken()
            server.log.info(
              {
                provider: result.provider,
                refreshed: result.refreshed,
                expiresAt: result.expiresAt,
                reason: result.reason,
              },
              'wechat token refresh done',
            )
            try {
              server.recordJobExecution(name, result.reason ? 'failed' : 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'dingtalk-token-refresh': {
            const result = await refreshDingTalkToken()
            server.log.info(
              {
                provider: result.provider,
                refreshed: result.refreshed,
                expiresAt: result.expiresAt,
                reason: result.reason,
              },
              'dingtalk token refresh done',
            )
            try {
              server.recordJobExecution(name, result.reason ? 'failed' : 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'ai-feed-collect': {
            const result = await collectAllSources()
            const failed = result.details.filter((d) => d.status === 'error')
            server.log.info(
              {
                fetchedSources: result.fetchedSources,
                totalItems: result.totalItems,
                detailsCount: result.details.length,
                failedSources: failed.length,
              },
              'ai-feed-collect done',
            )
            // P0 修复：采集存在失败源时主动告警，避免"靠人发现故障"。
            // 一旦某源连续失败需人工介入调整；全量或超半数失败按 critical 升级。
            // 按身份去重见上方 decideAiFeedCollectAlert(同一源在窗口内只喊一次,新坏源即时到人)。
            if (failed.length > 0) {
              const ratio = failed.length / Math.max(result.fetchedSources || failed.length, 1)
              const severity =
                ratio >= 0.5 || failed.length === result.fetchedSources ? 'critical' : 'warning'
              const failedList = failed
                .map(
                  (d) =>
                    `- ${flattenUntrustedText(d.sourceCode) || '(未知源)'} → ${untrustedErrorField(d.error ?? 'unknown error')}`,
                )
                .join('\n')
              try {
                await maybePushAiFeedCollectAlert({
                  failing: failed.map((d) => ({ sourceCode: d.sourceCode, severity })),
                  store: createRedisAlertCooldownStore(resolveAlertCooldownRedis(server)),
                  log: server.log,
                  // 邮件正文照旧列出**全部**在坏的源(不只是新坏的那个):人要知道现在整体坏成什么样。
                  // 送达判定取"至少一条通道确认成功",全落空则不进冷却(下一轮照发)。
                  push: async () => {
                    const pushed = await pushAlertWithResult({
                      title: `AI 资讯采集失败告警（${failed.length}/${result.fetchedSources} 源失败）`,
                      message: capAlertMessage(
                        `本轮采集共 ${result.totalItems} 条，${result.fetchedSources} 源，其中 ${failed.length} 源失败：\n${failedList}`,
                      ),
                      severity,
                      source: 'ai-feed-collect',
                      metadata: {
                        totalItems: result.totalItems,
                        fetchedSources: result.fetchedSources,
                        failedCount: failed.length,
                        failedSources: failed.map((d) => d.sourceCode),
                      },
                    })
                    return Object.values(pushed).some(Boolean)
                  },
                })
              } catch (err) {
                server.log.error({ err }, 'pushAlert failed in ai-feed-collect')
              }
            }
            try {
              server.recordJobExecution(name, failed.length > 0 ? 'failed' : 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'ai-feed-process': {
            // 1. 先生成当日快照(computeTrendSignals 依赖快照数据,必须先执行)
            //    快照是纯 SQL upsert,几秒完成,串行等待不影响整体耗时
            const snapRes = await generateSnapshot().catch((err) => {
              server.log.error({ err }, 'generateSnapshot failed in ai-feed-process')
              return { insertedRows: 0 }
            })
            // 2. 三个子任务并行执行,各自独立 catch 防止一个失败拖垮全部
            //    computeTrendSignals 用刚生成的快照计算趋势(需 ≥2 天快照才有趋势)
            //    LLM 批大小走 ai-feed-service 的可配置默认值(LLM_CATEGORY_BATCH_SIZE=200 /
            //    LLM_TRANSLATE_BATCH_SIZE=100);LLM_BATCH_ENABLED=false 时二者内部直接返回 0。
            const [llmRes, transRes, trendRes] = await Promise.all([
              processLlmBatch().catch((err) => {
                server.log.error({ err }, 'processLlmBatch failed in ai-feed-process')
                return { processedItems: 0, failed: 0, details: String(err) }
              }),
              translateTitles().catch((err) => {
                server.log.error({ err }, 'translateTitles failed in ai-feed-process')
                return { processedItems: 0, failed: 0, details: String(err) }
              }),
              computeTrendSignals().catch((err) => {
                server.log.error({ err }, 'computeTrendSignals failed in ai-feed-process')
                return { processedItems: 0 }
              }),
            ])
            server.log.info(
              {
                snapshotRows: snapRes.insertedRows,
                llmProcessed: llmRes.processedItems,
                translated: transRes.processedItems,
                trendItems: trendRes.processedItems,
              },
              'ai-feed-process done',
            )
            try {
              server.recordJobExecution(name, 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return { snapshot: snapRes, llm: llmRes, translate: transRes, trend: trendRes }
          }
          case 'ai-feed-drain': {
            // 互斥锁:同一时间全局只允许一个 drain 在跑。BullMQ worker 并发默认 5,
            // 多个 drain(repeat + 手动 accel)会同时处理 → 各自并发调 LLM 叠加,
            // 极易打爆 ai-service/litellm 的并发上限(默认 8),触发 502 风暴、
            // 翻译成功率 <10%。取不到锁的直接跳过本次(下一轮 repeat 再补)。
            const locker = new DistributedLock(server.redis)
            const drainLock = await locker.tryLock('ai-feed-drain:mutex', 'scheduler-worker', {
              ttlMs: 60 * 60 * 1000, // 单次 drain 最多约 1h,不续约,超时自动释放
            })
            if (!drainLock) {
              server.log.info(
                { jobId: job.id, jobName: name },
                'ai-feed-drain skipped: another drain running',
              )
              return { skipped: true, reason: 'another-drain-running' }
            }
            // 存量 LLM 积压抽干(错峰加速):多轮小批量 + 轮间 sleep,
            // 持续抽干缺英文标题/缺分类的存量条目。受 LLM_BATCH_ENABLED 控制,
            // 批大小/轮数/错峰间隔均可由环境变量覆盖。
            const result = await drainLlmBacklog()
              .catch((err) => {
                server.log.error({ err }, 'drainLlmBacklog failed in ai-feed-drain')
                return {
                  llmProcessed: 0,
                  translated: 0,
                  classifiedFailed: 0,
                  translateFailed: 0,
                  iterations: 0,
                  llmBacklogCleared: false,
                  translateBacklogCleared: false,
                  remainingNoLlm: -1,
                  remainingNoEn: -1,
                  zeroProgress: true,
                }
              })
              .finally(async () => {
                await locker.release(drainLock.name, drainLock.token).catch(() => false)
              })
            server.log.info(
              {
                llmProcessed: result.llmProcessed,
                translated: result.translated,
                classifiedFailed: result.classifiedFailed,
                translateFailed: result.translateFailed,
                iterations: result.iterations,
                llmBacklogCleared: result.llmBacklogCleared,
                translateBacklogCleared: result.translateBacklogCleared,
                remainingNoEn: result.remainingNoEn,
                remainingNoLlm: result.remainingNoLlm,
                zeroProgress: result.zeroProgress,
              },
              'ai-feed-drain done',
            )
            try {
              server.recordJobExecution(name, 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'budget-alert-check': {
            const result = await checkBudgetAlerts(server)
            server.log.info(
              {
                scanned: result.scanned,
                warning: result.warningCount,
                critical: result.criticalCount,
                errors: result.errors.length,
              },
              'budget alert check done',
            )
            try {
              server.recordJobExecution(name, result.errors.length > 0 ? 'failed' : 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'edu-arrear-remind-daily': {
            // 通道显式可配(默认只微信);日志把**所有**触达档打全 ——
            // 上一版只打 6 个字段,算出来的 wxNotConfigured/parentRecipients/sms* 没人看得见,
            // "失败必须响"这一维等于只做了一半。
            const remindChannels = parseRemindChannels(process.env.EDU_ARREAR_REMIND_CHANNELS)
            const result = await scanAndRemindArrears({ channels: remindChannels })
            server.log.info(
              {
                channels: remindChannels,
                scanned: result.scanned,
                reminded: result.reminded,
                skippedToday: result.skippedToday,
                notifyFailed: result.notifyFailed,
                recipients: result.recipients,
                parentRecipients: result.parentRecipients,
                overdue: result.overdueCount,
                dueSoon: result.dueSoonCount,
                withoutSchedule: result.withoutSchedule,
                wxSent: result.wxSent,
                wxFailed: result.wxFailed,
                wxNotConfigured: result.wxNotConfigured,
                wxNoOpenid: result.wxNoOpenid,
                wxUserRefused: result.wxUserRefused,
                smsSent: result.smsSent,
                smsFailed: result.smsFailed,
                smsNotConfigured: result.smsNotConfigured,
                smsNoPhone: result.smsNoPhone,
              },
              'edu arrear remind done',
            )
            try {
              // 站内信没抛异常 ≠ 催缴送达:外部通道全零送达时记 failed,
              // 否则"微信未配置"会一直显示成任务成功(与旧行为同形)。
              const missed = externalDeliveryMissed({
                channels: remindChannels,
                reminded: result.reminded,
                wxSent: result.wxSent,
                smsSent: result.smsSent,
              })
              server.recordJobExecution(
                name,
                result.notifyFailed > 0 || missed ? 'failed' : 'success',
              )
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'llm-call-log-purge-daily': {
            // O5 原文留存:循环清除到期/按 key 关闭的 llm_call_logs 原文直到无到期行。
            // 函数内部已降级(DB 异常返回 purged=0 不抛出),这里不需要 try。
            const result = await purgeAllExpiredLlmCallLogRawText()
            server.log.info(
              {
                purged: result.purged,
                hasMore: result.hasMore,
                defaultDays: result.policy.defaultDays,
              },
              'llm_call_logs raw-text purge done',
            )
            try {
              server.recordJobExecution(name, result.hasMore ? 'failed' : 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'upload-session-reap-hourly': {
            // A9R12-G1 ③:过期分片会话回收(删 upload_sessions 行 + uploads/chunks/<uuid>/)。
            // cleanupExpiredUploadSessions 只按本表 uuid 形态删目录,不会整片删 uploads/。
            const result = await cleanupExpiredUploadSessions()
            server.log.info(
              {
                sessions: result.sessions,
                dirs: result.dirs,
                dirsRejected: result.dirsRejected,
              },
              'expired upload sessions reaped',
            )
            try {
              server.recordJobExecution(name, 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'outbox-drain-every-30s': {
            // b76-12e 票3(G-998160):outbox 排空接进既有 BullMQ 轮询,不新增计时器。
            // runOutboxDrain 内部已降级(DB 异常不抛出),这里不需要额外 try。
            const result = await runOutboxDrain(server)
            try {
              server.recordJobExecution(name, 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          default:
            server.log.warn({ jobName: name }, 'unknown scheduled job')
            try {
              server.recordJobExecution(name, 'unknown')
            } catch {
              /* 指标采集失败不影响业务 */
            }
        }
      } catch (err) {
        // 上报任务执行失败
        try {
          server.recordJobExecution(name, 'failed')
        } catch {
          /* 指标采集失败不影响业务 */
        }
        throw err
      } finally {
        // 结束计时并上报耗时
        timer.end()
      }
    },
  )

  server.log.info(
    { count: SCHEDULED_JOBS.length, names: SCHEDULED_JOBS.map((j) => j.name) },
    'scheduler worker started',
  )
  return worker
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
