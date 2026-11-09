// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-255(2026-11-08)`runtimes` 无界增长收口。
 *
 * 缺陷:`runtimes` Map 只增不减 —— 终态记录永远留在进程里,长期运行必然无界;
 * Redis 侧 dispatch hash / logs 键同样没有 TTL ⇒「内存有界、Redis 无界」。
 *
 * 本文件钉住四条契约:
 *  ① 终态记录不再无界:超过 200 条按 LRU 淘汰(读命中保活),超过 30 分钟按 TTL 淘汰;
 *  ② 淘汰候选必须同时满足「终态 + !inFlight + 已落盘」,活跃记录任何情况下不被淘汰,
 *     无候选时宁可短暂超上限并记 `eviction_skipped`;
 *  ③ 淘汰只删内存:不发 abort、不碰执行器(活跃派单继续跑);
 *  ④ 淘汰后按 id 读取从 Redis 重建(`findByIdOrRestore`),归属闸仍判「这是谁的记录」,
 *     不会用「内存有界」换「合法用户 404 / 归属校验失效」;
 *  ⑤ 终态写入同时给 dispatch hash 与 logs list 补 TTL。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Redis } from 'ioredis'

const { mockFetch, mockUpdate, mockInsert, mockSelectResult } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockUpdate: vi.fn(),
  mockInsert: vi.fn(),
  mockSelectResult: vi.fn().mockResolvedValue([]),
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
  chatConversations: { id: 'chat_conversations_id' },
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

// 归属闸模块会引 require-permission;本文件不需要管理面通道,给出最小桩
vi.mock('../src/plugins/require-permission.js', () => ({
  isSystemAdmin: () => false,
  requireAdmin: async () => undefined,
  requirePermission: () => async () => undefined,
}))

import {
  SubagentDispatchService,
  subagentDispatchService,
} from '../src/services/subagent-dispatch-service'
import { ownsDispatchById } from '../src/utils/dispatch-ownership'
import type { ExtendedDispatchInput } from '../src/services/subagent-dispatch-service'

const KEY_DISPATCH = 'subagent:dispatch:'
const KEY_IDS = 'subagent:dispatch:ids'
const KEY_LOGS = 'subagent:logs:'
const KEY_CHECKPOINT = 'subagent:checkpoint:'

/** 最小 Redis 假件(额外记录 expire 入参,用于钉 TTL) */
class FakeRedis {
  hashes = new Map<string, Record<string, string>>()
  sets = new Map<string, Set<string>>()
  lists = new Map<string, string[]>()
  zsets = new Map<string, Map<string, number>>()
  /** key → TTL 秒(F-255 断言用) */
  expires = new Map<string, number>()

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
    withScores?: 'WITHSCORES',
  ): Promise<string[]> {
    const z = Array.from(this.zsets.get(key) ?? new Map<string, number>())
      .sort((a, b) => b[1] - a[1])
      .slice(start, stop < 0 ? undefined : stop + 1)
    return withScores ? z.flatMap(([m, s]) => [m, String(s)]) : z.map(([m]) => m)
  }
  async expire(key: string, ttl: number): Promise<number> {
    this.expires.set(key, ttl)
    return 1
  }
}

function asRedis(fake: FakeRedis): Redis {
  return fake as unknown as Redis
}

const NOW_ISO = '2026-11-08T00:00:00.000Z'

function seedTerminalHash(
  fake: FakeRedis,
  id: string,
  overrides: Record<string, string> = {},
): void {
  const hash: Record<string, string> = {
    id,
    goal: '保留测试',
    affectedFiles: '["a.ts"]',
    forbidden: '[]',
    verifyCommands: '[]',
    constraints: 'c',
    deliverables: 'd',
    agentRole: 'coder',
    orchestration: 'parallel',
    status: 'completed',
    result: 'done',
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
    priority: 'normal',
    ownerUserId: 'u-1',
    steps: '[]',
    messages: '[]',
    dagNodeStatus: '[]',
    terminalAt: String(Date.now()),
    ...overrides,
  }
  fake.hashes.set(`${KEY_DISPATCH}${id}`, hash)
  const ids = fake.sets.get(KEY_IDS) ?? new Set<string>()
  ids.add(id)
  fake.sets.set(KEY_IDS, ids)
}

/** 白盒运行时(只造 listAll/getStats/淘汰读到的字段) */
function makeRuntime(
  id: string,
  opts: { lastUsedAt: number; terminalAt?: number; status?: string; owner?: string },
): Record<string, unknown> {
  return {
    dispatch: {
      id,
      goal: 'retention',
      affectedFiles: [],
      forbidden: [],
      verifyCommands: [],
      constraints: '',
      deliverables: '',
      agentRole: 'coder',
      orchestration: 'parallel',
      status: opts.status ?? 'completed',
      result: 'done',
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO,
      ownerUserId: opts.owner ?? 'u-1',
    },
    priority: 'normal',
    steps: [],
    logs: [],
    checkpoints: new Map(),
    messages: [],
    dagNodeStatus: new Map(),
    artifacts: new Map(),
    startedAt: undefined,
    completedAt: opts.terminalAt,
    hasFailed: false,
    terminalAt: opts.terminalAt,
    terminalPersisted: true,
    lastUsedAt: opts.lastUsedAt,
  }
}

