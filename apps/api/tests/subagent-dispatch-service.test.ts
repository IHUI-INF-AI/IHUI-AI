// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * subagent-dispatch-service 轨迹持久化测试(2026-08-06 新增功能)。
 *
 * 覆盖:
 *  - _createAgentTask:无 agentId 跳过 / insert agent_tasks(running)成功返回 id / db 抛错静默返回 undefined
 *  - _syncAgentTask:无 taskId 跳过 / 非终态跳过 / 终态先释放工作区锁(P0-2) / completed 写回 result /
 *    failed·quota_exceeded 写回 errorMessage / preempted 归一为 cancelled / db 抛错静默
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockLoggerWarn, mockInsert, mockUpdate, mockWhere, mockSet, mockSelectResult } = vi.hoisted(
  () => ({
    mockLoggerWarn: vi.fn(),
    mockInsert: vi.fn(),
    mockUpdate: vi.fn(),
    mockWhere: vi.fn(),
    mockSet: vi.fn(),
    mockSelectResult: vi.fn().mockResolvedValue([]),
  }),
)

vi.mock('../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: vi.fn(),
  },
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    insert: mockInsert,
    update: mockUpdate,
    // _syncAgentTask 终态释放锁后会 db.select 查 taskRow(取 teamId 供 SSE 广播)
    select: vi.fn(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(() => mockSelectResult()),
        }),
      }),
    })),
  },
  dbRead: {},
}))

// mock @ihui/database:避免真实导入该 workspace 包导致 vitest 退出码非 0(仓库既有问题)
vi.mock('@ihui/database', () => ({
  agentTasks: { id: 'agent_tasks_id' },
}))

// mock workspace-lock-heartbeat:_syncAgentTask 终态先 releaseTaskLockByTaskId(内部走 db.select/心跳),
// 测试 db mock 仅含 insert/update,不 mock 该模块会让释放调用抛错被吞,终态 update 不再执行。
vi.mock('../src/services/workspace-lock-heartbeat.js', () => ({
  LOCK_HEARTBEAT_INTERVAL_MS: 30_000,
  startLockHeartbeat: vi.fn(),
  stopLockHeartbeat: vi.fn(),
  releaseLockToken: vi.fn().mockResolvedValue(undefined),
  releaseTaskLockFromRow: vi.fn().mockResolvedValue(undefined),
  releaseTaskLockByTaskId: vi.fn().mockResolvedValue(undefined),
  _resetLockHeartbeats: vi.fn(),
}))

import {
  aggregateDeliverables,
  subagentDispatchService,
} from '../src/services/subagent-dispatch-service'

