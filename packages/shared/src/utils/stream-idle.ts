// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-693(2026-10-01 立)流式「空闲超时」与「总超时」分离 —— 读环 idle 判据的唯一出口。
 *
 * 立因(票面原文口径):`apps/cli/src/provider/local.ts` 的读环只有**总** abort
 * (`setTimeout(() => controller.abort(), timeoutMs)`),循环体内没有任何计时器;
 * `packages/api-client/src/endpoints/agent-runtime.ts` 的 read 循环同样**无任何计时器**。
 * 后果是一条"连接还开着、但不再送字节"的死流只能等到总超时才失败 —— 而总超时的语义是
 * "这次请求整体允许跑多久",不是"多久没动静就算死",两笔账必须分开。
 *
 * 抄的形态:`next / timeout / abort` 三路竞速;取消时抛 **signal.reason 原物**,
 * 不自造 idle 错;idle 命中时抛带可识别 `code === 'MODEL_STREAM_IDLE'` 的错误。
 *
 * 为什么判据必须"每次 read 各起一个期限"而不是"整条流一个期限":收到任何字节即重置,
 * 这才是"空闲"的定义(ai-service 的 agent SSE 在静默期每 30s 发 `: keep-alive` 注释帧,
 * 实测 apps/ai-service/app/routers/agents.py:669-672 —— 活连接不会撞默认档,只有真死才会)。
 *
 * 跨包形态说明:本包是 canonical 实现;`packages/api-client` 是零依赖包且
 * `@ihui/shared` 的 sse 层反向依赖 api-client,api-client **不得** import 本文件(会成环),
 * 它持有一份逐字同形移植 `packages/api-client/src/stream-idle.ts`(先例:frame-watermark.ts /
 * error-serialize.ts),漂移由 `packages/api-client/tests/g-693-stream-idle-parity.test.ts` 判红。
 * 因此跨包判 idle 一律走 `isModelStreamIdleError()` 的**结构化**判据,不得用 `instanceof`
 * (两个 class 在不同包里,instanceof 必然假)。
 */
// ==== G-693 共用出口实现(canonical ↔ api-client 零依赖移植逐字同形;漂移由 g-693-stream-idle-parity.test.ts 判红) ====

/**
 * 默认空闲上限。取 120_000 与本仓既有同族档一致
 * (`apps/cli/src/subagents/worker-pool.ts` 的 `SUBAGENT_IDLE_TIMEOUT_DEFAULT_MS = 120_000`),
 * 并刻意大于 ai-service agent SSE 的 30s keep-alive 周期 —— 低于该周期会把活连接判死。
 */
export const DEFAULT_STREAM_IDLE_MS = 120_000

/**
 * 空闲超时的可识别 code。**调用方判分支只能认这个码**,不得拿 message 文案判
 * (文案会随措辞漂,而"是不是空闲死"决定要不要重连/要不要报网络异常)。
 */
export const MODEL_STREAM_IDLE_CODE = 'MODEL_STREAM_IDLE'

/** idle 命中时抛出的错误:`code` 是对外契约,`label` 只用于定位是哪个读环死了。 */
export class ModelStreamIdleError extends Error {
  readonly code: string = MODEL_STREAM_IDLE_CODE
  readonly idleMs: number
  readonly label: string

  constructor(idleMs: number, label?: string) {
    super(`${label ? `${label}: ` : ''}流空闲超时 —— ${idleMs}ms 内未收到任何数据块`)
    this.name = 'ModelStreamIdleError'
    this.idleMs = idleMs
    this.label = label ?? ''
  }
}

/**
 * 结构化判据(不是 instanceof)。只认 `code` 字段,因此对 canonical 与 api-client
 * 那份逐字移植同时成立;`code` 非字符串一律不算。
 */
export function isModelStreamIdleError(err: unknown): err is { code: string; message: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: unknown }).code === MODEL_STREAM_IDLE_CODE
  )
}

/**
 * 三路竞速的结论(判别联合;竞速结果不得用 any/unknown 裸承载)。
 * `next` 自身失败不在这一维 —— 它经 `raceStreamRead` 以 reject 原样递出。
 */
export type StreamRaceOutcome<T> =
  | { readonly kind: 'value'; readonly value: T }
  | { readonly kind: 'idle' }
  | { readonly kind: 'abort'; readonly reason: unknown }

