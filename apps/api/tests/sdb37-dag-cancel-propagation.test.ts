// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * SDB-37 DAG 条件边取消要真正生效,并向下游传播。
 *
 * 背景:条件不满足时只把下游节点标 `cancelled`,层执行循环从不读该标记 ——
 * 下一层把节点改回 `running` 照常调模型,结果还进了最终 `allResults`。
 *
 * 本文件覆盖:
 *  ① a 不满足条件 ⇒ b 被跳过:不调模型、不进入 dispatch.result;
 *  ② 链式 a→b→c 传播:b 取消后 c 同样跳过(判据不只看一层);
 *  ③ 无条件边不受影响:普通 a→b 两个节点都执行并进入结果;
 *  ④ 汇聚节点仍有存活上游时不误伤:a→b 条件不满足、a→c 正常,b/c 汇入 d ⇒ d 照常执行。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Redis } from 'ioredis'

const { mockFetch, mockInsert, mockInsertValues, mockUpdate, mockSet, mockSelectResult } = vi.hoisted(
  () => ({
    mockFetch: vi.fn(),
    mockInsert: vi.fn(),
    mockInsertValues: vi.fn(),
    mockUpdate: vi.fn(),
    mockSet: vi.fn(),
    mockSelectResult: vi.fn().mockResolvedValue([]),
  }),
)

vi.mock('../src/utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('../src/utils/ai-service-fetch.js', () => ({
  aiServiceSystemFetch: mockFetch,
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    insert: mockInsert,
    update: mockUpdate,
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

vi.mock('@ihui/database', () => ({
  agentTasks: { id: 'agent_tasks_id' },
}))

vi.mock('../src/services/workspace-lock-heartbeat.js', () => ({
  LOCK_HEARTBEAT_INTERVAL_MS: 30_000,
  startLockHeartbeat: vi.fn(),
  stopLockHeartbeat: vi.fn(),
  releaseLockToken: vi.fn().mockResolvedValue(undefined),
  releaseTaskLockFromRow: vi.fn().mockResolvedValue(undefined),
  releaseTaskLockByTaskId: vi.fn().mockResolvedValue(undefined),
  _resetLockHeartbeats: vi.fn(),
  toLockReleaseOutcome: (status: string): string | null =>
    ['completed', 'failed', 'cancelled', 'preempted', 'quota_exceeded', 'deleted'].includes(status)
      ? status
      : null,
}))

import { SubagentDispatchService } from '../src/services/subagent-dispatch-service'

/** 最小 Redis 假件(dispatch 记录/日志/窗口计数共用) */
class FakeRedis {
  hashes = new Map<string, Record<string, string>>()
  sets = new Map<string, Set<string>>()
  lists = new Map<string, string[]>()
  zsets = new Map<string, Map<string, number>>()
  strings = new Map<string, string>()

  async smembers(key: string): Promise<string[]> {
    return Array.from(this.sets.get(key) ?? [])
  }
  async sadd(key: string, ...members: string[]): Promise<number> {
    const set = this.sets.get(key) ?? new Set<string>()
    for (const m of members) set.add(m)
    this.sets.set(key, set)
    return members.length
  }
  async srem(key: string, ...members: string[]): Promise<number> {
    const set = this.sets.get(key)
    for (const m of members) set?.delete(m)
    return members.length
  }
  async hgetall(key: string): Promise<Record<string, string>> {
    return { ...(this.hashes.get(key) ?? {}) }
  }
  async hget(key: string, field: string): Promise<string | null> {
    return this.hashes.get(key)?.[field] ?? null
  }
  async hset(key: string, values: Record<string, unknown>): Promise<number> {
    const hash = this.hashes.get(key) ?? {}
    for (const [field, value] of Object.entries(values)) hash[field] = String(value)
    this.hashes.set(key, hash)
    return Object.keys(values).length
  }
  async hdel(key: string, ...fields: string[]): Promise<number> {
    const hash = this.hashes.get(key)
    for (const f of fields) delete hash?.[f]
    return fields.length
  }
  async lpush(key: string, ...values: string[]): Promise<number> {
    const list = this.lists.get(key) ?? []
    list.unshift(...values)
    this.lists.set(key, list)
    return list.length
  }
  async ltrim(key: string, start: number, stop: number): Promise<string> {
    const list = this.lists.get(key) ?? []
    const end = stop < 0 ? list.length + stop + 1 : stop + 1
    this.lists.set(key, list.slice(start, end))
    return 'OK'
  }
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const list = this.lists.get(key) ?? []
    const end = stop < 0 ? list.length + stop + 1 : stop + 1
    return list.slice(start, end)
  }
  async zadd(key: string, score: number, member: string): Promise<number> {
    const z = this.zsets.get(key) ?? new Map<string, number>()
    z.set(member, score)
    this.zsets.set(key, z)
    return 1
  }
  async zrem(key: string, ...members: string[]): Promise<number> {
    const z = this.zsets.get(key)
    for (const m of members) z?.delete(m)
    return members.length
  }
  async zrevrange(key: string, start: number, stop: number, withScores?: string): Promise<string[]> {
    const sorted = Array.from(this.zsets.get(key) ?? new Map<string, number>()).sort(
      (a, b) => b[1] - a[1],
    )
    const end = stop < 0 ? sorted.length + stop + 1 : stop + 1
    const slice = sorted.slice(start, end)
    return withScores ? slice.flatMap(([m, s]) => [m, String(s)]) : slice.map(([m]) => m)
  }
  async set(key: string, value: string): Promise<'OK'> {
    this.strings.set(key, value)
    return 'OK'
  }
  async get(key: string): Promise<string | null> {
    return this.strings.get(key) ?? null
  }
  async expire(): Promise<number> {
    return 1
  }
}