type Internals = {
  runtimes: Map<string, Record<string, unknown>>
  inFlight: Set<string>
}

function internalsOf(service: SubagentDispatchService): Internals {
  return service as unknown as Internals
}

async function waitFor(predicate: () => boolean, timeoutMs = 4000): Promise<void> {
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

const baseInput: ExtendedDispatchInput = {
  goal: 'retention-test',
  affectedFiles: ['apps/api/src/x.ts'],
  verifyCommands: [],
  constraints: 'only listed files',
  deliverables: 'patch',
  agentRole: 'coder',
  orchestration: 'parallel',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSelectResult.mockResolvedValue([])
  mockFetch.mockImplementation(async () => okResponse('ok'))
  mockUpdate.mockReturnValue({
    set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
  })
})

describe('F-255 ① 终态记录不再无界', () => {
  it('真实终态超过 200 条时,内存保留面收敛到 200(LRU 淘汰最老)', async () => {
    const fake = new FakeRedis()
    const service = new SubagentDispatchService()
    await service.setRedisClient(asRedis(fake))

    const created: string[] = []
    for (let i = 0; i < 205; i += 1) {
      const r = await service.dispatch({ ...baseInput, goal: `r-${i}`, ownerUserId: `u-${i}` })
      created.push(r.dispatch!.id)
    }
    // 等 205 条全部落终态(Redis hash 是落盘事实,不受内存淘汰影响)
    await waitFor(
      () =>
        created.filter((id) => fake.hashes.get(`${KEY_DISPATCH}${id}`)?.status === 'completed')
          .length === 205,
    )

    // 改前红:runtimes 只增不减 ⇒ 205 条全留;改后:≤200
    expect(service.listAll().length).toBeLessThanOrEqual(200)
    expect(service.getRetentionStats().terminalRetained).toBeLessThanOrEqual(200)
    expect(service.getRetentionStats().evictedTotal).toBeGreaterThanOrEqual(5)
  })

  it('超过 30 分钟的终态记录按 TTL 淘汰', () => {
    const service = new SubagentDispatchService()
    const internals = internalsOf(service)
    const now = Date.now()
    for (let i = 0; i < 199; i += 1) {
      internals.runtimes.set(`fresh-${i}`, makeRuntime(`fresh-${i}`, { lastUsedAt: now, terminalAt: now - i * 1000 }))
    }
    internals.runtimes.set(
      'stale-1',
      makeRuntime('stale-1', { lastUsedAt: now - 3_600_000, terminalAt: now - 31 * 60 * 1000 }),
    )

    const stats = service.getRetentionStats()
    expect(internals.runtimes.has('stale-1')).toBe(false)
    expect(stats.terminalRetained).toBe(199)
    expect(stats.evictedTotal).toBe(1)
  })
})

describe('F-255 ② 活跃记录绝不淘汰 + eviction_skipped', () => {
  it('全部终态候选都在飞时宁可超上限,记 eviction_skipped,一条不删', () => {
    const service = new SubagentDispatchService()
    const internals = internalsOf(service)
    const now = Date.now()
    for (let i = 0; i < 205; i += 1) {
      const id = `inflight-term-${i}`
      internals.runtimes.set(id, makeRuntime(id, { lastUsedAt: now - i, terminalAt: now }))
      internals.inFlight.add(id) // 终态但执行器还没退出 .finally ⇒ 不可淘汰
    }

    const stats = service.getRetentionStats()
    expect(stats.terminalRetained).toBe(205) // 宁可短暂超上限
    expect(stats.evictionSkippedTotal).toBe(5)
    expect(stats.evictedTotal).toBe(0)
    expect(internals.inFlight.size).toBe(205)
  })

  it('活跃派单不被淘汰,且淘汰不碰执行器(继续跑)', async () => {
    const fake = new FakeRedis()
    const service = new SubagentDispatchService()
    await service.setRedisClient(asRedis(fake))

    for (let i = 0; i < 201; i += 1) {
      await service.dispatch({ ...baseInput, goal: `t-${i}`, ownerUserId: `u-${i}` })
    }
    await waitFor(
      () =>
        Array.from(fake.hashes.entries()).filter(
          ([key, h]) => key.startsWith(KEY_DISPATCH) && h.status === 'completed',
        ).length === 201,
    )

    // 一条永不返回的派单:保持 running / inFlight
    mockFetch.mockImplementation(() => new Promise(() => {}))
    const active = await service.dispatch({ ...baseInput, goal: 'active', ownerUserId: 'u-active' })
    await waitFor(() => service.findById(active.dispatch!.id)?.status === 'running')

    service.listAll() // 触发一次淘汰
    expect(service.findById(active.dispatch!.id)?.status).toBe('running')
    expect(internalsOf(service).inFlight.has(active.dispatch!.id)).toBe(true)
  })

  it('读命中保活:被读过的最老终态记录排在淘汰序列之后', () => {
    const service = new SubagentDispatchService()
    const internals = internalsOf(service)
    const now = Date.now()
    for (let i = 0; i < 201; i += 1) {
      const id = `lru-${String(i).padStart(3, '0')}`
      internals.runtimes.set(id, makeRuntime(id, { lastUsedAt: i, terminalAt: now }))
    }

    // 读最老的那条 ⇒ lastUsedAt 抬到 now
    expect(service.findById('lru-000')).not.toBeNull()
    const stats = service.getRetentionStats()

    expect(stats.terminalRetained).toBe(200)
    expect(internals.runtimes.has('lru-000')).toBe(true) // 读过的保活
    expect(internals.runtimes.has('lru-001')).toBe(false) // 次老被淘汰
  })
})

