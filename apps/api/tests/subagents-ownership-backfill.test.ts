// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @ihui-seat OWNERSHIP 2026-11-02

/**
 * 归属回填与 fail-open 收敛的回归锁(2026-11-02,最后一席)。
 *
 * 背景:两条「无归属 = 所有人可见」的尾巴 ——
 *  ① `utils/dispatch-ownership.ts` 的 fail-open 档(无 ownerUserId ⇒ 公开);
 *  ② `db/agent-queries.ts` 查询完全不过滤创建者(agent_tasks.created_by IS NULL 的历史行对任何人可见)。
 * 目标:先把可推导归属回填,再把仍无归属的标 orphan(仅管理面);顺序必须是「先回填、后收紧」。
 *
 * 本文件钉住:
 *  B1 conversation 可推导:旧 hash 缺 owner + conversationId ⇒ 装载时按 chat_conversations.user_id 回填,
 *     回填结果写回 Redis,属主可见、他人不可见;
 *  B2 agentTask 可推导:缺 conversation、有 agentTaskId ⇒ 按 agent_tasks.created_by 回填;
 *  B3 thread 兄弟可推导:两级 DB 线索都没有 ⇒ 按同会话 thread zset 里兄弟记录的 ownerUserId 回填;
 *  B4 orphan 独立可见性:三源皆无 ⇒ 内存与 Redis 都标 `ownership='orphan'`,
 *     普通用户 `isDispatchVisibleTo=false`,管理员 `true`(记录仍在,只是不进普通用户视野);
 *  B5 回填不丢数据:收紧后,回填前的记录仍能被装载/查询到,属主本人仍可见(不是「凭空消失」);
 *  B6 agent_tasks 三态纯谓词:本人恒可见;NULL + 迁移前对登录用户可见;NULL + 迁移后仅管理员;
 *  B7 findAgentTasksByAgentId 过滤:迁移前本人 + NULL,迁移后只本人,管理员恒全部;
 *  B8 迁移标记探测:无表/无行 ⇒ false(维持旧口径);有行 ⇒ true;缓存只缓存 true,reset 后可重读。
 *
 * 顺序契约(不得颠倒):
 *  - Redis侧回填发生在 `_loadActiveDispatches` 的 `runtimes.set` **之前** ⇒ 路由读不到未推导归属的记录;
 *  - DB侧迁移**最后**才写 `ownership_backfill_state` 标记 ⇒ 代码读到标记才收紧 NULL 行;
 *    「代码先上、迁移没跑」⇒ 标记缺失 ⇒ 旧口径;「迁移先跑、代码没上」⇒ 旧代码不认识标记。
 *
 * 反向例(必须红,实测见交付报告):
 *  ① `isDispatchVisibleTo` 无 owner 分支改回 `return true` ⇒ B4 红;
 *  ② `isAgentTaskVisibleTo` 的 NULL 分支改回恒 `return true` ⇒ B6/B7 红;恢复后核对源码 sha256。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
// eslint 规则 consistent-type-imports 禁 `import()` 类型注解 ⇒ 顶层 import type 供 typeof 引用
import type * as DatabaseModule from '@ihui/database'
import type { Redis } from 'ioredis'

const TABLES = vi.hoisted(() => ({
  chatConversations: { id: 'chat_conversations.id', userId: 'chat_conversations.user_id' },
  agentTasks: {
    id: 'agent_tasks.id',
    agentId: 'agent_tasks.agent_id',
    createdBy: 'agent_tasks.created_by',
    createdAt: 'agent_tasks.created_at',
    status: 'agent_tasks.status',
    result: 'agent_tasks.result',
    teamId: 'agent_tasks.team_id',
  },
  agents: { agentId: 'agents.agent_id', userId: 'agents.user_id' },
}))

/**
 * 测试用库面状态(只被下面的 db mock 读):
 *  - conversationOwner / agentTaskCreatedBy:归属推导的 DB 线索;
 *  - runtimeRows:findAgentTasksByAgentId 的返回行;
 *  - markerRows:ownership_backfill_state 标记探测结果;
 *  - executeThrows:模拟「迁移表还没建」。
 */
