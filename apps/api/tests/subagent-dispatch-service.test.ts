/**
 * subagent-dispatch-service 轨迹持久化测试(2026-08-06 新增功能)。
 *
 * 覆盖:
 *  - _createAgentTask:无 agentId 跳过 / insert agent_tasks(running)成功返回 id / db 抛错静默返回 undefined
 *  - _syncAgentTask:无 taskId 跳过 / 非终态跳过 / completed 写回 result / failed·quota_exceeded 写回 errorMessage /
 *    preempted 归一为 cancelled / db 抛错静默
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockLoggerWarn, mockInsert, mockUpdate, mockWhere, mockSet } = vi.hoisted(() => ({
  mockLoggerWarn: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockWhere: vi.fn(),
  mockSet: vi.fn(),
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: vi.fn(),
  },
}))

vi.mock('../src/db/index.js', () => ({
  db: { insert: mockInsert, update: mockUpdate },
  dbRead: {},
}))

// mock @ihui/database:避免真实导入该 workspace 包导致 vitest 退出码非 0(仓库既有问题)
vi.mock('@ihui/database', () => ({
  agentTasks: { id: 'agent_tasks_id' },
}))

import { subagentDispatchService } from '../src/services/subagent-dispatch-service'

const service = subagentDispatchService as unknown as {
  _createAgentTask: (
    input: Record<string, unknown>,
    dispatchId: string,
  ) => Promise<string | undefined>
  _syncAgentTask: (runtime: {
    agentTaskId?: string
    dispatch: { status: string; result?: string }
    completedAt?: number
  }) => Promise<void>
}

describe('_createAgentTask(派单轨迹创建)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('无 agentId 直接跳过,不触达 db', async () => {
    const id = await service._createAgentTask({ goal: 'hello' }, 'dispatch-1')
    expect(id).toBeUndefined()
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('带 agentId:insert agent_tasks running,返回落库 id', async () => {
    let captured: Record<string, unknown> = {}
    mockInsert.mockReturnValue({
      values: vi.fn().mockImplementation((v: Record<string, unknown>) => {
        captured = v
        return { returning: vi.fn().mockResolvedValue([{ id: 'task-1' }]) }
      }),
    })
    const id = await service._createAgentTask({ agentId: 'agent-9', goal: '写测试' }, 'dispatch-1')
    expect(id).toBe('task-1')
    expect(mockInsert).toHaveBeenCalledTimes(1)
    expect(captured).toMatchObject({
      agentId: 'agent-9',
      name: 'subagent:parallel:coder',
      description: '写测试',
      status: 'running',
      payload: { dispatchId: 'dispatch-1' },
    })
    expect(captured.startedAt).toBeInstanceOf(Date)
    expect(mockLoggerWarn).not.toHaveBeenCalled()
  })

  it('name 使用编排模式与角色', async () => {
    mockInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 't' }]) }),
    })
    await service._createAgentTask(
      { agentId: 'a', orchestration: 'debate', agentRole: 'reviewer', goal: 'g' },
      'd',
    )
    const captured = (mockInsert.mock.results[0]!.value as { values: ReturnType<typeof vi.fn> })
      .values.mock.calls[0]![0] as Record<string, unknown>
    expect(captured.name).toBe('subagent:debate:reviewer')
  })

  it('goal 超过 2000 字符截断', async () => {
    mockInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 't' }]) }),
    })
    await service._createAgentTask({ agentId: 'a', goal: 'g'.repeat(5000) }, 'd')
    const captured = (mockInsert.mock.results[0]!.value as { values: ReturnType<typeof vi.fn> })
      .values.mock.calls[0]![0] as Record<string, unknown>
    expect((captured.description as string).length).toBe(2000)
  })

  it('db 抛错:静默失败返回 undefined,记 warn 不 rethrow', async () => {
    mockInsert.mockImplementation(() => {
      throw new Error('db down')
    })
    const id = await service._createAgentTask({ agentId: 'a', goal: 'g' }, 'd')
    expect(id).toBeUndefined()
    expect(mockLoggerWarn).toHaveBeenCalledTimes(1)
  })
})

describe('_syncAgentTask(终态轨迹写回)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdate.mockReturnValue({ set: mockSet })
    mockSet.mockReturnValue({ where: mockWhere })
    mockWhere.mockResolvedValue(undefined)
  })

  it('无 agentTaskId 直接跳过', async () => {
    await service._syncAgentTask({ dispatch: { status: 'completed' } })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('非终态(running)不写回', async () => {
    await service._syncAgentTask({ agentTaskId: 'task-1', dispatch: { status: 'running' } })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('completed 终态:写回 status=completed + result={output} + completedAt + updatedAt', async () => {
    await service._syncAgentTask({
      agentTaskId: 'task-1',
      dispatch: { status: 'completed', result: '最终输出' },
      completedAt: 1_700_000_000_000,
    })
    expect(mockUpdate).toHaveBeenCalledTimes(1)
    const setArg = mockSet.mock.calls[0]![0] as Record<string, unknown>
    expect(setArg).toMatchObject({
      status: 'completed',
      result: { output: '最终输出' },
      completedAt: new Date(1_700_000_000_000),
    })
    expect(setArg.errorMessage).toBeUndefined()
    expect(setArg.updatedAt).toBeInstanceOf(Date)
    expect(mockWhere).toHaveBeenCalledTimes(1)
  })

  it('failed 终态:写回 status=failed + errorMessage(result 截断 2000)', async () => {
    await service._syncAgentTask({
      agentTaskId: 'task-2',
      dispatch: { status: 'failed', result: 'x'.repeat(3000) },
    })
    const setArg = mockSet.mock.calls[0]![0] as Record<string, unknown>
    expect(setArg.status).toBe('failed')
    expect(setArg.errorMessage).toBe('x'.repeat(2000))
    expect(setArg.result).toBeUndefined()
  })

  it('quota_exceeded 终态:errorMessage 写回', async () => {
    await service._syncAgentTask({
      agentTaskId: 'task-3',
      dispatch: { status: 'quota_exceeded', result: 'token 超限' },
    })
    const setArg = mockSet.mock.calls[0]![0] as Record<string, unknown>
    expect(setArg.status).toBe('quota_exceeded')
    expect(setArg.errorMessage).toBe('token 超限')
  })

  it('preempted 归一为 cancelled', async () => {
    await service._syncAgentTask({
      agentTaskId: 'task-4',
      dispatch: { status: 'preempted' },
    })
    const setArg = mockSet.mock.calls[0]![0] as Record<string, unknown>
    expect(setArg.status).toBe('cancelled')
  })

  it('db 抛错:静默不 rethrow,记 warn', async () => {
    mockWhere.mockRejectedValueOnce(new Error('db down'))
    await expect(
      service._syncAgentTask({ agentTaskId: 'task-5', dispatch: { status: 'completed' } }),
    ).resolves.toBeUndefined()
    expect(mockLoggerWarn).toHaveBeenCalledTimes(1)
  })
})
