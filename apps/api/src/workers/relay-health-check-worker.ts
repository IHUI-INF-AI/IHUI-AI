/**
 * 中转站 Key 池健康巡检 BullMQ Worker。
 *
 * 消费 relay-health-check-queue 队列任务，定时巡检所有启用的 key。
 * - repeat job `check-all`：每 5 分钟触发一次，调 checkAllKeys
 * - 自动禁用：连续 3 次巡检 down 的 key 被 is_enabled=false（熔断逻辑在 service 层）
 *
 * 与 registry-sync-worker 同模式：server.redisForQueue 连接 + onClose 优雅关闭。
 */
import type { FastifyInstance } from 'fastify'
import { Queue, Worker } from 'bullmq'
import { checkAllKeys } from '../services/relay-health-check-service.js'

export const RELAY_HEALTH_CHECK_QUEUE_NAME = 'relay-health-check-queue'

/** 每 5 分钟巡检一次（cron 表达式见 CRON_PATTERN） */
const CRON_PATTERN = '*/5 * * * *'

export function startRelayHealthCheckWorker(server: FastifyInstance): Worker {
  const connection = server.redisForQueue
  if (!connection) {
    server.log.warn('relay-health-check-worker: Redis 不可用,Worker 未启动')
    return {} as Worker
  }

  // 创建队列 + 注册 repeatable cron job（onReady 时幂等注册，BullMQ 按 repeat key 去重）
  const queue = new Queue(RELAY_HEALTH_CHECK_QUEUE_NAME, { connection })
  server.addHook('onReady', async () => {
    try {
      await queue.add(
        'check-all',
        {},
        {
          repeat: { pattern: CRON_PATTERN },
          jobId: 'relay-health-check-cron',
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      )
      server.log.info({ pattern: CRON_PATTERN }, 'relay-health-check scheduled')
    } catch (err) {
      server.log.error({ err }, 'failed to schedule relay-health-check')
    }
  })

  const worker = new Worker(
    RELAY_HEALTH_CHECK_QUEUE_NAME,
    async (job) => {
      if (job.name !== 'check-all') {
        server.log.warn({ jobName: job.name }, 'relay-health-check: unknown job')
        return null
      }
      const result = await checkAllKeys()
      server.log.info(
        {
          total: result.total,
          healthy: result.healthy,
          degraded: result.degraded,
          down: result.down,
          disabled: result.disabled,
        },
        'relay-health-check done',
      )
      return result
    },
    { connection, concurrency: 1 },
  )

  worker.on('failed', (job, err) => {
    server.log.error({ jobId: job?.id, err: err.message }, 'relay-health-check job failed')
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

  server.log.info({ queue: RELAY_HEALTH_CHECK_QUEUE_NAME }, 'relay-health-check worker started')

  return worker
}
