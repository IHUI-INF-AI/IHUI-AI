import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { Queue, type ConnectionOptions } from 'bullmq'
import { config } from '../config/index.js'

/**
 * 定时任务调度器插件。
 *
 * 设计要点：
 * 1. 基于 BullMQ repeatable jobs（cron pattern），多实例部署时由 Redis 保证同一任务
 *    只被一个 worker 实例消费（BullMQ 的 delayed job 抢占语义）。
 * 2. BullMQ 按 repeat key 对 repeatable job 幂等去重，进程重启重复注册不会产生多份调度。
 * 3. 实际任务执行逻辑在 workers/scheduler-worker.ts，本插件只负责调度基础设施。
 * 4. 与 queue.ts 一致，使用独立 ConnectionOptions（maxRetriesPerRequest: null）。
 */
export const SCHEDULER_QUEUE_NAME = 'scheduler'

export type ScheduledJobName =
  | 'expired-order-cleanup'
  | 'heat-stats-hourly'
  | 'alert-check-daily'
  | 'data-archive-daily'
  | 'reconciliation-daily'

export interface ScheduledJobDef {
  name: ScheduledJobName
  pattern: string
  description: string
}

/**
 * 定时任务清单（cron 表达式，5 字段：分 时 日 月 周）。
 * 迁移自旧架构 server/app/tasks/scheduler.py，保留 5 类核心任务。
 */
export const SCHEDULED_JOBS: ScheduledJobDef[] = [
  { name: 'expired-order-cleanup', pattern: '*/10 * * * *', description: '过期订单清理（每10分钟）' },
  { name: 'heat-stats-hourly', pattern: '0 * * * *', description: '热度统计聚合（每小时）' },
  { name: 'alert-check-daily', pattern: '0 4 * * *', description: '告警噪音检查（每日04:00）' },
  { name: 'data-archive-daily', pattern: '30 4 * * *', description: '历史数据归档（每日04:30）' },
  { name: 'reconciliation-daily', pattern: '30 3 * * *', description: '支付对账（每日03:30）' },
]

interface SchedulerJobData {
  description: string
}

declare module 'fastify' {
  interface FastifyInstance {
    /** 定时任务队列（BullMQ repeatable jobs 生产者） */
    schedulerQueue: Queue<SchedulerJobData>
  }
}

const schedulerPlugin: FastifyPluginAsync = async (server) => {
  const connection: ConnectionOptions = {
    url: config.REDIS_URL,
    maxRetriesPerRequest: null,
  }

  const schedulerQueue = new Queue<SchedulerJobData>(SCHEDULER_QUEUE_NAME, { connection })

  // 注册 repeatable jobs。BullMQ 按 (name + repeat pattern) 生成 repeat key 幂等去重，
  // 多次启动 / 多实例注册同一 pattern 不会重复触发。
  for (const job of SCHEDULED_JOBS) {
    await schedulerQueue.add(
      job.name,
      { description: job.description },
      {
        repeat: { pattern: job.pattern },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 500 },
      },
    )
  }

  server.decorate('schedulerQueue', schedulerQueue)

  server.addHook('onClose', async () => {
    try {
      await schedulerQueue.close()
    } catch {
      /* ignore */
    }
  })
}

export const scheduler = fp(schedulerPlugin, {
  name: 'scheduler',
  fastify: '5.x',
})
