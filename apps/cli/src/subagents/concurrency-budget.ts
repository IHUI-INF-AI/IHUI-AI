// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 并发预算单一出口(concurrency budget)。
 *
 * 立因(2026-09-26 实测):子 agent 并发档在本仓**五处各自写死 4**,且
 * **全仓没有任何 CPU 推导**(grep `availableParallelism|defaultConcurrency` 在
 * apps/cli + packages 零命中,只有 `device-fingerprint` 里无关的 `os.cpus().length`);
 * 同时模型填入的 `maxWorkers` **上下限都不钳**(`Math.min(16, …)` 那道上界在磁盘上不存在,
 * 即"上界与默认互不相干"的真实形态是"根本没有上界")。
 * 后果:`spawnParallel()` 每次自建自关一个 pool,两个并发 fan-out 的实际并发是 2×maxWorkers,
 * 而 maxWorkers 可以是任意大的模型自填值。
 *
 * 本模块是**唯一**允许出现并发档位字面量的地方:硬上限与默认值都只写这一处。
 * 各调用点(见下)一律经 `resolveMaxConcurrency()`,不得再写 `?? 4` / `= 4` / `Math.min(16, …)`。
 *
 * 调用点清单(现值,勿按旧文档派单):
 *   - `src/commands/subagent-collab.ts` 的 `spawnParallel()` 与 `WorkerPoolCollaborationExecutor`
 *   - `src/subagents/worker-pool.ts` 的 `defaultWorkerPoolConfig()`
 *   - `src/commands/subagent-parallel.ts`(CLI 入口)
 *   - `src/tools/subagent.ts`(模型可见参数)
 *
 * 未收口的一条(如实登记,不是已完成):pool 复用。`spawnParallel()` 仍每次 `new` + `finally shutdown()`,
 * 因为 shutdown 会 resolve 队列里的 pending 任务,改成共享池要重做生命周期语义(另计一票)。
 * 本票只做"并发总量可被观测":见 `notePoolCreated` / `notePoolClosed` / `concurrencyBudgetSnapshot`。
 */

import * as os from 'node:os'

/** 硬上限:一次 fan-out 最多同时存活多少个 worker 子进程。唯一真相源。 */
export const MAX_CONCURRENCY = 16

/** 下限:至少 1,否则 drainQueue 的 `activeCount < maxWorkers` 永不成立 ⇒ 任务全排队饿死。 */
export const MIN_CONCURRENCY = 1

/**
 * CPU 读数拿不到时的兜底档(Node 异常 / 容器内读不到)。
 * 刻意不等于旧的写死值 4:旧值没有任何依据,这里取"保守可用"的 2。
 */
const CPU_UNREADABLE_FALLBACK = 2

function clampConcurrency(n: number): number {
  if (!Number.isFinite(n)) return MIN_CONCURRENCY
  const int = Math.floor(n)
  if (int < MIN_CONCURRENCY) return MIN_CONCURRENCY
  if (int > MAX_CONCURRENCY) return MAX_CONCURRENCY
  return int
}

/**
 * 机器并行度(优先 `os.availableParallelism()`,它是 cgroup/亲和性感知的那一个;
 * 旧 Node 无此方法时降 `os.defaultConcurrency()`,再降 `os.cpus().length`)。
 */
export function cpuParallelism(): number {
  const osAny = os as typeof os & {
    availableParallelism?: () => number
    defaultConcurrency?: () => number
  }
  const raw =
    typeof osAny.availableParallelism === 'function'
      ? osAny.availableParallelism()
      : typeof osAny.defaultConcurrency === 'function'
        ? osAny.defaultConcurrency()
        : os.cpus().length
  return Number.isFinite(raw) && raw > 0 ? raw : CPU_UNREADABLE_FALLBACK
}

/**
 * 并发档唯一解析出口。
 *
 * - 有请求值(模型/CLI 填的 `maxWorkers`)⇒ 钳到 `[MIN_CONCURRENCY, MAX_CONCURRENCY]`
 * - 无请求值 ⇒ 按 CPU 推导后同一次钳制
 *
 * `cpu` 形参供测试注入确定的机器并行度(否则"默认走 CPU 推导而非固定 4"这条断言
 * 在 4 核机上会退化);生产调用方一律不传。
 */
