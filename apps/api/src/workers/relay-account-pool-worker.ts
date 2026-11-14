// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 第三方 AI IDE 账号池巡检 BullMQ Worker(2026-10-22 立,对标码道网关)。
 *
 * 消费 relay-account-pool-queue:
 * - repeat job `sweep`:每 5 分钟一轮(sweepAccountPool)——
 *   token 临期刷新 / unknown 健康定级 / down 账号恢复尝试;
 *   2026-11-10 C 档:sweep 前当场探测各平台客户端三态(probeKeepAliveClientStates,复用
 *   工具层探测器),结果作为参数传入 scheduler —— 永久保活号只有在「明确没在跑且心跳
 *   过 TTL」时才被池接管,量不到一律让位(顶掉机主客户端 = 不可逆掉线)。
 * - repeat job `trae-session-sync`:每 10 分钟一轮 —— 把本机 Trae 客户端会话回灌进
 *   号池(客户端为主策略的取数端;Trae 的 ExchangeToken 会轮换 refreshToken,池主动
 *   刷会把本机客户端顶下线,故 trae 号票未过期时池不刷,新票一律从客户端回灌)
 *
 * WorkBuddy 定时腿已于 2026-11-03 撤除:API 进程以 LocalSystem 身份运行,结构上读不到
 * 交互用户的 auth 文件,每 10 分钟必然失败一次,属纯噪声;上游续期本就由服务端负责
 * (renewalPolicyOf('workbuddy')='server',每 5 分钟 sweep 续票 + 空闲保活),保活不依赖客户端。
 * 脚本与 runWorkbuddySessionSync 出口保留为一次性手工工具,不再自动调度。
 *
 * 与 relay-health-check-worker 同模式:server.redisForQueue 连接 + onClose 优雅关闭。
 */
import type { FastifyInstance } from 'fastify'
import { spawn } from 'node:child_process'
import { Queue, Worker } from 'bullmq'
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { sweepAccountPool } from '../services/relay-account-pool-scheduler.js'
import { describeQueueIsolation, relayAccountPoolQueueName } from '../services/relay-queue-name.js'
import {
  decideUnjudgedLog,
  unjudgedReasonOf,
  type UnjudgedNoiseState,
} from '../services/relay-session-sync-noise.js'
import { registerAllRelayAdapters } from '../services/upstream-adapters/index.js'

/** 队列**基础名**;真实队列名由 relay-queue-name 按库身份解析(隔离库加后缀) */
export const RELAY_ACCOUNT_POOL_QUEUE_NAME = 'relay-account-pool-queue'

/** 每 5 分钟巡检一次(token 寿命按天计,5 分钟窗口足够提前量) */
const CRON_PATTERN = '*/5 * * * *'
/** 每 10 分钟把本机 Trae 客户端会话回灌进号池(客户端为主策略的取数端;判据在 ts 落库脚本里) */
const TRAE_SYNC_CRON_PATTERN = '*/10 * * * *'
/** 每 10 分钟把本机 Qoder 登录态回灌进号池(同族:refreshToken 轮换由客户端主导,池只跟随) */
const QODER_SYNC_CRON_PATTERN = '*/10 * * * *'
/**
 * 已撤除的 WorkBuddy 定时注册 id。
 *
 * BullMQ 的 job scheduler 存在 Redis 里,删掉注册代码不会自动消失 —— 遗留项仍会每 10 分钟
 * 投递一条 worker 已不再处理的作业。启动时显式 remove 一次(幂等:不存在时返回 false),
 * 让代码与 Redis 两侧的注册真正收敛。
 */
