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
 * 配额(2026-11-02 拍板):全局 6 / 每租户 3 / 每租户每优先级 low 1·normal 2·high 3·urgent 3。
 * 拍板前的 normal=1 会让同租户第二条普通任务先撞优先级层(租户层还有余量)——
 * 优先级层比租户层更早成为瓶颈,等于把优先级设计反用了。抬到 2/3/3 后,三层判据
 * 的先后才有意义:先全局 6,再每租户 3,最后优先级层只负责防低优任务灌满。
 *
 * 本文件覆盖(真跑,不 mock service):
 *  ① 全局 6 槽由两租户各 3 条用满:互不排队、无人 429;
 *  ② 第 7 条落 queued(不是 429),释放槽位后按真 zset 顺序补位;
 *  ③ 单租户第 4 条落 queued 时,另一租户新增仍立即拿到槽位(单租户打满只影响自己);
 *  ④ 出队顺序 = 真队列顺序:urgent 先于先到的 normal;同优先级先来后到;
 *  ⑤ getQueue 读真队列:只返回 queued 成员,幽灵成员被清出 zset,取消即出队。
 *
 * 反向例(实测,见交付报告):把 `DEFAULT_TENANT_MAX_CONCURRENT` 改回 2 ⇒ ① 红
 * (两租户各第 3 条会被租户层拦下);把 `_capacityBlocked` 改成恒 null ⇒ ②③④ 红;
 * 去掉 `_persistDispatch` 里的终态出队触发 ⇒ ②④ 红。恢复后源文件 sha256 一致。
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

/**
 * 用满全局 6 槽:两个租户各 3 条,每条占用后返回句柄供用例释放。
 * 每个租户的组合是 normal×2 + high×1:既卡在「每租户 3」的租户层上限内,
 * 也不提前撞 normal 2 / high 3 的优先级档位 ⇒ 任何一条被 queued 都说明
 * 判据比预期更早生效(用例直接红,不用等释放才暴露)。
 */