export function resolveMaxConcurrency(requested?: number, cpu: number = cpuParallelism()): number {
  if (typeof requested === 'number') return clampConcurrency(requested)
  return clampConcurrency(cpu)
}

// ───────────────────────── 并发总量可观测(池生命周期计数) ─────────────────────────
// 只读遥测:任何一侧都不改行为。判"两个并发 fan-out = 2×maxWorkers"这类问题时用它现读。

let poolsCreated = 0
let poolsClosed = 0

/** `SubagentWorkerPool` 构造时调用。 */
export function notePoolCreated(): void {
  poolsCreated += 1
}

/** `SubagentWorkerPool.shutdown()` 首次调用时调用(重复 shutdown 不再计数)。 */
export function notePoolClosed(): void {
  // 单调性护栏:计数被外部重置时也不得让 active 变负
  poolsClosed = Math.min(poolsClosed + 1, poolsCreated)
}

export interface ConcurrencyBudgetSnapshot {
  /** 迄今创建的池数 */
  poolsCreated: number
  /** 迄今关闭的池数 */
  poolsClosed: number
  /** 当前仍存活的池数(= 并发总量的放大倍数) */
  activePools: number
  ceiling: number
  floor: number
  /** 本机按 CPU 推导出的默认档 */
  cpuDerivedDefault: number
}

export function concurrencyBudgetSnapshot(): ConcurrencyBudgetSnapshot {
  return {
    poolsCreated,
    poolsClosed,
    activePools: Math.max(0, poolsCreated - poolsClosed),
    ceiling: MAX_CONCURRENCY,
    floor: MIN_CONCURRENCY,
    cpuDerivedDefault: resolveMaxConcurrency(),
  }
}

// ───────────────── provider-key 级 AIMD 并发治理器(替掉静态并发档) ─────────────────
//
// 机制来源(上游对照面,只读):src/engine/concurrency.ts — 纯 AIMD:
//   - epoch 批次阻尼:每完成一个 epoch 批次才抬一次 cap,单次成功不抬(防抖)
//   - 两档减 cap:429/timeout 各自减档;cap 高于 lastGood 时直接退回 lastGood(不按系数减),
//     cap 已不高于 lastGood 时按系数乘法减并清空 lastGood
//   - lastGood 只由完成 streak 设:连续成功达标才记"已知良好档",失败永不写
//   - Retry-After cooldown:对端带了就排定退避,期间新请求按 backoff 因果被拒
//   - 空闲惰性重置 + 幂等守卫:闲置超阈值后惰性抬回天花板;已在天花板且状态干净
//     ⇒ 0 条 change、不翻 epoch(幂等)
//   - stale 事件:旧 epoch 的 429 只清 streak 不动 cap
//
// 两条界刻意不混(上游 types.ts/engine.ts 同形):
//   - 进程级观察 `onConcurrencyChanged`(对应进程级 'concurrency-changed'):只读遥测,
//     不参与决策,任何一侧都不改行为
//   - run 级命令 `applyRunCapCommand`(对应 run 级 'run-caps-changed'):就地抬/调本 run 上界,
//     同 runId 同值重复 ⇒ 幂等 no-op、不铸后继;在飞一个不丢(调低不召回,只收紧新闸门);
//     抬高多调一次 pumpAll,调低不调
//
// 本区是并发档位字面量的唯一真相源:AIMD 五常量 + MAX/MIN,守门测试断言
// 本文件其余裸数字只能是结构性的 0/1/-1(见 tests/concurrency-aimd-guard.test.ts)。

/** cap 调整原因(5 值;change 载荷见 ConcurrencyChange)。 */
export type ConcurrencyChangeReason =
  | 'throttle-429'
  | 'timeout'
  | 'retry-after'
  | 'recovery'
  | 'manual'

export interface ConcurrencyChange {
  providerKey: string
  reason: ConcurrencyChangeReason
  /** 调整前 cap */
  from: number
  /** 调整后 cap */
  to: number
  /** 调整发生时的 epoch 代次 */
  epoch: number
  /** 仅 reason='retry-after':冷却截止时刻(epoch ms) */
  cooldownUntilMs?: number
}

/**
 * "在等"的两种因果(上游 AskWaitInfo.cause 同形):
 * - 'slot':闸门外排队(cap 满,取决于他人释放,无确定时刻)
 * - 'backoff':已排定退避(Retry-After cooldown 生效中,有确定截止时刻)
 */
