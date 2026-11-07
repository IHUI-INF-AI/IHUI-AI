// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import { DEFAULT_SUPER_AGENT_POLICY, SuperAgentHost, canRetry, ticketStage } from './engine'
import type { IncomingTrigger, SuperAgentPolicy } from './engine'

function host(over: Partial<SuperAgentPolicy> = {}): SuperAgentHost {
  let n = 0
  return new SuperAgentHost(
    { ...DEFAULT_SUPER_AGENT_POLICY, ...over },
    {
      now: () => {
        n += 1
        return n
      },
      id: (prefix) => {
        n += 1
        return `${prefix}-${n}`
      },
    },
  )
}

function trigger(over: Partial<IncomingTrigger> = {}): IncomingTrigger {
  return {
    id: 'tr-1',
    sourceId: 'session',
    threadId: 'th-1',
    actorId: 'user-a',
    addressed: true,
    fromBot: false,
    text: '修登录回跳',
    ...over,
  }
}

describe('super-agent 控制面', () => {
  it('点名请求接成一张工单，只确认一次', () => {
    const agent = host()
    const first = agent.receive(trigger(), 'user-a')
    expect(first.disposition).toBe('accepted')
    expect(first.speech?.purpose).toBe('acknowledgement')
    expect(first.stage).toEqual({ stage: 'working' })
    const again = agent.receive(trigger(), 'user-a')
    expect(again.disposition).toBe('duplicate')
    expect(again.speech).toBeNull()
  })

  it('进度与等待不出声，就绪只说一次', () => {
    const agent = host()
    const opened = agent.receive(trigger(), 'user-a')
    const id = opened.ticketId!
    expect(agent.report(id, 'user-a', { state: 'progress', text: '正在看' }).speech).toBeNull()
    expect(agent.report(id, 'user-a', { state: 'waiting', text: '先停' }).speech).toBeNull()
    const ready = agent.report(id, 'user-a', { state: 'ready', text: '补丁在分支上' })
    expect(ready.speech).toEqual({ purpose: 'result', ticketId: id, text: '补丁在分支上' })
    expect(ready.stage).toEqual({ stage: 'person', action: 'review' })
    expect(agent.report(id, 'user-a', { state: 'ready', text: '又说一遍' }).speech).toBeNull()
    expect(agent.panel('user-a').quietDrops).toBe(2)
    expect(agent.panel('user-a').needsPerson).toHaveLength(1)
  })

  it('未点名与机器人只记账，不开工', () => {
    const agent = host()
    expect(agent.receive(trigger({ id: 'a', addressed: false }), 'user-a').disposition).toBe(
      'recorded',
    )
    expect(agent.receive(trigger({ id: 'b', fromBot: true }), 'user-a').disposition).toBe(
      'recorded',
    )
    expect(agent.panel('user-a').recorded).toBe(2)
    expect(agent.panel('user-a').needsPerson).toHaveLength(0)
  })

  it('主体不一致直接滤掉，别的用户看不到这张工单', () => {
    const agent = host()
    expect(agent.receive(trigger({ actorId: 'user-b' }), 'user-a').reason).toBe('actor_mismatch')
    const opened = agent.receive(trigger({ id: 'own' }), 'user-a')
    expect(agent.getTicket(opened.ticketId!, 'user-b')).toBeNull()
    expect(agent.report(opened.ticketId!, 'user-b', { state: 'ready', text: 'x' }).reason).toBe(
      'no_ticket',
    )
  })

  it('同一线程的后续人话扇出，不新开单、不再确认', () => {
    const agent = host()
    const opened = agent.receive(trigger(), 'user-a')
    const follow = agent.receive(trigger({ id: 'tr-2', text: '改成只改 web' }), 'user-a')
    expect(follow.disposition).toBe('fanout')
    expect(follow.ticketId).toBe(opened.ticketId)
    expect(follow.speech).toBeNull()
    expect(agent.getTicket(opened.ticketId!, 'user-a')?.inputs).toHaveLength(2)
  })

  it('人叫停后同一线程不再恢复', () => {
    const agent = host()
    const opened = agent.receive(trigger(), 'user-a')
    agent.stop(opened.ticketId!, 'user-a', '先别做')
    const follow = agent.receive(trigger({ id: 'tr-2' }), 'user-a')
    expect(follow.disposition).toBe('filtered')
    expect(follow.reason).toBe('stopped')
    expect(ticketStage(agent.getTicket(opened.ticketId!, 'user-a')!)).toEqual({ stage: 'ended' })
  })

  it('受阻后人回话，工单离开等人阶段', () => {
    const agent = host()
    const opened = agent.receive(trigger(), 'user-a')
    const blocked = agent.report(opened.ticketId!, 'user-a', {
      state: 'blocked',
      text: '要选方案',
      question: '用会话回跳还是新开页',
    })
    expect(blocked.stage).toEqual({ stage: 'person', action: 'answer' })
    expect(blocked.speech?.purpose).toBe('attention')
    expect(canRetry(agent.getTicket(opened.ticketId!, 'user-a')!)).toBe(true)
    const follow = agent.receive(trigger({ id: 'tr-2', text: '用会话回跳' }), 'user-a')
    expect(follow.stage?.stage).toBe('working')
    expect(agent.panel('user-a').needsPerson).toHaveLength(0)
  })

  it('槽满时第二张单排队，人的唤醒可以多用一槽', () => {
    const agent = host({ maxWorkers: 1 })
    const first = agent.receive(trigger(), 'user-a')
    const second = agent.receive(
      trigger({ id: 'tr-2', threadId: 'th-2', text: '另一件' }),
      'user-a',
    )
    expect(ticketStage(agent.getTicket(first.ticketId!, 'user-a')!).stage).toBe('working')
    expect(agent.getTicket(first.ticketId!, 'user-a')?.assignment?.state).toBe('running')
    expect(agent.getTicket(second.ticketId!, 'user-a')?.assignment?.state).toBe('pending')
    expect(ticketStage(agent.getTicket(second.ticketId!, 'user-a')!)).toEqual({
      stage: 'working',
      action: 'queued',
    })
    agent.report(first.ticketId!, 'user-a', { state: 'waiting', text: '空了' })
    const wake = agent.receive(trigger({ id: 'tr-3', text: '继续第一件' }), 'user-a')
    expect(wake.disposition).toBe('fanout')
    expect(agent.getTicket(first.ticketId!, 'user-a')?.assignment?.state).toBe('running')
  })

  it('无需处理的报告结束工单且不出声', () => {
    const agent = host()
    const opened = agent.receive(trigger(), 'user-a')
    const dropped = agent.report(opened.ticketId!, 'user-a', { state: 'dropped', text: '已经有了' })
    expect(dropped.speech).toBeNull()
    expect(dropped.stage).toEqual({ stage: 'ended' })
    expect(agent.panel('user-a').needsPerson).toHaveLength(0)
  })

  it('暂停时只收下事件，不开工', () => {
    const agent = host({ paused: true })
    expect(agent.receive(trigger(), 'user-a').disposition).toBe('paused')
    expect(agent.panel('user-a').needsPerson).toHaveLength(0)
  })
})

