// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 分片上传「合并阶段」并发闸(2026-09-26,收口分片上传链最后一条登记遗留)
 *
 * 在修什么:`apps/api/src/routes/chunked-upload.ts` 的合并(读全部 .part → 写最终文件 →
 * 流式实算摘要比对 → 删分片目录)是纯磁盘 IO + md5/sha256 CPU 工作,而 API 是同进程服务
 * 全部业务请求的单个 Node 实例。此前**没有任何并发上限** —— 同一时刻可以排队的合并数
 * 不限,故障形态是"第 N 个大文件合并把磁盘队列和哈希计算打满,整站响应变慢",
 * 且事后没有任何一处能回答"当时有几个合并在跑、谁在排队、等了多久"。
 *
 * 三条设计决定(都对应任务书要求,不是口味):
 *  ① **超限排队,不拒绝** —— 拒绝会把正常用户挡在门外;队列等待时长进台账,
 *     首次入队立即向结构化日志喊话,之后按节流窗口复读并带累计数
 *     (形状参考 `apps/cli/src/cloud-run.ts` 的 getCloudRunDegradeFacts:台账 + 首次喊话 +
 *     节流复读;api 侧没有现成的同类出口,故结论一律落 `utils/logger.ts` 既有结构化通道
 *     与调用方注入的 pino(request.log),**不新建第二套 metrics**)。
 *  ② 默认值取 `PROTOCOL_UPLOAD_LIMITS.maxConcurrentUploads`(依据写在那一行注释里),
 *     env 出口 `UPLOAD_MERGE_MAX_CONCURRENCY` 只调数值:`0` = 不限并发,但每次取用都计入
 *     台账并在首次/节流窗口喊出来(warn) —— "不限"是允许的状态,不是静默的状态;
 *     非法值(非正整数)回落默认档并 warn,绝不静默。
 *  ③ 闸是进程内的:多实例部署时每实例各限 N,这与"排队而非拒绝"的语义一致
 *     (单实例内不再放大磁盘争抢),不引入跨进程协调 —— 那是另一票。
 *
 * 消费点唯一:`routes/chunked-upload.ts` 的 merge 处理器用 `withUploadMergeSlot` 包住
 * 整个磁盘段;回归见 `tests/upload-merge-gate.test.ts`(含"摘掉闸 ⇒ 必红"的装车证明)。
 */
import { PROTOCOL_UPLOAD_LIMITS } from './upload-integrity.js'
import { logger } from '../utils/logger.js'
import {
  createRedisMergeSemaphore,
  resolveUploadMergeLease,
  resolveUploadMergeSemaphoreKey,
  type MergeSemaphoreRedis,
  type RedisMergeSemaphore,
} from './upload-merge-redis-semaphore.js'

/** env 覆盖出口键。只调数值;`0` = 显式不限并发(会被喊出来,不会静默)。 */
export const UPLOAD_MERGE_ENV_KEY = 'UPLOAD_MERGE_MAX_CONCURRENCY'
/** 同类喊话的节流窗口:首次立即,之后每个窗口至多一次且带累计数(不刷屏,同 cloud-run)。 */
export const UPLOAD_MERGE_NOTICE_THROTTLE_MS = 60_000

export type UploadMergeLimitSource =
  | 'default'
  | 'env'
  | 'env-unlimited'
  | 'env-invalid-fallback'

export interface ResolvedUploadMergeLimit {
  /** 实际并发上限;unlimited 时为 Number.POSITIVE_INFINITY。 */
  readonly limit: number
  readonly unlimited: boolean
  readonly source: UploadMergeLimitSource
  /** env 原始值(未设置时 undefined),进事实出口,不得静默。 */
  readonly raw: string | undefined
}

/**
 * 纯解析器(无副作用):env 只允许调数值,`0` 是唯一"关闸"形态且单独标源,
 * 非法值回落默认档并留源标记 —— 读事实的人必须能区分"没配"与"配坏了"。
 */