async function fillGlobalSlots() {
  const a1 = await service.dispatch({ ...baseInput, goal: 'a1', ownerUserId: 'tenant-a' })
  const a2 = await service.dispatch({ ...baseInput, goal: 'a2', ownerUserId: 'tenant-a' })
  const a3 = await service.dispatch({
    ...baseInput,
    goal: 'a3',
    ownerUserId: 'tenant-a',
    priority: 'high',
  })
  const b1 = await service.dispatch({ ...baseInput, goal: 'b1', ownerUserId: 'tenant-b' })
  const b2 = await service.dispatch({ ...baseInput, goal: 'b2', ownerUserId: 'tenant-b' })
  const b3 = await service.dispatch({
    ...baseInput,
    goal: 'b3',
    ownerUserId: 'tenant-b',
    priority: 'high',
  })
  return { a1, a2, a3, b1, b2, b3 }
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
  it('两个租户各跑 3 条(全局 6 用满):互不排队、无人 429', async () => {
    const { a1, a2, a3, b1, b2, b3 } = await fillGlobalSlots()

    // 满额前全部成功受理(没有 concurrent_limit / 429),也没有一条进队列
    for (const r of [a1, a2, a3, b1, b2, b3]) {
      expect(r.outcome).toBe('ok')
      expect(statusOf(r.dispatch?.id)).not.toBe('queued')
    }
    expect(service.listActive()).toHaveLength(6)
    expect(queueMembers()).toEqual([])
  })

  it('第 7 条落 queued(不是 429),租户释放后按真 zset 顺序补位', async () => {
    const { a1, a2 } = await fillGlobalSlots()
    // 全局已满:第 7 条(tenant-c)成功受理但落 queued,不是拒绝
    const seventh = await service.dispatch({ ...baseInput, goal: 's7', ownerUserId: 'tenant-c' })
    expect(seventh.outcome).toBe('ok')
    expect(statusOf(seventh.dispatch?.id)).toBe('queued')

    // 第 8 条是 high:真 zset 里 high 排在先到的 normal 之前(顺序在 score 里,不是插入序)
    const eighth = await service.dispatch({
      ...baseInput,
      goal: 's8',
      ownerUserId: 'tenant-d',
      priority: 'high',
    })
    expect(statusOf(eighth.dispatch?.id)).toBe('queued')
    const queueBefore = await service.getQueue()
    expect(queueBefore.map((q) => q.dispatchId)).toEqual([eighth.dispatch!.id, seventh.dispatch!.id])
    expect(service.listActive()).toHaveLength(6)

    // 释放 a1 ⇒ 按 zset 顺序补位的高优单先上,第 7 条仍等槽
    releaseNextFetch()
    await waitFor(() => statusOf(eighth.dispatch?.id) !== 'queued')
    expect(statusOf(eighth.dispatch?.id)).toBe('running')
    expect(statusOf(seventh.dispatch?.id)).toBe('queued')

    // 再释放 a2 ⇒ 第 7 条(只剩它)补位,running 后队列清空
    releaseNextFetch()
    await waitFor(() => statusOf(seventh.dispatch?.id) !== 'queued')
    expect(statusOf(seventh.dispatch?.id)).toBe('running')
    expect(queueMembers()).toEqual([])
    expect(statusOf(a1.dispatch?.id)).toBe('completed')
    expect(statusOf(a2.dispatch?.id)).toBe('completed')
  })

  it('单租户第 4 条落 queued 时,另一租户新增仍能立即拿到槽位', async () => {
    // A 的前 3 条:normal×2 + high×1 —— 第二条 normal 不再被优先级层拦下
    // (拍板前 normal=1 会让 a2 在这里就落 queued,优先级层先于租户层成为瓶颈)。
    const a1 = await service.dispatch({ ...baseInput, goal: 'a1', ownerUserId: 'tenant-a' })
    const a2 = await service.dispatch({ ...baseInput, goal: 'a2', ownerUserId: 'tenant-a' })
    const a3 = await service.dispatch({
      ...baseInput,
      goal: 'a3',
      ownerUserId: 'tenant-a',
      priority: 'high',
    })
    expect(a1.outcome).toBe('ok')
    expect(a2.outcome).toBe('ok')
    expect(statusOf(a1.dispatch?.id)).not.toBe('queued')
    expect(statusOf(a2.dispatch?.id)).not.toBe('queued')
    expect(statusOf(a3.dispatch?.id)).not.toBe('queued')

    // 第 4 条(high):high 档位还有余量,被「每租户 3」的租户层挡下 ⇒ queued
    const a4 = await service.dispatch({
      ...baseInput,
      goal: 'a4',
      ownerUserId: 'tenant-a',
      priority: 'high',
    })
    expect(a4.outcome).toBe('ok')
    expect(statusOf(a4.dispatch?.id)).toBe('queued')

    // 另一租户新增不受 A 打满影响:全局还有 3 槽,立即占槽
    const b1 = await service.dispatch({ ...baseInput, goal: 'b1', ownerUserId: 'tenant-b' })
    expect(b1.outcome).toBe('ok')
    expect(statusOf(b1.dispatch?.id)).not.toBe('queued')

    // 真队列里只有 A 的排队单;B 的运行单不在 zset
    expect(queueMembers()).toEqual([a4.dispatch!.id])
    expect(fake.hashes.get(`${KEY_DISPATCH}${b1.dispatch!.id}`)?.status).not.toBe('queued')
  })

  it('出队顺序 = 真队列顺序:urgent 先于先到的 normal,同优先级先来后到', async () => {
    const { a1, a2, b1 } = await fillGlobalSlots()
    expect(service.listActive()).toHaveLength(6)

    // 先到的是 normal(P),后到的是 urgent(U);全局 6 槽已满 ⇒ 两单都排队。
    // U 特意放到没有在跑任务的 tenant-d:同租户 urgent 抢占(low/normal)是另一条已锁行为
    // (见 subagents-preempt-tenant-scope.test.ts),放有本租户任务的地方会先抢掉再进队列,
    // 本用例要钉的是「队列内部的出队顺序」,必须让 U 走排队路径。
    const p = await service.dispatch({ ...baseInput, goal: 'p', ownerUserId: 'tenant-c' })
    const u = await service.dispatch({
      ...baseInput,
      goal: 'u',
      ownerUserId: 'tenant-d',
      priority: 'urgent',
    })
    expect(statusOf(p.dispatch?.id)).toBe('queued')
    expect(statusOf(u.dispatch?.id)).toBe('queued')
    // 真 zset 顺序:urgent 越过先到的 normal(zrevrange 的 score 序,不是插入序)
    expect((await service.getQueue()).map((q) => q.dispatchId)).toEqual([
      u.dispatch!.id,
      p.dispatch!.id,
    ])

    // 释放 a1 ⇒ 出队按 priority:U 越过先到的 P
    releaseNextFetch()
    await waitFor(() => statusOf(u.dispatch?.id) !== 'queued')
    expect(statusOf(u.dispatch?.id)).toBe('running')
    expect(statusOf(p.dispatch?.id)).toBe('queued')

    // 再释放 a2 ⇒ 同优先级(只剩 P)按先来后到出队
    releaseNextFetch()
    await waitFor(() => statusOf(p.dispatch?.id) !== 'queued')
    expect(statusOf(p.dispatch?.id)).toBe('running')

    // 全流程只保留了真实排队过的成员,没有把 running/终态塞回 zset
    expect(queueMembers()).toEqual([])
    expect(statusOf(a1.dispatch?.id)).toBe('completed')
    expect(statusOf(a2.dispatch?.id)).toBe('completed')
    // b1 仍在跑(未被误伤)
    expect(statusOf(b1.dispatch?.id)).toBe('running')
  })

  it('同优先级严格先来后到:早创建的 normal 先于晚创建的 normal 出队', async () => {
    await fillGlobalSlots()

    const first = await service.dispatch({ ...baseInput, goal: 'first', ownerUserId: 'tenant-c' })
    await flush(5) // 让两条记录的 createdAt 有可分辨的先后(毫秒级)
    const second = await service.dispatch({ ...baseInput, goal: 'second', ownerUserId: 'tenant-d' })
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
    const a2 = await service.dispatch({ ...baseInput, goal: 'a2', ownerUserId: 'tenant-a' })
    const a3 = await service.dispatch({
      ...baseInput,
      goal: 'a3',
      ownerUserId: 'tenant-a',
      priority: 'high',
    })
    // 前 3 条占满租户层(每租户 3);第 4 条 high 档位还有余量,被租户层挡下 ⇒ queued
    const a4 = await service.dispatch({
      ...baseInput,
      goal: 'a4',
      ownerUserId: 'tenant-a',
      priority: 'high',
    })
    expect(statusOf(a4.dispatch?.id)).toBe('queued')

    const queue = await service.getQueue()
    expect(queue).toHaveLength(1)
    expect(queue[0]!.dispatchId).toBe(a4.dispatch!.id)
    expect(String(queue[0]!.status)).toBe('queued')
    expect(queue[0]!.position).toBe(1)

    // 直接往 zset 塞一条内存里不存在的成员 ⇒ getQueue 不返回它,并从真队列清走
    fake.zsets.get(KEY_QUEUE)!.set('ghost-dispatch', 1)
    const afterGhost = await service.getQueue()
    expect(afterGhost).toHaveLength(1)
    expect(fake.zsets.get(KEY_QUEUE)!.has('ghost-dispatch')).toBe(false)

    // 取消排队单 ⇒ 记录终态 + zset 出队,队列视图不再含它
    expect(service.cancel(a4.dispatch!.id)).toBe(true)
    await waitFor(() => !fake.zsets.get(KEY_QUEUE)!.has(a4.dispatch!.id))
    expect(await service.getQueue()).toHaveLength(0)
    expect(statusOf(a4.dispatch?.id)).toBe('cancelled')
    // a1 未受影响
    expect(statusOf(a1.dispatch?.id)).toBe('running')
    expect(statusOf(a2.dispatch?.id)).not.toBe('queued')
    expect(statusOf(a3.dispatch?.id)).not.toBe('queued')
  })
})
