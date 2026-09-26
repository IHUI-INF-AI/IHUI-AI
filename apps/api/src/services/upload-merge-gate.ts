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
// 进程级单例(生产消费点:routes/chunked-upload.ts 的 merge)
// =============================================================================

let singleton: UploadMergeGate | null = null

function gate(): UploadMergeGate {
  if (!singleton) singleton = createUploadMergeGate()
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

/** 观测出口:活跃合并数 / 排队数 / 峰值 / 最长等待 / 生效上限与其来源。返回快照副本。 */
export function getUploadMergeGateFacts(): UploadMergeGateFacts {
  return gate().facts()
}

/** 仅供测试在案例之间重建单例(重新按当前 env 解析);生产路径不调用。 */
export function resetUploadMergeGateForTests(env?: Record<string, string | undefined>): void {
  singleton = env ? createUploadMergeGate({ env }) : null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
