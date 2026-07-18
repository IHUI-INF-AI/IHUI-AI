import 'dotenv/config'
import type { Worker } from 'bullmq'
import { buildServer } from './server.js'
import { startWorkers } from './workers/index.js'
import { startSchedulerWorker } from './workers/scheduler-worker.js'
import { initVendorConfigs } from './lifecycle/init-vendor-configs.js'
import { initOtel } from './plugins/otel.js'
import { isWechatPayConfigured, isPlatformCertConfigured } from './services/wechat-pay.js'

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
  console.error('❌ 生产环境微信支付配置不完整,启动中止:')
  for (const e of errors) console.error(`   - ${e}`)
  console.error('   参考 .env.production.example 补齐证书配置(证书放置项目内 cert/ 目录)')
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
