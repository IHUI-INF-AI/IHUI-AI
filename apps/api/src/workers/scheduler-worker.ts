import type { FastifyInstance } from 'fastify'
import type { Worker } from 'bullmq'
import { createWorker } from '../plugins/queue.js'
import { SCHEDULER_QUEUE_NAME, SCHEDULED_JOBS, type ScheduledJobName } from '../plugins/scheduler.js'
import { autoCloseExpiredOrders, autoReconcileYesterday } from '../services/reconciliation-service.js'
import { aggregateHeatStats } from '../services/heat-stats-service.js'
import { checkDailyAlerts } from '../services/alert-check-service.js'
import { archiveDailyData } from '../services/data-archive-service.js'

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
 */
export function startSchedulerWorker(server: FastifyInstance): Worker {
  const worker = createWorker<Record<string, unknown>>(
    server,
    SCHEDULER_QUEUE_NAME,
    async (job) => {
      const name = job.name as ScheduledJobName
      server.log.info({ jobId: job.id, jobName: name }, 'scheduled job started')

      switch (name) {
        case 'expired-order-cleanup': {
          const result = await autoCloseExpiredOrders()
          server.log.info(
            { scanned: result.scanned, closed: result.closed.length, failed: result.failed.length },
            'expired orders cleaned',
          )
          return result
        }
        case 'reconciliation-daily': {
          const result = await autoReconcileYesterday()
          server.log.info(
            { date: result.date, alipayLocal: result.alipay.localCount, wechatLocal: result.wechat.localCount },
            'daily reconciliation done',
          )
          return result
        }
        case 'heat-stats-hourly': {
          const result = await aggregateHeatStats()
          server.log.info(
            { dateStr: result.dateStr, agents: result.aggregatedAgents, hits: result.totalHits },
            'heat stats aggregated',
          )
          return result
        }
        case 'alert-check-daily': {
          const result = await checkDailyAlerts()
          server.log.info(
            { checked: result.checked, resolved: result.resolved, escalated: result.escalated },
            'daily alert check done',
          )
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
          return result
        }
        default:
          server.log.warn({ jobName: name }, 'unknown scheduled job')
      }
    },
  )

  server.log.info(
    { count: SCHEDULED_JOBS.length, names: SCHEDULED_JOBS.map((j) => j.name) },
    'scheduler worker started',
  )
  return worker
}
