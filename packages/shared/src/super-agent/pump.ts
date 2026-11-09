// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Watchdog 泵：把「来源拉事件 → 控制面收单 → 占槽工人派发 → 租约巡检回收」
 * 编成一轮可注入的纯逻辑节拍。行为对照 DeepSeek dsh-superagent 的
 * 事件驱动 + 看门狗语义；本文件为自写实现。
 * 超越点：单端口故障只隔离该端口并点名计数（portFailures），其余端口照常进食；
 * 派发失败交 deliveryFailed 归因入面板，而不是静默吞。
 *
 * 零 node: 内建、零定时器 — setInterval 由宿主（apps/api）注入。
 */

import type { IncomingTrigger, SuperAgentHost } from './engine'
import type { WorkerAssignment } from './roles'
import type { SuperAgentSnapshot } from './persist'
import type { SlowJudgeCall } from './slow-path'

/**
 * 慢路径判定节流间隔（默认 5 分钟）。
 * 设计理由：泵每轮（默认 60s）都会看到同一批推断积压，若每轮都调模型，
 * 成本随轮次线性增长且对同一条内容重复判定毫无信息增量；5 分钟既保证
 * 疑似请求在可接受延迟内拿到判定，又把单主体的模型调用压到 ≤12 次/小时。
 */
export const DEFAULT_SLOW_JUDGE_INTERVAL_MS = 5 * 60 * 1000

/** 一个来源 = 一个登录主体 + 一个可拉取事件的端口（webhook 落盘回放、轮询器都实现它）。 */
export interface TriggerSourcePort {
  readonly sourceId: string
  readonly ownerUserId: string
  fetchTriggers(): Promise<IncomingTrigger[]>
}

/** 占槽工人的派发出口。宿主把它接到 subagentDispatchService。 */
export type WorkerDispatch = (work: WorkerAssignment) => Promise<{ ok: boolean; error?: string }>

export interface PumpLogRow {
  at: number
  kind:
    'port_error' | 'dispatch_error' | 'lease_reclaimed' | 'slow_judge_error' | 'slow_auto_accept'
  source: string
  note: string
}

export class SuperAgentPump {
  private readonly portFailures = new Map<string, number>()
  private running = false

  constructor(
    private readonly host: SuperAgentHost,
    private readonly ports: () => TriggerSourcePort[],
    private readonly dispatch: WorkerDispatch,
    private readonly options: {
      now?: () => number
      onLog?: (row: PumpLogRow) => void
      /** 每轮（含 no-op）结束喊一次；宿主自己判 dirty 去抖。 */
      onCycle?: (snapshot: SuperAgentSnapshot) => void
      /** 慢路径判定通道；不给=泵完全不碰推断积压（保持纯快路径既有行为）。 */
      slowJudge?: SlowJudgeCall
      /** 慢路径节流间隔（毫秒）；默认 DEFAULT_SLOW_JUDGE_INTERVAL_MS。 */
      slowJudgeMinIntervalMs?: number
    } = {},
  ) {}

  /** 上一次真正调用慢路径判定的时刻；null＝本泵还没判过。 */
  private lastSlowJudgeAt: number | null = null

  private get now(): number {
    return (this.options.now ?? Date.now)()
  }

  private log(kind: PumpLogRow['kind'], source: string, note: string): void {
    this.options.onLog?.({ at: this.now, kind, source, note })
  }

  /** 端口故障读数（只增不身份化，供健康哨兵取用）。 */
  failures(): { sourceId: string; count: number }[] {
    return [...this.portFailures.entries()].map(([sourceId, count]) => ({ sourceId, count }))
  }