describe('super-agent 策略重验授权依据', () => {
  function acceptInferred(
    agent: SuperAgentHost,
    over: Partial<IncomingTrigger>,
    ruleId: string,
  ): ReturnType<SuperAgentHost['acceptRecorded']> {
    const recorded = agent.receive(trigger({ addressed: false, ...over }), 'user-a')
    expect(recorded.disposition).toBe('recorded')
    return agent.acceptRecorded('user-a', over.id!, ruleId)
  }

  it('显式来源被移出 allowed ⇒ 结束工单、记 policyRevoked 并出声', () => {
    const agent = host({ sessionIsAllowlist: false, allowedActors: ['user-b'] })
    const opened = agent.receive(trigger({ id: 'tr-b', actorId: 'user-b' }), 'user-a')
    expect(opened.disposition).toBe('accepted')
    const id = opened.ticketId!
    expect(agent.takeStarted()).toHaveLength(1)

    const notified = agent.applyPolicy('user-a', {
      ...DEFAULT_SUPER_AGENT_POLICY,
      version: 'v2',
      allowedActors: ['user-a'],
    })
    const ticket = agent.getTicket(id, 'user-a')!
    expect(ticket.mandate).toMatchObject({
      route: 'explicit',
      actorId: 'user-b',
      tier: 'observe',
      policyVersion: DEFAULT_SUPER_AGENT_POLICY.version,
    })
    expect(notified).toEqual([id])
    expect(ticket.mandateWithdrawn).toBe(true)
    expect(ticket.ended).toEqual({ by: 'policy', outcome: 'policyRevoked' })
    expect(ticket.policyEvents?.map((row) => row.kind)).toEqual(['policyRevoked'])
    const speech = agent.replies('user-a', 'session', 'th-1').at(-1)
    expect(speech?.purpose).toBe('attention')
    expect(speech?.text).toContain('撤回')
    // 撤权只停新动作：尚未派出的那一格也要清掉。
    expect(agent.takeStarted()).toHaveLength(0)
  })

  it('推断授权 auto 降 observe ⇒ 停新活、退回 recorded，已完成报告不回滚', () => {
    const agent = host({
      acceptMode: 'auto',
      rules: [{ id: 'rule-x', enabled: true, revision: 'r1' }],
    })
    const opened = acceptInferred(agent, { id: 'inf-1' }, 'rule-x')
    expect(opened.disposition).toBe('accepted')
    const id = opened.ticketId!
    expect(agent.takeStarted()).toHaveLength(1)
    agent.report(id, 'user-a', { state: 'progress', text: '做到一半' })

    const notified = agent.applyPolicy('user-a', {
      ...DEFAULT_SUPER_AGENT_POLICY,
      version: 'v2',
      acceptMode: 'record',
    })
    const ticket = agent.getTicket(id, 'user-a')!
    expect(ticket.mandate).toMatchObject({
      strength: 'inferred',
      route: 'admission',
      ruleId: 'rule-x',
      tier: 'auto',
    })
    expect(notified).toEqual([id])
    expect(ticket.mandateWithdrawn).toBe(true)
    expect(ticket.assignment?.state).toBe('ended')
    expect(ticket.ended).toEqual({ by: 'policy', outcome: 'policyDowngraded' })
    expect(ticket.policyEvents?.map((row) => row.kind)).toEqual(['policyDowngraded'])
    expect(ticket.report?.text).toBe('做到一半')
    const panel = agent.panel('user-a')
    expect(panel.pendingRecords.map((row) => row.id)).toContain('inf-1')
    expect(agent.takeStarted()).toHaveLength(0)
  })

  it('命中规则被禁用或改写 ⇒ 记 policy-changed，面板可标出', () => {
    const agent = host({
      acceptMode: 'auto',
      rules: [
        { id: 'rule-off', enabled: true, revision: 'r1' },
        { id: 'rule-rewrite', enabled: true, revision: 'r1' },
      ],
    })
    const disabled = acceptInferred(agent, { id: 'inf-a', threadId: 'th-a', text: 'A' }, 'rule-off')
    const rewritten = acceptInferred(
      agent,
      { id: 'inf-b', threadId: 'th-b', text: 'B' },
      'rule-rewrite',
    )
    expect(disabled.disposition).toBe('accepted')
    expect(rewritten.disposition).toBe('accepted')
    expect(agent.takeStarted()).toHaveLength(2)

    const notified = agent.applyPolicy('user-a', {
      ...DEFAULT_SUPER_AGENT_POLICY,
      version: 'v2',
      acceptMode: 'auto',
      rules: [
        { id: 'rule-off', enabled: false, revision: 'r1' },
        { id: 'rule-rewrite', enabled: true, revision: 'r2' },
      ],
    })
    const panel = agent.panel('user-a')
    expect(panel.policyChanged.map((row) => row.ticketId).sort()).toEqual(
      [disabled.ticketId!, rewritten.ticketId!].sort(),
    )
    expect(panel.policyChanged.every((row) => row.detail.includes('规则'))).toBe(true)
    for (const id of [disabled.ticketId!, rewritten.ticketId!]) {
      const ticket = agent.getTicket(id, 'user-a')!
      expect(ticket.mandateWithdrawn).toBe(true)
      expect(ticket.assignment?.state).toBe('ended')
      expect(ticket.ended).toEqual({ by: 'policy', outcome: 'policy-changed' })
      expect(ticket.policyEvents?.map((row) => row.kind)).toEqual(['policy-changed'])
    }
    expect(notified.sort()).toEqual([disabled.ticketId!, rewritten.ticketId!].sort())
    expect(agent.takeStarted()).toHaveLength(0)
  })

  it('策略版本未变时不误伤：重验通过，不撤权、不记事件', () => {
    const policy = {
      acceptMode: 'auto' as const,
      allowedActors: ['user-a'],
      rules: [{ id: 'rule-x', enabled: true, revision: 'r1' }],
    }
    const agent = host(policy)
    const explicit = agent.receive(trigger({ id: 'exp', threadId: 'th-e' }), 'user-a')
    const inferred = acceptInferred(agent, { id: 'inf', threadId: 'th-i', text: '推断' }, 'rule-x')
    expect(explicit.disposition).toBe('accepted')
    expect(inferred.disposition).toBe('accepted')
    agent.takeStarted()

    const notified = agent.applyPolicy('user-a', { ...DEFAULT_SUPER_AGENT_POLICY, ...policy })
    for (const id of [explicit.ticketId!, inferred.ticketId!]) {
      const ticket = agent.getTicket(id, 'user-a')!
      expect(ticket.mandateWithdrawn).toBe(false)
      expect(ticket.ended).toBeNull()
      expect(ticket.assignment?.state).toBe('running')
      expect(ticket.policyEvents).toEqual([])
    }
    expect(notified.sort()).toEqual([explicit.ticketId!, inferred.ticketId!].sort())
    expect(agent.panel('user-a').policyChanged).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
