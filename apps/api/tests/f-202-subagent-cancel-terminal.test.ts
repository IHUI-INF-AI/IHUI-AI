// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-202 回归锁(2026-11-13)。
 *
 * 病灶:POST /api/subagent-dispatch/{id}/cancel 只改内存标志 → 子代理自然跑完 → 完成回写
 * 无条件写 `completed`,取消终态被覆盖(用户以为已取消,实际继续消耗 token)。
 *
 * 本文件锁:
 *   ① 取消落持久化终态:派单记录与 agent_tasks 镜像都写 `cancelled`,在途调用被中止;
 *   ② 取消后完成回写不得覆盖:agent_tasks 已是 cancelled 时条件更新命中 0 行(不 update),
 *      最终状态仍是 cancelled(附「条件更新条件」源锁);
 *   ③ 未取消的任务正常回写 `completed`;
 *   ④ 重复取消幂等:第二次返回 false,不产生第二次写。
 *
 * 只 mock db / ai-service fetch / SSE / 工作区锁,不触达真实 PG、Redis、ai-service。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeEach, vi } from 'vitest'

const {
  mockInsert,
  mockUpdate,
  mockSelect,
  mockSet,
  mockWhere,
  mockFetch,
  mockBroadcast,
  taskRow,
} = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockSelect: vi.fn(),
  mockSet: vi.fn(),
  mockWhere: vi.fn(),
  mockFetch: vi.fn(),
  mockBroadcast: vi.fn(),
  /** `_syncAgentTask` 读到的 agent_tasks 现状(用例内按需改写) */
  taskRow: { value: [] as Array<Record<string, unknown>> },
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('../src/utils/ai-service-fetch.js', () => ({
  aiServiceSystemFetch: mockFetch,
}))

vi.mock('../src/services/agent-sse-bus.js', () => ({
  broadcastSSEEvent: mockBroadcast,
}))

vi.mock('../src/db/index.js', () => ({
  db: { insert: mockInsert, update: mockUpdate, select: mockSelect },
  dbRead: {},
}))

vi.mock('@ihui/database', () => ({
  agentTasks: { id: 'agent_tasks_id', status: 'agent_tasks_status' },
  chatConversations: { id: 'chat_conversations_id' },
}))

// 终态释放工作区锁:与真实现同源的表,只保留本票用得到的状态
vi.mock('../src/services/workspace-lock-heartbeat.js', () => {
  const LOCK_RELEASE_OUTCOME_TABLE = [
    'completed',
    'failed',
    'cancelled',
    'preempted',
    'quota_exceeded',
    'triage',
    'todo',
    'ready',
    'blocked',
    'done',
    'deleted',
  ] as const
  return {
    LOCK_HEARTBEAT_INTERVAL_MS: 30_000,
    startLockHeartbeat: vi.fn(),
    stopLockHeartbeat: vi.fn(),
    releaseLockToken: vi.fn().mockResolvedValue(undefined),
    releaseTaskLockFromRow: vi.fn().mockResolvedValue(undefined),
    releaseTaskLockByTaskId: vi.fn().mockResolvedValue(undefined),
    _resetLockHeartbeats: vi.fn(),
    toLockReleaseOutcome: (status: string) =>
      (LOCK_RELEASE_OUTCOME_TABLE as readonly string[]).includes(status)
        ? (status as (typeof LOCK_RELEASE_OUTCOME_TABLE)[number])
        : null,
  }
})

import { SubagentDispatchService } from '../src/services/subagent-dispatch-service.js'

const input = () => ({
  goal: 'F-202 取消终态回归',
  affectedFiles: [] as string[],
  forbidden: [] as string[],
  verifyCommands: [] as string[],
  constraints: '',
  deliverables: '',
  // 带 agentId 才有 agent_tasks 镜像可断言
  agentId: 'agent-f202',
  agentRole: 'coder' as const,
  orchestration: 'parallel' as const,
})

const okResponse = (output: string): Response =>
  new Response(JSON.stringify({ code: 0, data: { final_output: output, steps: [] } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

/** 在途请求:只有我们手动 resolve 才返回(取消后仍可模拟「底层照常跑完」) */
function controllableFetch(): { resolve: (res: Response) => void } {
  let resolveFn!: (res: Response) => void
  mockFetch.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        resolveFn = resolve
      }),
  )
  return { resolve: (res) => resolveFn(res) }
}

/** 在途请求:收到 AbortSignal 立即 reject(模拟真实 fetch 的中止语义) */
function abortableFetch(): { aborted: () => boolean } {
  let aborted = false
  mockFetch.mockImplementationOnce(
    (_url: unknown, init?: { signal?: AbortSignal }) =>
      new Promise<Response>((_resolve, reject) => {
        const onAbort = (): void => {
          aborted = true
          reject(new Error('The operation was aborted'))
        }
        if (init?.signal?.aborted) onAbort()
        else init?.signal?.addEventListener('abort', onAbort, { once: true })
      }),
  )
  return { aborted: () => aborted }
}

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 10))