export interface RaceStreamOptions {
  /** 本路 read 的空闲上限;`<= 0` 或非有限值 = 关闭空闲判据(只等 next / abort) */
  readonly idleMs: number
  /** 外部取消信号;取消时抛它的 `reason` 原物 */
  readonly signal?: AbortSignal
  /** 出错信息里的定位标签(可选) */
  readonly label?: string
}

/**
 * 取消时递出的值:**必须是 signal.reason 原物**。
 * 极老宿主上 abort() 不带 reason 且 `reason` 为 undefined 时,补一个 `name='AbortError'`
 * 的 Error 兜底 —— 这是"没有原因"的兜底,不是"造一个空闲错"。
 */
function abortReasonOf(signal: AbortSignal): unknown {
  // 精确标注而非 any:reason 在老宿主上可能不存在(ES2022 前),取不到才走兜底
  const reason: unknown = (signal as AbortSignal & { reason?: unknown }).reason
  if (reason !== undefined) return reason
  const fallback = new Error('stream aborted')
  fallback.name = 'AbortError'
  return fallback
}

/**
 * 把一次 `next`(通常是 `reader.read()`)与空闲期限、取消信号三路竞速。
 *
 * 结论只回答"哪一路先赢";`next` 自己 reject 时本函数同样 reject 那个原始错误
 * (两个 handler 都挂上了,所以败者不会冒成 unhandled rejection)。
 * 定时器与 abort 监听在任一 settled 路径上必被清理 —— 长流每次 read 都调一次,
 * 漏清理等于把监听器堆成泄漏。
 */
export function raceStreamNext<T>(
  next: Promise<T>,
  opts: RaceStreamOptions,
): Promise<StreamRaceOutcome<T>> {
  const signal = opts.signal
  return new Promise<StreamRaceOutcome<T>>((resolve, reject) => {
    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const cleanup = (): void => {
      if (timer !== undefined) clearTimeout(timer)
      if (signal) signal.removeEventListener('abort', onAbort)
    }
    const finish = (outcome: StreamRaceOutcome<T>): void => {
      if (settled) return
      settled = true
      cleanup()
      resolve(outcome)
    }
    function onAbort(): void {
      if (!signal) return
      finish({ kind: 'abort', reason: abortReasonOf(signal) })
    }

    // 已取消:当场定案,不起计时器也不与 next 争(否则取消会被读成空闲/读错误)
    if (signal?.aborted) {
      finish({ kind: 'abort', reason: abortReasonOf(signal) })
      return
    }
    if (Number.isFinite(opts.idleMs) && opts.idleMs > 0) {
      timer = setTimeout(() => finish({ kind: 'idle' }), opts.idleMs)
    }
    if (signal) signal.addEventListener('abort', onAbort, { once: true })
    next.then(
      (value) => finish({ kind: 'value', value }),
      (error: unknown) => {
        if (settled) return
        settled = true
        cleanup()
        reject(error)
      },
    )
  })
}

/**
 * 读环该用的出口:赢的是 `next` ⇒ 返回它的值;空闲命中 ⇒ 抛 `ModelStreamIdleError`
 * (code=MODEL_STREAM_IDLE);取消命中 ⇒ 抛 `signal.reason` 原物。
 * 两案必须可互相区分,这正是调用方分支的依据。
 * (三路定案本身由 `raceStreamNext` 的判别联合给出,测试直接跑那一层。)
 */
export async function raceStreamRead<T>(next: Promise<T>, opts: RaceStreamOptions): Promise<T> {
  const outcome = await raceStreamNext(next, opts)
  if (outcome.kind === 'value') return outcome.value
  if (outcome.kind === 'abort') throw outcome.reason
  throw new ModelStreamIdleError(opts.idleMs, opts.label)
}

/**
 * 空闲档解析(与 `IHUI_SUBAGENT_IDLE_TIMEOUT_MS` 同一条约定:**0 = 显式关闭**)。
 * 脏值(非有限 / 负)回落到默认档而不是静默关闭 —— "把没配读成关掉"会让判据无声失效。
 */
export function resolveStreamIdleMs(
  raw: number | undefined | null,
  fallback: number = DEFAULT_STREAM_IDLE_MS,
): number {
  if (raw === undefined || raw === null) return fallback
  if (!Number.isFinite(raw) || raw < 0) return fallback
  return raw
}

// ==== G-693 共用出口实现结束 ====
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
