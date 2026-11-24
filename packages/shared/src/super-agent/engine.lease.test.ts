// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { DEFAULT_SUPER_AGENT_POLICY, SuperAgentHost } from './engine'
import type { IncomingTrigger } from './engine'

function fakeClock(start = 1_000_000) {
  let now = start
  let n = 0
  return {
    tick: (ms: number) => {
      now += ms
    },
    at: () => now,
    clock: {
      now: () => now,
      id: (prefix: string) => `${prefix}_${(n += 1).toString(36)}`,
    },
  }
}

function trigger(id: string, overrides: Partial<IncomingTrigger> = {}): IncomingTrigger {
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

const leasePolicy = (leaseMs: number) => ({
  ...DEFAULT_SUPER_AGENT_POLICY,
  workerLeaseMs: leaseMs,
})

describe('super-agent engine 租约（watchdog 底座）', () => {
  it('未设租约（默认档）：launch 不写 leaseExpiresAt，巡检零副作用', () => {
    const c = fakeClock()
    const host = new SuperAgentHost(DEFAULT_SUPER_AGENT_POLICY, c.clock)
    const r = host.receive(trigger('t1'), 'user-1')
    expect(r.disposition).toBe('accepted')
    const ticket = host.getTicket(r.ticketId!, 'user-1')!
    expect(ticket.assignment?.leaseExpiresAt).toBeUndefined()
    expect(c.at()).toBe(1_000_000)
    expect(host.tickLeases('user-1').reclaimed).toEqual([])
    expect(host.renewLease('user-1', r.ticketId!)).toEqual({ ok: false, reason: 'no_lease' })
    expect(host.leaseRemaining(r.ticketId!, 'user-1')).toBeNull()
  })

  it('租约档：占槽即写截止时间，tick 内租约不动作', () => {
    const c = fakeClock()
    const host = new SuperAgentHost(leasePolicy(10_000), c.clock)
    const r = host.receive(trigger('t1'), 'user-1')
    const ticket = host.getTicket(r.ticketId!, 'user-1')!
    expect(ticket.assignment?.leaseExpiresAt).toBe(1_010_000)
    c.tick(9_999)
    expect(host.tickLeases('user-1').reclaimed).toEqual([])
    expect(host.leaseRemaining(r.ticketId!, 'user-1')).toBe(1)
  })

  it('到期未心跳：回收→重新排队→promote 同票重派，计数与时刻都记账', () => {
    const c = fakeClock()
    const host = new SuperAgentHost(leasePolicy(10_000), c.clock)
    const r = host.receive(trigger('t1'), 'user-1')
    const id = r.ticketId!
    host.takeStarted()
    c.tick(10_001)
    const first = host.tickLeases('user-1')
    expect(first.reclaimed).toEqual([id])
    const ticket = host.getTicket(id, 'user-1')!
    expect(ticket.lostLeaseCount).toBe(1)
    expect(ticket.leaseLostAt).toBe(1_010_001)
    const redispatched = host.takeStarted()
    expect(redispatched).toHaveLength(1)
    expect(redispatched[0]!.ownerUserId).toBe('user-1')
    // 重派再过期一次：计数递增（身份是稳定读数，告警可用）
    c.tick(10_001)
    expect(host.tickLeases('user-1').reclaimed).toEqual([id])
    expect(host.getTicket(id, 'user-1')!.lostLeaseCount).toBe(2)
  })

  it('report（含 progress 静默档）与手点心跳都续租；回收后补心跳可恢复', () => {
    const c = fakeClock()
    const host = new SuperAgentHost(leasePolicy(10_000), c.clock)
    const r = host.receive(trigger('t1'), 'user-1')
    const id = r.ticketId!
    c.tick(6_000)
    expect(host.report(id, 'user-1', { state: 'progress', text: '干了点活' })).toBeTruthy()
    expect(host.getTicket(id, 'user-1')!.assignment?.leaseExpiresAt).toBe(1_016_000)
    c.tick(9_999)
    expect(host.tickLeases('user-1').reclaimed).toEqual([])
    // 回收后再 renew：恢复截止
    c.tick(500)
    expect(host.tickLeases('user-1').reclaimed).toEqual([id])
    const renewed = host.renewLease('user-1', id)
    expect(renewed).toEqual({ ok: true })
    const ticket = host.getTicket(id, 'user-1')!
    expect(ticket.assignment?.state).toBe('running')
    expect(ticket.leaseLostAt).toBeNull()
  })

  it('只碰本主体：他主体的到期租约不回收；无单/已停的心跳按账面拒', () => {
    const c = fakeClock()
    const host = new SuperAgentHost(leasePolicy(10_000), c.clock)
    const mine = host.receive(trigger('t1'), 'user-1')
    const theirs = host.receive(
      trigger('t2', { threadId: 'thread-2', actorId: 'user-2' }),
      'user-2',
    )
    c.tick(10_001)
    expect(host.tickLeases('user-1').reclaimed).toEqual([mine.ticketId])
    expect(host.getTicket(theirs.ticketId!, 'user-2')!.assignment?.state).toBe('running')
    if (mine.ticketId) {
      host.stop(mine.ticketId, 'user-1', '撤了')
      expect(host.renewLease('user-1', mine.ticketId)).toEqual({
        ok: false,
        reason: 'no_ticket',
      })
    }
    expect(host.renewLease('user-1', 'ghost')).toEqual({ ok: false, reason: 'no_ticket' })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
