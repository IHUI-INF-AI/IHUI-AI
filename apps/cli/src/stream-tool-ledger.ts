// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 流式期工具登记账本(stream tool ledger)。
 *
 * 要解决的真实问题:模型还在流式输出时,工具调用其实**已经完整可读**了
 * (provider 的 tool-call 事件带完整 args),但旧实现要等整条流结束才提取、才执行。
 * 这带来两个后果:
 * 1. 白等 —— 一条长回答里前几个工具本可以和后面的文字并行跑;
 * 2. **断流后无法对账** —— 流被截断/进程重启时,没人知道哪些工具已经真的发出去了,
 *    于是既不敢重放(可能重复副作用),也不敢确认(可能漏跑)。
 *
 * 账本因此承担三件事:
 * - 流内**即时登记**(register),按到达顺序给单调 seq;
 * - **提前执行**(tryStartEarly),只对判定为无副作用的调用开放,且执行入口幂等
 *   (runOnce:同一个调用第二次拿结果时复用已发起的 promise,绝不重复执行);
 * - **恢复锚点**(RecoveryAnchor + snapshot):每条记录带 `fingerprint`(轮次+工具名+
 *   规范化参数的哈希)与 `anchorId`,断流后新账本可与旧快照对账,把
 *   "确定已落地 / 状态未知 / 从未发起"三类分开 —— 未知项必须显式列出,
 *   不得为了"看起来干净"把它当成没发生。
 *
 * 幂等口径(重要):去重键是 `fingerprint#occurrence`,occurrence 是该指纹在本轮内
 * 第几次出现。不用指纹单独作键,是因为同一轮里模型**可以**合法地发起两次同名同参
 * 调用(如连续读同一文件的两次),按指纹合并会把两次静默压成一次 —— 那是改语义,
 * 不是修 bug。
 */

import { createHash } from 'node:crypto'

/** 单条登记项的状态机(只前进不回退) */
export type LedgerState = 'registered' | 'started' | 'settled' | 'lost'

export interface RecoveryAnchor {
  /** 会话内轮次(1 起) */
  turn: number
  /** 本轮流的标识(重连后会换,用于区分"同一轮的两条流") */
  streamId: string
  /** 流内到达序号(单调,1 起) */
  seq: number
  /** 轮次+工具名+规范化参数的稳定指纹,跨流可辨认同一个调用 */
  fingerprint: string
}

export interface LedgerEntry {
  anchor: RecoveryAnchor
  /**
   * 去重键 = `fingerprint#该指纹在本轮的第几次出现`。
   * 刻意不用指纹单独作键:同一轮里模型可以合法发起两次同名同参调用
   * (如连续两次读同一文件),按指纹合并会把两次静默压成一次 —— 那是改语义。
   */
  dedupeKey: string
  /** provider 给的工具调用 id(本地 provider 有,部分远端流不给) */
  toolCallId?: string
  toolName: string
  args: Record<string, unknown>
  /** 是否由"提前执行"路径发起(true = 流还没结束就跑起来了) */
  early: boolean
  state: LedgerState
  startedAtMs?: number
  settledAtMs?: number
  /** settled 之后的成败(不含结果体,结果由调用方自己持有) */
  ok?: boolean
  /** 未发起执行的原因(权限/非只读/已取消) */
  skipReason?: string
}

export interface LedgerSnapshot {
  version: 1
  turn: number
  streamId: string
  createdAtMs: number
  endOfStreamAtMs?: number
  entries: LedgerEntry[]
}

/** 一条调用"能不能提前跑"的判定由调用方注入(它才知道权限模式与工具危险级) */
export type EarlyEligibility = (toolName: string) => boolean

export interface ReconcileReport {
  /** 旧账本已 settle、本轮又被重新登记 → 同一意图第二次发起,必须警惕重复副作用 */
  replayed: RecoveryAnchor[]
  /** 旧账本 started 但从未 settle → 副作用状态未知,必须人工/上层确认 */
  unknownEffect: RecoveryAnchor[]
  /** 旧账本已 settle 且本轮没有重发 → 正常收尾 */
  settled: RecoveryAnchor[]
}

/** runOnce 的返回值:附带"是不是复用已在途的执行"这一可观测位 */
export interface RunOnceResult<T> {
  value: T
  /** true = 复用了提前执行时发起的那一次(没有重复副作用) */
  reused: boolean
  /** 本次是第几次为该键发起执行(>1 即说明出现过重复请求) */
  attempts: number
}

export interface StreamToolLedgerOptions {
  turn: number
  streamId: string
  mayRunEarly?: EarlyEligibility
  now?: () => number
}

