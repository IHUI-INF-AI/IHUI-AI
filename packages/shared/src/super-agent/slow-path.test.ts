// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { DEFAULT_SUPER_AGENT_POLICY, SuperAgentHost } from './engine'
import { isSlowVerdict, pickDecisions } from './slow-path'
import type { SlowDecision, SlowJudgeInput } from './slow-path'
import type { IncomingTrigger } from './engine'

function fakeClock(start = 1000) {
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

function inferred(id: string, text = `消息 ${id}`): IncomingTrigger {
  return {
    id,
    sourceId: 'src-1',
    threadId: 'thread-1',
    actorId: 'user-1',
    addressed: false,
    fromBot: false,
    text,
  }
}

const policy = (mode: 'record' | 'auto') => ({
  ...DEFAULT_SUPER_AGENT_POLICY,
  acceptMode: mode as 'record' | 'auto',
})

describe('超工慢路径判定环', () => {
  it('词表与拆解纯判据：坏形状整条丢，不回落猜测', () => {
    expect(isSlowVerdict('act')).toBe(true)
    expect(isSlowVerdict('maybe')).toBe(false)
    const d: SlowDecision = { verdict: 'ignore', reason: '寒暄', at: 5 }
    const rows = pickDecisions(
      { a: d, b: { verdict: 'nope' as never, reason: '', at: 1 }, c: undefined },
      ['a', 'b', 'c'],
    )
    expect(rows).toEqual([{ id: 'a', decision: d }])
  })

  it('record 档：判定只注记进面板，绝不开工；同条重新 receive 仍 duplicate', async () => {
    const c = fakeClock()
    const host = new SuperAgentHost(policy('record'), c.clock)
    host.receive(inferred('t1'), 'user-1')
    const seen: SlowJudgeInput[] = []
    const res = await host.judgeRecorded('user-1', async (inputs) => {
      seen.push(...inputs)
      return { t1: { verdict: 'act', reason: '像求助', at: 2000 } }
    })
    expect(res.judged).toBe(1)
    expect(res.autoAccepted).toEqual([])
    const panel = host.panel('user-1')
    expect(panel.pendingRecords[0]!.decision).toEqual({
      verdict: 'act',
      reason: '像求助',
      at: 2000,
    })
    expect(seen[0]!.requesters).toEqual(['user-1'])
    // 判定后原触发再收:仍在簿 ⇒ duplicate 不重开
    expect(host.receive(inferred('t1'), 'user-1').disposition).toBe('duplicate')
  })

  it('auto 档 ∧ act：走与人工同一条 acceptRecorded 语义通道开工（inferred 强度）', async () => {
    const c = fakeClock()
    const host = new SuperAgentHost(policy('auto'), c.clock)
    host.receive(inferred('t1'), 'user-1')
    const res = await host.judgeRecorded('user-1', async () => ({
      t1: { verdict: 'act', reason: '缺陷报告', at: 1500 },
    }))
    expect(res.autoAccepted).toHaveLength(1)
    const ticket = host.getTicket(res.autoAccepted[0]!.ticketId!, 'user-1')!
    expect(ticket.strength).toBe('inferred')
    // 范围=原始请求原文：判定 reason 不得渗入授权范围
    expect(ticket.scope).toBe('消息 t1')
    expect(host.panel('user-1').pendingRecords).toEqual([])
  })

  it('auto 档 ∧ ignore/unclear：只注记不开工；unclear 下轮允许重判', async () => {
    const c = fakeClock()
    const host = new SuperAgentHost(policy('auto'), c.clock)
    host.receive(inferred('t1'), 'user-1')
    host.receive(inferred('t2', '消息 t2'), 'user-1')
    const r1 = await host.judgeRecorded('user-1', async () => ({
      t1: { verdict: 'ignore', reason: '寒暄', at: 1 },
      t2: { verdict: 'unclear', reason: '语境不足', at: 1 },
    }))
    expect(r1.autoAccepted).toEqual([])
    expect(r1.judged).toBe(2)
    // 第二轮：仅 unclear 被重判，ignore 不再送
    const sent: string[][] = []
    const r2 = await host.judgeRecorded('user-1', async (inputs) => {
      sent.push(inputs.map((i) => i.id))
      return { t2: { verdict: 'act', reason: '补上下文后可行', at: 2 } }
    })
    expect(sent[0]).toEqual(['t2'])
    expect(r2.autoAccepted).toHaveLength(1)
  })

  it('机器人条目：判定可注记，但慢路径通道永不自动开工（auto 档也不行）', async () => {
    const c = fakeClock()
    const host = new SuperAgentHost(policy('auto'), c.clock)
    host.receive({ ...inferred('bot1'), fromBot: true }, 'user-1')
    const res = await host.judgeRecorded('user-1', async () => ({
      bot1: { verdict: 'act', reason: '机器人播报但像活', at: 1 },
    }))
    expect(res.autoAccepted).toEqual([])
    expect(host.panel('user-1').pendingRecords[0]!.decision?.verdict).toBe('act')
  })

  it('判定通道抛错 ⇒ 未判定：积压原地保留、计数如实、下一轮可重试', async () => {
    const c = fakeClock()
    const host = new SuperAgentHost(policy('auto'), c.clock)
    host.receive(inferred('t1'), 'user-1')
    const bad = await host.judgeRecorded('user-1', async () => {
      throw new Error('ai down')
    })
    expect(bad).toMatchObject({ judged: 0, unjudged: 1, error: 'ai down' })
    expect(host.panel('user-1').pendingRecords).toHaveLength(1)
    const good = await host.judgeRecorded('user-1', async () => ({
      t1: { verdict: 'act', reason: 'ok', at: 9 },
    }))
    expect(good.autoAccepted).toHaveLength(1)
  })

  it('人工点名仍在判定建议之上（人点名优先既有语义）：ignore 注记不拦人工 ruleId', async () => {
    const c = fakeClock()
    const host = new SuperAgentHost(policy('auto'), c.clock)
    host.receive(inferred('t1'), 'user-1')
    await host.judgeRecorded('user-1', async () => ({
      t1: { verdict: 'ignore', reason: '判员认为无需', at: 1 },
    }))
    const manual = host.acceptRecorded('user-1', 't1', 'human-rule')
    expect(manual.disposition).toBe('accepted')
  })

  it('批量限流：一轮最多 limit 条，剩下轮再判；他人主体不误判', async () => {
    const c = fakeClock()
    const host = new SuperAgentHost(policy('record'), c.clock)
    host.receive(inferred('t1'), 'user-1')
    host.receive(inferred('t2', '消息 t2'), 'user-1')
    const other = host.receive({ ...inferred('t9'), actorId: 'user-2' }, 'user-2')
    void other
    const res = await host.judgeRecorded(
      'user-1',
      async (inputs) => {
        expect(inputs.map((i) => i.id)).toEqual(['t1'])
        return { t1: { verdict: 'ignore', reason: 'x', at: 1 } }
      },
      { limit: 1 },
    )
    expect(res.judged).toBe(1)
    expect(host.panel('user-2').pendingRecords[0]!.decision).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
