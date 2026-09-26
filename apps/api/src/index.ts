// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import 'dotenv/config'
import type { Worker } from 'bullmq'
import type { FastifyInstance } from 'fastify'
import { buildServer } from './server.js'
import { startWorkers } from './workers/index.js'
import { startSchedulerWorker } from './workers/scheduler-worker.js'
import { initVendorConfigs } from './lifecycle/init-vendor-configs.js'
import { initOtel } from './plugins/otel.js'
import { isWechatPayConfigured, isPlatformCertConfigured } from './services/wechat-pay.js'
import {
  startAiWorldSyncScheduler,
  stopAiWorldSyncScheduler,
  stopRankingScheduler,
  stopTrendingScheduler,
} from './jobs/ai-world-sync.js'
import { startHotWordsScheduler, stopHotWordsScheduler } from './jobs/hot-words-sync.js'
import { startSourceProbeScheduler, stopSourceProbeScheduler } from './jobs/portal-source-probe.js'
import {
  startPiiRetentionScheduler,
  stopPiiRetentionScheduler,
} from './jobs/pii-retention-cleanup.js'
import {
  startRelayAlertEvaluationScheduler,
  stopRelayAlertEvaluationScheduler,
} from './jobs/relay-alert-rules-evaluation.js'
import { startImageTaskWorker, stopImageTaskWorker } from './workers/image-task-worker.js'
import { startBackupCronScheduler, stopBackupCronScheduler } from './jobs/backup-jobs-cron.js'
import {
  startLiteLLMPriceSyncScheduler,
  stopLiteLLMPriceSyncScheduler,
} from './services/litellm-price-sync.js'
import { startAlgorithmRecordScheduler } from './services/algorithm-record-service.js'
import {
  startAgentAutomationScheduler,
  stopAgentAutomationScheduler,
} from './services/agent-automation-scheduler.js'
import { startPatrolScheduler, stopPatrolScheduler } from './services/patrol-scheduler.js'
import { stopAutoRollbackMonitor } from './services/auto-rollback.js'
import { routineManager } from './services/workspace-ai-service.js'
import { stopScheduledWarmup } from './services/cache-warmup-service.js'
import { stopRelayChannelRouterSweep } from './services/relay-channel-router.js'
import { stopRegistryRateLimitSweep } from './routes/registry-sync.js'
import { stopPoolTracker, registerPoolTrackerCleanup } from './db/index.js'
import { logger } from './utils/logger.js'
import { runShutdownPhases, type ShutdownPhase } from './utils/shutdown-phases.js'

const PORT = Number(process.env.PORT ?? 8802)
const HOST = process.env.HOST ?? '0.0.0.0'

// ── 关停相位超时档位(取值依据,2026-09-27 有序相可靠性票)──────────────────
// SYNC_STOP_MS=1s:以下 stop* 全部是 clearInterval / cron.stop 级别的同步收尾,
//   正常耗时 <1ms;若某相跑满 1s 即已是挂死而非"慢"。
//   (诚实登记:同步函数真死循环时事件循环被占死,任何 JS 超时都救不了 ——
//    本档只对"返回 promise / 未来变异步"的 disposer 有牙,取值只为预算有界。)
// QUEUE_WORKER_MS=5s:BullMQ worker.close() 需与 Redis 往返并等当前 job 结算。
// SERVER_CLOSE_MS=8s:Fastify close 是最重的一步 —— 所有 onClose 钩子(WS 连接、
//   DB 连接池、Redis、poolTracker 等)都挂在它身上统一释放,不拆plugins(禁改面)。
// 总预算 = Σ各相 + 最大单相档(见 defaultShutdownBudgetMs)⇒ 当前组合 ≈ 44s,
// 只有多相同时挂死才会顶到;正常关停 <3s。
const SYNC_STOP_MS = 1_000
const QUEUE_WORKER_MS = 5_000
const SERVER_CLOSE_MS = 8_000

