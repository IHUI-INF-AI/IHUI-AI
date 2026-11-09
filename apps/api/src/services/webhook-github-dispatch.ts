// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Y-91(2026-11-06 立)—— GitHub webhook「先回 200,再异步处理」的派发层。
 *
 * 为什么存在:现场读数(90 分钟 n=1910 现读)`POST /api/github-app/webhook` 应用侧
 * p95 2217ms、max 19720ms、≥10s 10 枚,而公网腿本身是干净的(GitHub 投递 100/100 成功、
 * p95 1120ms),源站 `/api/health` p50 2ms、隧道 concurrent=0 —— 长尾完全住在**应用侧**:
 * pull_request 的 PR review 与 issue_comment 的 mentions 处理都要在 handler 里同步等
 * ai-service + GitHub API。提供方(GitHub)的投递超时是 10s:我们等到 19.7s 的那一枚
 * 在它看来就是失败,于是重投;重投又被我方内存一级去重吃掉,形成"它记失败、我方记重复"
 * 的对不上账。**加源站并发买不到任何效果**(瓶颈不是并发而是单条请求的等待)。
 *
 * 正解 = 签名校验通过、事件体判定可处理之后,**应答不再等重活**:重活交给本文件的一次性
 * 内存队列,任务在后台跑完并把投递落表。本队列**不是常驻服务**:没有定时器、没有轮询、
 * 没有独立进程 —— 没有活就一行都不跑,派发节拍由调用方注入(`schedule`,缺省 setImmediate)。
 *
 * 应答预算(budgetMs)的语义必须读准:它是"最多让提供方等多久",**不是超时取消**。
 * 预算到点 → handler 回 200,任务照旧跑完(不中断、不重试、不丢副作用);预算内跑完 →
 * 结果照旧随 200 返回(既有响应形状因此不回退)。budgetMs=0 是"一律先回 200"的纯异步档。
 *
 * 失效方向(§0.10):积压满 ⇒ 当场记 error 并**就地执行**(宁可这一条慢,绝不静默丢活);
 * 队列自身的 close/drain 保证它不会无限长大(§附加强制条款「工作队列必须有死亡机制」)。
 */

/** 缺省并发=1:同一时刻只跑一枚重活,避免风暴把 ai-service 与 GitHub API 一起打穿 */
const DEFAULT_DISPATCH_CONCURRENCY = 1

/** 缺省积压上限(条)——超出即触发"就地执行"兜底,同时记 error 供对账 */
const DEFAULT_DISPATCH_MAX_PENDING = 256

/** 缺省应答预算(ms):远低于 GitHub 的 10s 投递超时,又足够让"零外部 IO 的轻判定"同步回话 */
export const DEFAULT_RESPONSE_BUDGET_MS = 500

/** 应答预算的环境变量键(现读;坏值不猜,回落缺省并保留读数) */
export const RESPONSE_BUDGET_ENV_KEY = 'GITHUB_WEBHOOK_RESPONSE_BUDGET_MS'

/**
 * 从 env 解析应答预算。
 * 判据:读不到 / 非有限数 / 负数 ⇒ 一律取 fallback(0 是合法值 = 纯异步档)。
 * 这里不做"看起来像数字就乘 1000"之类的猜测(§0.3:取不到就是取不到)。
 */
export function resolveResponseBudgetMs(
  env: Record<string, string | undefined> = process.env,
  fallback: number = DEFAULT_RESPONSE_BUDGET_MS,
): number {
  const raw = env[RESPONSE_BUDGET_ENV_KEY]
  if (raw === undefined || raw.trim() === '') return fallback
  const parsed = Number(raw.trim())
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return Math.floor(parsed)
}

/** 派发任务的身份(只带对账用的两个字段,绝不带提供方正文) */
export interface DispatchJobDescriptor {
  deliveryId: string
  event: string
}

type DispatchRejectReason = 'backlog_full' | 'closed'

/** 任务真正结束时的两种结局(永不 reject,因此后台失败不会掀掉 worker) */
type DispatchSettled<T> = { phase: 'completed'; value: T } | { phase: 'failed'; error: unknown }

/** 调用方在应答预算处看到的那一面 */
export type DispatchOutcome<T> =
  | DispatchSettled<T>
  /** 预算到点:任务仍在队列里继续跑,调用方应当立刻回 200 */
  | { phase: 'deferred' }
  /** 队列拒绝受理(积压满 / 已关闭),调用方需就地执行 */
  | { phase: 'rejected'; reason: DispatchRejectReason }

interface DispatchHandle<T> {
  /** 是否已入队;false 时 rejectReason 必非 null */
  readonly accepted: boolean
  readonly rejectReason: DispatchRejectReason | null
  /** 入队(或被拒)之后的积压深度,含正在跑的那枚 */
  readonly depthAfterSubmit: number
  /** 任务 settle 的终态 promise(永不 reject):测试断言"副作用最终发生"用它,不靠真等 */
  readonly settled: Promise<DispatchSettled<T>>
  /** 最多等 budgetMs;到点返回 deferred,不取消任务 */
  awaitWithin(budgetMs: number): Promise<DispatchOutcome<T>>
}

export interface WebhookDispatchQueue {
  submit<T>(job: DispatchJobDescriptor, task: () => Promise<T>): DispatchHandle<T>
  /** 当前深度 = 待跑 + 在跑(读数用) */
  depth(): number
  /** 排空:待跑清零且在跑清零时 resolve;空队列立即 resolve */
  drain(): Promise<void>
  /** 停止受理新任务(在跑的仍会跑完);幂等 */
  close(): void
  readonly closed: boolean
}

