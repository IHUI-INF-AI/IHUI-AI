// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F1(2026-11-02)崩溃自愈。
 *
 * 背景:旧实现启动时只把 Redis 里的 pending/running 装回内存,不重新执行;
 * 而 resume 拒绝 running ⇒ 进程重启后正在跑的派单变成「既不动也 resume 不了」的僵尸。
 *
 * 本文件覆盖:
 *  ① running 记录在启动时被标记 interrupted 并自动重新入队执行(终态 completed);
 *  ② 已有 ok checkpoint 的派单恢复时直接按完成收尾,不再调一次 AI(不重复执行);
 *  ③ outbox 重试意图跨重启可续:从 attempt+1 继续,不重跑已失败那次;
 *  ④ agent_tasks 终态写回幂等:已终态不重复 update/广播;
 *  ⑤ 反向例基线:删掉启动恢复 ⇒ ① 必须变红(本文件用「不触发恢复」的同形断言钉住)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Redis } from 'ioredis'

const { mockFetch, mockUpdate, mockInsert, mockSelectResult, mockRelease } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockUpdate: vi.fn(),
  mockInsert: vi.fn(),
  mockSelectResult: vi.fn().mockResolvedValue([]),
  mockRelease: vi.fn().mockResolvedValue(undefined),
}))

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
  releaseTaskLockByTaskId: mockRelease,
  _resetLockHeartbeats: vi.fn(),
  toLockReleaseOutcome: (status: string): string | null =>
    ['completed', 'failed', 'cancelled', 'preempted', 'quota_exceeded', 'deleted'].includes(status)
      ? status
      : null,
}))

import { SubagentDispatchService } from '../src/services/subagent-dispatch-service'

const KEY_DISPATCH = 'subagent:dispatch:'
const KEY_IDS = 'subagent:dispatch:ids'
const KEY_LOGS = 'subagent:logs:'
const KEY_CHECKPOINT = 'subagent:checkpoint:'

/** 最小 Redis 假件(只实现 service 用到的指令;值一律字符串,贴近 ioredis 行为) */
class FakeRedis {
  hashes = new Map<string, Record<string, string>>()
  sets = new Map<string, Set<string>>()
  lists = new Map<string, string[]>()
  zsets = new Map<string, Map<string, number>>()

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
  async expire(): Promise<number> {
    return 1
  }
}

function asRedis(fake: FakeRedis): Redis {
  return fake as unknown as Redis
}

function logsOf(fake: FakeRedis, id: string): Array<Record<string, unknown>> {
  return (fake.lists.get(`${KEY_LOGS}${id}`) ?? []).map((raw) => JSON.parse(raw) as Record<string, unknown>)
}

function eventsOf(fake: FakeRedis, id: string): string[] {
  return logsOf(fake, id).map((entry) => String(entry.event))
}

function seedDispatch(
  fake: FakeRedis,
  id: string,
  overrides: Record<string, string> = {},
  checkpoint?: Record<string, unknown>,
): void {
  const hash: Record<string, string> = {
    id,
    goal: '恢复测试',
    affectedFiles: '["a.ts"]',
    forbidden: '[]',
    verifyCommands: '[]',
    constraints: 'constraints',
    deliverables: 'deliverables',
    agentRole: 'coder',
    orchestration: 'parallel',
    status: 'running',
    result: '',
    createdAt: '2026-11-02T00:00:00.000Z',
    updatedAt: '2026-11-02T00:00:00.000Z',
    retry: '',
    dag: '',
    priority: 'normal',
    quotas: '',
    ownerUserId: 'u-1',
    prompt: 'PERSISTED PROMPT',
    conversationId: '',
    agentTaskId: '',
    steps: '[]',
    startedAt: '',
    completedAt: '',
    dagNodeStatus: '[]',
    messages: '[]',
    outbox: '',
    ...overrides,
  }
  fake.hashes.set(`${KEY_DISPATCH}${id}`, hash)
  const ids = fake.sets.get(KEY_IDS) ?? new Set<string>()
  ids.add(id)
  fake.sets.set(KEY_IDS, ids)
  if (checkpoint) {
    const cp = new Map<string, string>()
    for (const [stepId, value] of Object.entries(checkpoint)) cp.set(stepId, JSON.stringify(value))
    fake.hashes.set(`${KEY_CHECKPOINT}${id}`, Object.fromEntries(cp))
  }
}

async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
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

beforeEach(() => {
  vi.clearAllMocks()
  mockSelectResult.mockResolvedValue([])
  mockFetch.mockImplementation(async () => okResponse('recovered-output'))
  mockUpdate.mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) })
})