/**
 * listen 的上界。必须大于 server.ts 的 pluginTimeout(120s),否则一次正常的
 * 慢启动会被本守卫误杀。
 */
const LISTEN_DEADLINE_MS = Number(process.env.API_STARTUP_LISTEN_DEADLINE_MS ?? 180_000)
/** listen 失败后留给 shutdown 的时间;到点无条件退出。 */
const SHUTDOWN_DEADLINE_MS = 10_000

/** listen 成功之后置真:此后任何启动尾部异常都不该杀掉一个正在服务的进程。 */
let isListening = false

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms).unref()
  })
}

/**
 * 2026-09-26 07:58 线上哑火:路由插件在**注册期**执行的建表 DDL 抛错,之后的 46 分钟里
 * `sc query` 显示 RUNNING、ws-auto-recovery 照常每分钟写一行日志,8802 却从未 bind,
 * 而日志里既没有 'Failed to start server'(listen 的 catch 没被命中)也没有
 * 'Server listening' —— 即 listen() 这条 promise 既不 resolve 也不 reject。
 * 所以 bind 必须有上界:无论异常是以拒绝形态落进下面的 catch,还是把 avvio 的
 * ready 队列吊住,到点都要带着原因退出非零,交给服务管理器重启。
 * 不许有"进程在、端口没有"这一格。
 */
