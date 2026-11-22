// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import {
  pollPendingUsdtPayments,
  UsdtPollFailureError,
  type PollOptions,
  type PollResult,
} from '../services/payment-usdt-service.js'
import { queueNameWithDbIdentity } from '../services/relay-queue-name.js'

/**
 * 队列名(2026-10-31 起经库身份解析)。本文件是这一族的**唯一取名处**:
 * 生产者 = 下面注册 cron 的 `new Queue`,消费者 = 下面的 `new Worker`,两侧读同一枚常量。
 * 支付轮询被隔离栈抢走属资损面,主库(`ihui`、未设后缀)解析结果与旧字面量逐字节相同
 * ⇒ 线上队列名零扰动。
 */
const USDT_PAYMENT_QUEUE_BASE_NAME = 'usdt-payment-queue'

export const USDT_PAYMENT_QUEUE_NAME = queueNameWithDbIdentity(USDT_PAYMENT_QUEUE_BASE_NAME)

/** 每 1 分钟轮询一次（cron 表达式见 CRON_PATTERN） */
const CRON_PATTERN = '* * * * *'

/** F-509:job 执行体只依赖这两个日志级别，便于单测注入假 logger */
export interface UsdtPollJobLogger {
  info: (obj: Record<string, unknown>, msg: string) => void
  error: (obj: Record<string, unknown>, msg: string) => void
}

/**
 * F-509:USDT 轮询 job 的可单测执行体。
 *
 * 旧实现直接 `return result`：service 把链上故障咽成 pending，failed 恒 0，
 * BullMQ 每分钟把 job 记成 completed，监控永远显示健康。
 * 现在 service 在 failed>0 时抛 UsdtPollFailureError（带统计+摘要），这里
 * 结构化记录后再上抛，由 BullMQ 记为 failed 并触发既有 failed 日志/重试策略。
 */
export async function runUsdtPaymentPollJob(
  log: UsdtPollJobLogger,
  options?: PollOptions,
): Promise<PollResult> {
  try {
    const result = await pollPendingUsdtPayments(50, options)
    log.info(
      {
        checked: result.checked,
        confirmed: result.confirmed,
        failed: result.failed,
      },
      'usdt-payment poll done',
    )
    return result
  } catch (err) {
    const result = err instanceof UsdtPollFailureError ? err.result : undefined
    log.error(
      {
        checked: result?.checked ?? 0,
        confirmed: result?.confirmed ?? 0,
        failed: result?.failed ?? 0,
        failures: result?.errors ?? [],
        err: err instanceof Error ? err.message : String(err),
      },
      'usdt-payment poll failed',
    )
    throw err
  }
}

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
      const result = await runUsdtPaymentPollJob(server.log)
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