export function resolveUploadMergeLimit(
  env: Record<string, string | undefined> = process.env,
): ResolvedUploadMergeLimit {
  const raw = env[UPLOAD_MERGE_ENV_KEY]
  const fallbackDefault = (source: UploadMergeLimitSource): ResolvedUploadMergeLimit => ({
    limit: PROTOCOL_UPLOAD_LIMITS.maxConcurrentUploads,
    unlimited: false,
    source,
    raw,
  })
  if (raw === undefined || raw.trim() === '') {
    return { limit: PROTOCOL_UPLOAD_LIMITS.maxConcurrentUploads, unlimited: false, source: 'default', raw: undefined }
  }
  const n = Number(raw)
  if (Number.isInteger(n) && n > 0) return { limit: n, unlimited: false, source: 'env', raw }
  if (n === 0) return { limit: Number.POSITIVE_INFINITY, unlimited: true, source: 'env-unlimited', raw }
  return fallbackDefault('env-invalid-fallback')
}

export type UploadMergeNoticeEvent =
  | 'env-override'
  | 'env-invalid-fallback'
  | 'unlimited-mode'
  | 'queue-admission'
  /** 跨进程层首次不可用/抛错 ⇒ 回落进程内闸(每次回落首次立即 warn,不静默)。 */
  | 'degraded-to-in-process'

export interface UploadMergeNotice {
  level: 'info' | 'warn'
  event: UploadMergeNoticeEvent
  message: string
  fields: Record<string, unknown>
}
export type UploadMergeNotifier = (notice: UploadMergeNotice) => void

/** 调用方可注入的 pino 形态日志(request.log 即符合);缺省时落 utils/logger 既有通道。 */
export interface UploadMergeSlotLog {
  warn: (fields: Record<string, unknown>, message: string) => void
}

export interface UploadMergeSlotInfo {
  /** 本次取槽的排队等待毫秒(未排队为 0)。 */
  readonly waitMs: number
}

export interface UploadMergeGateFacts {
  /** 生效并发上限;null = 不限(仅当 env 显式 0)。每次问都是现值,不是建档数。 */
  readonly effectiveLimit: number | null
  readonly unlimited: boolean
  readonly limitSource: UploadMergeLimitSource
  readonly envRaw: string | undefined
  readonly active: number
  readonly queued: number
  readonly peakActive: number
  readonly admittedTotal: number
  readonly queuedTotal: number
  readonly maxWaitMs: number
  readonly lastWaitMs: number
  /** 喊话累计(含被节流吞掉应喊的次数的对账位:noticeSuppressedByThrottle)。 */
  readonly noticesEmitted: number
  readonly noticesThrottled: number
  /**
   * 当前生效的是哪一层 + 为什么(跨进程闸收口票的核心可观测面)。
   * - 'redis':占用/判额走 Redis 计数信号量(跨进程真值);
   * - 'in-process':未配置 Redis,或 Redis 抛错后回落既有进程内闸。
   * 禁止静默降级:走 in-process 时 layerReason 必点名原因(未配置 / 具体错误)。
   */
  readonly activeLayer: 'redis' | 'in-process'
  /** 生效层的可读原因:'redis-unconfigured' / 'redis-active' / 'redis-error: <msg>' 等。 */
  readonly layerReason: string
  /** Redis 取用累计失败次数(每次 EVAL 抛错 +1;回落不重置计数)。 */
  readonly redisFailures: number
  /** Redis 侧当前占用读数(跨进程真值);不在 redis 层时为 null。 */
  readonly crossProcessActive: number | null
}

interface Waiter {
  enqueuedAt: number
  settle: (info: UploadMergeSlotInfo) => void
}

export interface UploadMergeGate {
  runExclusive<T>(
    label: string,
    task: (slot: UploadMergeSlotInfo) => Promise<T>,
    log?: UploadMergeSlotLog,
  ): Promise<T>
  facts(): UploadMergeGateFacts
}

export interface CreateUploadMergeGateOptions {
  env?: Record<string, string | undefined>
  notify?: UploadMergeNotifier
  now?: () => number
  throttleMs?: number
}

/**
 * 有界闸:FIFO 排队 + 槽位交接(release 直接把槽给队首,active 数不变),
 * 排队者等,不等错的 —— runExclusive 从不因"超限"而 reject。
 */