async function listenWithinDeadline(server: FastifyInstance): Promise<void> {
  let timer: NodeJS.Timeout | undefined
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`server.listen() 未在 ${LISTEN_DEADLINE_MS}ms 内完成`)),
      LISTEN_DEADLINE_MS,
    )
  })
  try {
    await Promise.race([server.listen({ port: PORT, host: HOST }), deadline])
  } finally {
    clearTimeout(timer)
  }
}

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

  // P1 修复(2026-08-02):加 shuttingDown 守卫,防 SIGTERM/SIGINT 重复触发 shutdown;
  // 配合下方 once 注册,二次信号直接走默认行为(强制退出)。
  let shuttingDown = false
  // 2026-09-27 有序相改造(运行期可靠性票):原"一串 try/catch 平铺 + 无超时 await"改为
  // 经 runShutdownPhases 唯一出口执行 —— disposer 顺序**逐字保留**(语义不变),
  // 差别有三:① 每相独立超时,挂死不再阻塞后续相;② 失败/超时/未跑记入清单并由
  // exitCode 承担(旧路径抛错被吞、信号路径仍 exit 0);③ awaited disposer 的 reject
  // 不再冒成 unhandledRejection(旧形状 ⇒ 进程存活不 exit 的假死)。
  const syncStopPhase = (name: string, fn: () => unknown): ShutdownPhase => ({
    name,
    timeoutMs: SYNC_STOP_MS,
    run: fn,
  })
  const shutdown = async (signal: string, requestedExitCode = 0): Promise<void> => {
    if (shuttingDown) return
    shuttingDown = true
    server.log.info({ signal }, 'Shutting down...')
    const phases: ShutdownPhase[] = [
      syncStopPhase('stopAiWorldSyncScheduler', stopAiWorldSyncScheduler),
      syncStopPhase('stopRankingScheduler', stopRankingScheduler),
      syncStopPhase('stopTrendingScheduler', stopTrendingScheduler),
      syncStopPhase('stopSourceProbeScheduler', stopSourceProbeScheduler),
      syncStopPhase('stopLiteLLMPriceSyncScheduler', stopLiteLLMPriceSyncScheduler),
      syncStopPhase('stopHotWordsScheduler', stopHotWordsScheduler),
      syncStopPhase('stopPiiRetentionScheduler', stopPiiRetentionScheduler),
      syncStopPhase('stopRelayAlertEvaluationScheduler', stopRelayAlertEvaluationScheduler),
      syncStopPhase('stopImageTaskWorker', stopImageTaskWorker),
      syncStopPhase('stopBackupCronScheduler', stopBackupCronScheduler),
      syncStopPhase('stopAgentAutomationScheduler', stopAgentAutomationScheduler),
      syncStopPhase('stopPatrolScheduler', stopPatrolScheduler),
      // P0 修复:显式停止后台定时器,不依赖 server.close 钩子顺序
      syncStopPhase('stopAutoRollbackMonitor', stopAutoRollbackMonitor),
      syncStopPhase('routineManager.stopScheduler', () => routineManager.stopScheduler()),
      syncStopPhase('stopScheduledWarmup', stopScheduledWarmup),
      // P2 修复(2026-07-31):显式停止模块作用域 setInterval,不依赖 unref
      syncStopPhase('stopRelayChannelRouterSweep', stopRelayChannelRouterSweep),
      syncStopPhase('stopRegistryRateLimitSweep', stopRegistryRateLimitSweep),
      syncStopPhase('stopPoolTracker', stopPoolTracker),
    ]
    if (workers) {
      phases.push({
        name: 'bullmq-workers-close',
        timeoutMs: QUEUE_WORKER_MS,
        run: () => Promise.allSettled(workers.map((w) => w.close())),
      })
    }
    if (schedulerWorker) {
      phases.push({
        name: 'scheduler-worker-close',
        timeoutMs: QUEUE_WORKER_MS,
        run: () => schedulerWorker.close(),
      })
    }
    phases.push({
      name: 'http-close-pools-release',
      timeoutMs: SERVER_CLOSE_MS,
      run: () => server.close(),
    })
    let exitCode = requestedExitCode
    try {
      const result = await runShutdownPhases({ phases })
      // listen-failure 路径带 1 进来必须保留;相位清单的非零结论与之取 max
      exitCode = Math.max(requestedExitCode, result.exitCode)
    } catch (e) {
      // 相位执行器设计上不应 reject(所有失败已收进清单);兜底再接一层,
      // 防 shutdown() 自身冒成 unhandledRejection ⇒ 复刻"存活不 exit"假死。
      logger.warn('runShutdownPhases unexpected failure', { err: e })
      if (exitCode === 0) exitCode = 1
    }
    process.exit(exitCode)
  }

  try {
    // 2026-08-02 修复:注册 poolTracker onClose 清理,防进程不退出
    registerPoolTrackerCleanup(server)
    await listenWithinDeadline(server)
    isListening = true
    server.log.info(`🚀 API server listening on http://${HOST}:${PORT}`)
  } catch (err) {
    // P0 修复(2026-07-31):listen 失败时必须清理已启动的 workers / schedulers,
    // 否则 BullMQ worker 持有的 ioredis 连接、scheduler cron 句柄会泄露,
    // tsx watch 重启时会累积(死进程句柄 3791 的事故根因之一)。
    server.log.error({ err }, 'Failed to start server')
    // 但清理不能挡住退出:worker.close() / server.close() 自己也要用 Redis·DB,
    // 依赖不可用时它们会挂住,挂住就等于回到"进程在、端口没有"那一格。
    await Promise.race([
      shutdown('listen-failure', 1).catch((e: unknown) => {
        logger.warn('shutdown after listen failure itself failed', { err: e })
      }),
      delay(SHUTDOWN_DEADLINE_MS),
    ])
    process.exit(1)
  }

  // 启动 AI World 数据同步定时任务(每 12 小时一次,默认开启,ENABLE_AI_WORLD_SYNC=false 禁用)
  if (process.env.ENABLE_AI_WORLD_SYNC !== 'false') {
    startAiWorldSyncScheduler()
  }

  // 启动热搜词采集定时任务(每 3 小时一次,默认开启,ENABLE_HOT_WORDS_SYNC=false 禁用)
  if (process.env.ENABLE_HOT_WORDS_SYNC !== 'false') {
    startHotWordsScheduler()
  }

  // 启动门户信源「恢复探测」定时任务(每天 04:30 探测网易/搜狐/36氪等,
  // 一旦恢复公开 feed 自动入源;默认开启,ENABLE_SOURCE_PROBE=false 禁用)
  if (process.env.ENABLE_SOURCE_PROBE !== 'false') {
    startSourceProbeScheduler()
  }

  // 启动 PII 保留期清理定时任务(每天 03:30 滚动删除过期的 crash/behavior/visit 日志类 PII;
  // 默认开启,ENABLE_PII_RETENTION=false 禁用)
  if (process.env.ENABLE_PII_RETENTION !== 'false') {
    startPiiRetentionScheduler()
  }

  // 启动中转站告警规则评估(每 5 分钟,2026-09-16 立;ENABLE_RELAY_ALERT_EVALUATION=false 禁用)
  if (process.env.ENABLE_RELAY_ALERT_EVALUATION !== 'false') {
    startRelayAlertEvaluationScheduler()
  }

  // 启动数据库备份定时调度(读 backup_settings;备份设置页可改,2026-09-16 立)
  void startBackupCronScheduler()

  // 启动异步图片任务 worker(每 30 秒扫描 pending,2026-09-17 立)
  startImageTaskWorker()

  // 启动 LiteLLM 真网 AI 价表同步(启动 30s 后首跑,之后每 24h 一次,
  // 默认开启,AI_LITELLM_PRICE_SYNC_ENABLED=false 禁用)
  if (process.env.AI_LITELLM_PRICE_SYNC_ENABLED !== 'false') {
    startLiteLLMPriceSyncScheduler()
  }

  // 启动用户侧 Agent 定时自动化调度器(60s tick,到点执行 active 的自动化任务)
  startAgentAutomationScheduler()

  // 启动主动巡逻调度器(P3 #40,60s tick,到点执行 active 的巡检任务)
  startPatrolScheduler()

  // 启动网信办「算法/模型备案」清单同步定时任务(每 6 小时刷新全网备案数据;
  // 默认开启,ENABLE_ALGORITHM_RECORD_SYNC=false 禁用)
  if (process.env.ENABLE_ALGORITHM_RECORD_SYNC !== 'false') {
    startAlgorithmRecordScheduler()
  }

  // P1 修复(2026-08-02):改 on 为 once,避免重复触发 shutdown;二次信号走默认强制退出
  process.once('SIGTERM', () => shutdown('SIGTERM'))
  process.once('SIGINT', () => shutdown('SIGINT'))
}

