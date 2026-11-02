// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 重启自愈(E1,2026-11-02)回归测试。
 *
 * 覆盖:
 *  ① 原执行实例心跳已过期 → 加载即判 failed(可 resume),不再是无主僵尸
 *  ② 原执行实例心跳仍在 → 保留 running,本实例不抢占、不计并发、拒绝重复 resume
 *  ③ 未声明执行实例(旧 hash)→ 不判死,人工 resume 可接管
 *  ④ 他实例的 running 不占本实例并发额度(否则 --scale api=3 会全量 429)
 *
 * 判活口径:记录上的 executorHostId + Redis `subagent:instance:{hostId}` 心跳键。
 * 只判「声明了执行实例且心跳没了」的 running —— 跨实例不误杀是这套设计的第一约束。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Redis } from 'ioredis'

const { mockLoggerWarn } = vi.hoisted(() => ({ mockLoggerWarn: vi.fn() }))

vi.mock('../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: vi.fn(),
  },
}))

// 本用例 seed 的派单都没有 agentTaskId ⇒ _syncAgentTask 提前返回,不会触达 db;
// 仍照既有测试 mock 掉模块,避免真实导入 @ihui/database 导致 vitest 退出码非 0。
vi.mock('../src/db/index.js', () => ({
  db: { insert: vi.fn(), update: vi.fn(), select: vi.fn() },
  dbRead: {},
}))

vi.mock('@ihui/database', () => ({
  agentTasks: { id: 'agent_tasks_id' },
}))

vi.mock('../src/services/workspace-lock-heartbeat.js', () => ({
  releaseTaskLockByTaskId: vi.fn().mockResolvedValue(undefined),
  toLockReleaseOutcome: () => null,
}))

// resume/续跑会真实发起 ai-service 调用:立即拒绝,让执行体快速落终态(不联网、不留定时器)
vi.mock('../src/utils/ai-service-fetch.js', () => ({
  aiServiceSystemFetch: vi.fn().mockRejectedValue(new Error('ai-service offline (test)')),
}))

import { subagentDispatchService } from '../src/services/subagent-dispatch-service'
import { aiServiceSystemFetch } from '../src/utils/ai-service-fetch.js'

/** 服务单例的私有面(仅测试读取,不改生产可见性) */
const service = subagentDispatchService as unknown as {
  runtimes: Map<
    string,
    {
      dispatch: { id: string; status: string; result?: string }
      executorHostId?: string
      executingLocally?: boolean
    }
  >
  _hostId: string
  _tryPreempt: () => boolean
}

interface FakeRedis {
  strings: Map<string, string>
  hashes: Map<string, Record<string, string>>
  sets: Map<string, Set<string>>
  lists: Map<string, string[]>
  zsets: Map<string, Map<string, number>>
}

/** 只实现被测路径用到的 Redis 命令(内存字典,无 TTL 语义) */
function createFakeRedis(): FakeRedis {
  const strings = new Map<string, string>()
  const hashes = new Map<string, Record<string, string>>()
  const sets = new Map<string, Set<string>>()
  const lists = new Map<string, string[]>()
  const zsets = new Map<string, Map<string, number>>()

  const redis = {
    strings,
    hashes,
    sets,
    lists,
    zsets,
    set: async (key: string, value: string) => {
      strings.set(key, value)
      return 'OK'
    },
    exists: async (key: string) => (strings.has(key) || hashes.has(key) ? 1 : 0),
    hset: async (key: string, fieldOrObj: string | Record<string, string>, value?: string) => {
      const cur = hashes.get(key) ?? {}
      if (typeof fieldOrObj === 'string') cur[fieldOrObj] = value ?? ''
      else Object.assign(cur, fieldOrObj)
      hashes.set(key, cur)
      return 1
    },
    hgetall: async (key: string) => ({ ...(hashes.get(key) ?? {}) }),
    sadd: async (key: string, member: string) => {
      const set = sets.get(key) ?? new Set<string>()
      set.add(member)
      sets.set(key, set)
      return 1
    },
    smembers: async (key: string) => Array.from(sets.get(key) ?? []),
    zadd: async (key: string, score: number, member: string) => {
      const z = zsets.get(key) ?? new Map<string, number>()
      z.set(member, score)
      zsets.set(key, z)
      return 1
    },
    zrem: async (key: string, member: string) => {
      const z = zsets.get(key)
      if (!z || !z.has(member)) return 0
      z.delete(member)
      return 1
    },
    expire: async () => 1,
    lpush: async (key: string, value: string) => {
      const list = lists.get(key) ?? []
      list.unshift(value)
      lists.set(key, list)
      return list.length
    },
    ltrim: async (key: string, start: number, stop: number) => {
      lists.set(key, (lists.get(key) ?? []).slice(start, stop + 1))
      return 'OK'
    },
  }

  return redis as unknown as FakeRedis
}