function asRedis(fake: FakeRedis): Redis {
  return fake as unknown as Redis
}

async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const started = Date.now()
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error('waitFor timeout')
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

const okResponse = (output: string) => ({
  status: 200,
  ok: true,
  statusText: 'OK',
  json: async () => ({ code: 0, message: '', data: { final_output: output, steps: [] } }),
})

/** 建单并等待 DAG 收口,返回 dispatch 记录 */
async function runDag(
  service: SubagentDispatchService,
  dag: {
    nodes: Array<{ id: string; agentRole: 'researcher' | 'coder'; task: string }>
    edges: Array<{ from: string; to: string; condition?: string }>
  },
): Promise<{ status: string; result: string | undefined }> {
  const created = await service.dispatch({
    goal: 'SDB-37 DAG 取消传播',
    affectedFiles: ['a.ts'],
    verifyCommands: [],
    constraints: '',
    deliverables: '',
    dag,
    ownerUserId: 'tenant-a',
  })
  const id = created.dispatch!.id
  await waitFor(() => service.findById(id)?.status === 'completed', 5000)
  const record = service.findById(id)!
  return { status: record.status, result: record.result }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSelectResult.mockResolvedValue([])
  mockFetch.mockReset()
  mockInsert.mockReturnValue({ values: mockInsertValues })
  mockInsertValues.mockReturnValue({
    returning: vi.fn().mockResolvedValue([{ id: 'task-1' }]),
  })
  mockUpdate.mockReturnValue({ set: mockSet })
  mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) })
})

describe('SDB-37 ① 条件不满足:下游节点被跳过', () => {
  it('a 输出不含 YES ⇒ b 不调模型、不进入最终结果', async () => {
    const service = new SubagentDispatchService()
    await service.setRedisClient(asRedis(new FakeRedis()))
    mockFetch.mockImplementationOnce(async () => okResponse('NO'))

    const { status, result } = await runDag(service, {
      nodes: [
        { id: 'a', agentRole: 'researcher', task: '产出判断' },
        { id: 'b', agentRole: 'coder', task: '不应执行' },
      ],
      edges: [{ from: 'a', to: 'b', condition: "result.includes('YES')" }],
    })

    expect(status).toBe('completed')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(result).toContain('[a]: NO')
    expect(result).not.toContain('[b]:')
  })
})

describe('SDB-37 ② 链式传播:a→b→c', () => {
  it('b 因条件不满足被取消后,c 同样被跳过(不是只判一层)', async () => {
    const service = new SubagentDispatchService()
    await service.setRedisClient(asRedis(new FakeRedis()))
    mockFetch.mockImplementationOnce(async () => okResponse('NO'))

    const { status, result } = await runDag(service, {
      nodes: [
        { id: 'a', agentRole: 'researcher', task: '产出判断' },
        { id: 'b', agentRole: 'coder', task: '中间节点' },
        { id: 'c', agentRole: 'coder', task: '末端节点' },
      ],
      edges: [
        { from: 'a', to: 'b', condition: "result.includes('YES')" },
        { from: 'b', to: 'c' },
      ],
    })

    expect(status).toBe('completed')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(result).toContain('[a]: NO')
    expect(result).not.toContain('[b]:')
    expect(result).not.toContain('[c]:')
  })
})

describe('SDB-37 ③ 无条件边不受影响', () => {
  it('a→b 无 condition ⇒ 两个节点都执行并进入结果', async () => {
    const service = new SubagentDispatchService()
    await service.setRedisClient(asRedis(new FakeRedis()))
    mockFetch.mockImplementationOnce(async () => okResponse('OK-A'))
    mockFetch.mockImplementationOnce(async () => okResponse('OK-B'))

    const { status, result } = await runDag(service, {
      nodes: [
        { id: 'a', agentRole: 'researcher', task: '前置任务' },
        { id: 'b', agentRole: 'coder', task: '后续任务' },
      ],
      edges: [{ from: 'a', to: 'b' }],
    })

    expect(status).toBe('completed')
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(result).toContain('[a]: OK-A')
    expect(result).toContain('[b]: OK-B')
  })
})

describe('SDB-37 ④ 汇聚节点仍有存活上游时不误伤', () => {
  it('a→b 条件不满足、a→c 正常,b/c 汇入 d ⇒ b 跳过,d 照常执行', async () => {
    const service = new SubagentDispatchService()
    await service.setRedisClient(asRedis(new FakeRedis()))
    mockFetch.mockImplementationOnce(async () => okResponse('NO'))
    mockFetch.mockImplementationOnce(async () => okResponse('OK-C'))
    mockFetch.mockImplementationOnce(async () => okResponse('OK-D'))

    const { status, result } = await runDag(service, {
      nodes: [
        { id: 'a', agentRole: 'researcher', task: '分叉' },
        { id: 'b', agentRole: 'coder', task: '条件分支' },
        { id: 'c', agentRole: 'coder', task: '常驻分支' },
        { id: 'd', agentRole: 'coder', task: '汇聚节点' },
      ],
      edges: [
        { from: 'a', to: 'b', condition: "result.includes('YES')" },
        { from: 'a', to: 'c' },
        { from: 'b', to: 'd' },
        { from: 'c', to: 'd' },
      ],
    })

    expect(status).toBe('completed')
    expect(mockFetch).toHaveBeenCalledTimes(3)
    expect(result).toContain('[a]: NO')
    expect(result).not.toContain('[b]:')
    expect(result).toContain('[c]: OK-C')
    expect(result).toContain('[d]: OK-D')
  })
})