const RETIRED_WORKBUDDY_SCHEDULER_ID = 'workbuddy-session-sync-cron'
/** 每 10 分钟把本机 MiniMax Code(mcode)会话回灌进号池(mcode 轮换票面,池侧无刷新能力只能跟随) */
const MINIMAX_SYNC_CRON_PATTERN = '*/10 * * * *'
/** 每 10 分钟把本机 Loomy 登录态回灌进号池(Loomy 适配器无 refreshToken,池侧只能跟随) */
const LOOMY_SYNC_CRON_PATTERN = '*/10 * * * *'
/** 每 10 分钟把本机 ZCode 登录态回灌进号池(ZCode 适配器不实现 refreshToken,池侧只能跟随) */
const ZCODE_SYNC_CRON_PATTERN = '*/10 * * * *'
/** 每 10 分钟把本机小浣熊登录态回灌进号池(小浣熊适配器无 refreshToken,池侧只能跟随) */
const RACCOON_SYNC_CRON_PATTERN = '*/10 * * * *'
/** 仓根(scripts/sync-*-client-session.mjs 的落点):workers→src→api→apps→root 共 4 级 */
const REPO_ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')

/**
 * 同因「未判定」降噪状态(进程内;重启即清,首轮必 warn)。
 * qoder 腿在服务身份(LocalSystem)下结构上读不到交互用户的 APPDATA/DPAPI,
 * 每回灌轮原因一字不变 —— 不降噪就是每 10 分钟一条同文 warn。判据见
 * services/relay-session-sync-noise.ts(单一真相源),本处只持有状态。
 */
const unjudgedNoise = new Map<string, UnjudgedNoiseState>()
const UNJUDGED_WARN_WINDOW_MS = Number(
  process.env.RELAY_SYNC_UNJUDGED_WARN_WINDOW_MS || 6 * 60 * 60 * 1000,
)

interface ClientSyncOutcome {
  code: number
  applied: number
  skipped: number
  stderr: string
}