/** 按生产 _persistDispatch 的 hash 版式播种一条派单记录 */
function seedDispatch(
  redis: FakeRedis,
  seed: { id: string; status?: string; executorHostId?: string; priority?: string },
): void {
  redis.hashes.set(`subagent:dispatch:${seed.id}`, {
    id: seed.id,
    goal: `${seed.id} 的目标`,
    affectedFiles: '[]',
    forbidden: '[]',
    verifyCommands: '[]',
    constraints: '',
    deliverables: '',
    agentRole: 'coder',
    orchestration: 'parallel',
    status: seed.status ?? 'running',
    result: '',
    createdAt: '2026-11-02T00:00:00.000Z',
    updatedAt: '2026-11-02T00:00:00.000Z',
    priority: seed.priority ?? 'normal',
    ownerUserId: '',
    // 旧 hash 没有该字段 ⇒ 空串 ⇒ 加载后 undefined ⇒ 「未声明执行实例」
    executorHostId: seed.executorHostId ?? '',
    agentTaskId: '',
  })
  const ids = redis.sets.get('subagent:dispatch:ids') ?? new Set<string>()
  ids.add(seed.id)
  redis.sets.set('subagent:dispatch:ids', ids)
}

beforeEach(async () => {
  vi.clearAllMocks()
  // 停掉上一用例留下的心跳定时器,并清空内存态(单例跨用例复用)
  await subagentDispatchService.setRedisClient(null)
  service.runtimes.clear()
})

afterEach(async () => {
  await subagentDispatchService.setRedisClient(null)
  service.runtimes.clear()
})

describe('E1 重启恢复判活', () => {
  it('① 原执行实例心跳已过期:加载即判 failed,并留恢复日志', async () => {
    const redis = createFakeRedis()
    seedDispatch(redis, {
      id: 'd-dead',
      status: 'running',
      executorHostId: 'host-dead',
      priority: 'low',
    })
    // pending 也是僵尸形态:落了 Redis 但进程没来得及启动执行
    seedDispatch(redis, { id: 'd-pending-dead', status: 'pending', executorHostId: 'host-dead' })

    await subagentDispatchService.setRedisClient(redis as unknown as Redis)

    const rt = service.runtimes.get('d-dead')!
    expect(rt.dispatch.status).toBe('failed')
    expect(rt.dispatch.result).toContain('执行中断')
    expect(rt.executorHostId).toBe('host-dead') // 归属保留,便于排查是哪个实例中断的
    expect(rt.executingLocally).toBe(false)

    const pendingRt = service.runtimes.get('d-pending-dead')!
    expect(pendingRt.dispatch.status).toBe('failed')
    expect(pendingRt.dispatch.result).toContain('未执行')

    const logs = redis.lists.get('subagent:logs:d-dead') ?? []
    expect(logs.some((line) => line.includes('dispatch_recovered_interrupted'))).toBe(true)
  })

  it('② 原执行实例心跳仍在:保留 running,本实例不抢占、不计并发、拒绝重复 resume', async () => {
    const redis = createFakeRedis()
    // 心跳键存在 = 该实例仍存活(可能在另一个容器里正常跑同一条派单)
    redis.strings.set('subagent:instance:host-live', '2026-11-02T00:00:00.000Z')
    seedDispatch(redis, {
      id: 'd-live',
      status: 'running',
      executorHostId: 'host-live',
      priority: 'low',
    })

    await subagentDispatchService.setRedisClient(redis as unknown as Redis)

    const rt = service.runtimes.get('d-live')!
    expect(rt.dispatch.status).toBe('running')
    expect(rt.executingLocally).toBe(false)
    // 跨实例不抢占:即使本实例满载,也不能踩别人的 low 优先级派单
    expect(service._tryPreempt()).toBe(false)

    const res = await subagentDispatchService.resume('d-live')
    expect(res.resumed).toBe(false)
    expect(res.error).toContain('执行实例仍在运行')
  })

  it('③ 未声明执行实例(旧 hash):不判死,人工 resume 可接管执行权', async () => {
    const redis = createFakeRedis()
    seedDispatch(redis, { id: 'd-legacy', status: 'running' })

    await subagentDispatchService.setRedisClient(redis as unknown as Redis)

    const rt = service.runtimes.get('d-legacy')!
    expect(rt.dispatch.status).toBe('running')
    expect(rt.executorHostId).toBeUndefined()

    const res = await subagentDispatchService.resume('d-legacy')
    expect(res.resumed).toBe(true)
    expect(rt.executorHostId).toBe(service._hostId)
    expect(rt.executingLocally).toBe(true)

    // 续跑真实触发一次 ai-service 调用(mock 立即拒绝)⇒ 落 failed,仍是可再次 resume 的终态
    await vi.waitFor(() => expect(rt.dispatch.status).toBe('failed'))
  })

  it('④ 他实例的 running 不占本实例并发额度:仍可创建新派单', async () => {
    const redis = createFakeRedis()
    for (const n of [1, 2, 3]) {
      redis.strings.set(`subagent:instance:host-other-${n}`, '2026-11-02T00:00:00.000Z')
      seedDispatch(redis, {
        id: `d-other-${n}`,
        status: 'running',
        executorHostId: `host-other-${n}`,
        priority: 'low',
      })
    }

    await subagentDispatchService.setRedisClient(redis as unknown as Redis)

    // 3 个他实例 running 若被当成本实例占用 ⇒ 这里会 429(多实例部署下全员饿死)
    const res = await subagentDispatchService.dispatch({
      goal: '本实例新派单',
      affectedFiles: [],
      verifyCommands: [],
      constraints: '',
      deliverables: '',
      orchestration: 'parallel',
      agentRole: 'coder',
    })
    expect(res.outcome).toBe('ok')

    const rt = service.runtimes.get(res.dispatch!.id)!
    expect(rt.executingLocally).toBe(true)
    await vi.waitFor(() => expect(rt.dispatch.status).toBe('failed'))
  })
})

