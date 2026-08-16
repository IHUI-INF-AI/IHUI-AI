/**
 * USDT 支付轮询 BullMQ Worker。
 *
 * 消费 usdt-payment-queue 队列任务，定时轮询 pending 订单。
 * - repeat job `poll-pending`：每 1 分钟触发一次，调 pollPendingUsdtPayments
 *
 * 与 relay-health-check-worker 同模式：server.redisForQueue 连接 + onClose 优雅关闭。
 */
import type { FastifyInstance } from 'fastify'
import { Queue, Worker } from 'bullmq'
import { pollPendingUsdtPayments } from '../services/payment-usdt-service.js'

export const USDT_PAYMENT_QUEUE_NAME = 'usdt-payment-queue'

/** 每 1 分钟轮询一次（cron 表达式见 CRON_PATTERN） */
const CRON_PATTERN = '* * * * *'

export function startUsdtPaymentWorker(server: FastifyInstance): Worker {
  const connection = server.redisForQueue
  if (!connection) {
    server.log.warn('usdt-payment-worker: Redis 不可用,Worker 未启动')
    return {} as Worker
  }

  // 创建队列 + 注册 repeatable cron job（onReady 时幂等注册，BullMQ 按 repeat key 去重）
  const queue = new Queue(USDT_PAYMENT_QUEUE_NAME, { connection })
  server.addHook('onReady', async () => {
    try {
      await queue.upsertJobScheduler(
        'usdt-payment-cron',
        { pattern: CRON_PATTERN },
        {
          name: 'poll-pending',
          data: {},
          opts: {
            removeOnComplete: 100,
            removeOnFail: 500,
          },
        },
      )
      server.log.info({ pattern: CRON_PATTERN }, 'usdt-payment poll scheduled')
    } catch (err) {
      server.log.error({ err }, 'failed to schedule usdt-payment poll')
    }
  })

  const worker = new Worker(
    USDT_PAYMENT_QUEUE_NAME,
    async (job) => {
      if (job.name !== 'poll-pending') {
        server.log.warn({ jobName: job.name }, 'usdt-payment: unknown job')
        return null
      }
      const result = await pollPendingUsdtPayments()
      server.log.info(
        {
          checked: result.checked,
          confirmed: result.confirmed,
          failed: result.failed,
        },
        'usdt-payment poll done',
      )
      return result
    },
    { connection, concurrency: 1 },
  )

  worker.on('failed', (job, err) => {
    server.log.error({ jobId: job?.id, err: err.message }, 'usdt-payment poll job failed')
  })

  // 优雅关闭：Fastify onClose 时关闭 Worker + Queue
  server.addHook('onClose', async () => {
    try {
      await worker.close()
    } catch {
      /* ignore */
    }
    try {
      await queue.close()
    } catch {
      /* ignore */
    }
  })

  server.log.info({ queue: USDT_PAYMENT_QUEUE_NAME }, 'usdt-payment worker started')

  return worker
}
