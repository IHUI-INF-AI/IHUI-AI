import 'dotenv/config'
import type { Worker } from 'bullmq'
import { buildServer } from './server.js'
import { startWorkers } from './workers/index.js'
import { startSchedulerWorker } from './workers/scheduler-worker.js'
import { initVendorConfigs } from './lifecycle/init-vendor-configs.js'
import { initOtel } from './plugins/otel.js'
import { isWechatPayConfigured, isPlatformCertConfigured } from './services/wechat-pay.js'
import { startAiWorldSyncScheduler, stopAiWorldSyncScheduler } from './jobs/ai-world-sync.js'
import { stopAutoRollbackMonitor } from './services/auto-rollback.js'
import { routineManager } from './services/workspace-ai-service.js'
import { stopScheduledWarmup } from './services/cache-warmup-service.js'
import { stopRelayChannelRouterSweep } from './services/relay-channel-router.js'
import { stopRegistryRateLimitSweep } from './routes/registry-sync.js'
import { stopPoolTracker } from './db/index.js'
import { logger } from './utils/logger.js'

const PORT = Number(process.env.PORT ?? 8080)
const HOST = process.env.HOST ?? '0.0.0.0'

/**
 * 启动期生产环境安全检查:
 * - 微信支付私钥未配置 → 所有支付走 mock,真实支付无法完成(阻塞)
 * - 微信支付平台证书未配置 → 所有支付回调验签失败,订单无法自动标记为 paid(阻塞)
 *
 * 仅在 NODE_ENV=production 触发,开发/测试环境允许降级。
 * 阻塞策略:process.exit(1) 立即退出,避免带病运行。
 */
function checkProductionConfig(): void {
  if (process.env.NODE_ENV !== 'production') return
  const errors: string[] = []
  if (!isWechatPayConfigured()) {
    errors.push('WX_PAY_PRIVATE_KEY / WX_PAY_PRIVATE_KEY_PATH 至少配置一项')
  }
  if (!isPlatformCertConfigured()) {
    errors.push('WX_PAY_PLATFORM_CERT / WX_PAY_PLATFORM_CERT_PATH 至少配置一项')
  }
  if (errors.length === 0) return
  logger.error('❌ 生产环境微信支付配置不完整,启动中止:')
  for (const e of errors) logger.error(`   - ${e}`)
  logger.error('   参考 .env.production.example 补齐证书配置(证书放置项目内 cert/ 目录)')
  process.exit(1)
}

async function start() {
  // OpenTelemetry 追踪：在 buildServer 之前初始化，最大化 instrument 覆盖（含启动期代码）
  // 未配置 OTEL_EXPORTER_OTLP_ENDPOINT 且 OTEL_ENABLED!=true 时为 no-op，不阻塞启动
  initOtel()

  // 生产环境微信支付配置完整性检查(失败立即退出)
  checkProductionConfig()

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

  const shutdown = async (signal: string, exitCode = 0): Promise<never> => {
    server.log.info({ signal }, 'Shutting down...')
    try {
      stopAiWorldSyncScheduler()
    } catch {}
    // P0 修复:显式停止后台定时器,不依赖 server.close 钩子顺序
    try {
      stopAutoRollbackMonitor()
    } catch {}
    try {
      routineManager.stopScheduler()
    } catch {}
    try {
      stopScheduledWarmup()
    } catch {}
    // P2 修复(2026-07-31):显式停止模块作用域 setInterval,不依赖 unref
    try {
      stopRelayChannelRouterSweep()
    } catch {}
    try {
      stopRegistryRateLimitSweep()
    } catch {}
    try {
      stopPoolTracker()
    } catch {}
    if (workers) {
      await Promise.allSettled(workers.map((w) => w.close()))
    }
    if (schedulerWorker) {
      await schedulerWorker.close()
    }
    await server.close()
    process.exit(exitCode)
  }

  try {
    await server.listen({ port: PORT, host: HOST })
    server.log.info(`🚀 API server listening on http://${HOST}:${PORT}`)
  } catch (err) {
    // P0 修复(2026-07-31):listen 失败时必须清理已启动的 workers / schedulers,
    // 否则 BullMQ worker 持有的 ioredis 连接、scheduler cron 句柄会泄露,
    // tsx watch 重启时会累积(死进程句柄 3791 的事故根因之一)。
    server.log.error({ err }, 'Failed to start server')
    await shutdown('listen-failure', 1)
  }

  // 启动 AI World 数据同步定时任务(每 12 小时一次,默认开启,ENABLE_AI_WORLD_SYNC=false 禁用)
  if (process.env.ENABLE_AI_WORLD_SYNC !== 'false') {
    startAiWorldSyncScheduler()
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

// P0 修复(2026-07-31):全局未捕获错误处理 — 记录明确日志便于诊断,
// 避免进程静默卡死导致 tsx watch 主进程残留(死进程持续占用文件监听句柄)。
process.on('unhandledRejection', (err) => {
  logger.error({ err }, 'Unhandled promise rejection (process still alive, investigate)')
})
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception, exiting to let tsx watch / pm2 restart')
  process.exit(1)
})

start()
