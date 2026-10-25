// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 第三方 AI IDE 账号池巡检 BullMQ Worker(2026-10-22 立,对标码道网关)。
 *
 * 消费 relay-account-pool-queue:
 * - repeat job `sweep`:每 5 分钟一轮(sweepAccountPool)——
 *   token 临期刷新 / unknown 健康定级 / down 账号恢复尝试
 * - repeat job `trae-session-sync`:每 10 分钟一轮 —— 把本机 Trae 客户端会话回灌进
 *   号池(客户端为主策略的取数端;Trae 的 ExchangeToken 会轮换 refreshToken,池主动
 *   刷会把本机客户端顶下线,故 trae 号票未过期时池不刷,新票一律从客户端回灌)
 *
 * 与 relay-health-check-worker 同模式:server.redisForQueue 连接 + onClose 优雅关闭。
 */
import type { FastifyInstance } from 'fastify'
import { spawn } from 'node:child_process'
import { Queue, Worker } from 'bullmq'
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sweepAccountPool } from '../services/relay-account-pool-scheduler.js'
import { registerAllRelayAdapters } from '../services/upstream-adapters/index.js'

export const RELAY_ACCOUNT_POOL_QUEUE_NAME = 'relay-account-pool-queue'

/** 每 5 分钟巡检一次(token 寿命按天计,5 分钟窗口足够提前量) */
const CRON_PATTERN = '*/5 * * * *'
/** 每 10 分钟把本机 Trae 客户端会话回灌进号池(客户端为主策略的取数端;判据在 ts 落库脚本里) */
const TRAE_SYNC_CRON_PATTERN = '*/10 * * * *'
/** 仓根(scripts/sync-trae-client-session.mjs 的落点):workers→src→api→apps→root 共 4 级 */
const REPO_ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')

interface TraeSyncOutcome {
  code: number
  applied: number
  skipped: number
  stderr: string
}

/** 子进程跑回灌编排器;凭据只在父子进程管道里流动,输出面已由脚本脱敏 */
async function runTraeSessionSync(): Promise<TraeSyncOutcome> {
  const script = resolvePath(REPO_ROOT, 'scripts', 'sync-trae-client-session.mjs')
  // 变量名避开 result:消费面契约测试(relay-account-pool-sweep-result)按 `result.<键>`
  // 扫本文件对 sweepAccountPool 产出的取值;子进程结果与之同名异物会被误算进消费面
  // (2026-10-24 实测误报 code/out/err 三键)。
  const proc = await new Promise<{ code: number; out: string; err: string }>((resolve) => {
    const child = spawn(process.execPath, [script, '--json'], {
      cwd: REPO_ROOT,
      windowsHide: true,
      // 显式 stdio(§12g);凭据走 stdin,stdout 只回 JSON 汇总。
      // timeout 比编排器内层(120s)宽,防子进程挂死拖住 worker
      timeout: 180_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = ''
    let err = ''
    child.stdout.on('data', (d: Buffer) => (out += d))
    child.stderr.on('data', (d: Buffer) => (err += d))
    child.on('error', (e) => resolve({ code: 2, out, err: e.message }))
    child.on('exit', (code, signal) => resolve({ code: signal ? 2 : (code ?? 2), out, err }))
  })
  let summary: { applied?: number; skipped?: number } = {}
  try {
    summary = JSON.parse(proc.out) as { applied?: number; skipped?: number }
  } catch {
    /* 输出不是合法 JSON ⇒ 按零计数 + stderr 透出 */
  }
  return {
    code: proc.code,
    applied: summary.applied ?? 0,
    skipped: summary.skipped ?? 0,
    stderr: proc.err.slice(0, 400),
  }
}

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
      await queue.upsertJobScheduler(
        'trae-session-sync-cron',
        { pattern: TRAE_SYNC_CRON_PATTERN },
        {
          name: 'trae-session-sync',
          data: {},
          opts: {
            removeOnComplete: 100,
            removeOnFail: 500,
          },
        },
      )
      server.log.info({ pattern: CRON_PATTERN }, 'relay-account-pool sweep scheduled')
      server.log.info({ pattern: TRAE_SYNC_CRON_PATTERN }, 'trae-session-sync scheduled')
    } catch (err) {
      server.log.error({ err }, 'failed to schedule relay-account-pool sweep')
    }
  })

  const worker = new Worker(
    RELAY_ACCOUNT_POOL_QUEUE_NAME,
    async (job) => {
      if (job.name === 'trae-session-sync') {
        const outcome = await runTraeSessionSync()
        // 退出码 2 = 未判定(本机无 Trae 客户端/信封解不开/tsx 缺失):服务器部署形态
        // 的常态,记 warn 不记 failure(它不该进 BullMQ 失败重试风暴)
        if (outcome.code === 2) {
          server.log.warn({ stderr: outcome.stderr }, 'trae-session-sync 未判定(未写库)')
        } else if (outcome.code !== 0) {
          server.log.error(
            { code: outcome.code, stderr: outcome.stderr },
            'trae-session-sync 落库失败',
          )
        } else {
          server.log.info(
            { applied: outcome.applied, skipped: outcome.skipped },
            'trae-session-sync done',
          )
        }
        return outcome
      }
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
