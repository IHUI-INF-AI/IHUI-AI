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

  it('暂停期间的事件排队，恢复后按到达顺序重放，重复投递不重排', () => {
    const agent = host({ paused: true })
    expect(
      agent.receive(trigger({ id: 'p1', threadId: 'th-p1', text: '第一件' }), 'user-a').disposition,
    ).toBe('paused')
    expect(
      agent.receive(trigger({ id: 'p2', threadId: 'th-p2', text: '第二件' }), 'user-a').disposition,
    ).toBe('paused')
    // 暂停期的重复投递：幂等集覆盖排队区，判 duplicate 而不是再排一份。
    expect(
      agent.receive(trigger({ id: 'p1', threadId: 'th-p1', text: '第一件' }), 'user-a').disposition,
    ).toBe('duplicate')
    agent.applyPolicy('user-a', {
      ...DEFAULT_SUPER_AGENT_POLICY,
      paused: false,
      version: 'v-resume',
    })
    expect(agent.takeStarted().map((w) => w.goal)).toEqual(['第一件', '第二件'])
    expect(
      agent.receive(trigger({ id: 'p1', threadId: 'th-p1', text: '第一件' }), 'user-a').disposition,
    ).toBe('duplicate')
  })

  it('暂停排队的事件进快照，重启恢复后解除暂停仍原序重放', () => {
    const agent = host({ paused: true })
    agent.receive(trigger({ id: 'p1', threadId: 'th-p1', text: '第一件' }), 'user-a')
    agent.receive(trigger({ id: 'p2', threadId: 'th-p2', text: '第二件' }), 'user-a')
    const snap = agent.snapshot()
    expect(snap.owners[0]?.slice.parked?.map((t) => t.id)).toEqual(['p1', 'p2'])

    const restarted = host()
    expect(restarted.restore(snap).ok).toBe(true)
    // 快照里 defaultPolicy 仍是 paused；恢复后解除暂停才重放，顺序按排队顺序。
    restarted.applyPolicy('user-a', {
      ...DEFAULT_SUPER_AGENT_POLICY,
      paused: false,
      version: 'v-resume',
    })
    expect(restarted.takeStarted().map((w) => w.goal)).toEqual(['第一件', '第二件'])
    expect(restarted.receive(trigger({ id: 'p1', threadId: 'th-p1' }), 'user-a').disposition).toBe(
      'duplicate',
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
