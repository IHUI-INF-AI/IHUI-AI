// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 出站 fetch 的 deadline 出口（2026-09-29 立，台账号 G-814420）。
 *
 * 为什么需要它（上游证据已整读，不必再读上游）：
 * `.ihui-agent/tmp/zcode-study/zcode/packages/services/src/bots/providers/providerRequest.ts:15-58`
 * 的写法是「setTimeout 罩住 fetch **与响应体消费整段**，finally 才 clearTimeout」，并在 :34-40 / :53-57
 * 两条注释里写明原因：
 *   - `fetch()` 在**响应头到达时**就 resolve。收到响应头不代表请求完成；
 *   - 若 headers 一到就 clearTimeout 并返回裸 `Response`，服务端「发完 headers 之后停滞」时
 *     这条请求既没有 deadline 也没有 abort，会**永久占住调用方的串行队列**（上游是 bot actor 队列，
 *     我方是 ai-world-sync 的逐源串行抓取与 ai-audio 的供应商调用），且没有任何错误可诊断。
 * 本仓此前两处站点（`apps/api/src/routes/ai-audio.ts` 与 `apps/api/src/jobs/ai-world-sync.ts` 的
 * `fetchWithTimeout`）正是那种旧形态：`finally { clearTimeout }` 跟在 `await fetch(...)` 之后。
 *
 * 语义约定：
 *   1. deadline **不因 headers 到达而解除**。返回的 Response 是受管视图，`json()/text()/
 *      arrayBuffer()/blob()/bytes()/formData()` 任一次消费 settle（成功或抛错）后才 clearTimeout；
 *      读 `res.body` 时挂到该流的 `closed`（读完/出错/取消）上收口。
 *   2. 超时 abort 携带可读的 reason（含 label 与 timeoutMs），消费方拿到的 rejection 能指认是
 *      「哪一次出站请求在响应体阶段超时」，而不是裸 AbortError。
 *   3. 调用方自带的 `init.signal` 继续透传（外部取消优先，且监听器在收口时摘除，不留悬挂监听）。
 *   4. 定时器不引用事件循环（`unref`，可用时）：headers 之后没人读 body 的路径
 *      （如 `!res.ok` 直接抛错的分支）不会把一个最长 timeoutMs 的挂起句柄留在进程里。
 *
 * 已知边界（如实登记，不留“看起来全覆盖”的错觉）：
 *   - `clone()` 返回的副本不受管；两站点无该用法。
 *   - 半途弃用 `res.body` 流（既不读完也不取消）时不会提前收口，由 deadline 自身在 timeoutMs
 *     触发后结束——有界，不构成定时器泄漏。
 *   - 只兜「超时/取消」，不改状态码、不改响应结构、不做重试。
 */

/** 受管出口可识别的 body 消费方法名（与 `Response` 上的读取方法一致）。 */
const BODY_CONSUMERS = ['json', 'text', 'arrayBuffer', 'blob', 'bytes', 'formData'] as const

/**
 * 受管 Response → 收口函数的登记表。`withBody()` 走它，保证「显式消费」与「方法级包装」
 * 共用同一条收口实现（两处各写一遍 clearTimeout 必然漂移，本仓记过多次）。
 */
const releasers = new WeakMap<object, () => void>()

/** 本出口实际调用的 fetch 形态（默认 `globalThis.fetch`，代理分支注入 undici 自带 fetch）。 */
export type FetchDeadlineImpl = (input: string | URL | Request, init: RequestInit) => Promise<Response>

export interface FetchDeadlineOptions {
  /** 罩住「发出请求 → 响应体消费结束」整段的毫秒数。 */
  timeoutMs: number
  /** 诊断标签：超时 reason 与未来日志都靠它指认是哪一次出站调用。 */
  label?: string
  /**
   * 注入点：默认取**调用时刻**的 `globalThis.fetch`（不缓存引用，保证测试替身与
   * 运行期换实现都生效）。需要走 undici `dispatcher`（代理）等专有形态时由调用方传入自己的 fetch。
   */
  fetchImpl?: FetchDeadlineImpl
}

/** 外部 signal 的窄视图：`RequestInit.signal` 在 @types/node 里是 GenericAbortSignal，没有 `reason`。 */
interface SignalWithReason {
  reason?: unknown
}

/**
 * 超时 abort 的 reason 上的标记（G-815411，2026-09-29）：调用方拿到的 rejection 必须能
 * **程序化**地与「解析出空对象」分流，而不是靠 message 字符串比对 —— 两处各写一遍判别必然漂移。
 * reason 的 message 仍携带 label 与超时位置（人读的那一半不变），标记只加机器读的那一半。
 */
export interface DeadlineAbortError extends Error {
  deadlineLabel: string
}

/** 该 rejection 是否是本出口的超时 abort（外部 signal 的取消**不**算，它没有标记）。 */
export function isDeadlineAbort(err: unknown): err is DeadlineAbortError {
  return (
    err instanceof Error &&
    typeof (err as DeadlineAbortError).deadlineLabel === 'string' &&
    (err as DeadlineAbortError).deadlineLabel.length > 0
  )
}

/**
 * 发一次有 deadline 的出站请求，返回**受管** Response：
 * deadline 覆盖到响应体消费结束，headers 到达不解除。
 *
 * 返回类型仍是 `Response`，所以调用方签名（`Promise<Response>`）与响应结构逐字不变。
 */