export function createUploadMergeGate(opts: CreateUploadMergeGateOptions = {}): UploadMergeGate {
  const resolved = resolveUploadMergeLimit(opts.env ?? process.env)
  const now = opts.now ?? Date.now
  const throttleMs = opts.throttleMs ?? UPLOAD_MERGE_NOTICE_THROTTLE_MS
  const notify = opts.notify ?? defaultNotifier

  let active = 0
  let peakActive = 0
  let admittedTotal = 0
  let queuedTotal = 0
  let maxWaitMs = 0
  let lastWaitMs = 0
  let noticesEmitted = 0
  let noticesThrottled = 0
  const waiters: Waiter[] = []
  /** 每类事件独立台账:首次立即喊,窗口内静默计数,窗口后复读带累计数。 */
  const noticeLedger = new Map<UploadMergeNoticeEvent, { count: number; lastAtMs: number }>()
  /** 生效上限的"出身"在闸的整个生命周期里只播报一次(它是构造期事实,不是反复发生的事件)。 */
  let startupAnnounced = false

  function shout(event: UploadMergeNoticeEvent, level: 'info' | 'warn', message: string, fields: Record<string, unknown>): void {
    const led = noticeLedger.get(event) ?? { count: 0, lastAtMs: 0 }
    led.count += 1
    const t = now()
    const due = led.count === 1 || t - led.lastAtMs >= throttleMs
    noticeLedger.set(event, led)
    if (!due) {
      noticesThrottled += 1
      return
    }
    led.lastAtMs = t
    noticesEmitted += 1
    notify({ level, event, message, fields: { ...snapshotFields(), ...fields } })
  }

  function defaultNotifier(n: UploadMergeNotice): void {
    // 既有结构化通道(utils/logger:注入过 fastify 走 pino,否则 console),不另立 metrics。
    if (n.level === 'warn') logger.warn(n.message, n.fields)
    else logger.info(n.message, n.fields)
  }

  function snapshotFields(): Record<string, unknown> {
    return {
      gate: 'upload-merge',
      effectiveLimit: resolved.unlimited ? null : resolved.limit,
      unlimited: resolved.unlimited,
      limitSource: resolved.source,
      envKey: UPLOAD_MERGE_ENV_KEY,
      active,
      queued: waiters.length,
    }
  }

  function shoutStartupFacts(): void {
    // env 生效值随事实报出(不得静默);invalid 单独成事件 —— "没配"与"配坏了"必须可区分。
    if (resolved.source === 'env') {
      shout('env-override', 'info', `${UPLOAD_MERGE_ENV_KEY} 覆盖合并并发上限为 ${resolved.limit}`, { envRaw: resolved.raw })
    } else if (resolved.source === 'env-invalid-fallback') {
      shout('env-invalid-fallback', 'warn', `${UPLOAD_MERGE_ENV_KEY}="${resolved.raw}" 非法,回落默认档 ${resolved.limit}(只接受正整数,或 0 = 显式不限)`, { envRaw: resolved.raw })
    }
  }

  function acquire(): Promise<UploadMergeSlotInfo> {
    if (resolved.source === 'env-unlimited') {
      shout('unlimited-mode', 'warn', `${UPLOAD_MERGE_ENV_KEY}=0 ⇒ 合并并发**不设上限**,磁盘 IO 与哈希计算不再受闸约束`, { admitted: admittedTotal + 1 })
    } else if (!startupAnnounced) {
      startupAnnounced = true
      shoutStartupFacts()
    }
    if (resolved.unlimited || active < resolved.limit) {
      active += 1
      if (active > peakActive) peakActive = active
      admittedTotal += 1
      return Promise.resolve({ waitMs: 0 })
    }
    // 超限 ⇒ 排队(拒绝会把正常用户挡在门外)。入队这一事件本身必须可见。
    queuedTotal += 1
    const enqueuedAt = now()
    const waiter: Waiter = { enqueuedAt, settle: () => {} }
    waiters.push(waiter) // 先入列再喊话:台账里的 queued 与 queueDepth 必须同形
    const depth = waiters.length
    shout('queue-admission', 'warn', `合并并发已满(上限 ${resolved.limit}),本次入队等待,队列深度 ${depth}`, { queueDepth: depth, cumulativeQueued: queuedTotal })
    return new Promise<UploadMergeSlotInfo>((settle) => {
      waiter.settle = settle
    })
  }

  function release(): void {
    const w = waiters.shift()
    if (w) {
      // 槽位直接交接给队首:active 不降(一人退一人进),等待时长在这里落账。
      const waitMs = Math.max(0, now() - w.enqueuedAt)
      lastWaitMs = waitMs
      if (waitMs > maxWaitMs) maxWaitMs = waitMs
      admittedTotal += 1
      w.settle({ waitMs })
      return
    }
    active -= 1
  }

  function facts(): UploadMergeGateFacts {
    return {
      effectiveLimit: resolved.unlimited ? null : resolved.limit,
      unlimited: resolved.unlimited,
      limitSource: resolved.source,
      envRaw: resolved.raw,
      active,
      queued: waiters.length,
      peakActive,
      admittedTotal,
      queuedTotal,
      maxWaitMs,
      lastWaitMs,
      noticesEmitted,
      noticesThrottled,
      // 进程内闸本身就是 'in-process' 层:未接 Redis 即这一档,原因如实标注(不得静默)。
      activeLayer: 'in-process' as const,
      layerReason: 'redis-unconfigured',
      redisFailures: 0,
      crossProcessActive: null,
    }
  }

  async function runExclusive<T>(
    label: string,
    task: (slot: UploadMergeSlotInfo) => Promise<T>,
    log?: UploadMergeSlotLog,
  ): Promise<T> {
    const slot = await acquire()
    try {
      return await task(slot)
    } finally {
      release()
      // 有请求上下文时,排队过的槽在调用方日志里再落一行(与台账喊话互补,不重复刷屏)。
      if (slot.waitMs > 0 && log) {
        log.warn(snapshotFields(), `${label}: 合并槽排队 ${slot.waitMs}ms`)
      }
    }
  }

  return { runExclusive, facts }
}