/** 子进程跑回灌编排器;凭据只在父子进程管道里流动,输出面已由脚本脱敏 */
async function runClientSessionSync(scriptName: string): Promise<ClientSyncOutcome> {
  const script = resolvePath(REPO_ROOT, 'scripts', scriptName)
  const result = await new Promise<{ code: number; out: string; err: string }>((resolve) => {
    const child = spawn(process.execPath, [script, '--json'], {
      cwd: REPO_ROOT,
      windowsHide: true,
      // 显式 stdio(§12g);凭据走 stdin,stdout 只回 JSON 汇总。
      // 外层窗口必须 ≥ 编排器两段内层之和(捕获 240s + 落库 240s)。原值 180s 比两段之和还小,
      // 而它自己的注释写着「比编排器内层(120s)宽」—— 那个前提从写下那天起就不成立:外层先杀父,
      // Windows 上又不连带杀孙,实测留下过孤儿子进程。抬到 540s(= 480 + 启动/心跳探测 60,
      // 且刻意 <600s 的每 10 分钟节拍,不让一轮跨拍叠罗汉)即是这一格的结构性收口。
      // 数值单源在 scripts/lib/sync-stage-timeouts.mjs;不做跨语言 import(ts 引仓库根 .mjs 会出
      // include 根),同值由 scripts/tests/sync-stage-timeouts.test.mjs 逐字钉住 —— 靠测试不靠约定。
      timeout: 540_000,
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
    summary = JSON.parse(result.out) as { applied?: number; skipped?: number }
  } catch {
    /* 输出不是合法 JSON ⇒ 按零计数 + stderr 透出 */
  }
  return {
    code: result.code,
    applied: summary.applied ?? 0,
    skipped: summary.skipped ?? 0,
    stderr: result.err.slice(0, 400),
  }
}

/**
 * 任务中心手动触发的出口(2026-10-29 补回,同日补 workbuddy)。
 * 共用助手重构把这两个按名取用的出口摘掉了,而 relay-task-center.ts 仍按名 import
 * ⇒ 运行时 `runTraeSessionSync is not a function`,管理面「手动触发」直接 500
 * (测试 mock 了同名键,所以 mock 面一直是绿的)。
 */
export const runTraeSessionSync = (): Promise<ClientSyncOutcome> =>
  runClientSessionSync('sync-trae-client-session.mjs')
export const runQoderSessionSync = (): Promise<ClientSyncOutcome> =>
  runClientSessionSync('sync-qoder-client-session.mjs')
export const runWorkbuddySessionSync = (): Promise<ClientSyncOutcome> =>
  runClientSessionSync('sync-workbuddy-client-session.mjs')
export const runMinimaxSessionSync = (): Promise<ClientSyncOutcome> =>
  runClientSessionSync('sync-minimax-client-session.mjs')
export const runLoomySessionSync = (): Promise<ClientSyncOutcome> =>
  runClientSessionSync('sync-loomy-client-session.mjs')
export const runZcodeSessionSync = (): Promise<ClientSyncOutcome> =>
  runClientSessionSync('sync-zcode-client-session.mjs')
export const runRaccoonSessionSync = (): Promise<ClientSyncOutcome> =>
  runClientSessionSync('sync-raccoon-client-session.mjs')

/**
 * 接管前「当场再探测一次客户端」的调用方侧实现(2026-11-10 C 档)。
 *
 * 立因:scheduler 本体不许 spawn 进程探测(判据留服务层、副作用留调用方),而 api 常驻
 * 这头的调用方就是本 worker —— 原语义只看心跳 TTL,回灌腿(每 10 分钟)与接管轮(每 5 分钟)
 * 同 Worker concurrency:1 且**没有先后保证**,心跳一陈旧就顶掉机主正在用的 Qoder(不可逆)。
 *
 * 实现:派生一枚短命 node 子进程,import 两条回灌腿已导出的三态探测器
 * (probeClientActive / __test__.probeQoderClientActive,判据单源在工具层,本层零复算),
 * 收 JSON。任何失败/超时/解析不出 ⇒ 空表 ⇒ 逐平台按 null = 未判定 ⇒ scheduler 侧
 * keepAliveForeverVerdictOf 按「在跑」让位 —— 失效方向恒为「多让」,绝不因量不到而接管。
 * 探测的 provider = trae/qoder(工具层探测器只有这两族)+ minimax(2026-11-10 补接,
 * 探测器同在那条回灌腿里,原先漏接 ⇒ 该平台恒「未判定」⇒ 恒让位 ⇒ 永不续期);
 * 其余平台缺键 ⇒ null;`server` 续期档的平台由 scheduler 侧放行(见 keepAliveForeverVerdictOf),
 * `client-first` 档仍按「在跑」让位。
 */
const CLIENT_PROBE_TIMEOUT_MS = 30_000

export async function probeKeepAliveClientStates(): Promise<Record<string, boolean | null>> {
  const traeUrl = pathToFileURL(
    resolvePath(REPO_ROOT, 'scripts', 'sync-trae-client-session.mjs'),
  ).href
  const qoderUrl = pathToFileURL(
    resolvePath(REPO_ROOT, 'scripts', 'sync-qoder-client-session.mjs'),
  ).href
  const minimaxUrl = pathToFileURL(
    resolvePath(REPO_ROOT, 'scripts', 'sync-minimax-client-session.mjs'),
  ).href
  const src =
    'const out={};' +
    `import(${JSON.stringify(traeUrl)}).then((m)=>{out.trae=m.probeClientActive();})` +
    '.catch(()=>{out.trae=null;})' +
    `.then(()=>import(${JSON.stringify(qoderUrl)})).then((m)=>{out.qoder=m.__test__.probeQoderClientActive();})` +
    '.catch(()=>{out.qoder=null;})' +
    // minimax(2026-11-10 补):探测器在回灌腿里早就导出,原先没接 ⇒ 该平台恒「未判定」= 恒让位
    // = 永不续期(与薄壳 scripts/relay-account-keepalive.mjs 的 probe 表必须同形,两处同源)。
    `.then(()=>import(${JSON.stringify(minimaxUrl)})).then((m)=>{out.minimax=m.probeMinimaxClientActive();})` +
    '.catch(()=>{out.minimax=null;})' +
    '.then(()=>{process.stdout.write(JSON.stringify(out));});'
  return await new Promise<Record<string, boolean | null>>((resolveP) => {
    const child = spawn(process.execPath, ['-e', src], {
      cwd: REPO_ROOT,
      windowsHide: true,
      // §12g:派生进程必须显式 stdio;本探测不吃 stdin,要回读 stdout
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: CLIENT_PROBE_TIMEOUT_MS,
    })
    let out = ''
    child.stdout.on('data', (d: Buffer) => (out += d))
    child.on('error', () => resolveP({}))
    child.on('exit', (code) => {
      if (code !== 0) {
        resolveP({})
        return
      }
      try {
        const parsed = JSON.parse(out) as Record<string, unknown>
        const norm: Record<string, boolean | null> = {}
        for (const [k, v] of Object.entries(parsed)) {
          norm[k] = v === true ? true : v === false ? false : null
        }
        resolveP(norm)
      } catch {
        resolveP({})
      }
    })
  })
}

export function startRelayAccountPoolWorker(server: FastifyInstance): Worker {
  registerAllRelayAdapters()

  const connection = server.redisForQueue
  if (!connection) {
    server.log.warn('relay-account-pool-worker: Redis 不可用,Worker 未启动')
    return {} as Worker
  }

  // 队列属于数据库:隔离库实例只能消费自己后缀的队列,否则会跨库抢作业
  // (2026-10-24~10-31 事故:隔离栈继承主库 REDIS_URL,抢走主库 sweep 并在缺列库上全轮失败)
  const queueName = relayAccountPoolQueueName()
  server.log.info(describeQueueIsolation(), 'relay-account-pool queue resolved')

  const queue = new Queue(queueName, { connection })
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
      await queue.upsertJobScheduler(
        'qoder-session-sync-cron',
        { pattern: QODER_SYNC_CRON_PATTERN },
        {
          name: 'qoder-session-sync',
          data: {},
          opts: {
            removeOnComplete: 100,
            removeOnFail: 500,
          },
        },
      )
      await queue.upsertJobScheduler(
        'minimax-session-sync-cron',
        { pattern: MINIMAX_SYNC_CRON_PATTERN },
        {
          name: 'minimax-session-sync',
          data: {},
          opts: {
            removeOnComplete: 100,
            removeOnFail: 500,
          },
        },
      )
      // 2026-11-12 接车:Loomy / ZCode / 小浣熊三条同型回灌腿(适配器均无 refreshToken,
      // 客户端为主策略的取数端;与 trae/qoder/minimax 同族)。
      await queue.upsertJobScheduler(
        'loomy-session-sync-cron',
        { pattern: LOOMY_SYNC_CRON_PATTERN },
        {
          name: 'loomy-session-sync',
          data: {},
          opts: { removeOnComplete: 100, removeOnFail: 500 },
        },
      )
      await queue.upsertJobScheduler(
        'zcode-session-sync-cron',
        { pattern: ZCODE_SYNC_CRON_PATTERN },
        {
          name: 'zcode-session-sync',
          data: {},
          opts: { removeOnComplete: 100, removeOnFail: 500 },
        },
      )
      await queue.upsertJobScheduler(
        'raccoon-session-sync-cron',
        { pattern: RACCOON_SYNC_CRON_PATTERN },
        {
          name: 'raccoon-session-sync',
          data: {},
          opts: { removeOnComplete: 100, removeOnFail: 500 },
        },
      )
      // WorkBuddy 定时腿已撤除:显式移除可能的遗留注册(BullMQ 的 scheduler 存于 Redis,
      // 删代码不会自动清理),避免它继续每 10 分钟投递 worker 已不再处理的幽灵作业。
      try {
        const removed = await queue.removeJobScheduler(RETIRED_WORKBUDDY_SCHEDULER_ID)
        if (removed) {
          server.log.info(
            { schedulerId: RETIRED_WORKBUDDY_SCHEDULER_ID },
            'workbuddy-session-sync 遗留定时注册已移除',
          )
        }
      } catch (err) {
        server.log.warn(
          { err },
          '移除 workbuddy-session-sync 遗留定时注册失败(该腿已停用,不影响其它调度)',
        )
      }
      server.log.info({ pattern: CRON_PATTERN }, 'relay-account-pool sweep scheduled')
      server.log.info({ pattern: TRAE_SYNC_CRON_PATTERN }, 'trae-session-sync scheduled')
      server.log.info({ pattern: QODER_SYNC_CRON_PATTERN }, 'qoder-session-sync scheduled')
      server.log.info({ pattern: MINIMAX_SYNC_CRON_PATTERN }, 'minimax-session-sync scheduled')
      server.log.info({ pattern: LOOMY_SYNC_CRON_PATTERN }, 'loomy-session-sync scheduled')
      server.log.info({ pattern: ZCODE_SYNC_CRON_PATTERN }, 'zcode-session-sync scheduled')
      server.log.info({ pattern: RACCOON_SYNC_CRON_PATTERN }, 'raccoon-session-sync scheduled')
    } catch (err) {
      server.log.error({ err }, 'failed to schedule relay-account-pool sweep')
    }
  })

  const worker = new Worker(
    queueName,
    async (job) => {
      if (
        job.name === 'trae-session-sync' ||
        job.name === 'qoder-session-sync' ||
        job.name === 'minimax-session-sync' ||
        job.name === 'loomy-session-sync' ||
        job.name === 'zcode-session-sync' ||
        job.name === 'raccoon-session-sync'
      ) {
        // 脚本名单源在命名出口里,调度分支与手动触发口走同一条路
        const outcome = await (job.name === 'qoder-session-sync'
          ? runQoderSessionSync()
          : job.name === 'minimax-session-sync'
            ? runMinimaxSessionSync()
            : job.name === 'loomy-session-sync'
              ? runLoomySessionSync()
              : job.name === 'zcode-session-sync'
                ? runZcodeSessionSync()
                : job.name === 'raccoon-session-sync'
                  ? runRaccoonSessionSync()
                  : runTraeSessionSync())
        // 退出码 2 = 未判定(本机无对应客户端/解密失败/tsx 缺失):服务器部署形态
        // 的常态,记 warn 不记 failure(它不该进 BullMQ 失败重试风暴)
        if (outcome.code === 2) {
          const reason = unjudgedReasonOf(outcome.stderr)
          const decision = decideUnjudgedLog(
            unjudgedNoise.get(job.name),
            reason,
            Date.now(),
            UNJUDGED_WARN_WINDOW_MS,
          )
          unjudgedNoise.set(job.name, decision.state)
          if (decision.warn) {
            server.log.warn(
              {
                stderr: outcome.stderr,
                reason,
                // 被压下的轮数随下一次 warn 一并报出,避免"降噪"把持续性藏起来
                suppressedSinceLastWarn: decision.suppressed,
              },
              `${job.name} 未判定(未写库)`,
            )
          } else {
            server.log.debug(
              { reason, suppressed: decision.suppressed },
              `${job.name} 未判定(同因已记过,降噪)`,
            )
          }
        } else if (outcome.code !== 0) {
          server.log.error({ code: outcome.code, stderr: outcome.stderr }, `${job.name} 落库失败`)
        } else {
          server.log.info(
            { applied: outcome.applied, skipped: outcome.skipped },
            `${job.name} done`,
          )
        }
        return outcome
      }
      if (job.name !== 'sweep') {
        server.log.warn({ jobName: job.name }, 'relay-account-pool: unknown job')
        return null
      }
      // C 档(2026-11-10):接管前当场再探一次客户端 —— 探测结果由调用方(本 worker)传入,
      // scheduler 不自己 spawn。探测失败/取不到 ⇒ 平台按 null ⇒ 永久保活号本轮让位(多让)。
      const clientStates = await probeKeepAliveClientStates()
      const result = await sweepAccountPool((providerCode) => clientStates[providerCode] ?? null)
      // 日志取值面 = sweepAccountPool 的产出面(AccountPoolSweepResult 的键),不得多读:
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
          // 永久保活让位计数(2026-11-10 C 档):逐枚原因在 scheduler 侧日志,这里是轮级读数
          foreverDeferred: result.foreverDeferred,
          // refresh 绝对寿命提前预警:最早到期 < 7 天时 warn 非空(与 logger.warn 同口径)
          refreshExpiresAt: result.refreshExpiresAt,
          refreshExpiryWarn: result.refreshExpiryWarn,
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

  server.log.info({ queue: queueName }, 'relay-account-pool worker started')

  return worker
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