const service = subagentDispatchService as unknown as {
  _createAgentTask: (
    input: Record<string, unknown>,
    dispatchId: string,
  ) => Promise<string | undefined>
  _syncAgentTask: (runtime: {
    agentTaskId?: string
    dispatch: { status: string; result?: string }
    completedAt?: number
    /** D27:ai-service 编排原始结果(completed 时供交付清单聚合,with_communication/DAG 场景为空) */
    orchestration?: unknown
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

  it('D27:completed + orchestration → result 合并既有键并追加 deliverables(不破坏 output/steps)', async () => {
    // mockSelectResult 用 Once:单次返回带 result 的 taskRow,之后回落默认 [](不污染其他用例)
    mockSelectResult.mockResolvedValueOnce([
      { result: { foo: 'bar', output: '旧输出' }, teamId: 'team-1' },
    ])
    await service._syncAgentTask({
      agentTaskId: 'task-9',
      dispatch: { status: 'completed', result: '新输出' },
      orchestration: {
        final_output: '编排摘要',
        steps: [
          {
            tool_calls: [
              { id: 'call-1', name: 'write_file', args: { path: 'a.ts', content: 'l1\nl2' } },
            ],
          },
        ],
      },
    })
    const setArg = mockSet.mock.calls[0]![0] as Record<string, unknown>
    const result = setArg.result as Record<string, unknown>
    expect(result.foo).toBe('bar') // 既有 result 键保留
    expect(result.output).toBe('新输出') // output 覆盖为新值
    expect(Array.isArray(result.steps)).toBe(true) // steps 保留
    const deliverables = result.deliverables as {
      filesChanged: Array<{
        path: string
        kind: string
        stepIds: string[]
        additions: number
        deletions: number
      }>
      outputSummary: string
    }
    expect(deliverables.filesChanged).toEqual([
      { path: 'a.ts', kind: 'add', stepIds: ['call-1'], additions: 2, deletions: 0 },
    ])
    expect(deliverables.outputSummary).toBe('编排摘要')
  })

  it('D27:completed 无 orchestration(with_communication/DAG 场景) → result 不含 deliverables 键', async () => {
    await service._syncAgentTask({
      agentTaskId: 'task-10',
      dispatch: { status: 'completed', result: '多轮输出' },
    })
    const setArg = mockSet.mock.calls[0]![0] as Record<string, unknown>
    expect('deliverables' in (setArg.result as Record<string, unknown>)).toBe(false)
    expect((setArg.result as Record<string, unknown>).output).toBe('多轮输出')
  })

  it('D27:completed + orchestration 但聚合为空 → result 不含 deliverables 键', async () => {
    await service._syncAgentTask({
      agentTaskId: 'task-11',
      dispatch: { status: 'completed', result: '' },
      orchestration: { final_output: '', steps: [] },
    })
    const setArg = mockSet.mock.calls[0]![0] as Record<string, unknown>
    expect('deliverables' in (setArg.result as Record<string, unknown>)).toBe(false)
  })

  it('db 抛错:静默不 rethrow,记 warn', async () => {
    mockWhere.mockRejectedValueOnce(new Error('db down'))
    await expect(
      service._syncAgentTask({ agentTaskId: 'task-5', dispatch: { status: 'completed' } }),
    ).resolves.toBeUndefined()
    expect(mockLoggerWarn).toHaveBeenCalledTimes(1)
  })
})

describe('aggregateDeliverables(D27 交付清单聚合)', () => {
  type Orch = Parameters<typeof aggregateDeliverables>[0]

  it('空编排(无步骤/无工具/无输出)返回 null', () => {
    expect(aggregateDeliverables({} as unknown as Orch)).toBeNull()
    expect(aggregateDeliverables({ final_output: '', steps: [] } as unknown as Orch)).toBeNull()
  })

  it('写文件类工具映射:kind 映射/同路径合并增删行累加/lenient 参数/OpenAI 风格 arguments', () => {
    const d = aggregateDeliverables({
      final_output: 'x'.repeat(600),
      steps: [
        {
          agent: 'coder',
          status: 'completed',
          tool_calls: [
            // write_file:add,content 计 3 行 → additions 3
            { id: 'call-1', name: 'write_file', args: { path: 'a.ts', content: 'l1\nl2\nl3' } },
            // edit_file:update,old 1 行 new 2 行 → additions 1(同路径合并进 a.ts,kind 取最后一次)
            {
              id: 'call-2',
              name: 'edit_file',
              args: { path: 'a.ts', old_string: 'l1', new_string: 'l1\nl9' },
            },
            // delete_file:delete,file_path 别名,无文本参数 → 增删 0
            { id: 'call-3', name: 'delete_file', args: { file_path: 'b.ts' } },
            // OpenAI 风格:function.name + function.arguments(JSON 字符串自动解析)
            {
              id: 'call-4',
              function: {
                name: 'create_file',
                arguments: JSON.stringify({ path: 'c.ts', text: 'x' }),
              },
            },
          ],
        },
      ],
    } as unknown as Orch)
    expect(d).not.toBeNull()
    expect(d!.filesChanged).toEqual([
      { path: 'a.ts', kind: 'update', stepIds: ['call-1', 'call-2'], additions: 4, deletions: 0 },
      { path: 'b.ts', kind: 'delete', stepIds: ['call-3'], additions: 0, deletions: 0 },
      { path: 'c.ts', kind: 'add', stepIds: ['call-4'], additions: 1, deletions: 0 },
    ])
    expect(d!.toolsSummary).toEqual({
      total: 4,
      byTool: { write_file: 1, edit_file: 1, delete_file: 1, create_file: 1 },
    })
    expect(d!.outputSummary).toBe('x'.repeat(500)) // final_output 截断前 500 字
    expect(new Date(d!.generatedAt).toString()).not.toBe('Invalid Date')
  })

  it('citations 四源映射:mcp 前缀/双下划线优先,wiki/skill 带 url,memory 无 url,同源去重', () => {
    const d = aggregateDeliverables({
      final_output: 'done',
      steps: [
        {
          tool_calls: [
            { id: 'c1', name: 'wiki_search', args: { title: '部署指南' } },
            { id: 'c2', name: 'mcp:github__search', args: { query: 'repo' } },
            { id: 'c3', name: 'memory_get', args: { key: 'k1' } },
            { id: 'c4', name: 'skill_run', args: { name: 'pdf' } },
            // 双下划线 → mcp;参数无 label 字段 → 回落 callId
            { id: 'c5', name: 'x__y_tool', args: {} },
            // 与 c1 完全同源 → 去重
            { id: 'c6', name: 'wiki_search', args: { title: '部署指南' } },
          ],
        },
      ],
    } as unknown as Orch)
    expect(d!.citations).toEqual([
      { source: 'wiki', label: '部署指南', url: '/repo-wiki' },
      { source: 'mcp', label: 'repo', url: '/mcp-projects' },
      { source: 'memory', label: 'k1' },
      { source: 'skill', label: 'pdf', url: '/skills' },
      { source: 'mcp', label: 'c5', url: '/mcp-projects' },
    ])
  })

  it('上限裁剪:citations ≤20,filesChanged ≤100,toolsSummary.total 不受裁剪影响', () => {
    const citationCalls = Array.from({ length: 30 }, (_, i) => ({
      id: `w-${i}`,
      name: 'wiki_search',
      args: { title: `页-${i}` },
    }))
    const fileCalls = Array.from({ length: 105 }, (_, i) => ({
      id: `f-${i}`,
      name: 'write_file',
      args: { path: `f${i}.ts`, content: 'x' },
    }))
    const d = aggregateDeliverables({
      final_output: 'out',
      steps: [{ tool_calls: [...citationCalls, ...fileCalls] }],
    } as unknown as Orch)
    expect(d!.citations).toHaveLength(20)
    expect(d!.filesChanged).toHaveLength(100)
    expect(d!.toolsSummary.total).toBe(135)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