// =============================================================================
// 层叠闸(跨进程有界 + 降级可见):Redis 计数信号量为主,不可用/未配置回落既有进程内闸
// =============================================================================

export type UploadMergeSemaphoreProvider =
  | MergeSemaphoreRedis
  | null
  | (() => MergeSemaphoreRedis | null | Promise<MergeSemaphoreRedis | null>)

export interface CreateLayeredUploadMergeGateOptions extends CreateUploadMergeGateOptions {
  /** Redis 客户端(或其工厂);省略 = 纯进程内闸(等价旧行为,测试默认档)。 */
  redis?: UploadMergeSemaphoreProvider
  /** redis 判额已满时的轮询间隔(ms)。默认 50。 */
  pollIntervalMs?: number
  /** 租约时长(ms);省略则按 UPLOAD_MERGE_REDIS_LEASE_MS / 默认档解析。 */
  leaseMs?: number
  /** owner token(每次进程唯一的持锁者标识);缺省用 pid + 随机段。 */
  ownerToken?: string
}

/** 模块级默认派发器(与进程内闸同一条 utils/logger 通道,不另立 metrics)。 */
function defaultLayerNotifier(n: UploadMergeNotice): void {
  if (n.level === 'warn') logger.warn(n.message, n.fields)
  else logger.info(n.message, n.fields)
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * 有界层叠闸:`UploadMergeGate` 契约不变,runExclusive 仍"排队不拒绝",只是取槽从
 * "进程内 FIFO"升级为"先问 Redis(跨进程真值),问不动才回落进程内 FIFO",且回落必喊。
 *
 * - 未配置 redis(opts.redis 省略)⇒ 逐调用透传给内层进程内闸,facts 也直接取自它,
 *   行为与本票之前**一字不差**(activeLayer='in-process', layerReason='redis-unconfigured')。
 * - 配置了 redis ⇒ 外层自持一份台账(env 出身/超限/排队/降级都经它喊),内层进程内闸只作
 *   降级时的排队原语(notify 置空,避免双重喊话)。任何一次 Redis 取用抛错 ⇒ 落降级闩,
 *   本次及之后回落内层,并首次立即 warn 点名原因(§5e「失败必须响」、守门「未判定不得记绿」同族)。
 */
export function createLayeredUploadMergeGate(
  opts: CreateLayeredUploadMergeGateOptions = {},
): UploadMergeGate {
  const resolved = resolveUploadMergeLimit(opts.env ?? process.env)
  const leaseMs = opts.leaseMs ?? resolveUploadMergeLease(opts.env ?? process.env).leaseMs
  const renewIntervalMs = Math.max(
    1,
    Math.floor(leaseMs / 3),
  )
  const now = opts.now ?? Date.now
  const pollMs = opts.pollIntervalMs ?? 50
  const key = resolveUploadMergeSemaphoreKey(opts.env ?? process.env)
  const owner = opts.ownerToken ?? `pid-${process?.pid ?? 0}-${Math.random().toString(36).slice(2, 10)}`
  const notify = opts.notify ?? defaultLayerNotifier
  const throttleMs = opts.throttleMs ?? UPLOAD_MERGE_NOTICE_THROTTLE_MS

  const hasProvider = opts.redis !== undefined && opts.redis !== null
  // 未配置 provider 时内层闸自己喊(notify 透传);配置了则由外层喊,内层静默作排队原语。
  const inner = createUploadMergeGate({
    ...opts,
    notify: hasProvider ? () => {} : notify,
  })

  const noticeLedger = new Map<UploadMergeNoticeEvent, { count: number; lastAtMs: number }>()
  let outerNoticesEmitted = 0
  let outerNoticesThrottled = 0
  let outerAdmitted = 0
  let outerQueued = 0
  let outerActive = 0
  let outerPeakActive = 0
  let outerMaxWaitMs = 0
  let outerLastWaitMs = 0
  let redisFailures = 0
  let degraded = false
  let degradeReason = ''
  let crossProcessActive: number | null = null
  let startupAnnounced = false
  let semaphore: RedisMergeSemaphore | null = null
  let semaphoreInit: Promise<RedisMergeSemaphore | null> | null = null
  /** 每次占用一个单调递增后缀,与 owner 前缀拼成全局唯一的租约成员名。 */
  let tokenSeq = 0

  function outerShout(event: UploadMergeNoticeEvent, level: 'info' | 'warn', message: string, fields: Record<string, unknown>): void {
    const led = noticeLedger.get(event) ?? { count: 0, lastAtMs: 0 }
    led.count += 1
    const t = now()
    const due = led.count === 1 || t - led.lastAtMs >= throttleMs
    noticeLedger.set(event, led)
    if (!due) {
      outerNoticesThrottled += 1
      return
    }
    led.lastAtMs = t
    outerNoticesEmitted += 1
    notify({
      level,
      event,
      message,
      fields: { gate: 'upload-merge', activeLayer: 'redis', limitSource: resolved.source, ...fields },
    })
  }

  async function ensureSemaphore(): Promise<RedisMergeSemaphore | null> {
    if (!hasProvider) return null
    if (semaphore) return semaphore
    if (!semaphoreInit) {
      semaphoreInit = (async () => {
        try {
          const provided =
            typeof opts.redis === 'function' ? await (opts.redis as () => MergeSemaphoreRedis | null | Promise<MergeSemaphoreRedis | null>)() : opts.redis
          if (!provided) return null
          semaphore = createRedisMergeSemaphore({ redis: provided, key, limit: resolved.limit, leaseMs, now })
          return semaphore
        } catch (err) {
          degradeFromError(err)
          return null
        } finally {
          // 初始化完成后允许后续(如降级恢复)重建;保留 semaphoreInit 引用不重置以省重复连接。
        }
      })()
    }
    return semaphoreInit
  }

  function degradeFromError(err: unknown): void {
    degraded = true
    redisFailures += 1
    degradeReason = `redis-error: ${err instanceof Error ? err.message : String(err)}`
    outerShout('degraded-to-in-process', 'warn', `跨进程合并闸不可用,回落进程内闸(各实例各限 ${Number.isFinite(resolved.limit) ? resolved.limit : '∞'}):${degradeReason}`, {
      degradeReason,
      redisFailures,
    })
  }

  function announceLimit(): void {
    if (startupAnnounced) return
    startupAnnounced = true
    if (resolved.source === 'env') {
      outerShout('env-override', 'info', `${UPLOAD_MERGE_ENV_KEY} 覆盖合并并发上限为 ${resolved.limit}`, { envRaw: resolved.raw })
    } else if (resolved.source === 'env-invalid-fallback') {
      outerShout('env-invalid-fallback', 'warn', `${UPLOAD_MERGE_ENV_KEY}="${resolved.raw}" 非法,回落默认档 ${resolved.limit}(只接受正整数,或 0 = 显式不限)`, { envRaw: resolved.raw })
    }
  }

  async function runExclusive<T>(
    label: string,
    task: (slot: UploadMergeSlotInfo) => Promise<T>,
    log?: UploadMergeSlotLog,
  ): Promise<T> {
    // 未配置 Redis ⇒ 纯透传进程内闸,行为与本票之前一致(它自己已负责超限喊话/排队/台账)。
    if (!hasProvider) return inner.runExclusive(label, task, log)
    // 已降级 ⇒ 之后一律走进程内闸(它兜住排队语义,不因跨进程协调坏掉而挡用户)。
    if (degraded) return inner.runExclusive(label, task, log)
    // 显式不限(env=0)⇒ 两层都不设界;外层这一层必须自己喊 unlimited(与进程内闸各自成话)。
    if (resolved.unlimited) {
      outerShout('unlimited-mode', 'warn', `${UPLOAD_MERGE_ENV_KEY}=0 ⇒ 合并并发**不设上限**(跨进程层同样不判额),磁盘 IO 与哈希计算不再受闸约束`, {})
      return task({ waitMs: 0 })
    }

    const sem = await ensureSemaphore()
    if (!sem) {
      // provider 解析为 null(未就绪 / 明确不提供):回落进程内闸,原因标注为 unconfigured 之外的
      // "provider returned null"。ensureSemaphore 抛错路径已在 degradeFromError 里喊过。
      if (degraded) return inner.runExclusive(label, task, log)
      degraded = true
      degradeReason = 'redis-provider-null'
      outerShout('degraded-to-in-process', 'warn', `跨进程合并闸未就绪(provider 返回 null),回落进程内闸`, { degradeReason })
      return inner.runExclusive(label, task, log)
    }
    announceLimit()

    // 取槽:满了轮询等待(不拒绝);Redis 抛错 ⇒ 就地降级并交给进程内闸兜这次。
    // owner token 每次「占用」唯一(同一进程可并发持多个槽,故不能按进程复用同一 token,
    // 否则 ZSET 里两槽并成一名、size 恒 1 把上限架空);整个占用生命周期(acquire→renew→release)
    // 用同一个 token,轮询重试不换(换了会在 grant 前留下半吊子成员)。
    const startedAt = now()
    let waited = 0
    const slotToken = `${owner}:${(tokenSeq += 1)}`
    for (;;) {
      let granted = false
      try {
        const r = await sem.acquire(slotToken)
        granted = r.granted
        crossProcessActive = r.active
      } catch (err) {
        degradeFromError(err)
        return inner.runExclusive(label, task, log)
      }
      if (granted) break
      if (waited === 0) {
        outerQueued += 1
        outerShout('queue-admission', 'warn', `跨进程合并并发已满(上限 ${resolved.limit}),本次入队等待`, { cumulativeQueued: outerQueued })
      }
      waited += 1
      await sleep(pollMs)
    }

    const waitMs = Math.max(0, now() - startedAt)
    outerLastWaitMs = waitMs
    if (waitMs > outerMaxWaitMs) outerMaxWaitMs = waitMs
    outerAdmitted += 1
    outerActive += 1
    if (outerActive > outerPeakActive) outerPeakActive = outerActive

    // 续租:持有期间按 leaseMs/3 心跳把租约往后推,防一次慢合并被自己的租约踢出造成越限。
    // 续租是 best-effort:失败(含 Redis 挂)不打断正在跑的合并,只是不再依赖该槽(到期自然可复用)。
    let heartbeat: ReturnType<typeof setInterval> | undefined
    if (typeof setInterval === 'function') {
      heartbeat = setInterval(() => {
        void sem.renew(slotToken).catch(() => {
          /* 续租失败:不冒泡、不打断任务,租约到期后该槽自动可被复用 */
        })
      }, renewIntervalMs)
      // Node 定时器有 unref;浏览器 setInterval 返回 number 无 unref —— 能力检测而非假定。
      const maybeUnref = heartbeat as unknown as { unref?: () => void }
      if (typeof maybeUnref.unref === 'function') maybeUnref.unref()
    }
    try {
      return await task({ waitMs })
    } finally {
      if (heartbeat) clearInterval(heartbeat)
      outerActive -= 1
      try {
        await sem.release(slotToken)
        crossProcessActive = await sem.count().catch(() => crossProcessActive)
      } catch (err) {
        // release 失败不改变本次任务结果:槽会因租约到期被回收,绝不会永久占位。
        degradeFromError(err)
      }
      if (waitMs > 0 && log) {
        log.warn({ gate: 'upload-merge', activeLayer: 'redis', waitMs }, `${label}: 跨进程合并槽排队 ${waitMs}ms`)
      }
    }
  }

  function facts(): UploadMergeGateFacts {
    if (!hasProvider || degraded) {
      // 进程内闸这一层的读数即当前真值(未接 Redis,或 Redis 已回落)。
      const f = inner.facts()
      return {
        ...f,
        activeLayer: 'in-process',
        layerReason: !hasProvider ? 'redis-unconfigured' : degradeReason || 'redis-degraded',
        redisFailures,
        crossProcessActive: null,
      }
    }
    // 已配置 provider 且未降级,但尚未跑过任何 redis 取用(启动即读 facts):仍报 redis 层待命。
    return {
      effectiveLimit: resolved.unlimited ? null : resolved.limit,
      unlimited: resolved.unlimited,
      limitSource: resolved.source,
      envRaw: resolved.raw,
      active: outerActive,
      queued: outerQueued > outerAdmitted ? outerQueued - outerAdmitted : 0,
      peakActive: outerPeakActive,
      admittedTotal: outerAdmitted,
      queuedTotal: outerQueued,
      maxWaitMs: outerMaxWaitMs,
      lastWaitMs: outerLastWaitMs,
      noticesEmitted: outerNoticesEmitted + inner.facts().noticesEmitted,
      noticesThrottled: outerNoticesThrottled + inner.facts().noticesThrottled,
      activeLayer: 'redis',
      layerReason: resolved.unlimited ? 'redis-bypassed-unlimited' : 'redis-active',
      redisFailures,
      crossProcessActive,
    }
  }

  return { runExclusive, facts }
}

// =============================================================================
// 进程级单例(生产消费点:routes/chunked-upload.ts 的 merge)
// =============================================================================

let singleton: UploadMergeGate | null = null

/**
 * 生产环境是否应接 Redis:测试环境(NODE_ENV==='test')显式关闭,保证既有闸级/路由级
 * 回归(§5 测试隔离铁律:不得真连库)与旧行为逐字一致;可用 UPLOAD_MERGE_DISABLE_REDIS=1
 * 显式关停。REDIS_URL 缺省时不接(降级可见,而非静默)。
 */
function shouldEnableRedisLayer(env: Record<string, string | undefined>): boolean {
  if (env.NODE_ENV === 'test') return false
  if (env.UPLOAD_MERGE_DISABLE_REDIS === '1') return false
  return true
}

/** 懒建一条 ioredis 连接(仅非测试环境),给计数信号量当 EVAL 载体。 */
async function makeProductionSemaphoreRedis(): Promise<MergeSemaphoreRedis | null> {
  const url = process.env.REDIS_URL || 'redis://localhost:8811'
  const mod = (await import('ioredis')) as { default?: new (url: string, opts: Record<string, unknown>) => MergeSemaphoreRedis }
  const Ctor = mod.default ?? (mod as unknown as new (url: string, opts: Record<string, unknown>) => MergeSemaphoreRedis)
  // lazyConnect 由调用方首次命令触发;offline 队列关闭 ⇒ 未连接时命令快速 reject(被外层捕获并降级),
  // 而不是把取用挂进无限等待队列(那等于把"降级可见"换成"提交卡死")。
  return new Ctor(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 1500,
  })
}

