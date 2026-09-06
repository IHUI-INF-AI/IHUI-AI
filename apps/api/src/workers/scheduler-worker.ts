// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyInstance } from 'fastify'
import type { Worker } from 'bullmq'
import { createWorker } from '../plugins/queue.js'
import {
  SCHEDULER_QUEUE_NAME,
  SCHEDULED_JOBS,
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
import { expireVipMembers } from '../services/vip-expire-service.js'
import { autoCloseExpiredActivities } from '../services/activity-status-service.js'
import { calibrateCommissionSettlement } from '../services/commission-settle-service.js'
import {
  markInactiveAgents,
  cleanupOldHeatStats,
  cleanupOauthSessions,
} from '../services/scheduled-tasks-service.js'
import { pushAlert } from '../services/alert-notification-service.js'
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
              },
              'daily alert check done',
            )
            if (result.escalated > 0) {
              try {
                if (result.backupIssues.length > 0) {
                  await pushAlert({
                    title: '数据库备份监控告警(缺失/空备份/过期)',
                    message: result.backupIssues.join('\n'),
                    severity: 'critical',
                    source: 'alert-check-daily',
                    metadata: {
                      checked: result.checked,
                      resolved: result.resolved,
                      escalated: result.escalated,
                      backupIssues: result.backupIssues,
                    },
                  })
                } else {
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
          case 'pg-backup-daily': {
            const { spawn } = await import('node:child_process')
            const scriptPath = new URL('../../scripts/pg-backup.mjs', import.meta.url).pathname
            const result = await new Promise<{ code: number; stdout: string; stderr: string }>(
              (resolve) => {
                const p = spawn(process.execPath, [scriptPath], { cwd: process.cwd() })
                let out = '',
                  err = ''
                p.stdout.on('data', (d) => (out += d))
                p.stderr.on('data', (d) => (err += d))
                p.on('close', (code) => resolve({ code: code ?? 0, stdout: out, stderr: err }))
              },
            )
            server.log.info(
              {
                exitCode: result.code,
                stdoutTail: result.stdout.split('\n').slice(-3).join(' | '),
              },
              'pg backup done',
            )
            try {
              server.recordJobExecution(name, result.code === 0 ? 'success' : 'failed')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            if (result.code !== 0)
              throw new Error(`pg-backup.mjs exit ${result.code}: ${result.stderr.slice(-200)}`)
            return { exitCode: result.code }
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
            if (failed.length > 0) {
              const ratio = failed.length / Math.max(result.fetchedSources || failed.length, 1)
              const severity =
                ratio >= 0.5 || failed.length === result.fetchedSources
                  ? 'critical'
                  : 'warning'
              const failedList = failed
                .map((d) => `- ${d.sourceCode}: ${d.error ?? 'unknown error'}`)
                .join('\n')
              try {
                await pushAlert({
                  title: `AI 资讯采集失败告警（${failed.length}/${result.fetchedSources} 源失败）`,
                  message: `本轮采集共 ${result.totalItems} 条，${result.fetchedSources} 源，其中 ${failed.length} 源失败：\n${failedList}`,
                  severity,
                  source: 'ai-feed-collect',
                  metadata: {
                    totalItems: result.totalItems,
                    fetchedSources: result.fetchedSources,
                    failedCount: failed.length,
                    failedSources: failed.map((d) => d.sourceCode),
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
              server.log.info({ jobId: job.id, jobName: name }, 'ai-feed-drain skipped: another drain running')
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
