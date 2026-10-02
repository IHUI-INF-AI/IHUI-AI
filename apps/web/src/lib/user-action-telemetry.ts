// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * UI 动作遥测 span 生命周期 + catalog allowlist + 有界队列(2026-09-30 立,吸收批次 74 票 G-977990)。
 *
 * 机制吸收自上游 UI 动作 trace(上游 packages/ui/src/lib/userActionTelemetry.ts:93-273 与
 * userActionTraceCatalog.ts:3-165),catalog 表内容按本仓域自拟,字段名中性自命名。
 *
 * 机制要点:
 * - featureId × action 白名单 catalog(core + settings 两张表)+ 总开关 + 分组开关 +
 *   采样,三重门未命中返回共享 NOOP 句柄(零开销:不建 active、不进队列);
 * - start 返回 complete/fail/reject/cancel 句柄,超时未收口自动记 abandoned
 *   (防句柄泄漏导致 active 无界增长);
 * - 完成队列有界 256:满即丢并计 droppedSinceLastFlush,随下一批上报后清零;
 * - 切批按 span 数与估算字节(JSON 长度 × 2,粗估 UTF-16→UTF-8 膨胀)双重上限,
 *   单条就超限的 span 丢弃并计数,绝不发出超限批次;
 * - flush promise 去重 + 尾随定时器(低流量时不频繁发小批);
 * - 传输失败吞掉(遥测严格旁路,不回压不重试,不影响用户操作结果);
 * - shutdown 把 active 全记 abandoned 再 flush(退出前不丢现场)。
 */

export type ActionTraceGroup = 'core' | 'settings'

export type ActionOutcome = 'completed' | 'failed' | 'rejected' | 'cancelled' | 'abandoned' | 'noop'

export type ActionOperationKind =
  'navigation' | 'preference' | 'command' | 'management' | 'destructive'

export type ActionTrigger = 'pointer' | 'keyboard' | 'programmatic'

/** core 域动作白名单(featureId → 动作列表;本仓域自拟样例表,增量维护)。 */
export const CORE_ACTION_FEATURES = {
  'workspace.session': ['open', 'create', 'rename', 'archive', 'delete'],
  'chat.composer': ['send', 'stop', 'attach_file'],
  'chat.turn': ['retry', 'fork', 'copy'],
  'workbench.file': ['open', 'refresh'],
} as const

/** settings 域动作白名单。 */
export const SETTINGS_ACTION_FEATURES = {
  'settings.appearance': ['change_theme'],
  'settings.model': ['change_default_model'],
  'settings.notification': ['toggle_sound'],
} as const

export interface ActionCatalogEntry {
  featureId: string
  action: string
  group: ActionTraceGroup
  operationKind: ActionOperationKind
  /** 动作级默认超时:超时未收口记 abandoned。 */
  timeoutMs: number
}

function operationKindFor(featureId: string, action: string): ActionOperationKind {
  if (action === 'delete') return 'destructive'
  if (action.startsWith('open') || featureId.endsWith('navigation')) return 'navigation'
  if (featureId.startsWith('settings.')) return 'preference'
  if (featureId.startsWith('chat.') || featureId.startsWith('workspace.')) return 'command'
  return 'management'
}

type CatalogDefinition = Readonly<Record<string, readonly string[]>>

function entriesFrom(
  definitions: CatalogDefinition,
  group: ActionTraceGroup,
): ActionCatalogEntry[] {
  return Object.entries(definitions).flatMap(([featureId, actions]) =>
    actions.map((action) => ({
      featureId,
      action,
      group,
      operationKind: operationKindFor(featureId, action),
      timeoutMs: 30_000,
    })),
  )
}

export const ACTION_CATALOG: readonly ActionCatalogEntry[] = [
  ...entriesFrom(CORE_ACTION_FEATURES, 'core'),
  ...entriesFrom(SETTINGS_ACTION_FEATURES, 'settings'),
]

const ACTION_CATALOG_BY_KEY = new Map(
  ACTION_CATALOG.map((entry) => [`${entry.featureId}:${entry.action}`, entry]),
)

/** catalog allowlist 查询:未命中返回 undefined(调用方得到 NOOP)。 */
export function resolveActionCatalogEntry(
  featureId: string,
  action: string,
): ActionCatalogEntry | undefined {
  return ACTION_CATALOG_BY_KEY.get(`${featureId}:${action}`)
}

export interface ActionTraceConfig {
  enabled: boolean
  enabledGroups: ActionTraceGroup[]
  /** 0..1,>= 判定:random() >= sampleRatio 则丢弃。 */
  sampleRatio: number
}

export interface ActionResult {
  resultSource?: string
  stateAfter?: string
  /** 仅失败收口携带;complete/reject 恒为缺省。 */
  failureStage?: string
}

export interface ActionFailure extends ActionResult {
  failureStage: string
}

