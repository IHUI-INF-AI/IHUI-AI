// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * In-flight 台账 —— 把"一次异步提交"的**成功与失败同时固化**的可查询记录。
 *
 * 为什么要有这个文件(机制来源:ZCode 第十轮 A10A-7,按我方命名重写):
 * 单纯的 single-flight 去重只保证"并发只做一次",它把答案存在**Promise 本身**里。
 * 于是有两个结构性缺口:
 *  1. **迟到提问的人**:Promise 已经结算完、inflight 槽位被清空之后再问一次的人,
 *     拿不到"刚才那次失败",而是**重新发起一次**并再挂满一个超时。故障形态是
 *     "越接近上限越慢",现象却写成"这个命令卡住了",极难归因到去重表。
 *  2. **取消被折叠成失败**:如果失败只以一个布尔值/undefined 表达,"用户取消了"与
 *     "服务端拒了"就是同一句话,上层再也分不出该重试还是该让人重新登录。
 *
 * 本台账的判据(三条都写成可测的行为,不是风格):
 *  - **A 在途复用**:未结算的记录,后来者复用**同一个 Promise**(与旧 single-flight 同语义)。
 *  - **B 失败固化**:第一个失败(含超时/取消)记录原因码与 Error 本体;在保留窗口内的
 *    后来者**直接拿到同一份带原因的结果**,不经过任何定时器。
 *  - **C 成功不固化**:成功结算后记录即失效。理由是"这件事此刻成不成"由调用方自己的
 *    新鲜度判据决定(例:token 是否过期看 exp),把成功冻在台账里等于造第二个真相,
 *    并且会盖住"成功换来的新结果也已经过期"这一格。
 *
 * 失败原因码是**封闭集**(`LEDGER_FAILURE_CODES`):新增一档必须同时改这里的判据与
 * 分类出口,不允许用 message 文本区分成因。超时与失败**不得同码**。
 */

/** 失败原因码封闭集。语义互不重叠,不得把 cancelled 折叠成 network/timeout。 */
export const LEDGER_FAILURE_CODES = ['network', 'auth', 'timeout', 'cancelled'] as const

export type LedgerFailureCode = (typeof LEDGER_FAILURE_CODES)[number]

/** 判断一个值是否合法原因码(给分类出口用,不靠 as 断言)。 */
export function isLedgerFailureCode(value: unknown): value is LedgerFailureCode {
  return typeof value === 'string' && (LEDGER_FAILURE_CODES as readonly string[]).includes(value)
}

/**
 * 台账里流转的失败。`code` 是封闭集原因码,`cause` 保留原始错误
 * (包装错误时丢原因 = 丢诊断能力)。
 */
export class LedgerFailure extends Error {
  readonly code: LedgerFailureCode

  constructor(code: LedgerFailureCode, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'LedgerFailure'
    this.code = code
  }
}

/**
 * 把任意抛出的值归一为 LedgerFailure。
 * 已经是 LedgerFailure 时**原样返回**(同一实例,便于"同一份结果"的断言);
 * 其余一律保守标成 `network` —— 台账不猜成因,分类是调用方的职责。
 */
export function toLedgerFailure(err: unknown): LedgerFailure {
  if (err instanceof LedgerFailure) return err
  const detail = err instanceof Error ? err.message : String(err)
  return new LedgerFailure('network', `in-flight 任务失败: ${detail}`, err)
}

/** 默认失败保留窗口:30s。见 InflightLedgerOptions.failureMemoMs 的注释。 */
export const DEFAULT_LEDGER_FAILURE_MEMO_MS = 30_000

/** 默认最多留存的记录数(有界内存;超出时淘汰最旧的**已结算**记录)。 */
export const DEFAULT_LEDGER_MAX_ENTRIES = 64

interface LedgerEntry<T> {
  /** 在途时给后来者复用的同一个 Promise;结算后置 null(此时靠 settled/failure 回答) */
  pending: Promise<T> | null
  settled: boolean
  /** 仅当本次以失败结算时非 null */
  failure: LedgerFailure | null
  settledAtMs: number
}

export interface InflightLedgerOptions {
  /** 时钟注入(默认 Date.now);测试里不依赖真实流逝时间 */
  now?: () => number
  /** 失败答案对后来者保持有效的窗口;<=0 表示不固化失败(退化为纯 single-flight) */
  failureMemoMs?: number
  /** 记录数上限,防无界增长 */
  maxEntries?: number
}

export interface InflightLedgerRunOptions {
  /**
   * 外部取消信号。**取消必须改写被等待的事实**:不只是把当前等待者结掉,
   * 而是把 `cancelled` 固化进台账,让之后的后来者同样立刻拿到这个答案。
   */
  signal?: AbortSignal
}

