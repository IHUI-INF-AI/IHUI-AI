import 'dotenv/config'
import type { Worker } from 'bullmq'
import { buildServer } from './server.js'
import { startWorkers } from './workers/index.js'
import { startSchedulerWorker } from './workers/scheduler-worker.js'
import { initOtel } from './plugins/otel.js'

/**
 * Worker 独立进程入口。
 *
 * 使用场景:
 * - docker-compose worker service 独立部署
 * - 多实例部署时,API 进程仅生产(ENABLE_WORKER=false),Worker 进程独立消费
 * - 避免单进程内 HTTP 请求与异步任务互相阻塞
 *
 * 与 src/index.ts 的区别:
 * - 不监听 HTTP(PORT=0 或不调用 listen)
 * - 不触发生产环境微信支付配置检查(纯消费者无需支付配置)
 * - 仅启动 BullMQ Worker + Scheduler Worker
 *
 * 启动命令:node dist/worker-entry.js
 */
async function startWorkerProcess(): Promise<void> {
  initOtel()

  const server = await buildServer()

  const workers: Worker[] = startWorkers(server)
  const schedulerWorker: Worker = startSchedulerWorker(server)

  server.log.info(
    {
      workers: workers.length + 1,
      mode: 'worker-only',
    },
    '🚀 Worker process started (no HTTP listener)',
  )

  const shutdown = async (signal: string) => {
    server.log.info({ signal }, 'Worker process shutting down...')
    await Promise.allSettled([...workers.map((w) => w.close()), schedulerWorker.close()])
    await server.close()
    process.exit(0)
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

startWorkerProcess().catch((err) => {
  console.error('Worker process failed to start:', err)
  process.exit(1)
})