export interface AskWaitInfo {
  cause: 'slot' | 'backoff'
  /** 预计可重试时刻(epoch ms);slot 因果时为 0 */
  retryAtMs: number
}

// AIMD 五常量(唯一真相源)
/** epoch 批次大小:每完成 N 个成功才翻一次 epoch(批次阻尼)。 */
export const AIMD_EPOCH_BATCH = 8
/** additive 抬升步长:epoch 翻代且有等待者时 cap + 1。 */
export const AIMD_ADDITIVE_STEP = 1
/** 连续成功 streak 达标才设 lastGood(已知良好档)。 */
export const AIMD_LASTGOOD_STREAK = 8
/** cap 已不高于 lastGood 时的乘法减档系数。 */
export const AIMD_DECREASE_FACTOR = 0.75
/** 空闲惰性重置阈值(ms):闲置超过它,下一次 ask 时抬回天花板。 */
export const AIMD_IDLE_RESET_MS = 300_000

interface ProviderAimdState {
  cap: number
  inflight: number
  /** 闸门外排队者计数(ask 被拒 +1,ask 放行归 0:"能放行即非饱和"口径) */
  waiting: number
  successStreak: number
  epochProgress: number
  epoch: number
  lastGood: number
  cooldownUntilMs: number
  lastActivityMs: number
}

/**
 * `ask` 的两种模式(G-686 新增,**默认值 `'gated'` ⇒ 既有调用方逐字不变**):
 *
 * - `gated`(缺省):原语义 —— 看冷却、看 cap,满了排队计数 +1 并拒绝。
 * - `observer`:主代理那一族请求。**立即放行、不看 cap 也不看冷却,但照样计入在飞。**
 *   为什么必须计入:observer 也是真的在打同一个模型端点,若它不进 `inflight`,
 *   子代理侧的闸门就会把这部分负载看成 0 而超发(即"立即放行"退化成"不计量的放行")。
 *   为什么**不动 `waiting`**:`waiting` 是 additive-increase 的唯一触发条件
 *   (`release` 里"有等待者才抬 cap")。observer 的放行不是"闸门有空位"的证据 ——
 *   它在 cap 满时也被放行,若顺手把 waiting 归零,就会把"还有人等"这一事实擦掉,
 *   cap 从此再也抬不回来。这是"判据必须覆盖门自己产出的形态"那一型,勿"顺手统一"。
 *   为什么仍跑 `idleResetIfNeeded`:空闲惰性重置与准入模式无关(它是时间维的)。
 */
export type AimdAskMode = 'gated' | 'observer'

/** release 的事件:outcome + 事件发生时的 epoch(判 stale)+ 对端 Retry-After(ms)。 */
export interface AimdReleaseEvent {
  outcome: 'success' | 'throttled' | 'timeout'
  /** 事件发生时的 epoch;低于当前 epoch ⇒ stale:只清 streak 不动 cap */
  eventEpoch?: number
  /** 对端 Retry-After 头(ms):带 ⇒ 即便 cap 减无可减也广播一条冷却 */
  retryAfterMs?: number
}

export interface ProviderAimdSnapshot {
  cap: number
  inflight: number
  waiting: number
  successStreak: number
  epoch: number
  epochProgress: number
  lastGood: number
  cooldownUntilMs: number
}

export class ProviderAimdGovernor {
  private readonly states = new Map<string, ProviderAimdState>()
  private readonly runCommands = new Map<string, { providerKey: string; target: number }>()
  private observers: Array<(change: ConcurrencyChange) => void> = []
  private pumpAllCb: (() => void) | null = null
  private readonly now: () => number

  constructor(now: () => number = () => Date.now()) {
    this.now = now
  }

  /** 进程级观察界('concurrency-changed'):只读遥测,返回退订函数。 */
  onConcurrencyChanged(cb: (change: ConcurrencyChange) => void): () => void {
    this.observers.push(cb)
    return () => {
      const idx = this.observers.indexOf(cb)
      if (idx >= 0) this.observers.splice(idx, 1)
    }
  }

  /** run 级泵闸回调:cap 抬高时调用一次(抬高多一次 pumpAll;调低不调)。 */
  setPumpAll(cb: (() => void) | null): void {
    this.pumpAllCb = cb
  }

  private emit(change: ConcurrencyChange): void {
    for (const cb of this.observers) cb(change)
  }

  private pump(): void {
    const cb = this.pumpAllCb
    if (cb) cb()
  }

