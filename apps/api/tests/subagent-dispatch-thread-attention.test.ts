// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F3(2026-11-02)Thread/Ticket 最小版 + 人工注意力。
 *
 * 背景:`conversationId` 原先只是归属标签 —— `buildAgentPrompt` 不读它,同一会话的后续派单
 * 与上一条完全无关;执行状态只有 8 个,没有「等人回答 / 等人复核」。
 *
 * 本文件覆盖:
 *  ① 同会话第二次派单挂到既有 thread(parentDispatchId),prompt 带入第一次的 goal + result
 *    (近期 inline;引用行落点是 GET /api/subagents/{id}/stats 的 result);
 *  ② 跨租户同一 conversationId 不成链、不读他人历史(thread 不是跨租户血缘通道);
 *  ③ 重启后(已完成记录不在进程内 Map)仍能从 Redis 索引把后续派单挂回 thread;
 *  ④ attention 可进/可退、与 status 正交、`/active` 的数据源(listActive)自然反映;
 *  ⑤ 落库:建单写 parent_dispatch_id / attention,变更镜像 agent_tasks.attention;
 *  ⑥ 终态记录不允许再进入 attention(terminal)。
 *
 * 反向例(实测):删掉 `_buildPromptWithThread` 的调用 ⇒ ① 红;删掉 `_persistDispatch` 里的
 * `parentDispatchId/attention` 写入 ⇒ ③/④ 红(读数见提交回传)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Redis } from 'ioredis'

const { mockFetch, mockInsert, mockInsertValues, mockUpdate, mockSet, mockSelectResult, mockRelease } =
  vi.hoisted(() => ({
    mockFetch: vi.fn(),
    mockInsert: vi.fn(),
    mockInsertValues: vi.fn(),
    mockUpdate: vi.fn(),
    mockSet: vi.fn(),
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
const KEY_THREAD = 'subagent:dispatch:thread:'

/** 最小 Redis 假件(含 F3 thread 索引需要的 zrevrange;数值贴 ioredis 行为) */
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
  async zrevrange(
    key: string,
    start: number,
    stop: number,
    withScores?: string,
  ): Promise<string[]> {
    const sorted = Array.from(this.zsets.get(key) ?? new Map<string, number>()).sort(
      (a, b) => b[1] - a[1],
    )
    const end = stop < 0 ? sorted.length + stop + 1 : stop + 1
    const slice = sorted.slice(start, end)
    return withScores ? slice.flatMap(([m, s]) => [m, String(s)]) : slice.map(([m]) => m)
  }
  async expire(): Promise<number> {
    return 1
  }
}

function asRedis(fake: FakeRedis): Redis {
  return fake as unknown as Redis
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

/** 造一条已完成的 thread 记录(只落 thread 读取需要的字段) */
function seedCompletedThread(
  fake: FakeRedis,
  id: string,
  conversationId: string,
  ownerUserId: string,
  goal: string,
  result: string,
  createdAt = '2026-11-01T00:00:00.000Z',
): void {
  fake.hashes.set(`${KEY_DISPATCH}${id}`, {
    id,
    goal,
    status: 'completed',
    result,
    createdAt,
    updatedAt: createdAt,
    conversationId,
    ownerUserId,
  })
  const ids = fake.sets.get(KEY_IDS) ?? new Set<string>()
  ids.add(id)
  fake.sets.set(KEY_IDS, ids)
  const key = `${KEY_THREAD}${conversationId}`
  const z = fake.zsets.get(key) ?? new Map<string, number>()
  z.set(id, Date.parse(createdAt))
  fake.zsets.set(key, z)
}

const CONV = 'conv-thread-1'

beforeEach(() => {
  vi.clearAllMocks()
  mockSelectResult.mockResolvedValue([])
  mockFetch.mockImplementation(async () => okResponse('默认输出'))
  mockInsert.mockReturnValue({ values: mockInsertValues })
  mockInsertValues.mockReturnValue({
    returning: vi.fn().mockResolvedValue([{ id: 'task-1' }]),
  })
  mockUpdate.mockReturnValue({ set: mockSet })
  mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) })
})