export interface ActionHandle {
  complete(result?: ActionResult): void
  fail(failure: ActionFailure): void
  reject(result?: ActionResult): void
  cancel(): void
  noop(): void
}

export interface ActionSpanAttributes {
  featureId: string
  action: string
  group: ActionTraceGroup
  operationKind: ActionOperationKind
  trigger: ActionTrigger
  outcome: ActionOutcome
  actionId: string
  failureStage?: string
  resultSource?: string
  stateAfter?: string
}

export interface ActionSpan {
  traceId: string
  spanId: string
  name: 'ui_action'
  startedAt: number
  endedAt: number
  durationMs: number
  status: 'ok' | 'error'
  attributes: ActionSpanAttributes
}

export interface ActionTraceBatch {
  version: 1
  instanceId: string
  sequence: number
  /** 自上次成功发批以来因有界队列/超限丢弃的 span 数。 */
  droppedCount: number
  spans: ActionSpan[]
}

/** 共享 NOOP 句柄:三重门未命中时零开销返回,不建任何状态。 */
export const ACTION_HANDLE_NOOP: ActionHandle = Object.freeze({
  complete() {},
  fail() {},
  reject() {},
  cancel() {},
  noop() {},
})

export interface UserActionTelemetryTimers {
  set(fn: () => void, ms: number): unknown
  clear(handle: unknown): void
}

export interface UserActionTelemetryLimits {
  /** 完成队列上限:满即丢并计数。 */
  maxQueueSpans: number
  /** 单批 span 数上限。 */
  maxBatchSpans: number
  /** 单批估算字节上限(JSON 长度 × 2)。 */
  maxBatchBytes: number
  /** 尾随定时器间隔。 */
  flushDelayMs: number
}

export interface UserActionTelemetryOptions {
  config: ActionTraceConfig
  resource: { instanceId: string }
  sendBatch: (batch: ActionTraceBatch) => Promise<unknown> | unknown
  clock?: { now(): number }
  timers?: UserActionTelemetryTimers
  random?: () => number
  idFactory?: () => string
  limits?: Partial<UserActionTelemetryLimits>
}

export const DEFAULT_ACTION_TELEMETRY_LIMITS: UserActionTelemetryLimits = {
  maxQueueSpans: 256,
  maxBatchSpans: 50,
  maxBatchBytes: 512 * 1024,
  flushDelayMs: 2_000,
}

const DEFAULT_TIMERS: UserActionTelemetryTimers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

interface ActiveAction {
  actionId: string
  entry: ActionCatalogEntry
  trigger: ActionTrigger
  spanId: string
  traceId: string
  startedAt: number
  timeoutHandle: unknown
}

interface StartActionInput {
  featureId: string
  action: string
  trigger: ActionTrigger
  /** 动作级超时覆盖;缺省用 catalog 的 30s。 */
  timeoutMs?: number
}

let idCounter = 0

export class UserActionTelemetry {
  private config: ActionTraceConfig
  private readonly resource: { instanceId: string }
  private readonly sendBatch: UserActionTelemetryOptions['sendBatch']
  private readonly clock: { now(): number }
  private readonly timers: UserActionTelemetryTimers
  private readonly random: () => number
  private readonly idFactory: () => string
  private readonly limits: UserActionTelemetryLimits
  private readonly completedQueue: ActionSpan[] = []
  private readonly activeActions = new Set<ActiveAction>()
  private flushTimer: unknown = undefined
  private flushPromise: Promise<void> | undefined
  private droppedSinceLastFlush = 0
  private sequence = 0

  constructor(options: UserActionTelemetryOptions) {
    this.config = options.config
    this.resource = options.resource
    this.sendBatch = options.sendBatch
    this.clock = options.clock ?? { now: () => Date.now() }
    this.timers = options.timers ?? DEFAULT_TIMERS
    this.random = options.random ?? Math.random
    this.idFactory =
      options.idFactory ??
      (() => {
        idCounter += 1
        return `act-${idCounter}-${Math.random().toString(36).slice(2, 10)}`
      })
    this.limits = { ...DEFAULT_ACTION_TELEMETRY_LIMITS, ...options.limits }
  }

  updateConfig(config: ActionTraceConfig): void {
    this.config = config
  }

  get pendingSpanCount(): number {
    return this.completedQueue.length
  }

  get droppedSpanCount(): number {
    return this.droppedSinceLastFlush
  }