  private state(key: string): ProviderAimdState {
    let s = this.states.get(key)
    if (!s) {
      s = {
        cap: MAX_CONCURRENCY,
        inflight: 0,
        waiting: 0,
        successStreak: 0,
        epochProgress: 0,
        epoch: 0,
        lastGood: MAX_CONCURRENCY,
        cooldownUntilMs: 0,
        lastActivityMs: this.now(),
      }
      this.states.set(key, s)
    }
    return s
  }

  /** 只读:当前 cap。 */
  capOf(key: string): number {
    return this.state(key).cap
  }

  /** 只读:单 key 诊断快照。 */
  snapshot(key: string): ProviderAimdSnapshot {
    const s = this.state(key)
    return {
      cap: s.cap,
      inflight: s.inflight,
      waiting: s.waiting,
      successStreak: s.successStreak,
      epoch: s.epoch,
      epochProgress: s.epochProgress,
      lastGood: s.lastGood,
      cooldownUntilMs: s.cooldownUntilMs,
    }
  }

  /**
   * 空闲惰性重置(在 ask 里惰性触发):闲置超过阈值 ⇒ 抬回天花板 + 状态归零。
   * 幂等守卫:已在天花板且状态干净 ⇒ 0 条 change、不翻 epoch、不 pump。
   */
  private idleResetIfNeeded(key: string, s: ProviderAimdState, t: number): void {
    if (t - s.lastActivityMs <= AIMD_IDLE_RESET_MS) return
    const clean =
      s.cap === MAX_CONCURRENCY &&
      s.successStreak === 0 &&
      s.epochProgress === 0 &&
      s.lastGood === MAX_CONCURRENCY &&
      s.cooldownUntilMs === 0
    s.successStreak = 0
    s.epochProgress = 0
    s.lastGood = MAX_CONCURRENCY
    s.cooldownUntilMs = 0
    if (clean) return
    const from = s.cap
    s.cap = MAX_CONCURRENCY
    this.emit({ providerKey: key, reason: 'recovery', from, to: s.cap, epoch: s.epoch })
    this.pump()
  }

  /** 申请一个槽位;拒绝时给"在等"的因果(闸门外排队 slot / 已排定退避 backoff)。 */
  ask(key: string, mode: AimdAskMode = 'gated'): { ok: true } | { ok: false; wait: AskWaitInfo } {
    const s = this.state(key)
    const t = this.now()
    this.idleResetIfNeeded(key, s, t)
    s.lastActivityMs = t
    if (mode === 'observer') {
      // 见 AimdAskMode 头注:放行不看 cap/冷却,但计入在飞;且不擦 waiting(那会让 cap 永不回升)
      s.inflight += 1
      return { ok: true }
    }
    if (s.cooldownUntilMs > t) {
      s.waiting += 1
      return { ok: false, wait: { cause: 'backoff', retryAtMs: s.cooldownUntilMs } }
    }
    if (s.inflight >= s.cap) {
      s.waiting += 1
      return { ok: false, wait: { cause: 'slot', retryAtMs: 0 } }
    }
    s.inflight += 1
    s.waiting = 0
    return { ok: true }
  }

  /**
   * 把 `waiting` 同步成**队列持有者**算出的真实等待者数(G-686 新增)。
   *
   * 为什么必须有它:`ask()` 放行时会把 `waiting` 归零(本文件既有的"能放行即非饱和"口径),
   * 而放行一次并不代表**其它 run**的排队者也拿到了名额 —— 准入队列住在
   * `provider/request-admission.ts`,不在这里。没有这次同步,`waiting` 会在每次放行后被
   * 擦成 0,additive-increase 的触发条件(`release` 里 `s.waiting > 0`)从此永不成立,
   * cap 减下去就再也抬不回来。
   *
   * 口径分工(写死在这里以免两处各算一遍):
   *   - cap / inflight / streak / epoch / cooldown 的唯一权威 = 本类
   *   - **等待者数的唯一权威 = 准入队列**(它调用本方法把事实递进来)
   */
  noteWaiters(key: string, count: number): void {
    const s = this.state(key)
    s.waiting = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
  }