export async function fetchWithinDeadline(
  input: string | URL | Request,
  init: RequestInit = {},
  options: FetchDeadlineOptions,
): Promise<Response> {
  const { timeoutMs, label = 'fetchWithinDeadline', fetchImpl } = options

  const controller = new AbortController()
  const externalSignal = init.signal as AbortSignal | null | undefined

  // 外部取消优先透传：reason 原样带上（拿不到就不带，不伪造原因）。
  function relayExternalAbort(): void {
    const reason = (externalSignal as SignalWithReason | null | undefined)?.reason
    if (reason === undefined) controller.abort()
    else controller.abort(reason)
  }
  if (externalSignal?.aborted) {
    relayExternalAbort()
  } else {
    externalSignal?.addEventListener?.('abort', relayExternalAbort, { once: true })
  }

  // 超时点是「headers 之后、body 未读完」——文案把这个位置写出来，便于事后归因。
  // reason 同时带上机器可读的标记（isDeadlineAbort），让调用方能把 abort 与「空响应」分流。
  const timer = setTimeout(() => {
    const reason = new Error(
      `${label} 在 ${timeoutMs}ms 内未完成（超时发生在响应头之后的响应体消费阶段）`,
    ) as DeadlineAbortError
    reason.deadlineLabel = label
    controller.abort(reason)
  }, timeoutMs)
  // headers 之后无人读 body 的路径不把挂起句柄留在事件循环上（能力缺失时忽略）。
  ;(timer as { unref?: () => void }).unref?.()

  // 收口：只生效一次；清定时器 + 摘外部 signal 监听，正常与异常两条路径共用。
  // 只有在响应体消费 settle 之后才允许调用它——headers 到达时调用就是本票要修的那一型。
  let released = false
  const release = (): void => {
    if (released) return
    released = true
    clearTimeout(timer)
    externalSignal?.removeEventListener?.('abort', relayExternalAbort)
  }

  const runFetch: FetchDeadlineImpl = fetchImpl ?? globalThis.fetch
  let response: Response
  try {
    response = await runFetch(input, { ...init, signal: controller.signal })
  } catch (err) {
    // 传输层（含 abort）抛错：body 永远不会被读，立即收口，不留定时器。
    release()
    throw err
  }

  const managed = manageBodyConsumption(response, release)
  releasers.set(managed, release)
  return managed
}

/**
 * 取消 + 超时组合器（b75-3#1，2026-09-30，上游出处 zcode script-workflow-utils.ts:116-123）：
 * `AbortSignal.any([signal, AbortSignal.timeout(ms)])` 一行把「人控取消」与「超时」
 * 合成单个 signal，调用方无需手写 race/监听器清理。超时计时由平台托管（Timer 不占调用方代码）。
 * 缺省语义与上游一致：只传其一原样取其一；都不传返回 undefined（= 不加取消约束）。
 * `timeoutMs` 为 0/undefined 时不挂超时（与上游 `!timeoutMs` 判据逐字同语义）。
 */
export function mergedSignal(
  signal: AbortSignal | undefined,
  timeoutMs: number | undefined,
): AbortSignal | undefined {
  if (!timeoutMs) return signal
  const timeout = AbortSignal.timeout(timeoutMs)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

/**
 * 显式消费出口：在同一个 deadline 下读完响应体再返回结果（上游 :52-57 的形状）。
 * 传入非受管 Response 时退化为「直接调用 consume」，不报错、不伪造收口。
 */
export async function withBody<T>(
  response: Response,
  consume: (res: Response) => Promise<T>,
): Promise<T> {
  try {
    return await consume(response)
  } finally {
    releasers.get(response)?.()
  }
}

/**
 * 把受管 Response 的 body 消费方法换成「消费完（成功或抛错）即收口」的版本，其余属性透传。
 * 用 Proxy 而不是新建对象：`instanceof Response`、`res.ok`、`res.status`、`res.headers` 的语义
 * 与字节都不变，调用方与旧写法完全同形。
 */
function manageBodyConsumption(response: Response, release: () => void): Response {
  return new Proxy(response, {
    get(target, prop) {
      if (typeof prop === 'string' && BODY_CONSUMERS.includes(prop as (typeof BODY_CONSUMERS)[number])) {
        const method = Reflect.get(target, prop, target) as unknown as () => Promise<unknown>
        if (typeof method !== 'function') return method
        return async (): Promise<unknown> => {
          try {
            // 绑定 target：undici Response 的读取方法有品牌校验，receiver 传 Proxy 会抛。
            return await method.call(target)
          } finally {
            release()
          }
        }
      }
      // 流式消费方：把收口挂在该 body 流的 closed 上（读完/出错/取消都会 settle）。
      // 注：`closed` 是**返回 Promise 的 getter**，不是方法，所以判据取 thenable 而不是 function。
      if (prop === 'body') {
        const raw = Reflect.get(target, 'body', target) as
          | { closed?: { then?: unknown } }
          | null
          | undefined
        if (raw?.closed && typeof raw.closed.then === 'function') {
          raw.closed.then(release, release)
        }
        return raw
      }
      const value = Reflect.get(target, prop, target)
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
