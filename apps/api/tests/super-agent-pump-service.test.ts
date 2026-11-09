// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

vi.mock('../src/services/subagent-dispatch-service.js', () => ({
  subagentDispatchService: { dispatch: vi.fn() },
  setTenantConcurrencyLimitResolver: vi.fn(),
}))
// 测试隔离铁律:持久腿触库的模块必须 mock(本 service 静态 import user-preferences-queries)
vi.mock('../src/db/user-preferences-queries.js', () => ({
  USER_PREFERENCE_GROUPS: { superAgent: 'super_agent' },
  findUserPreferences: vi.fn(async () => ({ list: [], total: 0 })),
  upsertUserPreference: vi.fn(async () => undefined),
}))

import {
  setTenantConcurrencyLimitResolver,
  subagentDispatchService,
} from '../src/services/subagent-dispatch-service.js'
import {
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

let workspaceRoot = ''

beforeEach(() => {
  workspaceRoot = mkdtempSync(join(tmpdir(), 'ihui-sa-pump-'))
  process.env.IHUI_SUPER_AGENT_WORKSPACE_ROOT = workspaceRoot
  vi.mocked(subagentDispatchService.dispatch).mockReset()
  vi.mocked(subagentDispatchService.dispatch).mockResolvedValue({
    outcome: 'ok',
    dispatch: { id: 'd-1' },
  } as never)
  superAgentHost.applyPolicy('user-1', { ...DEFAULT_SUPER_AGENT_POLICY })
})

afterEach(() => {
  rmSync(workspaceRoot, { recursive: true, force: true })
  delete process.env.IHUI_SUPER_AGENT_WORKSPACE_ROOT
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
    const input = vi.mocked(subagentDispatchService.dispatch).mock.calls.at(-1)![0]
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
    const input2 = vi.mocked(subagentDispatchService.dispatch).mock.calls.at(-1)![0]
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

  it('隔离实证：两个工人同名文件落在各自目录，互不覆盖', async () => {
    const owner = 'user-iso'
    superAgentHost.applyPolicy(owner, { ...DEFAULT_SUPER_AGENT_POLICY })
    const a = superAgentHost.receive(
      {
        id: 'trg-iso-a',
        sourceId: 'src-iso',
        threadId: 'thread-iso-a',
        actorId: owner,
        addressed: true,
        fromBot: false,
        text: '任务 A',
      },
      owner,
    )
    const b = superAgentHost.receive(
      {
        id: 'trg-iso-b',
        sourceId: 'src-iso',
        threadId: 'thread-iso-b',
        actorId: owner,
        addressed: true,
        fromBot: false,
        text: '任务 B',
      },
      owner,
    )
    expect(a.work?.directory).toBeTruthy()
    expect(b.work?.directory).toBeTruthy()
    expect(a.work!.directory).not.toBe(b.work!.directory)

    // 执行器边界照着 dispatch 收到的 directory 落盘 —— 证明值到达末端且可直接使用,
    // 而不是只在入口断言「参数被传了」。同名文件必须落在不同目录、内容互不覆盖。
    vi.mocked(subagentDispatchService.dispatch).mockImplementation(async (input) => {
      const directory = input.directory
      if (typeof directory !== 'string') throw new Error('dispatch lost directory')
      writeFileSync(join(directory, 'result.md'), `goal=${input.goal}\nsession=${input.sessionId}`)
      return { outcome: 'ok', dispatch: { id: 'd-iso' } } as never
    })

    await dispatchWorkerWork(a.work!)
    await dispatchWorkerWork(b.work!)

    const pathA = join(workspaceRoot, a.work!.directory, 'result.md')
    const pathB = join(workspaceRoot, b.work!.directory, 'result.md')
    expect(pathA).not.toBe(pathB)
    expect(readFileSync(pathA, 'utf8')).toContain(`session=${a.work!.sessionId}`)
    expect(readFileSync(pathB, 'utf8')).toContain(`session=${b.work!.sessionId}`)
    const calls = vi.mocked(subagentDispatchService.dispatch).mock.calls.map((c) => c[0])
    expect(calls.map((c) => c.sessionId)).toEqual([a.work!.sessionId, b.work!.sessionId])
    expect(calls.map((c) => c.directory)).toEqual([
      join(workspaceRoot, a.work!.directory),
      join(workspaceRoot, b.work!.directory),
    ])
    expect(calls.every((c) => c.capacityReserved === true)).toBe(true)
  })

  it('并发闸单一真相源：下游租户上限解析器直接读宿主 maxWorkers', () => {
    const resolver = vi.mocked(setTenantConcurrencyLimitResolver).mock.calls.at(-1)?.[0]
    expect(typeof resolver).toBe('function')
    const owner = 'user-gate'
    superAgentHost.applyPolicy(owner, { ...DEFAULT_SUPER_AGENT_POLICY, maxWorkers: 2 })
    expect(superAgentHost.maxWorkersFor(owner)).toBe(2)
    expect(resolver!(owner)).toBe(2)
    // 改策略后两侧同步变化(同一个读数出口,不是各自缓存一份默认值)
    superAgentHost.applyPolicy(owner, { ...DEFAULT_SUPER_AGENT_POLICY, maxWorkers: 4 })
    expect(resolver!(owner)).toBe(4)
    // 无归属租户不参与宿主策略,交回下游默认值
    expect(resolver!(undefined)).toBeUndefined()
  })

  it('引擎侧到上限即不再开工，与下游同一上限', () => {
    const owner = 'user-gate-run'
    superAgentHost.applyPolicy(owner, { ...DEFAULT_SUPER_AGENT_POLICY, maxWorkers: 1 })
    superAgentHost.takeStarted()
    const first = superAgentHost.receive(
      {
        id: 'trg-gate-1',
        sourceId: 'src-gate',
        threadId: 'thread-gate-1',
        actorId: owner,
        addressed: true,
        fromBot: false,
        text: '任务 1',
      },
      owner,
    )
    const second = superAgentHost.receive(
      {
        id: 'trg-gate-2',
        sourceId: 'src-gate',
        threadId: 'thread-gate-2',
        actorId: owner,
        addressed: true,
        fromBot: false,
        text: '任务 2',
      },
      owner,
    )
    expect(first.disposition).toBe('accepted')
    expect(second.disposition).toBe('accepted')
    // 上限 1：本轮只应新开 1 个执行槽,第 2 个落 pending(阶段读数仍是排队)
    expect(superAgentHost.takeStarted()).toHaveLength(1)
    expect(superAgentHost.getTicket(second.ticketId!, owner)?.assignment?.state).toBe('pending')
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
