// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 第三方 AI IDE 账号池巡检 BullMQ Worker(2026-10-22 立,对标码道网关)。
 *
 * 消费 relay-account-pool-queue:
 * - repeat job `sweep`:每 5 分钟一轮(sweepAccountPool)——
 *   token 临期刷新 / unknown 健康定级 / down 账号恢复尝试
 *
 * 与 relay-health-check-worker 同模式:server.redisForQueue 连接 + onClose 优雅关闭。
 */
import type { FastifyInstance } from 'fastify'
import { Queue, Worker } from 'bullmq'
import { sweepAccountPool } from '../services/relay-account-pool-scheduler.js'
import { registerAllRelayAdapters } from '../services/upstream-adapters/index.js'

export const RELAY_ACCOUNT_POOL_QUEUE_NAME = 'relay-account-pool-queue'

/** 每 5 分钟巡检一次(token 寿命按天计,5 分钟窗口足够提前量) */
const CRON_PATTERN = '*/5 * * * *'

export function startRelayAccountPoolWorker(server: FastifyInstance): Worker {
  registerAllRelayAdapters()

  const connection = server.redisForQueue
  if (!connection) {
    server.log.warn('relay-account-pool-worker: Redis 不可用,Worker 未启动')
    return {} as Worker
  }

  const queue = new Queue(RELAY_ACCOUNT_POOL_QUEUE_NAME, { connection })
  server.addHook('onReady', async () => {
    try {
      await queue.upsertJobScheduler(
        'relay-account-pool-cron',
        { pattern: CRON_PATTERN },
        {
          name: 'sweep',
          data: {},
          opts: {
            removeOnComplete: 100,
            removeOnFail: 500,
          },
        },
      )
      server.log.info({ pattern: CRON_PATTERN }, 'relay-account-pool sweep scheduled')
    } catch (err) {
      server.log.error({ err }, 'failed to schedule relay-account-pool sweep')
    }
  })

  const worker = new Worker(
    RELAY_ACCOUNT_POOL_QUEUE_NAME,
    async (job) => {
      if (job.name !== 'sweep') {
        server.log.warn({ jobName: job.name }, 'relay-account-pool: unknown job')
        return null
      }
      const result = await sweepAccountPool()
      // 日志取值面 = sweepAccountPool 的产出面(AccountPoolSweepResult 的 6 枚键),不得多读:
      // 签到对账 / 断链待推重推当前不在 sweep 产出里(sweep 单轮只做临期刷新 + unknown 定级
      // + down 恢复),读它们只会得到 undefined。要恢复该族埋点,先让生产端真发键(见本票回报)。
      server.log.info(
        {
          skipped: result.skipped,
          refreshed: result.refreshed,
          refreshFailed: result.refreshFailed,
          refreshSkipped: result.refreshSkipped,
          healthChecked: result.healthChecked,
          healthRecovered: result.healthRecovered,
        },
        'relay-account-pool sweep done',
      )
      return result
    },
    { connection, concurrency: 1 },
  )

  worker.on('failed', (job, err) => {
    server.log.error({ jobId: job?.id, err: err.message }, 'relay-account-pool job failed')
  })

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

  server.log.info({ queue: RELAY_ACCOUNT_POOL_QUEUE_NAME }, 'relay-account-pool worker started')

  return worker
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