  /** 跑一轮：先收齐事件，收尾统一结算派发与租约（回收即重派不隔拍）。 */
  async runOnce(): Promise<{
    ingested: number
    accepted: number
    dispatched: number
    reclaimed: string[]
    slowJudged: number
    slowUnjudged: number
    /** 本轮是否因节流跳过了慢路径判定（可观测，不静默）。 */
    slowThrottled: boolean
  }> {
    if (this.running) {
      this.options.onCycle?.(this.host.snapshot())
      return {
        ingested: 0,
        accepted: 0,
        dispatched: 0,
        reclaimed: [],
        slowJudged: 0,
        slowUnjudged: 0,
        slowThrottled: false,
      }
    }
    this.running = true
    let ingested = 0
    let accepted = 0
    let dispatched = 0
    let slowJudged = 0
    let slowUnjudged = 0
    let slowThrottled = false
    const reclaimed: string[] = []
    try {
      const owners = new Set<string>()
      for (const port of this.ports()) {
        owners.add(port.ownerUserId)
        let triggers: IncomingTrigger[] = []
        try {
          triggers = await port.fetchTriggers()
        } catch (e) {
          const n = (this.portFailures.get(port.sourceId) ?? 0) + 1
          this.portFailures.set(port.sourceId, n)
          this.log('port_error', port.sourceId, e instanceof Error ? e.message : String(e))
          continue
        }
        for (const trigger of triggers) {
          ingested += 1
          const result = this.host.receive(trigger, port.ownerUserId)
          if (result.disposition === 'accepted') accepted += 1
        }
      }
      const started = this.host.takeStarted()
      for (const work of started) {
        try {
          const r = await this.dispatch(work)
          if (r.ok) {
            dispatched += 1
          } else {
            this.log('dispatch_error', work.sessionId, r.error ?? 'dispatch_failed')
          }
        } catch (e) {
          this.log('dispatch_error', work.sessionId, e instanceof Error ? e.message : String(e))
        }
      }
      // 慢路径：本轮涉及的 inferred 积压交注入判定器（无判定器=零动作，既有行为不变）。
      // 节流：确定性过滤（receive 的 paused/actor_mismatch/bot 等）已经把绝大多数事件挡在
      // recordedTriggers 之外；这里再加一道时间闸，避免同一批积压每轮重复烧 token。
      // 节流戳只在真正调用时推进；判定通道抛错也算"调用过"，避免故障期间每轮重试放大成本
      // （积压本身不动，下个窗口仍可重判）。
      if (this.options.slowJudge) {
        const interval = this.options.slowJudgeMinIntervalMs ?? DEFAULT_SLOW_JUDGE_INTERVAL_MS
        if (this.lastSlowJudgeAt !== null && this.now - this.lastSlowJudgeAt < interval) {
          slowThrottled = true
        } else if (owners.size > 0) {
          this.lastSlowJudgeAt = this.now
          for (const owner of owners) {
            const judged = await this.host.judgeRecorded(owner, this.options.slowJudge)
            slowJudged += judged.judged
            slowUnjudged += judged.unjudged
            if (judged.error) {
              this.log('slow_judge_error', owner, judged.error)
            }
            for (const acc of judged.autoAccepted) {
              this.log('slow_auto_accept', owner, `${acc.triggerId}:${acc.ticketId}`)
            }
          }
        }
      }
      // 租约巡检按本轮涉及的主体收尾结算；回收→promote 的新占槽即时补一派发，
      // 不让重派多等一拍（事件驱动停幅，不赌节拍）。
      const slowStarted = this.host.takeStarted()
      for (const work of slowStarted) {
        try {
          const r = await this.dispatch(work)
          if (r.ok) {
            dispatched += 1
          } else {
            this.log('dispatch_error', work.sessionId, r.error ?? 'dispatch_failed')
          }
        } catch (e) {
          this.log('dispatch_error', work.sessionId, e instanceof Error ? e.message : String(e))
        }
      }
      for (const owner of owners) {
        const ticked = this.host.tickLeases(owner)
        if (ticked.reclaimed.length > 0) {
          reclaimed.push(...ticked.reclaimed)
          this.log('lease_reclaimed', owner, ticked.reclaimed.join(','))
        }
        const revived = this.host.takeStarted()
        for (const work of revived) {
          try {
            const r = await this.dispatch(work)
            if (r.ok) {
              dispatched += 1
            } else {
              this.log('dispatch_error', work.sessionId, r.error ?? 'dispatch_failed')
            }
          } catch (e) {
            this.log('dispatch_error', work.sessionId, e instanceof Error ? e.message : String(e))
          }
        }
      }
    } finally {
      this.running = false
      this.options.onCycle?.(this.host.snapshot())
    }
    return {
      ingested,
      accepted,
      dispatched,
      reclaimed,
      slowJudged,
      slowUnjudged,
      slowThrottled,
    }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
