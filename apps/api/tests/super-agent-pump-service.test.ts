// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('../src/services/subagent-dispatch-service.js', () => ({
  subagentDispatchService: { dispatch: vi.fn() },
}))
// 测试隔离铁律:持久腿触库的模块必须 mock(本 service 静态 import user-preferences-queries)
vi.mock('../src/db/user-preferences-queries.js', () => ({
  USER_PREFERENCE_GROUPS: { superAgent: 'super_agent' },
  findUserPreferences: vi.fn(async () => ({ list: [], total: 0 })),
  upsertUserPreference: vi.fn(async () => undefined),
}))

import { subagentDispatchService } from '../src/services/subagent-dispatch-service.js'
import {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- G 面纯增量:预留导入,零改他席行
  dispatchStartedWork,
  dispatchWorkerWork,
  registerTriggerSourcePort,
  unregisterTriggerSourcePort,
  listTriggerSourcePorts,
  superAgentHost,
  superAgentPump,
  readSuperAgentPumpLog,
} from '../src/services/super-agent-pump-service.js'
import { DEFAULT_SUPER_AGENT_POLICY } from '@ihui/shared/super-agent'
import type { WorkerAssignment } from '@ihui/shared/super-agent'

function assignment(overrides: Partial<WorkerAssignment> = {}): WorkerAssignment {
  return {
    sessionId: 'worker-ticket-x',
    directory: 'super-agent/user-1/ticket-x',
    goal: '任务 x',
    constraints: '只在目录里改文件。',
    deliverables: '可复核的结果。',
    role: 'worker',
    ownerUserId: 'user-1',
    ...overrides,
  }
}

const uuidThread = '11111111-2222-4333-8444-555555555555'

beforeEach(() => {
  vi.mocked(subagentDispatchService.dispatch).mockReset()
  vi.mocked(subagentDispatchService.dispatch).mockResolvedValue({
    outcome: 'ok',
    dispatch: { id: 'd-1' },
  } as never)
  superAgentHost.applyPolicy('user-1', { ...DEFAULT_SUPER_AGENT_POLICY })
})

describe('super-agent pump service 接线', () => {
  it('端口注册表：注册→可列→注销→不留痕；重复注册覆盖', () => {
    const port = {
      sourceId: 'src-a',
      ownerUserId: 'user-1',
      fetchTriggers: async () => [],
    }
    registerTriggerSourcePort(port)
    registerTriggerSourcePort({ ...port, ownerUserId: 'user-2' })
    expect(listTriggerSourcePorts().find((p) => p.sourceId === 'src-a')).toEqual({
      sourceId: 'src-a',
      ownerUserId: 'user-2',
    })
    expect(unregisterTriggerSourcePort('src-a')).toBe(true)
    expect(unregisterTriggerSourcePort('src-a')).toBe(false)
    expect(listTriggerSourcePorts().some((p) => p.sourceId === 'src-a')).toBe(false)
  })

  it('无归属载荷一律拒派，不碰 dispatch', async () => {
    const r = await dispatchWorkerWork(assignment({ ownerUserId: undefined }))
    expect(r).toEqual({ ok: false, error: 'no_owner' })
    expect(subagentDispatchService.dispatch).not.toHaveBeenCalled()
  })

  it('threadId 是 uuid 才写 conversationId；非 uuid 不带该键', async () => {
    const uuidAccept = superAgentHost.receive(
      {
        id: 'trg-uuid',
        sourceId: 'src-x1',
        threadId: uuidThread,
        actorId: 'user-1',
        addressed: true,
        fromBot: false,
        text: '任务 uuid',
      },
      'user-1',
    )
    expect(uuidAccept.disposition).toBe('accepted')
    await dispatchWorkerWork(assignment({ sessionId: `worker-${uuidAccept.ticketId}` }))
    const input = vi.mocked(subagentDispatchService.dispatch).mock.calls.at(-1)![0] as Record<
      string,
      unknown
    >
    expect(JSON.stringify(input)).toContain(uuidThread)

    vi.mocked(subagentDispatchService.dispatch).mockClear()
    const plainAccept = superAgentHost.receive(
      {
        id: 'trg-plain',
        sourceId: 'src-x2',
        threadId: 'not-a-uuid',
        actorId: 'user-1',
        addressed: true,
        fromBot: false,
        text: '任务 plain',
      },
      'user-1',
    )
    await dispatchWorkerWork(assignment({ sessionId: `worker-${plainAccept.ticketId}` }))
    const input2 = vi.mocked(subagentDispatchService.dispatch).mock.calls.at(-1)![0] as Record<
      string,
      unknown
    >
    expect('conversationId' in input2).toBe(false)
  })

  it('派单失败经 deliveryFailed 归因：票面点名、面板进"要人处理"', async () => {
    vi.mocked(subagentDispatchService.dispatch).mockResolvedValueOnce({
      outcome: 'failed',
      error: 'ai_down',
    } as never)
    const accepted = superAgentHost.receive(
      {
        id: 'trg-fail',
        sourceId: 'src-y',
        threadId: 'thread-y',
        actorId: 'user-1',
        addressed: true,
        fromBot: false,
        text: '任务 will-fail',
      },
      'user-1',
    )
    const ticketId = accepted.ticketId!
    const r = await dispatchWorkerWork(assignment({ sessionId: `worker-${ticketId}` }))
    expect(r.ok).toBe(false)
    const ticket = superAgentHost.getTicket(ticketId, 'user-1')!
    expect(ticket.deliveryError).toBe('ai_down')
    const panelRow = superAgentHost
      .panel('user-1')
      .needsPerson.find((row) => row.scope === '任务 will-fail')
    expect(panelRow?.stage).toEqual({ stage: 'person', action: 'delivery' })
  })

  it('泵用真 host 走一轮：拉事件→派发到 mock dispatch→回收读数齐', async () => {
    // 单例 host 跨用例积累 pendingStart：先排干旧账，再断言本轮增量。
    superAgentHost.takeStarted()
    vi.mocked(subagentDispatchService.dispatch).mockClear()
    registerTriggerSourcePort({
      sourceId: 'src-pump',
      ownerUserId: 'user-pump',
      fetchTriggers: async () => [
        {
          id: 'trg-pump-1',
          sourceId: 'src-pump',
          threadId: 'thread-pump',
          actorId: 'user-pump',
          addressed: true,
          fromBot: false,
          text: '任务泵',
        },
      ],
    })
    const r = await superAgentPump.runOnce()
    expect(r.ingested).toBe(1)
    expect(r.accepted).toBe(1)
    expect(r.dispatched).toBe(1)
    expect(vi.mocked(subagentDispatchService.dispatch).mock.calls.length).toBe(1)
    expect(readSuperAgentPumpLog().filter((row) => row.kind === 'port_error')).toEqual([])
    unregisterTriggerSourcePort('src-pump')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
