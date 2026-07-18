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
              { checked: result.checked, resolved: result.resolved, escalated: result.escalated },
              'daily alert check done',
            )
            if (result.escalated > 0) {
              try {
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