/**
 * 键 → 一条同时承载成功与失败的在途记录。
 * 每个使用者**恰好一本**(刻意不做进程级注册表):再挂一张全局表只带来
 * "两边不一致时信谁"这一种新问题。
 */
export class InflightLedger<T> {
  private readonly entries = new Map<string, LedgerEntry<T>>()
  private readonly now: () => number
  private readonly failureMemoMs: number
  private readonly maxEntries: number

  constructor(opts?: InflightLedgerOptions) {
    this.now = opts?.now ?? ((): number => Date.now())
    this.failureMemoMs = opts?.failureMemoMs ?? DEFAULT_LEDGER_FAILURE_MEMO_MS
    this.maxEntries = opts?.maxEntries ?? DEFAULT_LEDGER_MAX_ENTRIES
  }

  /** 当前是否有在途记录(诊断用,不参与判定)。 */
  hasPending(key: string): boolean {
    const entry = this.entries.get(key)
    return entry !== undefined && !entry.settled
  }

  /** 读取某键此刻固化的失败(没有则 null)。调用方可据此区分成因而不必重跑。 */
  peekFailure(key: string): LedgerFailure | null {
    const entry = this.entries.get(key)
    if (!entry || !entry.failure) return null
    if (this.now() - entry.settledAtMs >= this.failureMemoMs) return null
    return entry.failure
  }

  /** 丢弃某键的记录(例如凭据已更换、重试窗口应当重新打开)。 */
  invalidate(key: string): void {
    this.entries.delete(key)
  }

  /**
   * 核心入口:同一个 key 的并发调用只做一次;失败在保留窗口内被后来者复用。
   *
   * task 抛错时 run() 也抛(抛出的就是那条 LedgerFailure)—— **不把失败洗成
   * 成功值**,归因由调用方在边界上决定(见 token-manager 的用法)。
   */
  run(key: string, task: () => Promise<T>, opts?: InflightLedgerRunOptions): Promise<T> {
    const existing = this.entries.get(key)
    if (existing) {
      // A 在途复用:未结算就是同一件事,给同一个 Promise
      if (!existing.settled && existing.pending) return existing.pending
      // B 失败固化:迟到者立刻拿到同一份带原因的结果,不重新发起、不挂超时
      if (existing.settled && existing.failure && this.now() - existing.settledAtMs < this.failureMemoMs) {
        return Promise.reject(existing.failure)
      }
      // C 成功不固化 / 失败已过期:丢掉旧记录,重新跑
      this.entries.delete(key)
    }

    const entry: LedgerEntry<T> = { pending: null, settled: false, failure: null, settledAtMs: 0 }
    this.entries.set(key, entry)
    this.evictIfNeeded()

    const promise = this.execute(entry, task, opts?.signal)
    // task 同步抛错时 execute 已经把记录结算掉了,此时不得再把已结算的记录标成在途
    if (!entry.settled) entry.pending = promise
    return promise
  }

  private async execute(
    entry: LedgerEntry<T>,
    task: () => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    if (signal?.aborted) {
      const failure = new LedgerFailure('cancelled', 'in-flight 任务在发起前已被取消', signal.reason)
      entry.settled = true
      entry.pending = null
      entry.failure = failure
      entry.settledAtMs = this.now()
      throw failure
    }

    let onAbort: (() => void) | undefined
    try {
      const value = await new Promise<T>((resolve, reject) => {
        if (signal) {
          onAbort = (): void => reject(new LedgerFailure('cancelled', 'in-flight 任务被取消', signal.reason))
          signal.addEventListener('abort', onAbort, { once: true })
        }
        // 注意:task 自身抛错也要走同一份归因 —— 由它自己决定抛 LedgerFailure('timeout') 等
        void task().then(resolve, reject)
      })
      // C 成功不固化:只把值交回去。记录留在表里但**永远不会被读到**
      // (run() 读到 settled && !failure 就删键重跑),所以这里不反查键删除 ——
      // 反查要遍历整个 Map,而这条分支恰恰是最常走的那条。
      entry.settled = true
      entry.pending = null
      entry.failure = null
      entry.settledAtMs = this.now()
      return value
    } catch (err) {
      const failure = toLedgerFailure(err)
      entry.settled = true
      entry.pending = null
      entry.failure = failure
      entry.settledAtMs = this.now()
      throw failure
    } finally {
      if (signal && onAbort) signal.removeEventListener('abort', onAbort)
    }
  }

  /**
   * 有界内存:超上限时从最旧开始淘汰**已结算**记录。
   * 在途记录不淘汰 —— 摘掉它等于让后来者重新发起一次,正是本台账要防的那一型。
   */
  private evictIfNeeded(): void {
    if (this.entries.size <= this.maxEntries) return
    for (const [key, entry] of this.entries) {
      if (entry.settled) this.entries.delete(key)
      if (this.entries.size <= this.maxEntries) return
    }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