// P0 修复(2026-07-31):全局未捕获错误处理 — 记录明确日志便于诊断,
// 避免进程静默卡死导致 tsx watch 主进程残留(死进程持续占用文件监听句柄)。
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled promise rejection (process still alive, investigate)', { err })
})
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception, exiting to let tsx watch / pm2 restart', { err })
  process.exit(1)
})

start().catch((err: unknown) => {
  // 2026-09-26 线上哑火收口。start() 此前是一个裸 promise:它一 reject 只会命中上面
  // 那个 "process still alive, investigate" 处理器(只记日志、不退出),于是 listen
  // 从未被调用而进程照样活着 —— NSSM 报 RUNNING、健康面零响应。
  // (07:58 那次的日志形态正是这样:只有一行 unhandledRejection,既没有
  //  'Failed to start server' 也没有 'Server listening' —— 说明异常根本没落到下面
  //  listen 的 catch,所以光给 listen 加兜底是不够的,start() 自身这条链必须有人收。)
  // 已经 bind 成功的进程不因尾部异常自杀(那会把可用服务打死);还没 bind 的必须退出
  // 非零交给服务管理器重启 —— 启动阶段只允许"在监听"与"已退出"两种状态。
  if (isListening) {
    logger.error('Startup tail failed after listen (serving continues)', { err })
    return
  }
  logger.error('Startup failed before listen, exiting to let the service manager restart', { err })
  process.exit(1)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
