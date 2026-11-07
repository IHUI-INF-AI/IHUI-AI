// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { SuperAgentPump, type TriggerSourcePort } from './pump'
import { DEFAULT_SUPER_AGENT_POLICY, SuperAgentHost } from './engine'
import type { IncomingTrigger, ReceiveResult } from './engine'
import type { WorkerAssignment } from './roles'

function fakeClock(start = 0) {
  let now = start
  let n = 0
  return {
    tick: (ms: number) => {
      now += ms
    },
    clock: {
      now: () => now,
      id: (prefix: string) => `${prefix}_${(n += 1).toString(36)}`,
    },
  }
}

function trigger(id: string): IncomingTrigger {
  return {
    id,
    sourceId: 'src-1',
    threadId: 'thread-1',
    actorId: 'user-1',
    addressed: true,
    fromBot: false,
    text: `任务 ${id}`,
  }
}

interface FakeHost {
  receive(t: IncomingTrigger, owner: string): ReceiveResult
  takeStarted(): WorkerAssignment[]
  tickLeases(owner: string): { reclaimed: string[] }
  calls: string[]
}

function fakeHost(
  script: { started?: WorkerAssignment[]; reclaimedEachTick?: string[] } = {},
): FakeHost {
  const host: FakeHost = {
    calls: [],
    receive(t) {
      host.calls.push(`receive:${t.id}:${t.actorId}`)
      return { disposition: 'accepted', ticketId: `ticket-${t.id}`, speech: null }
    },
    takeStarted() {
      host.calls.push('takeStarted')
      const rows = script.started ?? []
      script.started = []
      return rows
    },
    tickLeases(owner) {
      host.calls.push(`tick:${owner}`)
      return { reclaimed: script.reclaimedEachTick ?? [] }
    },
  }
  return host
}

const work: WorkerAssignment = {
  sessionId: 'worker-ticket-1',
  directory: 'super-agent/user-1/ticket-1',
  goal: '任务 t1',
  constraints: '',
  deliverables: '',
  role: 'worker',
  ownerUserId: 'user-1',
}

describe('super-agent pump 行为', () => {
  it('空注册表：一轮零动作', async () => {
    const p = fakeHost()
    const pump = new SuperAgentPump(
      p as unknown as SuperAgentHost,
      () => [],
      async () => ({ ok: true }),
    )
    expect(await pump.runOnce()).toMatchObject({
      ingested: 0,
      accepted: 0,
      dispatched: 0,
      reclaimed: [],
    })
  })

  it('拉事件→收单→派发成功计数；takeStarted 归泵消费', async () => {
    const port: TriggerSourcePort = {
      sourceId: 'src-1',
      ownerUserId: 'user-1',
      fetchTriggers: async () => [trigger('t1')],
    }
    const p = fakeHost({ started: [work], reclaimedEachTick: ['ticket-gone'] })
    const dispatched: string[] = []
    const pump = new SuperAgentPump(
      p as unknown as SuperAgentHost,
      () => [port],
      async (w) => {
        dispatched.push(w.sessionId)
        return { ok: true }
      },
    )
    const r = await pump.runOnce()
    expect(r).toEqual({ ingested: 1, accepted: 1, dispatched: 1, reclaimed: ['ticket-gone'] })
    expect(dispatched).toEqual(['worker-ticket-1'])
    expect(p.calls).toContain('receive:t1:user-1')
  })

  it('单端口故障只隔离该端口并计数，其余照常；重复故障累加', async () => {
    const bad: TriggerSourcePort = {
      sourceId: 'bad',
      ownerUserId: 'user-1',
      fetchTriggers: async () => {
        throw new Error('boom')
      },
    }
    const good: TriggerSourcePort = {
      sourceId: 'good',
      ownerUserId: 'user-1',
      fetchTriggers: async () => [trigger('ok1')],
    }
    const p = fakeHost()
    const logs: { kind: string; source: string }[] = []
    const pump = new SuperAgentPump(
      p as unknown as SuperAgentHost,
      () => [bad, good],
      async () => ({
        ok: true,
      }),
      { onLog: (row) => logs.push({ kind: row.kind, source: row.source }) },
    )
    const r = await pump.runOnce()
    expect(r.ingested).toBe(1)
    expect(pump.failures()).toEqual([{ sourceId: 'bad', count: 1 }])
    expect(logs).toEqual([{ kind: 'port_error', source: 'bad' }])
    await pump.runOnce()
    expect(pump.failures()).toEqual([{ sourceId: 'bad', count: 2 }])
  })

  it('派发失败不计数、记日志，轮次照常完成', async () => {
    const port: TriggerSourcePort = {
      sourceId: 'src-1',
      ownerUserId: 'user-1',
      fetchTriggers: async () => [trigger('t1')],
    }
    const p = fakeHost({ started: [work] })
    const logs: string[] = []
    const pump = new SuperAgentPump(
      p as unknown as SuperAgentHost,
      () => [port],
      async () => ({
        ok: false,
        error: 'quota',
      }),
      { onLog: (row) => logs.push(`${row.kind}:${row.note}`) },
    )
    const r = await pump.runOnce()
    expect(r.dispatched).toBe(0)
    expect(logs).toEqual(['dispatch_error:quota'])
  })

  it('与真控制面联动：租约到期由泵回收并重新派发（端到端语义钉）', async () => {
    const c = fakeClock(100)
    const host = new SuperAgentHost(
      { ...DEFAULT_SUPER_AGENT_POLICY, workerLeaseMs: 10_000 },
      c.clock,
    )
    const port: TriggerSourcePort = {
      sourceId: 'src-1',
      ownerUserId: 'user-1',
      fetchTriggers: async () => [trigger('t1')],
    }
    const seen: string[] = []
    const pump = new SuperAgentPump(
      host as SuperAgentHost,
      () => [port],
      async (w) => {
        seen.push(w.goal)
        return { ok: true }
      },
    )
    const first = await pump.runOnce()
    expect(first.dispatched).toBe(1)
    c.tick(10_001)
    const second = await pump.runOnce()
    // 回收→promote→同轮补派发：重派不隔拍
    expect(second.reclaimed).toHaveLength(1)
    expect(second.dispatched).toBe(1)
    expect(seen).toEqual(['任务 t1', '任务 t1'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