const dbState = vi.hoisted(() => ({
  conversationOwner: null as string | null,
  agentTaskCreatedBy: null as string | null,
  runtimeRows: [] as Array<Record<string, unknown>>,
  markerRows: [] as unknown[],
  executeThrows: false,
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// 恢复执行会调 ai-service;本文件只关心归属,让它直接成功(不阻断装载)
vi.mock('../src/utils/ai-service-fetch.js', () => ({
  aiServiceSystemFetch: vi.fn(async () => ({
    status: 200,
    ok: true,
    statusText: 'OK',
    json: async () => ({ code: 0, data: { final_output: 'ok', steps: [] } }),
  })),
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

// 部分 mock:只为把本文件关心的三张表换成可辨识的标记对象;
// 其余导出(developerApiKeys 等)保留真实实现,避免间接依赖链上的模块拿到 undefined。
vi.mock('@ihui/database', async (importOriginal) => {
  const actual = await importOriginal<typeof DatabaseModule>()
  return {
    ...actual,
    chatConversations: TABLES.chatConversations,
    agentTasks: TABLES.agentTasks,
    agents: TABLES.agents,
  }
})

/**
 * db / dbRead 的最小链式替身:
 *  - `_syncAgentTask`(写库)按「已是终态」返回,避免测试里真的 update;
 *  - 归属推导按 from(table)+select(fields) 分辨来源(conversation / agentTask);
 *  - `findAgentTasksByAgentId` 用无字段 select ⇒ runtimeRows;
 *  - 标记探测走 `execute`。
 */
vi.mock('../src/db/index.js', () => {
  const chain = (table: unknown, fields: Record<string, unknown> | undefined, write: boolean) => {
    const c: Record<string, unknown> = {}
    c.where = () => c
    c.orderBy = () => c
    c.limit = () => {
      if (write) return Promise.resolve([{ status: 'completed' }])
      if (table === TABLES.chatConversations) {
        return Promise.resolve(
          dbState.conversationOwner ? [{ userId: dbState.conversationOwner }] : [],
        )
      }
      if (fields && 'createdBy' in fields) {
        return Promise.resolve(
          dbState.agentTaskCreatedBy ? [{ createdBy: dbState.agentTaskCreatedBy }] : [],
        )
      }
      return Promise.resolve(dbState.runtimeRows)
    }
    return c
  }
  return {
    db: {
      select: (fields?: Record<string, unknown>) => ({
        from: (table: unknown) => chain(table, fields, true),
      }),
      update: () => ({ set: () => ({ where: () => Promise.resolve(undefined) }) }),
      insert: () => ({ values: () => Promise.resolve(undefined) }),
    },
    dbRead: {
      select: (fields?: Record<string, unknown>) => ({
        from: (table: unknown) => chain(table, fields, false),
      }),
      execute: async () => {
        if (dbState.executeThrows)
          throw new Error('relation "ownership_backfill_state" does not exist')
        return dbState.markerRows
      },
    },
  }
})

import { SubagentDispatchService } from '../src/services/subagent-dispatch-service.js'
import { isDispatchVisibleTo } from '../src/utils/dispatch-ownership.js'
import {
  findAgentTasksByAgentId,
  isAgentTaskVisibleTo,
  isAgentTaskBackfillApplied,
  _resetAgentTaskBackfillCache,
} from '../src/db/agent-queries.js'

const KEY_DISPATCH = 'subagent:dispatch:'
const KEY_IDS = 'subagent:dispatch:ids'
const KEY_THREAD = 'subagent:dispatch:thread:'
const KEY_BACKFILL = 'subagent:dispatch:ownership-backfill:20261102'

/** 最小 Redis 假件(只实现装载/回填路径用到的指令;值一律字符串,贴近 ioredis 行为) */
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
  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    const z = Array.from(this.zsets.get(key)?.entries() ?? [])
      .sort((a, b) => a[1] - b[1])
      .map((e) => e[0])
    const end = stop < 0 ? z.length + stop + 1 : stop + 1
    return z.slice(start, end)
  }
  async zrevrange(key: string, start: number, stop: number): Promise<string[]> {
    const z = Array.from(this.zsets.get(key)?.entries() ?? [])
      .sort((a, b) => b[1] - a[1])
      .map((e) => e[0])
    const end = stop < 0 ? z.length + stop + 1 : stop + 1
    return z.slice(start, end)
  }
  async expire(): Promise<number> {
    return 1
  }
}

function asRedis(fake: FakeRedis): Redis {
  return fake as unknown as Redis
}

/**
 * 造一条「旧 hash」:默认 queued(装载但不在本批抢跑),ownerUserId 与关联 id 默认空 ——
 * 正是 2026-11-01 ownerUserId 落地前的存量形态。
 */
function seedDispatch(fake: FakeRedis, id: string, overrides: Record<string, string> = {}): void {
  const hash: Record<string, string> = {
    id,
    goal: `goal-${id}`,
    affectedFiles: '[]',
    forbidden: '[]',
    verifyCommands: '[]',
    constraints: 'c',
    deliverables: 'd',
    agentRole: 'coder',
    orchestration: 'parallel',
    status: 'queued',
    result: '',
    createdAt: '2026-11-02T00:00:00.000Z',
    updatedAt: '2026-11-02T00:00:00.000Z',
    retry: '',
    dag: '',
    priority: 'normal',
    quotas: '',
    prompt: 'PROMPT',
    steps: '[]',
    startedAt: '',
    completedAt: '',
    dagNodeStatus: '[]',
    messages: '[]',
    outbox: '',
    ownerUserId: '',
    conversationId: '',
    agentTaskId: '',
    parentDispatchId: '',
    attention: '',
    ...overrides,
  }
  fake.hashes.set(`${KEY_DISPATCH}${id}`, hash)
  const ids = fake.sets.get(KEY_IDS) ?? new Set<string>()
  ids.add(id)
  fake.sets.set(KEY_IDS, ids)
}

const BACKFILL_MEMBERS = (fake: FakeRedis): string[] =>
  Array.from(fake.sets.get(KEY_BACKFILL) ?? [])

beforeEach(() => {
  dbState.conversationOwner = null
  dbState.agentTaskCreatedBy = null
  dbState.runtimeRows = []
  dbState.markerRows = []
  dbState.executeThrows = false
  _resetAgentTaskBackfillCache()
})

afterEach(() => {
  _resetAgentTaskBackfillCache()
})

describe('B1-B3 Redis 归属三级推导(先回填,后装载)', () => {
  it('B1 conversation 可推导:按 chat_conversations.user_id 回填并写回 Redis', async () => {
    const fake = new FakeRedis()
    dbState.conversationOwner = 'u-a'
    seedDispatch(fake, 'd-b1', { conversationId: '22222222-2222-4222-8222-222222222222' })
    const service = new SubagentDispatchService()

    await service.setRedisClient(asRedis(fake))

    const d = service.findById('d-b1')
    expect(d).not.toBeNull()
    expect(d!.ownerUserId).toBe('u-a')
    expect(d!.ownership).toBeUndefined()
    // 回填后立即按「本人可见」判:属主可见、他人不可见;管理面不跨租户读已归属记录
    expect(isDispatchVisibleTo(d!, 'u-a')).toBe(true)
    expect(isDispatchVisibleTo(d!, 'u-b')).toBe(false)
    expect(isDispatchVisibleTo(d!, 'u-b', true)).toBe(false)
    // Redis hash 已补归属,记账 set 留痕(供回滚逐条 HDEL)
    expect(fake.hashes.get(`${KEY_DISPATCH}d-b1`)?.ownerUserId).toBe('u-a')
    expect(BACKFILL_MEMBERS(fake)).toContain('d-b1|conversation')
  })

  it('B2 agentTask 可推导:按 agent_tasks.created_by 回填', async () => {
    const fake = new FakeRedis()
    dbState.agentTaskCreatedBy = 'u-a'
    seedDispatch(fake, 'd-b2', { agentTaskId: '11111111-1111-4111-8111-111111111111' })
    const service = new SubagentDispatchService()

    await service.setRedisClient(asRedis(fake))

    const d = service.findById('d-b2')
    expect(d!.ownerUserId).toBe('u-a')
    expect(isDispatchVisibleTo(d!, 'u-a')).toBe(true)
    expect(isDispatchVisibleTo(d!, 'u-b')).toBe(false)
    expect(fake.hashes.get(`${KEY_DISPATCH}d-b2`)?.ownerUserId).toBe('u-a')
    expect(BACKFILL_MEMBERS(fake)).toContain('d-b2|agentTask')
  })

  it('B3 thread 兄弟可推导:DB 两级线索都没有 ⇒ 取同会话兄弟记录的 ownerUserId', async () => {
    const fake = new FakeRedis()
    // conversationId 非 uuid ⇒ 跳过 DB;兄弟记录在 thread zset 里且带 owner
    seedDispatch(fake, 'd-b3', { conversationId: 'conv-thread-1' })
    fake.zsets.set(`${KEY_THREAD}conv-thread-1`, new Map([['sib-owner', 1]]))
    fake.hashes.set(`${KEY_DISPATCH}sib-owner`, { id: 'sib-owner', ownerUserId: 'u-a' })
    const service = new SubagentDispatchService()

    await service.setRedisClient(asRedis(fake))

    const d = service.findById('d-b3')
    expect(d!.ownerUserId).toBe('u-a')
    expect(fake.hashes.get(`${KEY_DISPATCH}d-b3`)?.ownerUserId).toBe('u-a')
    expect(BACKFILL_MEMBERS(fake)).toContain('d-b3|thread')
  })
})

describe('B4-B5 orphan 独立可见性与回填不丢数据', () => {
  it('B4 三源皆无 ⇒ orphan:内存与 Redis 都标记,普通用户不可见、管理员可见', async () => {
    const fake = new FakeRedis()
    seedDispatch(fake, 'd-b4')
    const service = new SubagentDispatchService()

    await service.setRedisClient(asRedis(fake))

    const d = service.findById('d-b4')
    // 记录没有被丢弃:仍在内存里,goal 原样
    expect(d).not.toBeNull()
    expect(d!.goal).toBe('goal-d-b4')
    expect(d!.ownership).toBe('orphan')
    expect(fake.hashes.get(`${KEY_DISPATCH}d-b4`)?.ownership).toBe('orphan')
    expect(BACKFILL_MEMBERS(fake)).toContain('d-b4|orphan')
    // 独立可见性:普通用户 false,管理员 true
    expect(isDispatchVisibleTo(d!, 'u-a')).toBe(false)
    expect(isDispatchVisibleTo(d!, 'u-b')).toBe(false)
    expect(isDispatchVisibleTo(d!, 'u-b', true)).toBe(true)
  })

  it('B5 收紧后回填前的数据不凭空消失:可推导记录仍归原属主,orphan 仍在管理面', async () => {
    const fake = new FakeRedis()
    dbState.conversationOwner = 'u-a'
    seedDispatch(fake, 'd-b5-owned', {
      conversationId: '33333333-3333-4333-8333-333333333333',
      goal: 'legacy-goal-kept',
    })
    seedDispatch(fake, 'd-b5-orphan')
    const service = new SubagentDispatchService()

    // 回填前:两条都在 Redis(存量事实)
    expect(fake.hashes.has(`${KEY_DISPATCH}d-b5-owned`)).toBe(true)
    expect(fake.hashes.has(`${KEY_DISPATCH}d-b5-orphan`)).toBe(true)

    await service.setRedisClient(asRedis(fake))

    // 收紧后:两条都还在,可推导的回到属主视野;orphan 只在管理面
    const owned = service.findById('d-b5-owned')
    const orphan = service.findById('d-b5-orphan')
    expect(owned).not.toBeNull()
    expect(orphan).not.toBeNull()
    expect(owned!.goal).toBe('legacy-goal-kept')
    expect(isDispatchVisibleTo(owned!, 'u-a')).toBe(true)
    expect(isDispatchVisibleTo(orphan!, 'u-a')).toBe(false)
    expect(isDispatchVisibleTo(orphan!, 'admin-x', true)).toBe(true)
  })
})

describe('B6 agent_tasks 创建者三态纯谓词', () => {
  it('本人恒可见;NULL 迁移前可见、迁移后仅管理面;管理员恒可见', () => {
    const viewerA = { userId: 'u-a', isAdmin: false }
    const viewerB = { userId: 'u-b', isAdmin: false }
    const admin = { userId: 'admin-x', isAdmin: true }

    expect(isAgentTaskVisibleTo({ createdBy: 'u-a' }, viewerA, false)).toBe(true)
    expect(isAgentTaskVisibleTo({ createdBy: 'u-a' }, viewerB, false)).toBe(false)
    expect(isAgentTaskVisibleTo({ createdBy: 'u-a' }, viewerB, true)).toBe(false)

    // NULL + 迁移前 = 旧口径(不隐藏历史)
    expect(isAgentTaskVisibleTo({ createdBy: null }, viewerB, false)).toBe(true)
    // NULL + 迁移后 = orphan(仅管理员)
    expect(isAgentTaskVisibleTo({ createdBy: null }, viewerB, true)).toBe(false)
    expect(isAgentTaskVisibleTo({ createdBy: null }, admin, true)).toBe(true)
    expect(isAgentTaskVisibleTo({ createdBy: null }, admin, false)).toBe(true)
  })
})

describe('B7 findAgentTasksByAgentId 按标记过滤', () => {
  const rows = () => [
    { id: 'row-mine', createdBy: 'u-a' },
    { id: 'row-other', createdBy: 'u-b' },
    { id: 'row-null', createdBy: null },
  ]

  it('迁移前:本人 + NULL;他人不可见;管理员全部', async () => {
    dbState.runtimeRows = rows()
    dbState.markerRows = []
    _resetAgentTaskBackfillCache()

    const mine = await findAgentTasksByAgentId('agent-1', { userId: 'u-a', isAdmin: false })
    expect(mine.map((r) => (r as unknown as { id: string }).id)).toEqual(['row-mine', 'row-null'])

    const theirs = await findAgentTasksByAgentId('agent-1', { userId: 'u-b', isAdmin: false })
    expect(theirs.map((r) => (r as unknown as { id: string }).id)).toEqual([
      'row-other',
      'row-null',
    ])

    const all = await findAgentTasksByAgentId('agent-1', { userId: 'admin-x', isAdmin: true })
    expect(all.map((r) => (r as unknown as { id: string }).id)).toEqual([
      'row-mine',
      'row-other',
      'row-null',
    ])
  })

  it('迁移后(NULL 行只有管理员可见):普通用户只余本人行', async () => {
    dbState.runtimeRows = rows()
    dbState.markerRows = [{ scope: 'agent_tasks.creator' }]
    _resetAgentTaskBackfillCache()

    const mine = await findAgentTasksByAgentId('agent-1', { userId: 'u-a', isAdmin: false })
    expect(mine.map((r) => (r as unknown as { id: string }).id)).toEqual(['row-mine'])

    const theirs = await findAgentTasksByAgentId('agent-1', { userId: 'u-b', isAdmin: false })
    expect(theirs.map((r) => (r as unknown as { id: string }).id)).toEqual(['row-other'])

    const all = await findAgentTasksByAgentId('agent-1', { userId: 'admin-x', isAdmin: true })
    expect(all.map((r) => (r as unknown as { id: string }).id)).toEqual([
      'row-mine',
      'row-other',
      'row-null',
    ])
  })
})

describe('B8 迁移标记探测(顺序契约的代码侧门控)', () => {
  it('无表/无行 ⇒ false(维持旧口径);有行 ⇒ true;缓存只缓存 true;reset 后可重读', async () => {
    // 迁移未跑(无行)
    dbState.markerRows = []
    dbState.executeThrows = false
    _resetAgentTaskBackfillCache()
    expect(await isAgentTaskBackfillApplied()).toBe(false)

    // 迁移已写标记:回填完成,**最后**写标记
    dbState.markerRows = [{ scope: 'agent_tasks.creator' }]
    expect(await isAgentTaskBackfillApplied()).toBe(true)

    // true 已缓存:标记消失仍读 true(只有 true 才缓存,false 每次重查)
    dbState.markerRows = []
    expect(await isAgentTaskBackfillApplied()).toBe(true)

    _resetAgentTaskBackfillCache()
    expect(await isAgentTaskBackfillApplied()).toBe(false)

    // 表还没建(迁移未跑)⇒ 异常吞掉,保持旧口径
    dbState.executeThrows = true
    _resetAgentTaskBackfillCache()
    expect(await isAgentTaskBackfillApplied()).toBe(false)
  })
})