function gate(): UploadMergeGate {
  if (!singleton) {
    singleton = createLayeredUploadMergeGate({
      redis: shouldEnableRedisLayer(process.env) ? makeProductionSemaphoreRedis : undefined,
    })
  }
  return singleton
}

/** 合并阶段磁盘段的唯一入口:超限排队,不拒绝。 */
export function withUploadMergeSlot<T>(
  label: string,
  task: (slot: UploadMergeSlotInfo) => Promise<T>,
  opts?: { log?: UploadMergeSlotLog },
): Promise<T> {
  return gate().runExclusive(label, task, opts?.log)
}

/**
 * 观测出口:活跃合并数 / 排队数 / 峰值 / 最长等待 / 生效上限与其来源 +
 * **当前生效层('redis' | 'in-process')与其原因**。返回快照副本。
 */
export function getUploadMergeGateFacts(): UploadMergeGateFacts {
  return gate().facts()
}

/**
 * 仅供测试在案例之间重建单例(重新按当前 env 解析);生产路径不调用。
 * - 不带 `redis` ⇒ 纯进程内闸(既有回归逐字不变,默认不连库)。
 * - 带 `redis`(内存假实现)⇒ 层叠闸走跨进程层,供本票的跨进程/降级/租约回归注入。
 */
export function resetUploadMergeGateForTests(
  env?: Record<string, string | undefined>,
  opts?: { redis?: UploadMergeSemaphoreProvider; pollIntervalMs?: number; leaseMs?: number; ownerToken?: string },
): void {
  if (!env && !opts) {
    singleton = null
    return
  }
  singleton = createLayeredUploadMergeGate({ env, ...opts })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