  /**
   * 只归还名额、**不上报任何 AIMD 信号**(G-686 新增,给"非失败 retry"用)。
   *
   * 上游语义同形(workflow-concurrency-governor.ts:78-82 的 NON_FAILURE_RETRY_REASONS):
   * 这类尝试终结既不减 cap 也不清 streak —— 例:token 刷新后重发、推理签名修复后重发。
   * 它们不是"端点扛不住这个并发"的证据,喂进 `release()` 会让闸门因为一次自家修复而减半。
   * 但**名额必须还**,否则 inflight 只增不减,闸门会把自己钉死。
   */
  releaseCounted(key: string): void {
    const s = this.state(key)
    if (s.inflight > 0) s.inflight -= 1
    s.lastActivityMs = this.now()
  }

  /** 归还槽位并上报结果;返回本次产生的 change 列表(cap 减档/recovery/冷却广播)。 */
  release(key: string, ev: AimdReleaseEvent): ConcurrencyChange[] {
    const s = this.state(key)
    const t = this.now()
    s.lastActivityMs = t
    if (s.inflight > 0) s.inflight -= 1
    const changes: ConcurrencyChange[] = []

    if (ev.outcome === 'success') {
      s.successStreak += 1
      s.epochProgress += 1
      let batchBoundary = false
      if (s.epochProgress >= AIMD_EPOCH_BATCH) {
        s.epochProgress = 0
        s.epoch += 1
        batchBoundary = true
      }
      if (s.successStreak >= AIMD_LASTGOOD_STREAK) {
        s.lastGood = s.cap
        // 有等待者才抬 cap;无等待者只设 lastGood、cap 不变
        if (batchBoundary && s.waiting > 0 && s.cap < MAX_CONCURRENCY) {
          const from = s.cap
          s.cap = Math.min(MAX_CONCURRENCY, s.cap + AIMD_ADDITIVE_STEP)
          changes.push({ providerKey: key, reason: 'recovery', from, to: s.cap, epoch: s.epoch })
          this.pump()
        }
      }
    } else {
      // 减档分支:throttled(429)/ timeout
      const stale = typeof ev.eventEpoch === 'number' && ev.eventEpoch < s.epoch
      s.successStreak = 0
      if (!stale) {
        // 旧 epoch 的事件只清 streak 不动 cap
        const from = s.cap
        let to = from
        if (from > s.lastGood) {
          // 高于已知良好档:直接退回 lastGood,不按系数减
          to = Math.max(MIN_CONCURRENCY, s.lastGood)
        } else {
          to = Math.max(MIN_CONCURRENCY, Math.floor(from * AIMD_DECREASE_FACTOR))
          s.lastGood = 0
        }
        if (to < from) {
          s.cap = to
          changes.push({
            providerKey: key,
            reason: ev.outcome === 'throttled' ? 'throttle-429' : 'timeout',
            from,
            to,
            epoch: s.epoch,
          })
        }
        const ra = ev.retryAfterMs
        if (typeof ra === 'number' && ra > 0) {
          s.cooldownUntilMs = t + ra
          changes.push({
            providerKey: key,
            reason: 'retry-after',
            from: s.cap,
            to: s.cap,
            epoch: s.epoch,
            cooldownUntilMs: s.cooldownUntilMs,
          })
        }
      }
    }
    // 本票 release 产生的所有 change 统一走进程级观察界(只读遥测)
    for (const c of changes) this.emit(c)
    return changes
  }

  /**
   * run 级命令('run-caps-changed'):就地抬/调本 run 上界。
   * - 同 runId 同值重复 ⇒ 幂等 no-op(不铸后继、不发 change)
   * - 在飞一个不丢:调低只收紧新闸门,不召回在飞(inflight 可暂高于 cap)
   * - 抬高 ⇒ 调一次 pumpAll;调低 ⇒ 不调
   */
  applyRunCapCommand(runId: string, providerKey: string, target: number): ConcurrencyChange | null {
    const prior = this.runCommands.get(runId)
    const to = Math.min(MAX_CONCURRENCY, Math.max(MIN_CONCURRENCY, Math.floor(target)))
    if (prior && prior.providerKey === providerKey && prior.target === to) return null
    this.runCommands.set(runId, { providerKey, target: to })
    const s = this.state(providerKey)
    s.lastActivityMs = this.now()
    const from = s.cap
    if (to === from) return null
    s.cap = to
    const change: ConcurrencyChange = { providerKey, reason: 'manual', from, to, epoch: s.epoch }
    this.emit(change)
    if (to > from) this.pump()
    return change
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
