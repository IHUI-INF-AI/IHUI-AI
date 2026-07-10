import type { FastifyInstance } from 'fastify'
import type { Worker } from 'bullmq'
import { createWorker } from '../plugins/queue.js'
import { SCHEDULER_QUEUE_NAME, SCHEDULED_JOBS, type ScheduledJobName } from '../plugins/scheduler.js'
import { autoCloseExpiredOrders, autoReconcileYesterday } from '../services/reconciliation-service.js'

/**
 * 启动定时任务 Worker（消费 scheduler 队列的 repeatable jobs）。
 *
 * 多实例部署时，BullMQ 保证每个 delayed job 只被一个 worker 抢占执行，
 * 因此同一时刻同一 cron 任务只在一个实例上运行。
 *
 * 任务分发：
 * - expired-order-cleanup: 调 autoCloseExpiredOrders 关闭超时未支付订单
 * - reconciliation-daily: 调 autoReconcileYesterday 做昨日支付对账
 * - heat-stats-hourly / alert-check-daily / data-archive-daily: backing service 未迁移，
 *   暂记日志跳过，待对应 TS service 落地后接入。
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
          server.log.info('heat stats aggregation skipped (backing service not migrated)')
          return { skipped: true, reason: 'heat_stats_service not migrated' }
        }
        case 'alert-check-daily': {
          server.log.info('alert noise check skipped (backing service not migrated)')
          return { skipped: true, reason: 'alert service not migrated' }
        }
        case 'data-archive-daily': {
          server.log.info('data archive skipped (backing tables not migrated)')
          return { skipped: true, reason: 'archive tables not migrated' }
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