describe('E1 收尾:终态护栏与队列清理', () => {
  const dispatchInput = {
    goal: 'E1 收尾用例',
    affectedFiles: [],
    verifyCommands: [],
    constraints: '',
    deliverables: '',
    orchestration: 'parallel' as const,
    agentRole: 'coder' as const,
  }

  it('⑤ 取消后迟到的成功结果不得把派单复活', async () => {
    const redis = createFakeRedis()
    await subagentDispatchService.setRedisClient(redis as unknown as Redis)

    let resolveFetch!: (value: Response) => void
    vi.mocked(aiServiceSystemFetch).mockImplementationOnce(
      () => new Promise<Response>((resolve) => (resolveFetch = resolve)),
    )

    const res = await subagentDispatchService.dispatch(dispatchInput)
    const id = res.dispatch!.id
    // 等执行体真正发出 ai-service 调用(挂起在 deferred 上),再取消 —— 模拟"请求已发出"
    await vi.waitFor(() => expect(typeof resolveFetch).toBe('function'))
    expect(subagentDispatchService.cancel(id)).toBe(true)

    // 取消不会中断已发出的调用;响应迟到后必须被终态护栏丢掉
    resolveFetch({
      status: 200,
      ok: true,
      statusText: 'OK',
      json: async () => ({ code: 0, data: { final_output: '迟到的成功' } }),
    } as unknown as Response)
    await new Promise((resolve) => setTimeout(resolve, 20))

    const rt = service.runtimes.get(id)!
    expect(rt.dispatch.status).toBe('cancelled')
    expect(redis.hashes.get(`subagent:dispatch:${id}`)?.status).toBe('cancelled')
  })

  it('⑥ 终态派单出队:队列 zset 不再随派单量无限增长', async () => {
    const redis = createFakeRedis()
    await subagentDispatchService.setRedisClient(redis as unknown as Redis)

    const res = await subagentDispatchService.dispatch(dispatchInput)
    const id = res.dispatch!.id
    const rt = service.runtimes.get(id)!
    // 活跃态在队列里(dispatch 落 Redis 时 zadd)
    expect(redis.zsets.get('subagent:dispatch:queue')?.has(id)).toBe(true)

    // mock 的 ai-service 立即失败 ⇒ 落终态后必须 zrem。
    // 直接等 zrem 生效,不先等 status:status 与 zrem 是两次 Redis 写,先等 status 会在
    // 两次写之间的窗口返回,断言 zset 就会偶发失败(时序竞争)。
    await vi.waitFor(() => expect(redis.zsets.get('subagent:dispatch:queue')?.has(id)).toBe(false))
    expect(rt.dispatch.status).toBe('failed')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