describe('F3 ① 同会话派单挂 thread 并带入第一次上下文', () => {
  it('第二次派单 parentDispatchId = 第一条,persisted prompt 含第一次 goal/result + 按引用取地址', async () => {
    const fake = new FakeRedis()
    const service = new SubagentDispatchService()
    await service.setRedisClient(asRedis(fake))
    mockFetch.mockImplementationOnce(async () => okResponse('第一条结果'))

    const first = await service.dispatch({
      goal: '第一条:梳理登录流程',
      affectedFiles: ['a.ts'],
      conversationId: CONV,
      ownerUserId: 'tenant-a',
    })
    const firstId = first.dispatch!.id
    await waitFor(() => service.findById(firstId)?.status === 'completed')
    expect(service.findById(firstId)?.result).toBe('第一条结果')

    const second = await service.dispatch({
      goal: '第二条:补充边界用例',
      affectedFiles: ['a.ts'],
      conversationId: CONV,
      ownerUserId: 'tenant-a',
    })
    const secondId = second.dispatch!.id
    await waitFor(() => fake.hashes.get(`${KEY_DISPATCH}${secondId}`)?.prompt !== undefined)

    // 挂到既有 thread(不是孤立新开)
    expect(service.findById(secondId)?.parentDispatchId).toBe(firstId)
    expect(fake.hashes.get(`${KEY_DISPATCH}${secondId}`)?.parentDispatchId).toBe(firstId)

    const prompt = fake.hashes.get(`${KEY_DISPATCH}${secondId}`)!.prompt
    expect(prompt).toContain('## 同会话历史(thread)')
    expect(prompt).toContain(`上一条派单 id:${firstId}`)
    expect(prompt).toContain('第一条:梳理登录流程')
    expect(prompt).toContain('第一条结果')
    // 超预算/更早内容的真实取回点(不是截断丢弃)
    expect(prompt).toContain(`GET /api/subagents/${firstId}/stats`)

    // 两条都在会话索引里(顺序 = createdAt)
    expect(fake.zsets.get(`${KEY_THREAD}${CONV}`)?.has(firstId)).toBe(true)
    expect(fake.zsets.get(`${KEY_THREAD}${CONV}`)?.has(secondId)).toBe(true)
  })
})

describe('F3 ② 跨租户同一会话不成链', () => {
  it('B 在 A 的会话里派单:不挂父节点,persisted prompt 不含 A 的 goal/result', async () => {
    const fake = new FakeRedis()
    const service = new SubagentDispatchService()
    await service.setRedisClient(asRedis(fake))

    const first = await service.dispatch({
      goal: 'A 的秘密目标',
      affectedFiles: ['a.ts'],
      conversationId: CONV,
      ownerUserId: 'tenant-a',
    })
    await waitFor(() => service.findById(first.dispatch!.id)?.status === 'completed')

    const second = await service.dispatch({
      goal: 'B 的目标',
      affectedFiles: ['a.ts'],
      conversationId: CONV,
      ownerUserId: 'tenant-b',
    })
    const secondId = second.dispatch!.id
    await waitFor(() => fake.hashes.get(`${KEY_DISPATCH}${secondId}`)?.prompt !== undefined)

    expect(service.findById(secondId)?.parentDispatchId).toBeUndefined()
    const prompt = fake.hashes.get(`${KEY_DISPATCH}${secondId}`)!.prompt
    expect(prompt).not.toContain('A 的秘密目标')
    expect(prompt).not.toContain('默认输出')
    expect(prompt).not.toContain('## 同会话历史(thread)')
  })
})

describe('F3 ③ 重启后 thread 仍可挂回(历史来自 Redis 索引)', () => {
  it('新进程内的 Map 不含已完成的第一条,但后续派单仍能挂父并读到第一条结果', async () => {
    const fake = new FakeRedis()
    const serviceA = new SubagentDispatchService()
    await serviceA.setRedisClient(asRedis(fake))

    const first = await serviceA.dispatch({
      goal: '重启前的目标',
      affectedFiles: ['a.ts'],
      conversationId: CONV,
      ownerUserId: 'tenant-a',
    })
    const firstId = first.dispatch!.id
    await waitFor(() => serviceA.findById(firstId)?.status === 'completed')

    // 重启:新实例只接管 pending/running/queued/interrupted ⇒ 已完成记录不在内存
    const serviceB = new SubagentDispatchService()
    await serviceB.setRedisClient(asRedis(fake))
    expect(serviceB.findById(firstId)).toBeNull()

    const second = await serviceB.dispatch({
      goal: '重启后的目标',
      affectedFiles: ['a.ts'],
      conversationId: CONV,
      ownerUserId: 'tenant-a',
    })
    const secondId = second.dispatch!.id
    await waitFor(() => fake.hashes.get(`${KEY_DISPATCH}${secondId}`)?.prompt !== undefined)

    expect(serviceB.findById(secondId)?.parentDispatchId).toBe(firstId)
    const prompt = fake.hashes.get(`${KEY_DISPATCH}${secondId}`)!.prompt
    expect(prompt).toContain('重启前的目标')
    expect(prompt).toContain('默认输出')
  })
})