async function waitFor(cond: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now()
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor 超时')
    await new Promise((r) => setTimeout(r, 5))
  }
}

const setArgs = (): Array<Record<string, unknown>> =>
  mockSet.mock.calls.map(([arg]) => arg as Record<string, unknown>)

describe('F-202 subagent 取消必须是持久化终态(不得被完成回写覆盖)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()

    taskRow.value = [{ id: 'task-1', status: 'running', result: null, teamId: 'team-1' }]

    mockInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'task-1' }]),
      }),
    })
    mockUpdate.mockReturnValue({ set: mockSet })
    mockSet.mockReturnValue({ where: mockWhere })
    mockWhere.mockResolvedValue(undefined)
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(() => Promise.resolve(taskRow.value)),
        }),
      }),
    })
  })

  it('① 取消落持久化终态:派单与 agent_tasks 镜像都是 cancelled,在途调用被中止', async () => {
    const service = new SubagentDispatchService(null)
    const pending = abortableFetch()

    const { dispatch } = await service.dispatch(input())
    const id = dispatch!.id
    await waitFor(() => service.findById(id)?.status === 'running')

    expect(service.cancel(id)).toBe(true)

    // 内存终态 + 持久化终态:agent_tasks 镜像写 cancelled
    expect(service.findById(id)?.status).toBe('cancelled')
    await waitFor(() => setArgs().some((a) => a.status === 'cancelled'))
    expect(setArgs().map((a) => a.status)).not.toContain('completed')
    // 在途 ai-service 调用被中止(不再继续产生用量)
    expect(pending.aborted()).toBe(true)
  })

  it('② 取消后完成回写不得覆盖:命中 0 行即不覆盖,最终仍是 cancelled', async () => {
    const service = new SubagentDispatchService(null)
    const pending = controllableFetch()

    const { dispatch } = await service.dispatch(input())
    const id = dispatch!.id
    await waitFor(() => service.findById(id)?.status === 'running')

    await service.cancel(id)
    await waitFor(() => setArgs().some((a) => a.status === 'cancelled'))

    // 底层调用「照常跑完」——这正是本票的触发路径
    pending.resolve(okResponse('迟到的完成结果'))
    await flush()

    expect(service.findById(id)?.status).toBe('cancelled')
    expect(setArgs().map((a) => a.status)).not.toContain('completed')

    // DB 镜像侧:agent_tasks 已是 cancelled ⇒ completed 回写不命中任何行(不 update、不广播完成)
    mockUpdate.mockClear()
    mockBroadcast.mockClear()
    taskRow.value = [{ id: 'task-1', status: 'cancelled', result: null, teamId: 'team-1' }]
    await (
      service as unknown as { _syncAgentTask: (runtime: unknown) => Promise<void> }
    )._syncAgentTask({
      agentTaskId: 'task-1',
      dispatch: { status: 'completed', result: '迟到的完成结果' },
      completedAt: Date.now(),
    })
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockBroadcast).not.toHaveBeenCalled()

    // 源锁:完成回写 WHERE 必须带「当前状态非 cancelled」条件(条件更新)
    const src = readFileSync(
      fileURLToPath(new URL('../src/services/subagent-dispatch-service.ts', import.meta.url)),
      'utf8',
    )
    expect(src).toContain("ne(agentTasks.status, 'cancelled')")
  })

  it('③ 未取消的任务正常回写 completed', async () => {
    const service = new SubagentDispatchService(null)
    mockFetch.mockResolvedValueOnce(okResponse('正常完成结果'))

    const { dispatch } = await service.dispatch(input())
    const id = dispatch!.id
    await waitFor(() => service.findById(id)?.status === 'completed')

    const completed = setArgs().find((a) => a.status === 'completed')
    expect(completed).toBeTruthy()
    expect((completed!.result as { output?: string }).output).toBe('正常完成结果')
    expect(mockBroadcast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'task_completed', taskId: 'task-1' }),
    )
  })

  it('④ 重复取消幂等:第二次返回 false,不产生第二次写', async () => {
    const service = new SubagentDispatchService(null)
    const pending = controllableFetch()

    const { dispatch } = await service.dispatch(input())
    const id = dispatch!.id
    expect(service.cancel(id)).toBe(true)
    await waitFor(() => setArgs().some((a) => a.status === 'cancelled'))
    const writesAfterFirst = mockUpdate.mock.calls.length

    expect(service.cancel(id)).toBe(false)
    await flush()

    expect(mockUpdate.mock.calls.length).toBe(writesAfterFirst)
    expect(service.findById(id)?.status).toBe('cancelled')

    pending.resolve(okResponse('迟到的完成结果'))
    await flush()
    expect(service.findById(id)?.status).toBe('cancelled')
  })
})