/** 规范化参数:递归按 key 排序,消除"同一对象两种 JSON 串"造成的指纹分裂 */
export function canonicalizeArgs(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null)
  if (Array.isArray(value)) return `[${value.map((v) => canonicalizeArgs(v)).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalizeArgs(obj[k])}`).join(',')}}`
}

/** 稳定指纹:同名同参同轮 → 同值,与 args 的键序无关 */
export function computeFingerprint(
  turn: number,
  toolName: string,
  args: Record<string, unknown>,
): string {
  return createHash('sha1')
    .update(`${turn}|${toolName}|${canonicalizeArgs(args)}`)
    .digest('hex')
    .slice(0, 16)
}

/**
 * 本轮的工具账本。一个 StreamToolLedger 实例对应**一轮的一条流**。
 */
export class StreamToolLedger {
  private readonly turn: number
  private readonly streamId: string
  private readonly mayRunEarly: EarlyEligibility
  private readonly now: () => number
  private readonly list: LedgerEntry[] = []
  private readonly byKey = new Map<string, LedgerEntry>()
  /** dedupeKey → 已在途/已完成 的执行 */
  private readonly inFlight = new Map<string, Promise<unknown>>()
  private readonly attempts = new Map<string, number>()
  /** fingerprint → 本轮已出现次数(occurrence 计数,保证同名同参不被合并) */
  private readonly seen = new Map<string, number>()
  private endOfStreamAtMs: number | undefined

  constructor(opts: StreamToolLedgerOptions) {
    this.turn = opts.turn
    this.streamId = opts.streamId
    this.mayRunEarly = opts.mayRunEarly ?? (() => false)
    this.now = opts.now ?? (() => Date.now())
  }

  get size(): number {
    return this.list.length
  }

  /** 流是否已收尾(end_of_stream 时机是否已到) */
  get ended(): boolean {
    return this.endOfStreamAtMs !== undefined
  }

  /**
   * 流内即时登记。同一个 toolCallId 重复登记不会造出第二条(幂等)。
   *
   * 登记即尝试提前执行:eligible 就当场把 run 发出去,不等流结束。
   */
  register(
    call: { toolCallId?: string; toolName: string; args: Record<string, unknown> },
    run?: () => Promise<unknown>,
  ): LedgerEntry {
    if (call.toolCallId) {
      const existing = this.list.find((e) => e.toolCallId === call.toolCallId)
      if (existing) return existing
    }
    const fingerprint = computeFingerprint(this.turn, call.toolName, call.args)
    const occurrence = (this.seen.get(fingerprint) ?? 0) + 1
    this.seen.set(fingerprint, occurrence)
    const dedupeKey = `${fingerprint}#${occurrence}`
    const entry: LedgerEntry = {
      anchor: {
        turn: this.turn,
        streamId: this.streamId,
        seq: this.list.length + 1,
        fingerprint,
      },
      dedupeKey,
      toolCallId: call.toolCallId,
      toolName: call.toolName,
      args: call.args,
      early: false,
      state: 'registered',
    }
    this.list.push(entry)
    this.byKey.set(dedupeKey, entry)
    if (run && this.mayRunEarly(call.toolName)) void this.start(entry, run, true)
    return entry
  }

  /** 按到达顺序取第 idx 条登记项(诊断用) */
  at(index: number): LedgerEntry | undefined {
    return this.list[index]
  }

  /** 全部登记项(只读视图,按到达顺序) */
  entries(): LedgerEntry[] {
    return [...this.list]
  }

  /**
   * 按 (工具名, 参数) 找回登记项 —— 主执行路径用它而**不是按下标对齐**。
   *
   * 下标对齐看着更省,但它假设"登记顺序 == 提取顺序"。上游解析器一旦丢掉某条
   * (形态不符的 entry 会 continue),两边就整体错位一格:后一条会复用前一条
   * 已在途的 promise,拿到的是**另一个工具的结果**,而本该跑的那一次被静默跳过。
   * 所以这里按指纹找,并且同指纹多次出现时把已消费过的那条跳过。
   */
  matchForCall(toolName: string, args: Record<string, unknown>): LedgerEntry | undefined {
    const fingerprint = computeFingerprint(this.turn, toolName, args)
    for (const entry of this.list) {
      if (entry.anchor.fingerprint !== fingerprint) continue
      if (this.attempts.has(entry.dedupeKey)) continue
      return entry
    }
    return undefined
  }

  /**
   * 幂等执行入口:同一个去重键只真正跑一次。
   *
   * 提前执行已发起 → 这里复用同一个 promise;尚未发起 → 这里发起。
   * 流结束后主执行路径走的就是这个口。
   */
  async runOnce<T>(
    entry: LedgerEntry,
    run: () => Promise<T>,
    options?: { allowLateStart?: boolean },
  ): Promise<RunOnceResult<T>> {
    const key = entry.dedupeKey
    const attempts = (this.attempts.get(key) ?? 0) + 1
    this.attempts.set(key, attempts)
    const existing = this.inFlight.get(key) as Promise<T> | undefined
    if (existing) {
      return { value: await existing, reused: true, attempts }
    }
    if (options?.allowLateStart === false) {
      throw new Error(`stream-tool-ledger: no in-flight run for ${key} (allowLateStart=false)`)
    }
    const promise = run()
    this.inFlight.set(key, promise)
    entry.state = 'started'
    entry.startedAtMs = this.now()
    try {
      const value = await promise
      entry.state = 'settled'
      entry.ok = true
      entry.settledAtMs = this.now()
      return { value, reused: false, attempts }
    } catch (err) {
      entry.state = 'settled'
      entry.ok = false
      entry.settledAtMs = this.now()
      throw err
    }
  }

  /** 由 register 的提前执行路径调用 */
  private async start(entry: LedgerEntry, run: () => Promise<unknown>, early: boolean): Promise<void> {
    const key = entry.dedupeKey
    if (this.inFlight.has(key)) return
    entry.early = early
    entry.state = 'started'
    entry.startedAtMs = this.now()
    const promise = run()
    this.inFlight.set(key, promise)
    try {
      await promise
      entry.state = 'settled'
      entry.ok = true
    } catch {
      // 提前执行的失败**不改写**账本结论为"没跑过":请求已经发出去了,
      // 副作用是否存在属未知。标记 settled+ok=false,由主路径决定要不要重试。
      entry.state = 'settled'
      entry.ok = false
    } finally {
      entry.settledAtMs = this.now()
    }
  }

  /**
   * end_of_stream 时机:流读完了。此时仍未发起的登记项判 `lost`
   * (模型声明了要调用却没走到执行 —— 断流或上层提前 break),必须如实报出来。
   */
  markEndOfStream(): LedgerEntry[] {
    this.endOfStreamAtMs = this.now()
    const lost: LedgerEntry[] = []
    for (const entry of this.list) {
      if (entry.state === 'registered') {
        entry.state = 'lost'
        entry.skipReason = 'end-of-stream before dispatch'
        lost.push(entry)
      }
    }
    return lost
  }

  /** 可序列化快照:断流/重启后据此对账 */
  snapshot(): LedgerSnapshot {
    return {
      version: 1,
      turn: this.turn,
      streamId: this.streamId,
      createdAtMs: this.now(),
      endOfStreamAtMs: this.endOfStreamAtMs,
      entries: this.list.map((e) => ({ ...e })),
    }
  }

  /**
   * 与上一份快照对账(恢复路径)。三类结果都必须给出,不得合并成"看起来没问题"。
   */
  static reconcile(prev: LedgerSnapshot, current: LedgerEntry[]): ReconcileReport {
    const report: ReconcileReport = { replayed: [], unknownEffect: [], settled: [] }
    const currentFingerprints = new Set(current.map((e) => e.anchor.fingerprint))
    for (const entry of prev.entries) {
      if (entry.state === 'started') {
        report.unknownEffect.push(entry.anchor)
        continue
      }
      if (entry.state !== 'settled') continue
      if (currentFingerprints.has(entry.anchor.fingerprint)) {
        report.replayed.push(entry.anchor)
      } else {
        report.settled.push(entry.anchor)
      }
    }
    return report
  }
}

/**
 * 账本摘要(诊断用,面向终端)。
 *
 * 刻意只输出 ASCII:硬编码中文文案在 cli/src 会撞基线棘轮守门,
 * 且这一行是给自己人看的技术诊断,不是产品文案。
 */
export function formatLedgerSummary(snapshot: LedgerSnapshot): string {
  const counts = { registered: 0, started: 0, settled: 0, lost: 0 }
  let earlyCount = 0
  for (const entry of snapshot.entries) {
    counts[entry.state] += 1
    if (entry.early) earlyCount += 1
  }
  const okCount = snapshot.entries.filter((e) => e.ok === true).length
  const failCount = snapshot.entries.filter((e) => e.ok === false).length
  return (
    `turn=${snapshot.turn} stream=${snapshot.streamId.slice(0, 8)} ` +
    `registered=${snapshot.entries.length} early=${earlyCount} ` +
    `settled=${counts.settled}(ok=${okCount},fail=${failCount}) ` +
    `unknown=${counts.started} lost=${counts.lost} ` +
    `endOfStream=${snapshot.endOfStreamAtMs === undefined ? 'no' : 'yes'}`
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
