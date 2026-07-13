import 'dotenv/config'
import type { Worker } from 'bullmq'
import { buildServer } from './server.js'
import { startWorkers } from './workers/index.js'
import { startSchedulerWorker } from './workers/scheduler-worker.js'
import { initVendorConfigs } from './lifecycle/init-vendor-configs.js'

const PORT = Number(process.env.PORT ?? 8080)
const HOST = process.env.HOST ?? '0.0.0.0'

async function start() {
  const server = await buildServer()

  // 启动 BullMQ Worker（异步消费者）
  // 通过 ENABLE_WORKER=false 可禁用（用于纯生产者实例）
  const enableWorker = process.env.ENABLE_WORKER !== 'false'
  const workers = enableWorker ? startWorkers(server) : null
  const schedulerWorker: Worker | null = enableWorker ? startSchedulerWorker(server) : null

  // R4 重构产物：启动后异步初始化 AI 厂商配置（不阻塞 listen）
  // 数据库不可用或表未创建时静默降级，不影响服务启动
  void initVendorConfigs(server.log).catch((err) => {
    server.log.warn({ err }, 'AI 厂商配置初始化跳过（数据库/表未就绪）')
  })

  try {
    await server.listen({ port: PORT, host: HOST })
    server.log.info(`🚀 API server listening on http://${HOST}:${PORT}`)
  } catch (err) {
    server.log.error({ err }, 'Failed to start server')
    process.exit(1)
  }

  const shutdown = async (signal: string) => {
    server.log.info({ signal }, 'Shutting down...')
    if (workers) {
      await Promise.allSettled(workers.map((w) => w.close()))
    }
    if (schedulerWorker) {
      await schedulerWorker.close()
    }
    await server.close()
    process.exit(0)
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

start()
