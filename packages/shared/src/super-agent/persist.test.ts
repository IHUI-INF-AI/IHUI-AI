// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { DEFAULT_SUPER_AGENT_POLICY, SuperAgentHost } from './engine'
import { SNAPSHOT_VERSION } from './persist'
import type { IncomingTrigger } from './engine'

function fakeClock(start = 5_000) {
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

function trig(id: string, overrides: Partial<IncomingTrigger> = {}): IncomingTrigger {
  return {
    id,
    sourceId: 'src-1',
    threadId: 'thread-1',
    actorId: 'user-1',
    addressed: true,
    fromBot: false,
    text: `任务 ${id}`,
    ...overrides,
  }
}

function buildBusy(): { host: SuperAgentHost; ids: Record<string, string | undefined> } {
  const c = fakeClock()
  const host = new SuperAgentHost(
    { ...DEFAULT_SUPER_AGENT_POLICY, workerLeaseMs: 10_000 },
    c.clock,
    { onDirty: () => c.clock.now() },
  )
  const a = host.receive(trig('tA'), 'user-1')
  const b = host.receive(trig('tB', { threadId: 'thread-2' }), 'user-1')
  const inferred = host.receive(trig('tC', { addressed: false, threadId: 'thread-3' }), 'user-1')
  if (b.ticketId) host.report(b.ticketId, 'user-1', { state: 'progress', text: '半路' })
  if (a.ticketId) host.followForContext('user-1', a.ticketId, 'src-2', 'thread-9')
  if (a.ticketId) host.takeStarted()
  return {
    host,
    ids: {
      a: a.ticketId,
      b: b.ticketId,
      inferredRecorded: inferred.reason === 'recorded' ? 'tC' : undefined,
    },
  }
}

describe('super-agent 快照（存算分离）', () => {
  it('往返等价：面板、租约截止、pendingStart、计数逐片对上', () => {
    const c = fakeClock()
    const host = new SuperAgentHost(
      { ...DEFAULT_SUPER_AGENT_POLICY, workerLeaseMs: 10_000 },
      c.clock,
    )
    const a = host.receive(trig('tA'), 'user-1')
    const b = host.receive(trig('tB', { threadId: 'thread-2' }), 'user-1')
    host.receive(trig('tC', { addressed: false, threadId: 'thread-3' }), 'user-1')
    if (b.ticketId) host.report(b.ticketId, 'user-1', { state: 'progress', text: '半路' })
    if (a.ticketId) host.followForContext('user-1', a.ticketId, 'src-2', 'thread-9')
    // 不 takeStarted：两个已占槽未派出的工人必须跟着快照活下来
    const snap = JSON.parse(JSON.stringify(host.snapshot()))
    expect(snap.version).toBe(SNAPSHOT_VERSION)
    const c2 = fakeClock(9_000)
    const restored = new SuperAgentHost(
      { ...DEFAULT_SUPER_AGENT_POLICY, workerLeaseMs: 10_000 },
      c2.clock,
    )
    const report = restored.restore(snap)
    expect(report.ok).toBe(true)
    expect(report.rejected).toEqual([])
    const idA = a.ticketId!
    const original = host.getTicket(idA, 'user-1')!
    const copy = restored.getTicket(idA, 'user-1')!
    expect(copy.assignment?.leaseExpiresAt).toBe(original.assignment?.leaseExpiresAt)
    expect(copy.attention).toEqual(original.attention)
    expect(copy.ended).toEqual(original.ended)
    // 面板对齐
    expect(JSON.stringify(restored.panel('user-1'))).toBe(JSON.stringify(host.panel('user-1')))
    // pendingStart 未消费的工人跟着快照活下来
    const started = restored.takeStarted()
    expect(started.map((w) => w.sessionId)).toEqual([`worker-${idA}`, `worker-${b.ticketId}`])
    void c
  })

  it('重放幂等：恢复后同 id 触发重新 receive 必判 duplicate，不重开工单', () => {
    const { host } = buildBusy()
    const snap = JSON.parse(JSON.stringify(host.snapshot()))
    const restored = new SuperAgentHost(
      { ...DEFAULT_SUPER_AGENT_POLICY, workerLeaseMs: 10_000 },
      fakeClock(9_000).clock,
    )
    restored.restore(snap)
    const again = restored.receive(trig('tA'), 'user-1')
    expect(again.disposition).toBe('duplicate')
    const c2 = restored.receive(trig('tA2', { threadId: 'thread-42' }), 'user-1')
    expect(c2.disposition).toBe('accepted')
  })

  it('版本 fail-closed：不匹配整场拒绝，账面回到恢复前', () => {
    const host = new SuperAgentHost(DEFAULT_SUPER_AGENT_POLICY, fakeClock().clock)
    host.receive(trig('keep'), 'user-1')
    const before = JSON.stringify(host.panel('user-1'))
    const bad = {
      version: 'super-agent-snapshot-v0',
      takenAt: 1,
      defaultPolicy: DEFAULT_SUPER_AGENT_POLICY,
      policies: [],
      owners: [],
      correlations: [],
      pendingStart: [],
    }
    const report = host.restore(bad)
    expect(report.ok).toBe(false)
    expect(report.rejected[0]!.reason).toBe('version_mismatch')
    expect(JSON.stringify(host.panel('user-1'))).toBe(before)
  })

  it('形状 fail-closed：票的 owner 与切片主体不匹配 ⇒ 整片拒绝', () => {
    const host = new SuperAgentHost(DEFAULT_SUPER_AGENT_POLICY, fakeClock().clock)
    const a = host.receive(trig('tA'), 'user-1')
    const snap = JSON.parse(JSON.stringify(host.snapshot()))
    const owner = snap.owners.find((o: { ownerUserId: string }) => o.ownerUserId === 'user-1')
    void a
    owner.slice.tickets[0].ownerUserId = 'user-evil'
    const report = host.restore(snap)
    expect(report.ok).toBe(false)
    expect(report.rejected).toContainEqual(expect.objectContaining({ reason: 'owner_mismatch' }))
  })

  it('时钟倒退：恢复成功但 rejected 点名 clock_behind，不谎称干净', () => {
    const c1 = fakeClock(100_000)
    const host = new SuperAgentHost(DEFAULT_SUPER_AGENT_POLICY, c1.clock)
    host.receive(trig('tA'), 'user-1')
    const snap = JSON.parse(JSON.stringify(host.snapshot()))
    const slow = fakeClock(1)
    const restored = new SuperAgentHost(DEFAULT_SUPER_AGENT_POLICY, slow.clock)
    const report = restored.restore(snap)
    expect(report.ok).toBe(true)
    expect(report.rejected).toEqual([{ reason: 'clock_behind' }])
  })

  it('多主体切片隔离：u1 与 u2 的票分片存放，恢复后互不串账', () => {
    const c = fakeClock()
    const host = new SuperAgentHost(DEFAULT_SUPER_AGENT_POLICY, c.clock)
    const a = host.receive({ ...trig('tA'), actorId: 'user-1' }, 'user-1')
    const b = host.receive({ ...trig('tB'), actorId: 'user-2', threadId: 'thread-2' }, 'user-2')
    const snap = JSON.parse(JSON.stringify(host.snapshot()))
    expect(snap.owners.map((o: { ownerUserId: string }) => o.ownerUserId)).toEqual([
      'user-1',
      'user-2',
    ])
    const restored = new SuperAgentHost(DEFAULT_SUPER_AGENT_POLICY, fakeClock(7_000).clock)
    restored.restore(snap)
    // 各自拿到自己的票，跨主体拿不到（归属隔离是超越点，不得被恢复洗掉）
    expect(restored.getTicket(a.ticketId!, 'user-1')).not.toBeNull()
    expect(restored.getTicket(b.ticketId!, 'user-2')).not.toBeNull()
    expect(restored.getTicket(a.ticketId!, 'user-2')).toBeNull()
    expect(restored.getTicket(b.ticketId!, 'user-1')).toBeNull()
  })

  it('旧快照缺授权依据按「当时未知」恢复，不按未授权砍单', () => {
    const c = fakeClock(100)
    const first = new SuperAgentHost(
      { ...DEFAULT_SUPER_AGENT_POLICY, sessionIsAllowlist: false, allowedActors: ['user-2'] },
      c.clock,
    )
    const opened = first.receive(trig('tA', { actorId: 'user-2' }), 'user-1')
    expect(opened.disposition).toBe('accepted')
    const id = opened.ticketId!
    const snap = JSON.parse(JSON.stringify(first.snapshot()))
    const owner = snap.owners.find(
      (row: { ownerUserId: string; slice: { tickets: Record<string, unknown>[] } }) =>
        row.ownerUserId === 'user-1',
    )!
    // 模拟加字段之前的旧快照。
    delete owner.slice.tickets[0]!.mandate
    delete owner.slice.tickets[0]!.policyEvents

    const restored = new SuperAgentHost(DEFAULT_SUPER_AGENT_POLICY, fakeClock(900).clock)
    expect(restored.restore(snap).ok).toBe(true)
    const notified = restored.applyPolicy('user-1', {
      ...DEFAULT_SUPER_AGENT_POLICY,
      version: 'v2',
      sessionIsAllowlist: true,
      allowedActors: ['user-1'],
    })
    const ticket = restored.getTicket(id, 'user-1')!
    expect(ticket.mandate).toBeUndefined()
    expect(ticket.mandateWithdrawn).toBe(false)
    expect(ticket.ended).toBeNull()
    expect(ticket.policyEvents).toBeUndefined()
    expect(notified).toContain(id)
    // 尚未派出的工人仍在队列：未知不等于未授权。
    expect(restored.takeStarted().map((row) => row.sessionId)).toContain(`worker-${id}`)
  })

  it('授权依据进快照：重启后同一份依据仍能重验', () => {
    const c = fakeClock(100)
    const first = new SuperAgentHost(
      { ...DEFAULT_SUPER_AGENT_POLICY, sessionIsAllowlist: false, allowedActors: ['user-2'] },
      c.clock,
    )
    const opened = first.receive(trig('tA', { actorId: 'user-2' }), 'user-1')
    const id = opened.ticketId!
    const snap = JSON.parse(JSON.stringify(first.snapshot()))
    const restored = new SuperAgentHost(DEFAULT_SUPER_AGENT_POLICY, fakeClock(900).clock)
    expect(restored.restore(snap).ok).toBe(true)
    expect(restored.getTicket(id, 'user-1')?.mandate?.actorId).toBe('user-2')
    restored.takeStarted()
    const notified = restored.applyPolicy('user-1', {
      ...DEFAULT_SUPER_AGENT_POLICY,
      version: 'v2',
      sessionIsAllowlist: true,
      allowedActors: ['user-1'],
    })
    const ticket = restored.getTicket(id, 'user-1')!
    expect(notified).toContain(id)
    expect(ticket.mandateWithdrawn).toBe(true)
    expect(ticket.ended).toEqual({ by: 'policy', outcome: 'policyRevoked' })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
