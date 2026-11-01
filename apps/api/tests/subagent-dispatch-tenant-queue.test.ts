// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F2(2026-11-02)租户化槽位 + 真排队。
 *
 * 背景:
 *  - 并发上限原来是全站 3(任意租户共享),满额直接 429;
 *  - 计数读 `listActive()`(全量),没有租户维度 ⇒ 一个租户打满,其他人全部被拒;
 *  - Redis zset 只写不读,`getQueue` 读的是内存视图 ⇒ 队列顺序与真实出队脱钩。
 *
 * 本文件覆盖(真跑,不 mock service):
 *  ① 单租户打满只影响自己:同租户第 3 单落 queued,另一租户照常开跑(无 429);
 *  ② 全局硬上限只保护不拒绝:三租户各占 1 槽,第四单落 queued;
 *  ③ queued 真可调度:释放槽位后按 zset 顺序出队执行;
 *  ④ 出队顺序 = 真队列顺序:urgent 先于先到的 normal;同优先级先来后到;
 *  ⑤ getQueue 读真队列:只返回 queued 成员,幽灵成员被清出 zset,取消即出队。
 *
 * 反向例(实测,见交付报告):把 `_capacityBlocked` 改成恒 null ⇒ ①②③ 红;
 * 去掉 `_persistDispatch` 里的终态出队触发 ⇒ ③④ 红。恢复后源文件 sha256 一致。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Redis } from 'ioredis'

const { mockFetch, mockUpdate, mockSelectResult } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockUpdate: vi.fn(),
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
    insert: vi.fn(),
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

const KEY_QUEUE = 'subagent:dispatch:queue'
const KEY_DISPATCH = 'subagent:dispatch:'

/** 最小 Redis 假件(实现 service 用到的指令;zrevrange 支持 WITHSCORES) */
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
    withScores?: 'WITHSCORES',
  ): Promise<string[]> {
    const z = Array.from(this.zsets.get(key) ?? new Map<string, number>())
      .sort((a, b) => b[1] - a[1])
      .slice(start, stop < 0 ? undefined : stop + 1)
    return withScores ? z.flatMap(([m, s]) => [m, String(s)]) : z.map(([m]) => m)
  }
  async expire(): Promise<number> {
    return 1
  }
}

function asRedis(fake: FakeRedis): Redis {
  return fake as unknown as Redis
}

/** ai-service 响应体(与 service 读的字段对齐) */
function okResponse(output: string) {
  return {
    status: 200,
    ok: true,
    statusText: 'OK',
    json: async () => ({ code: 0, message: '', data: { final_output: output, steps: [] } }),
  }
}

/** 每次 fetch 挂起,由用例决定何时完成 —— 这样「槽位被占满」是可观察且确定的 */
let pendingFetches: Array<(value: ReturnType<typeof okResponse>) => void> = []

async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const started = Date.now()
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error('waitFor timeout')
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

/** 释放最早一次挂起的 ai-service 调用(按派单创建顺序) */
function releaseNextFetch(): void {
  const resolve = pendingFetches.shift()
  if (!resolve) throw new Error('没有挂起的 ai-service 调用可释放')
  resolve(okResponse('queued-run-output'))
}

async function flush(ms = 30): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

const baseInput = {
  goal: 'queue-test',
  affectedFiles: ['apps/api/src/x.ts'],
  verifyCommands: [],
  constraints: 'only listed files',
  deliverables: 'patch',
  agentRole: 'coder',
  orchestration: 'parallel',
}

let service: SubagentDispatchService
let fake: FakeRedis

function statusOf(id: string | undefined): string {
  return String(service.findById(id ?? '')?.status)
}

function queueMembers(): string[] {
  return Array.from(fake.zsets.get(KEY_QUEUE)?.keys() ?? [])
}

beforeEach(async () => {
  vi.clearAllMocks()
  pendingFetches = []
  mockFetch.mockImplementation(() => new Promise((resolve) => pendingFetches.push(resolve)))
  mockSelectResult.mockResolvedValue([])
  mockUpdate.mockReturnValue({
    set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
  })
  fake = new FakeRedis()
  service = new SubagentDispatchService()
  await service.setRedisClient(asRedis(fake))
})