describe('F1 崩溃自愈:启动恢复', () => {
  it('running 记录被标记 interrupted 并自动续跑,完成终态(不重复 dispatch_created)', async () => {
    const fake = new FakeRedis()
    const id = 'd-recover-1'
    seedDispatch(fake, id)
    const service = new SubagentDispatchService()

    await service.setRedisClient(asRedis(fake))
    await waitFor(() => fake.hashes.get(`${KEY_DISPATCH}${id}`)?.status === 'completed')

    // 自动续跑:用持久化的 prompt 调了一次 ai-service(不是零次,也不是从 build 函数重拼)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const body = JSON.parse(String((mockFetch.mock.calls[0]![1] as { body: string }).body)) as {
      items: Array<{ input: string }>
    }
    expect(body.items[0]!.input).toBe('PERSISTED PROMPT')

    // 执行态可被重建:内存里拿到的就是完成后的记录
    expect(service.findById(id)?.status).toBe('completed')
    expect(service.findById(id)?.result).toBe('recovered-output')

    const events = eventsOf(fake, id)
    expect(events.filter((e) => e === 'dispatch_interrupted')).toHaveLength(1)
    expect(events.filter((e) => e === 'dispatch_recovered')).toHaveLength(1)
    expect(events).not.toContain('dispatch_created') // 恢复不是新建
  })

  it('已有 ok checkpoint:恢复时直接完成,不再调用 AI(只执行一次)', async () => {
    const fake = new FakeRedis()
    const id = 'd-recover-checkpoint'
    seedDispatch(fake, id, {}, {
      'step-1': {
        stepId: 'step-1',
        agentRole: 'coder',
        status: 'ok',
        result: 'checkpoint-output',
        timestamp: '2026-11-02T00:00:00.000Z',
      },
    })
    const service = new SubagentDispatchService()

    await service.setRedisClient(asRedis(fake))
    // 终态写入先于断点日志落盘 ⇒ 等同一个可观察结果(日志出现在 Redis 里)再断言,避免读取时差
    await waitFor(
      () =>
        fake.hashes.get(`${KEY_DISPATCH}${id}`)?.status === 'completed' &&
        eventsOf(fake, id).includes('dispatch_recovered_from_checkpoint'),
    )

    expect(mockFetch).not.toHaveBeenCalled()
    expect(service.findById(id)?.result).toBe('checkpoint-output')
    expect(eventsOf(fake, id)).toContain('dispatch_recovered_from_checkpoint')
  })

  it('outbox 重试意图跨重启续跑:从 attempt+1 继续,不重跑已失败的 attempt', async () => {
    const fake = new FakeRedis()
    const id = 'd-recover-outbox'
    seedDispatch(fake, id, {
      outbox: JSON.stringify({
        attempt: 1,
        maxAttempts: 2,
        nextRetryAt: 0,
        lastError: 'first attempt failed before crash',
      }),
    })
    const service = new SubagentDispatchService()

    await service.setRedisClient(asRedis(fake))
    await waitFor(() => fake.hashes.get(`${KEY_DISPATCH}${id}`)?.status === 'completed')

    // attempt 1 已经执行过(记录在 outbox)⇒ 恢复只执行 attempt 2,AI 只被调一次
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(fake.hashes.get(`${KEY_DISPATCH}${id}`)?.outbox).toBe('')
    expect(service.findById(id)?.status).toBe('completed')
  })

  it('反向基线:未把记录放进 Redis 活跃集 ⇒ 启动不接管(证明恢复逻辑确实依赖持久化恢复)', async () => {
    const fake = new FakeRedis()
    const id = 'd-orphan'
    seedDispatch(fake, id)
    // 模拟「持久化层丢了活跃集」:hash 在,但 ids 集合没有该 id
    fake.sets.set(KEY_IDS, new Set<string>())
    const service = new SubagentDispatchService()

    await service.setRedisClient(asRedis(fake))
    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(service.findById(id)).toBeNull()
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('F1 幂等:agent_tasks 终态只写一次', () => {
  it('同一终态重复写回:第二次直接跳过,不 update/不释放锁', async () => {
    const service = new SubagentDispatchService() as unknown as {
      _syncAgentTask: (runtime: {
        agentTaskId?: string
        dispatch: { status: string; result?: string }
        completedAt?: number
      }) => Promise<void>
    }
    mockSelectResult
      .mockResolvedValueOnce([{ status: 'running', result: null, teamId: null }])
      .mockResolvedValueOnce([{ status: 'completed', result: null, teamId: null }])

    await service._syncAgentTask({
      agentTaskId: 'task-1',
      dispatch: { status: 'completed', result: 'out' },
      completedAt: 1_700_000_000_000,
    })
    await service._syncAgentTask({
      agentTaskId: 'task-1',
      dispatch: { status: 'completed', result: 'out' },
      completedAt: 1_700_000_000_000,
    })

    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockRelease).toHaveBeenCalledTimes(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