describe('F3 ④ 人工注意力:进入/退出 + /active 反映', () => {
  it('awaiting_answer 进入、awaiting_review 切换、null 退出;listActive(/active 数据源)随之变化', async () => {
    const fake = new FakeRedis()
    const service = new SubagentDispatchService()
    await service.setRedisClient(asRedis(fake))

    let releaseAi: ((value: unknown) => void) | undefined
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseAi = resolve
        }),
    )

    const created = await service.dispatch({
      goal: '等人的任务',
      affectedFiles: ['a.ts'],
      ownerUserId: 'tenant-a',
    })
    const id = created.dispatch!.id
    await waitFor(() => service.findById(id)?.status === 'running')

    const entered = await service.setAttention(id, 'awaiting_answer')
    expect(entered.ok).toBe(true)
    expect(service.findById(id)?.attention).toBe('awaiting_answer')
    expect(service.listActive().find((d) => d.id === id)?.attention).toBe('awaiting_answer')
    expect(fake.hashes.get(`${KEY_DISPATCH}${id}`)?.attention).toBe('awaiting_answer')
    // 正交:attention 不改变执行状态
    expect(service.findById(id)?.status).toBe('running')

    const switched = await service.setAttention(id, 'awaiting_review')
    expect(switched.ok).toBe(true)
    expect(service.findById(id)?.attention).toBe('awaiting_review')

    const cleared = await service.setAttention(id, null)
    expect(cleared.ok).toBe(true)
    expect(service.findById(id)?.attention).toBeUndefined()
    expect(service.listActive().find((d) => d.id === id)?.attention).toBeUndefined()
    expect(fake.hashes.get(`${KEY_DISPATCH}${id}`)?.attention).toBe('')

    releaseAi!(okResponse('完成'))
    await waitFor(() => service.findById(id)?.status === 'completed')

    // 终态不再接受「进入」
    const rejected = await service.setAttention(id, 'awaiting_review')
    expect(rejected).toEqual({ ok: false, reason: 'terminal' })
    expect(service.findById(id)?.attention).toBeUndefined()
  })
})

describe('F3 ⑤ 落库镜像:agent_tasks.parent_dispatch_id / attention', () => {
  it('建单写入 parentDispatchId(来自 thread)与 attention=NULL;变更时同步 attention', async () => {
    const fake = new FakeRedis()
    seedCompletedThread(fake, 'd-parent', CONV, 'tenant-a', '父目标', '父结果')
    const service = new SubagentDispatchService()
    await service.setRedisClient(asRedis(fake))

    let releaseAi: ((value: unknown) => void) | undefined
    mockFetch.mockImplementationOnce(
      () => new Promise((resolve) => (releaseAi = resolve)),
    )

    const created = await service.dispatch({
      goal: '子任务',
      affectedFiles: ['a.ts'],
      conversationId: CONV,
      ownerUserId: 'tenant-a',
      agentId: 'agent-1',
    })
    const id = created.dispatch!.id
    await waitFor(() => service.findById(id)?.status === 'running')

    const inserted = mockInsertValues.mock.calls[0]![0] as Record<string, unknown>
    expect(inserted.parentDispatchId).toBe('d-parent')
    expect(inserted.attention).toBeNull()

    await service.setAttention(id, 'awaiting_answer')
    const attentionSet = mockSet.mock.calls.find(
      (call) => (call[0] as Record<string, unknown>).attention === 'awaiting_answer',
    )
    expect(attentionSet).toBeDefined()

    releaseAi!(okResponse('子结果'))
    await waitFor(() => service.findById(id)?.status === 'completed')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
