// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import { queueNameWithDbIdentity } from '../services/relay-queue-name.js'

/**
 * 队列名(2026-10-31 起经库身份解析)。本文件是这一族的**唯一取名处**:
 * 生产者 = 下面注册 cron 的 `new Queue`,消费者 = 下面的 `new Worker`,两侧读同一枚常量。
 *
 * 为什么优先级最高:Redis 现场取证(2026-10-31,`.ihui-agent/tmp/queue-proof/PROOF.md` §3b)
 * 量到 `bull:relay-health-check-queue:failed` **ZCARD=500 打满**(条目集中在 2026-10-24),
 * 与号池那族是同一型事故 —— 隔离栈起 worker、吃主库队列、在缺列库上跑。
 * 残留 500 条是事故证据,**不许删**(清理需另授权)。
 * 主库(`ihui`、未设后缀)解析结果与旧字面量逐字节相同 ⇒ 线上队列名零扰动。
 */
const RELAY_HEALTH_CHECK_QUEUE_BASE_NAME = 'relay-health-check-queue'

export const RELAY_HEALTH_CHECK_QUEUE_NAME = queueNameWithDbIdentity(
  RELAY_HEALTH_CHECK_QUEUE_BASE_NAME,
)

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
      await queue.upsertJobScheduler(
        'relay-health-check-cron',
        { pattern: CRON_PATTERN },
        {
          name: 'check-all',
          data: {},
          opts: {
            removeOnComplete: 100,
            removeOnFail: 500,
          },
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
          recovered: result.recovered,
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