export interface WebhookDispatchQueueOptions {
  concurrency?: number
  maxPending?: number
  /** 后台派发节拍(缺省 setImmediate;测试可注入微任务或手动泵) */
  schedule?: (run: () => void) => void
  /** 任务失败的落点:队列内已捕获,此处只负责把它推到可核对的日志 */
  onError?: (error: unknown, job: DispatchJobDescriptor) => void
}

interface InternalEntry {
  job: DispatchJobDescriptor
  start: () => Promise<unknown>
  finish: (settled: DispatchSettled<unknown>) => void
}

/**
 * 造一条一次性内存派发队列。
 *
 * 约束(与本票交付面一致):
 * - 不新建常驻服务/定时器/进程:worker 只在 submit 时被 `schedule` 唤起一次。
 * - 任务异常绝不冒出队列(否则 worker 一死,后续投递静默失聪 —— 与本票要修的正是同型)。
 * - `close()` 后只拒新单,在跑的照旧跑完并可 `drain()`,保证测试能断言终态。
 */
export function createWebhookDispatchQueue(
  options: WebhookDispatchQueueOptions = {},
): WebhookDispatchQueue {
  const concurrency = Math.max(1, options.concurrency ?? DEFAULT_DISPATCH_CONCURRENCY)
  const maxPending = Math.max(1, options.maxPending ?? DEFAULT_DISPATCH_MAX_PENDING)
  const schedule = options.schedule ?? ((run: () => void) => setImmediate(run))

  const backlog: InternalEntry[] = []
  const drainWaiters: Array<() => void> = []
  let running = 0
  let ticking = false
  let queueClosed = false

  function isIdle(): boolean {
    return running === 0 && backlog.length === 0
  }

  function notifyIfIdle(): void {
    if (!isIdle() || drainWaiters.length === 0) return
    while (drainWaiters.length > 0) {
      const wake = drainWaiters.shift() as () => void
      wake()
    }
  }

  function pump(): void {
    while (running < concurrency && backlog.length > 0) {
      const entry = backlog.shift() as InternalEntry
      running += 1
      void execute(entry)
    }
  }

  function kick(): void {
    if (ticking || running >= concurrency) return
    ticking = true
    schedule(() => {
      ticking = false
      pump()
    })
  }

  async function execute(entry: InternalEntry): Promise<void> {
    try {
      entry.finish({ phase: 'completed', value: await entry.start() })
    } catch (error) {
      // 异常在队列内就地捕获并转成终态:worker 绝不能因为一枚任务而停摆,
      // 否则后续所有投递都会静默失聪(与本票要修的同型故障)。
      entry.finish({ phase: 'failed', error })
      options.onError?.(error, entry.job)
    } finally {
      running -= 1
      notifyIfIdle()
      if (backlog.length > 0) kick()
    }
  }

  return {
    submit<T>(job: DispatchJobDescriptor, task: () => Promise<T>): DispatchHandle<T> {
      let resolveSettled: (settled: DispatchSettled<T>) => void = () => {}
      const settled = new Promise<DispatchSettled<T>>((resolve) => {
        resolveSettled = resolve
      })

      let accepted = true
      let rejectReason: DispatchRejectReason | null = null
      if (queueClosed) {
        accepted = false
        rejectReason = 'closed'
      } else if (backlog.length + running >= maxPending) {
        accepted = false
        rejectReason = 'backlog_full'
      }

      if (accepted) {
        backlog.push({
          job,
          start: () => task(),
          // finish 的入参是 DispatchSettled<unknown>;本 handle 的 settled 是 DispatchSettled<T>。
          // T 由 submit 调用方在类型层固定,队列内不做任何跨任务的值传递,这一处窄转换是安全的。
          finish: resolveSettled as (settled: DispatchSettled<unknown>) => void,
        })
        kick()
      } else {
        // 被拒的任务永远不会被 worker 取走:settled 必须以 rejected 同语义终态收口,
        // 否则调用方 await 会永挂(§0.3 —— 不猜结果,但也不能把等待者丢在半路)。
        resolveSettled({ phase: 'failed', error: new Error(`dispatch_rejected:${rejectReason}`) })
      }

      return {
        accepted,
        rejectReason,
        depthAfterSubmit: backlog.length + running,
        settled,
        async awaitWithin(budgetMs: number): Promise<DispatchOutcome<T>> {
          if (!accepted) return { phase: 'rejected', reason: rejectReason as DispatchRejectReason }
          if (budgetMs <= 0) return { phase: 'deferred' }
          return await new Promise<DispatchOutcome<T>>((resolve) => {
            let done = false
            const timer = setTimeout(() => {
              if (done) return
              done = true
              resolve({ phase: 'deferred' })
            }, budgetMs)
            // 应答预算不该拖住进程退出(测试跑完即走)
            timer.unref?.()
            void settled.then((result) => {
              if (done) return
              done = true
              clearTimeout(timer)
              resolve(result)
            })
          })
        },
      }
    },
    depth(): number {
      return backlog.length + running
    },
    drain(): Promise<void> {
      if (isIdle()) return Promise.resolve()
      return new Promise<void>((resolve) => {
        drainWaiters.push(resolve)
      })
    },
    close(): void {
      queueClosed = true
    },
    get closed(): boolean {
      return queueClosed
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