  /**
   * 开始一个动作 span。catalog allowlist + 总开关 + 分组开关 + 采样三重门,
   * 未命中返回共享 NOOP(零开销:不建 active、不排定时器、不进队列)。
   */
  start(input: StartActionInput): ActionHandle {
    const entry = resolveActionCatalogEntry(input.featureId, input.action)
    if (
      !entry ||
      !this.config.enabled ||
      !this.config.enabledGroups.includes(entry.group) ||
      this.random() >= this.config.sampleRatio
    ) {
      return ACTION_HANDLE_NOOP
    }

    const active: ActiveAction = {
      actionId: this.idFactory(),
      entry,
      trigger: input.trigger,
      spanId: this.idFactory(),
      traceId: this.idFactory(),
      startedAt: this.clock.now(),
      timeoutHandle: this.timers.set(() => {
        this.finish(active, 'abandoned', {})
      }, input.timeoutMs ?? entry.timeoutMs),
    }
    this.activeActions.add(active)

    return {
      complete: (result) => this.finish(active, 'completed', result ?? {}),
      fail: (failure) => this.finish(active, 'failed', failure),
      reject: (result) => this.finish(active, 'rejected', result ?? {}),
      cancel: () => this.finish(active, 'cancelled', {}),
      noop: () => this.finish(active, 'noop', {}),
    }
  }

  /** flush promise 去重:在途时复用同一 promise,避免并发多批交错。 */
  flush(): Promise<void> {
    if (this.flushPromise) return this.flushPromise
    this.flushPromise = Promise.resolve()
      .then(() => this.flushImpl())
      .finally(() => {
        this.flushPromise = undefined
        // 尾随定时器:flush 期间又完成的 span,低流量下等 2s 攒批。
        if (this.completedQueue.length > 0 && this.flushTimer === undefined) {
          this.flushTimer = this.timers.set(() => {
            this.flushTimer = undefined
            void this.flush()
          }, this.limits.flushDelayMs)
        }
      })
    return this.flushPromise
  }

  /** 退出前收口:active 全记 abandoned(不丢现场),再 flush 干净。 */
  async shutdown(): Promise<void> {
    for (const active of [...this.activeActions]) {
      this.finish(active, 'abandoned', {})
    }
    await this.flush()
  }

  private async flushImpl(): Promise<void> {
    if (this.flushTimer !== undefined) {
      this.timers.clear(this.flushTimer)
      this.flushTimer = undefined
    }
    while (this.completedQueue.length > 0) {
      const spans = this.takeNextBatch()
      if (spans.length === 0) break
      const batch: ActionTraceBatch = {
        version: 1,
        instanceId: this.resource.instanceId,
        sequence: this.sequence++,
        droppedCount: this.droppedSinceLastFlush,
        spans,
      }
      this.droppedSinceLastFlush = 0
      try {
        await this.sendBatch(batch)
      } catch {
        // 遥测是严格旁路:传输失败不回压、不重试、不改变用户操作结果。
      }
    }
  }

  /** 有界队列:满即丢并计数;丢包数随下一批上报后清零。 */
  private finish(active: ActiveAction, outcome: ActionOutcome, result: ActionResult): void {
    if (!this.activeActions.delete(active)) return
    this.timers.clear(active.timeoutHandle)

    const endedAt = this.clock.now()
    const span: ActionSpan = {
      traceId: active.traceId,
      spanId: active.spanId,
      name: 'ui_action',
      startedAt: active.startedAt,
      endedAt: Math.max(endedAt, active.startedAt),
      durationMs: Math.max(0, endedAt - active.startedAt),
      status: outcome === 'failed' || outcome === 'rejected' ? 'error' : 'ok',
      attributes: {
        featureId: active.entry.featureId,
        action: active.entry.action,
        group: active.entry.group,
        operationKind: active.entry.operationKind,
        trigger: active.trigger,
        outcome,
        actionId: active.actionId,
        ...(result.failureStage ? { failureStage: result.failureStage } : {}),
        ...(result.resultSource ? { resultSource: result.resultSource } : {}),
        ...(result.stateAfter ? { stateAfter: result.stateAfter } : {}),
      },
    }

    if (this.completedQueue.length >= this.limits.maxQueueSpans) {
      this.droppedSinceLastFlush += 1
      return
    }
    this.completedQueue.push(span)
    if (this.completedQueue.length >= this.limits.maxBatchSpans) {
      void this.flush()
    } else if (this.flushTimer === undefined) {
      this.flushTimer = this.timers.set(() => {
        this.flushTimer = undefined
        void this.flush()
      }, this.limits.flushDelayMs)
    }
  }

  /**
   * 切批:span 数与估算字节双重上限。估算用 JSON 长度 × 2(UTF-16 计数对
   * UTF-8 传输的粗上界);单条就超限的 span 丢弃并计数,绝不发出超限批次。
   */
  private takeNextBatch(): ActionSpan[] {
    const spans: ActionSpan[] = []
    while (spans.length < this.limits.maxBatchSpans && this.completedQueue.length > 0) {
      const candidate = this.completedQueue[0]
      if (!candidate) break
      const next = [...spans, candidate]
      const estimatedBytes = JSON.stringify(next).length * 2
      if (estimatedBytes > this.limits.maxBatchBytes) {
        if (spans.length === 0) {
          this.completedQueue.shift()
          this.droppedSinceLastFlush += 1
          continue
        }
        break
      }
      spans.push(candidate)
      this.completedQueue.shift()
    }
    return spans
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
