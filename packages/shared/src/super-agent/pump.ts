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
  kind: 'port_error' | 'dispatch_error' | 'lease_reclaimed'
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
    } = {},
  ) {}

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
  }> {
    if (this.running) return { ingested: 0, accepted: 0, dispatched: 0, reclaimed: [] }
    this.running = true
    let ingested = 0
    let accepted = 0
    let dispatched = 0
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
      // 租约巡检按本轮涉及的主体收尾结算；回收→promote 的新占槽即时补一派发，
      // 不让重派多等一拍（事件驱动停幅，不赌节拍）。
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
    }
    return { ingested, accepted, dispatched, reclaimed }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