describe('F-255 ③ 淘汰后的读路径:Redis 回退 + 归属判据', () => {
  it('淘汰后 findByIdOrRestore 从 Redis 重建,不把合法读取变 404', async () => {
    const fake = new FakeRedis()
    const service = new SubagentDispatchService()
    const base = Date.now() - 200_000
    for (let i = 0; i < 200; i += 1) {
      seedTerminalHash(fake, `seed-${String(i).padStart(3, '0')}`, {
        ownerUserId: 'u-owner',
        terminalAt: String(base + i * 1000),
      })
    }
    await service.setRedisClient(asRedis(fake)) // 启动装载只装活跃记录,终态不进内存
    for (let i = 0; i < 200; i += 1) {
      const id = `seed-${String(i).padStart(3, '0')}`
      expect(await service.findByIdOrRestore(id)).not.toBeNull()
    }
    expect(service.getRetentionStats().terminalRetained).toBe(200)

    // 再来一条终态 ⇒ 超上限,最老(seed-000)被淘汰
    const fresh = await service.dispatch({ ...baseInput, goal: 'fresh', ownerUserId: 'u-owner' })
    await waitFor(
      () => fake.hashes.get(`${KEY_DISPATCH}${fresh.dispatch!.id}`)?.status === 'completed',
    )
    service.listAll()

    expect(service.findById('seed-000')).toBeNull() // 内存确实删了
    const restored = await service.findByIdOrRestore('seed-000')
    expect(restored).not.toBeNull()
    expect(restored!.status).toBe('completed')
    expect(restored!.ownerUserId).toBe('u-owner')
  })

  it('归属闸走回退读:本人 true、他人 false、不存在 false(一律仍由路由 404)', async () => {
    const fake = new FakeRedis()
    seedTerminalHash(fake, 'gate-1', { ownerUserId: 'u-owner' })
    await subagentDispatchService.setRedisClient(asRedis(fake))

    expect(await ownsDispatchById('gate-1', 'u-owner')).toBe(true)
    expect(await ownsDispatchById('gate-1', 'u-other')).toBe(false)
    expect(await ownsDispatchById('gate-missing', 'u-owner')).toBe(false)
  })
})

describe('F-255 ⑤ Redis 终态键 TTL', () => {
  it('终态写入给 dispatch hash 与 logs list 同时补 30 分钟 TTL', async () => {
    const fake = new FakeRedis()
    const service = new SubagentDispatchService()
    await service.setRedisClient(asRedis(fake))

    const r = await service.dispatch({ ...baseInput, goal: 'ttl', ownerUserId: 'u-ttl' })
    const id = r.dispatch!.id
    await waitFor(
      () =>
        fake.expires.has(`${KEY_DISPATCH}${id}`) && fake.expires.has(`${KEY_LOGS}${id}`),
    )
    expect(fake.expires.get(`${KEY_DISPATCH}${id}`)).toBe(1800)
    expect(fake.expires.get(`${KEY_LOGS}${id}`)).toBe(1800)
    expect(fake.hashes.get(`${KEY_DISPATCH}${id}`)?.terminalAt).toBeTruthy()
  })

  it('cancel 也是终态出口:走 _finalize,记 terminalAt 并补 TTL', async () => {
    const fake = new FakeRedis()
    const service = new SubagentDispatchService()
    await service.setRedisClient(asRedis(fake))

    mockFetch.mockImplementation(() => new Promise(() => {}))
    const r = await service.dispatch({ ...baseInput, goal: 'cancel', ownerUserId: 'u-c' })
    const id = r.dispatch!.id
    await waitFor(() => service.findById(id)?.status === 'running')

    expect(service.cancel(id)).toBe(true)
    await waitFor(() => fake.expires.has(`${KEY_DISPATCH}${id}`))

    expect(fake.hashes.get(`${KEY_DISPATCH}${id}`)?.status).toBe('cancelled')
    expect(fake.hashes.get(`${KEY_DISPATCH}${id}`)?.terminalAt).toBeTruthy()
    const runtime = internalsOf(service).runtimes.get(id) as { terminalAt?: number; terminalPersisted?: boolean }
    expect(runtime.terminalAt).toBeTypeOf('number')
    expect(runtime.terminalPersisted).toBe(true)
    // checkpoint 键不参与终态 TTL(它由 resume 生命周期管理)
    expect(fake.expires.has(`${KEY_CHECKPOINT}${id}`)).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
