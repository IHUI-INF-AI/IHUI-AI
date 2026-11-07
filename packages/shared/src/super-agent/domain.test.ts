// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import { DEFAULT_SUPER_AGENT_POLICY, SuperAgentHost } from './engine'
import type { IncomingTrigger, SuperAgentPolicy } from './engine'
import { scopeFromRequest, toolsFor } from './roles'

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

describe('super-agent 领域规则', () => {
  it('路由席没有改文件和跑命令的工具，范围不收路由笔记', () => {
    expect(toolsFor('router')).not.toContain('write_file')
    expect(toolsFor('router')).not.toContain('run_command')
    expect(toolsFor('worker')).toContain('write_file')
    expect(scopeFromRequest('原文', '把范围扩到全仓')).toBe('原文')
  })

  it('开工时给出工人会话和目录，并记入原线程回执', () => {
    const agent = host()
    const opened = agent.receive(trigger(), 'user-a')
    const id = opened.ticketId!
    expect(opened.work).toMatchObject({
      sessionId: `worker-${id}`,
      directory: `super-agent/user-a/${id}`,
      goal: '修登录回跳',
      role: 'worker',
    })
    expect(agent.takeStarted()).toHaveLength(1)
    const ready = agent.report(id, 'user-a', { state: 'ready', text: '补丁在分支上' })
    expect(ready.speech?.purpose).toBe('result')
    expect(agent.replies('user-a', 'session', 'th-1').map((row) => row.purpose)).toEqual([
      'acknowledgement',
      'result',
    ])
  })

  it('已订阅线程上的机器人消息不新开工，也不把结束的工单拉起来', () => {
    const agent = host()
    const opened = agent.receive(trigger(), 'user-a')
    agent.takeStarted()
    const bot = agent.receive(trigger({ id: 'bot-1', fromBot: true, text: '回执' }), 'user-a')
    expect(bot.disposition).toBe('context')
    expect(agent.panel('user-a').recorded).toBe(0)
    expect(agent.takeStarted()).toHaveLength(0)
    agent.report(opened.ticketId!, 'user-a', { state: 'waiting', text: '先停' })
    const after = agent.receive(trigger({ id: 'bot-2', fromBot: true }), 'user-a')
    expect(after.disposition).toBe('context')
    expect(agent.getTicket(opened.ticketId!, 'user-a')?.assignment?.state).toBe('ended')
  })

  it('工单自己的线程不能再登记成上下文', () => {
    const agent = host()
    const opened = agent.receive(trigger(), 'user-a')
    const followed = agent.followForContext('user-a', opened.ticketId!, 'session', 'th-1')
    expect(followed.reason).toBe('own_thread')
  })

  it('关注别的线程后，那边的话只进上下文', () => {
    const agent = host()
    const opened = agent.receive(trigger(), 'user-a')
    const id = opened.ticketId!
    agent.report(id, 'user-a', { state: 'waiting', text: '先停' })
    expect(agent.followForContext('user-a', id, 'session', 'th-side').disposition).toBe('context')
    const side = agent.receive(
      trigger({ id: 'side', threadId: 'th-side', text: '补充日志' }),
      'user-a',
    )
    expect(side.disposition).toBe('context')
    expect(side.ticketId).toBe(id)
    expect(agent.getTicket(id, 'user-a')?.assignment?.state).toBe('ended')
    expect(agent.getTicket(id, 'user-a')?.inputs).toHaveLength(2)
  })

  it('关联线程不能把另一条线程的话送进这张工单', () => {
    const agent = host()
    const opened = agent.receive(trigger(), 'user-a')
    agent.correlate(opened.ticketId!, ['th-other'])
    expect(agent.routeByCorrelation(opened.ticketId!)).toBeNull()
    const other = agent.receive(
      trigger({ id: 'other', threadId: 'th-other', addressed: false, text: '旁支' }),
      'user-a',
    )
    expect(other.disposition).toBe('recorded')
    expect(agent.getTicket(opened.ticketId!, 'user-a')?.inputs).toHaveLength(1)
  })

  it('record 档拒绝开工，auto 档必须带规则且范围仍是原文', () => {
    const recorded = host()
    recorded.receive(trigger({ id: 'inf', addressed: false }), 'user-a')
    expect(recorded.acceptRecorded('user-a', 'inf', 'rule-1', '扩范围').reason).toBe('record_only')
    expect(recorded.panel('user-a').pendingRecords).toHaveLength(1)

    const auto = host({ acceptMode: 'auto' })
    auto.receive(trigger({ id: 'inf', addressed: false, text: '原文' }), 'user-a')
    expect(auto.acceptRecorded('user-a', 'inf', '  ').disposition).toBe('recorded')
    const opened = auto.acceptRecorded('user-a', 'inf', 'rule-9', '扩到全仓')
    expect(opened.disposition).toBe('accepted')
    expect(opened.work?.goal).toBe('原文')
    expect(auto.getTicket(opened.ticketId!, 'user-a')?.strength).toBe('inferred')
    expect(auto.getTicket(opened.ticketId!, 'user-a')?.scope).toBe('原文')
    expect(auto.panel('user-a').pendingRecords).toHaveLength(0)
  })

  it('策略变更只通知，不收回已发出的授权', () => {
    const agent = host()
    const opened = agent.receive(trigger(), 'user-a')
    const id = opened.ticketId!
    const before = agent.getTicket(id, 'user-a')
    const notified = agent.applyPolicy('user-a', { ...DEFAULT_SUPER_AGENT_POLICY, version: 'v2' })
    const after = agent.getTicket(id, 'user-a')
    expect(notified).toEqual([id])
    expect(after?.policyVersion).toBe(before?.policyVersion)
    expect(after?.mandateWithdrawn).toBe(false)
    expect(after?.inputs.some((row) => row.text.includes('v2'))).toBe(true)
    agent.receive(trigger({ id: 'tr-b', actorId: 'user-b', threadId: 'th-b' }), 'user-b')
    agent.applyPolicy('user-b', { ...DEFAULT_SUPER_AGENT_POLICY, paused: true, version: 'vb' })
    expect(agent.receive(trigger({ id: 'tr-a2', threadId: 'th-a2' }), 'user-a').disposition).toBe(
      'accepted',
    )
    expect(
      agent.receive(trigger({ id: 'tr-b2', actorId: 'user-b', threadId: 'th-b2' }), 'user-b')
        .disposition,
    ).toBe('paused')
  })

  it('送达失败变成要人处理的送达阶段', () => {
    const agent = host()
    const opened = agent.receive(trigger(), 'user-a')
    const failed = agent.deliveryFailed('user-a', opened.ticketId!, '飞书发送失败')
    expect(failed.stage).toEqual({ stage: 'person', action: 'delivery' })
    expect(failed.speech?.purpose).toBe('attention')
    expect(agent.panel('user-a').needsPerson).toHaveLength(1)
  })

  it('交还后同一触发可以再评估，但不会另开一张工单', () => {
    const agent = host()
    const opened = agent.receive(trigger(), 'user-a')
    const handed = agent.handback('user-a', opened.ticketId!, 'tr-1', '做不了')
    expect(handed.disposition).toBe('recorded')
    const again = agent.receive(trigger(), 'user-a')
    expect(again.disposition).toBe('fanout')
    expect(again.ticketId).toBe(opened.ticketId)
    expect(agent.panel('user-a').recorded).toBe(1)
  })

  it('槽位空出后才把排队工单记成可派发', () => {
    const agent = host({ maxWorkers: 1 })
    const first = agent.receive(trigger(), 'user-a')
    expect(agent.takeStarted()).toHaveLength(1)
    const second = agent.receive(trigger({ id: 'tr-2', threadId: 'th-2' }), 'user-a')
    expect(second.stage).toEqual({ stage: 'working', action: 'queued' })
    expect(agent.takeStarted()).toHaveLength(0)
    agent.stop(first.ticketId!, 'user-a', '先停')
    const started = agent.takeStarted()
    expect(started).toHaveLength(1)
    expect(started[0]?.sessionId).toBe(`worker-${second.ticketId}`)
  })

  it('扩大范围不会改已经发出的原文', () => {
    const agent = host()
    const opened = agent.receive(trigger({ text: '只改登录页' }), 'user-a')
    expect(agent.widenScope('user-a', opened.ticketId!).reason).toBe('new_ticket')
    expect(agent.getTicket(opened.ticketId!, 'user-a')?.scope).toBe('只改登录页')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