afterEach(async () => {
  // 让所有挂起调用收尾,避免 30s 超时定时器把测试进程拖住(收尾状态不影响已完成的断言)
  while (pendingFetches.length > 0) {
    pendingFetches.shift()!(okResponse('after-test'))
  }
  await flush(50)
})

describe('F2 租户化槽位 + 真排队', () => {
  it('单租户打满只影响自己:同租户第 3 单落 queued,另一租户照常开跑(无 429)', async () => {
    const a1 = await service.dispatch({ ...baseInput, goal: 'a1', ownerUserId: 'tenant-a' })
    const a2 = await service.dispatch({
      ...baseInput,
      goal: 'a2',
      ownerUserId: 'tenant-a',
      priority: 'high',
    })
    const a3 = await service.dispatch({ ...baseInput, goal: 'a3', ownerUserId: 'tenant-a' })
    const b1 = await service.dispatch({ ...baseInput, goal: 'b1', ownerUserId: 'tenant-b' })

    // 满额不拒绝:三单都是成功受理(没有 concurrent_limit)
    expect(a1.outcome).toBe('ok')
    expect(a2.outcome).toBe('ok')
    expect(a3.outcome).toBe('ok')
    expect(b1.outcome).toBe('ok')

    // A 的第 3 单排队(租户上限 2),B 不受影响直接占槽
    expect(statusOf(a3.dispatch?.id)).toBe('queued')
    expect(statusOf(b1.dispatch?.id)).not.toBe('queued')

    // 真队列里只有 A 的排队单;B 的运行单不在 zset
    expect(queueMembers()).toEqual([a3.dispatch!.id])
    expect(fake.hashes.get(`${KEY_DISPATCH}${b1.dispatch!.id}`)?.status).not.toBe('queued')
  })

  it('全局硬上限只保护不拒绝:三租户各占 1 槽,第四单落 queued;释放槽位后自动出队', async () => {
    const _a = await service.dispatch({ ...baseInput, goal: 'ga', ownerUserId: 'tenant-a' })
    const _b = await service.dispatch({ ...baseInput, goal: 'gb', ownerUserId: 'tenant-b' })
    const _c = await service.dispatch({ ...baseInput, goal: 'gc', ownerUserId: 'tenant-c' })
    const d = await service.dispatch({ ...baseInput, goal: 'gd', ownerUserId: 'tenant-d' })

    expect(d.outcome).toBe('ok')
    expect(statusOf(d.dispatch?.id)).toBe('queued')
    expect(service.listActive()).toHaveLength(3)

    // 释放一个槽位(第一单完成)⇒ 排队单自动出队执行
    releaseNextFetch()
    await waitFor(() => statusOf(d.dispatch?.id) !== 'queued')
    expect(statusOf(d.dispatch?.id)).toBe('running')
    expect(queueMembers()).toEqual([])
  })

  it('出队顺序 = 真队列顺序:urgent 先于先到的 normal,同优先级先来后到', async () => {
    const a1 = await service.dispatch({ ...baseInput, goal: 'a1', ownerUserId: 'tenant-a' })
    const b1 = await service.dispatch({ ...baseInput, goal: 'b1', ownerUserId: 'tenant-b' })
    const c1 = await service.dispatch({ ...baseInput, goal: 'c1', ownerUserId: 'tenant-c' })
    expect(service.listActive()).toHaveLength(3)

    // 先到的是 normal(P),后到的是 urgent(U);全局已满 ⇒ 两单都排队。
    // U 特意放到没有在跑任务的 tenant-d:同租户 urgent 抢占(low/normal)是另一条已锁行为
    // (见 subagents-preempt-tenant-scope.test.ts),放 tenant-b 会先抢掉 b1 而不进队列,
    // 本用例要钉的是「队列内部的出队顺序」,必须让 U 走排队路径。
    const p = await service.dispatch({ ...baseInput, goal: 'p', ownerUserId: 'tenant-a' })
    const u = await service.dispatch({
      ...baseInput,
      goal: 'u',
      ownerUserId: 'tenant-d',
      priority: 'urgent',
    })
    expect(statusOf(p.dispatch?.id)).toBe('queued')
    expect(statusOf(u.dispatch?.id)).toBe('queued')

    // 释放 a1 ⇒ 出队按 priority:U 越过先到的 P
    releaseNextFetch()
    await waitFor(() => statusOf(u.dispatch?.id) !== 'queued')
    expect(statusOf(u.dispatch?.id)).toBe('running')
    expect(statusOf(p.dispatch?.id)).toBe('queued')

    // 再释放 b1 ⇒ 同优先级(只剩 P)按先来后到出队
    releaseNextFetch()
    await waitFor(() => statusOf(p.dispatch?.id) !== 'queued')
    expect(statusOf(p.dispatch?.id)).toBe('running')

    // 全流程只保留了真实排队过的成员,没有把 running/终态塞回 zset
    expect(queueMembers()).toEqual([])
    expect(statusOf(a1.dispatch?.id)).toBe('completed')
    expect(statusOf(b1.dispatch?.id)).toBe('completed')
    // c1 仍在跑(未被误伤)
    expect(statusOf(c1.dispatch?.id)).toBe('running')
  })

  it('同优先级严格先来后到:早创建的 normal 先于晚创建的 normal 出队', async () => {
    const _a1 = await service.dispatch({ ...baseInput, goal: 'a1', ownerUserId: 'tenant-a' })
    await service.dispatch({ ...baseInput, goal: 'b1', ownerUserId: 'tenant-b' })
    await service.dispatch({ ...baseInput, goal: 'c1', ownerUserId: 'tenant-c' })

    const first = await service.dispatch({ ...baseInput, goal: 'first', ownerUserId: 'tenant-a' })
    await flush(5) // 让两条记录的 createdAt 有可分辨的先后(毫秒级)
    const second = await service.dispatch({ ...baseInput, goal: 'second', ownerUserId: 'tenant-b' })
    expect(statusOf(first.dispatch?.id)).toBe('queued')
    expect(statusOf(second.dispatch?.id)).toBe('queued')
    expect(queueMembers()).toEqual([first.dispatch!.id, second.dispatch!.id])

    releaseNextFetch()
    await waitFor(() => statusOf(first.dispatch?.id) !== 'queued')
    expect(statusOf(first.dispatch?.id)).toBe('running')
    expect(statusOf(second.dispatch?.id)).toBe('queued')

    releaseNextFetch()
    await waitFor(() => statusOf(second.dispatch?.id) !== 'queued')
    expect(statusOf(second.dispatch?.id)).toBe('running')
  })

  it('getQueue 读真队列:幽灵成员清出 zset,取消排队即出队', async () => {
    const a1 = await service.dispatch({ ...baseInput, goal: 'a1', ownerUserId: 'tenant-a' })
    await service.dispatch({
      ...baseInput,
      goal: 'a2',
      ownerUserId: 'tenant-a',
      priority: 'high',
    })
    const a3 = await service.dispatch({ ...baseInput, goal: 'a3', ownerUserId: 'tenant-a' })
    expect(statusOf(a3.dispatch?.id)).toBe('queued')

    const queue = await service.getQueue()
    expect(queue).toHaveLength(1)
    expect(queue[0]!.dispatchId).toBe(a3.dispatch!.id)
    expect(String(queue[0]!.status)).toBe('queued')
    expect(queue[0]!.position).toBe(1)

    // 直接往 zset 塞一条内存里不存在的成员 ⇒ getQueue 不返回它,并从真队列清走
    fake.zsets.get(KEY_QUEUE)!.set('ghost-dispatch', 1)
    const afterGhost = await service.getQueue()
    expect(afterGhost).toHaveLength(1)
    expect(fake.zsets.get(KEY_QUEUE)!.has('ghost-dispatch')).toBe(false)

    // 取消排队单 ⇒ 记录终态 + zset 出队,队列视图不再含它
    expect(service.cancel(a3.dispatch!.id)).toBe(true)
    await waitFor(() => !fake.zsets.get(KEY_QUEUE)!.has(a3.dispatch!.id))
    expect(await service.getQueue()).toHaveLength(0)
    expect(statusOf(a3.dispatch?.id)).toBe('cancelled')
    // a1 未受影响
    expect(statusOf(a1.dispatch?.id)).toBe('running')
  })
})
