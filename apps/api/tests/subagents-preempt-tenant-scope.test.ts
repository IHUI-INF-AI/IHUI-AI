// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @ihui-seat P0-1 2026-11-02

/**
 * 回归锁:urgent 派单的**内部抢占**不得跨租户(2026-11-02,P0-1)。
 *
 * 背景:`SubagentDispatchService._tryPreempt()` 原实现的候选取自 `runtimes` 全集,只按
 * priority 排序取最低的抢占 —— 绕过了 `/cancel` 的 `ownsDispatch` 归属闸:A 租户的 urgent
 * 请求能把 B 租户正在跑的 normal 任务置 `preempted`(写 completedAt + `dispatch_preempted` 日志)。
 *
 * 修法:候选只保留 `dispatch.ownerUserId === 发起方 ownerUserId` 的记录(直接从派单记录上读,
 * 不另立租户表达);没有同租户候选 ⇒ 不抢他人,记录落 queued 等槽位(F2 起不再返回 429)。
 *
 * 本文件钉住(真跑,不 mock service —— 走 `dispatch()` 真路径):
 *  ① 跨租户:全局 6 槽已满、B 有 normal 在跑, A 发 urgent ⇒ 自己的单落 queued;
 *     B 的记录 status 不变、completedAt 未写、logs 里没有 dispatch_preempted;
 *  ② 同租户:全局 6 槽已满、A 自己的 low 在跑,A 发 urgent ⇒ 仍能抢占(证明没把功能改死);
 *     同批 B 的记录一个都不动;
 *  ③ 无归属旧记录(未标注)不会被带 owner 的 urgent 跨租户抢(不做跨租户写入)。
 *  ④ 反向例(实测,见交付报告):删掉 owner 过滤 ⇒ ①② 立刻变红(① 变成 ok + B 被 preempted,
 *     ② 抢错目标)。
 *
 * 全程不连库、不发网络(callAiService 的底层 fetch 被 mock 成立即成功)。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.hoisted(() => {
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('../src/utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// service 顶层 import 了 db / @ihui/database / workspace-lock-heartbeat —— 与既有
// tests/subagent-dispatch-service.test.ts 同款 mock 面,只为让真实现能在单测里加载。
vi.mock('../src/db/index.js', () => ({
  db: { insert: vi.fn(), update: vi.fn(), select: vi.fn() },
  dbRead: {},
}))

vi.mock('@ihui/database', () => ({
  agentTasks: { id: 'agent_tasks_id' },
}))

vi.mock('../src/services/workspace-lock-heartbeat.js', () => ({
  releaseTaskLockByTaskId: vi.fn(),
  toLockReleaseOutcome: () => null,
  startLockHeartbeat: vi.fn(),
  stopLockHeartbeat: vi.fn(),
}))

// 派单真正跑起来时会调 ai-service:mock 底层 fetch 成立即成功,避免出网/悬挂
vi.mock('../src/utils/ai-service-fetch.js', () => ({
  aiServiceSystemFetch: vi.fn(async () => ({
    status: 200,
    ok: true,
    json: async () => ({ code: 0, data: { final_output: 'ok' } }),
  })),
}))

import { subagentDispatchService } from '../src/services/subagent-dispatch-service.js'

type DispatchPriority = 'low' | 'normal' | 'high' | 'urgent'

interface RuntimeLike {
  dispatch: {
    id: string
    goal: string
    status: string
    ownerUserId?: string
    affectedFiles: string[]
    createdAt: string
    updatedAt: string
  }
  retry?: unknown
  dag?: unknown
  priority: DispatchPriority
  steps: unknown[]
  logs: Array<{ event?: string }>
  hasFailed: boolean
  checkpoints: Map<string, unknown>
  messages: unknown[]
  dagNodeStatus: Map<string, unknown>
  startedAt?: number
  completedAt?: number
}

const service = subagentDispatchService as unknown as {
  runtimes: Map<string, RuntimeLike>
  dispatch: (input: Record<string, unknown>) => Promise<{
    outcome: string
    error?: string
    dispatch?: { id: string }
  }>
}

const runtimes = service.runtimes

/** 直接注入 runtime:与既有服务测试同款(私有字段经 cast 取)—— 避免真跑 ai-service 出网 */
function seedDispatch(
  id: string,
  opts: { owner?: string; status: string; priority: DispatchPriority },
): void {
  runtimes.set(id, {
    dispatch: {
      id,
      goal: `goal-${id}`,
      status: opts.status,
      ...(opts.owner ? { ownerUserId: opts.owner } : {}),
      affectedFiles: ['a.ts'],
      createdAt: '2026-11-02T00:00:00.000Z',
      updatedAt: '2026-11-02T00:00:00.000Z',
    },
    priority: opts.priority,
    steps: [],
    logs: [],
    hasFailed: false,
    checkpoints: new Map(),
    messages: [],
    dagNodeStatus: new Map(),
  })
}

function runtime(id: string): RuntimeLike | undefined {
  return runtimes.get(id)
}

/** 抢占目标是否真的被动过:状态、completedAt、日志三处都得是原样 */
function expectUntouched(id: string, status: 'running' | 'pending' = 'running'): void {
  const rt = runtime(id)
  expect(rt).toBeDefined()
  expect(rt!.dispatch.status).toBe(status)
  expect(rt!.completedAt).toBeUndefined()
  expect(rt!.logs.some((l) => l.event === 'dispatch_preempted')).toBe(false)
}

const baseInput = {
  goal: 'urgent by tenant-a',
  affectedFiles: ['apps/api/src/x.ts'],
  verifyCommands: [],
  constraints: 'only listed files',
  deliverables: 'patch',
  agentRole: 'coder',
  orchestration: 'parallel',
}

beforeEach(() => {
  runtimes.clear()
})

afterEach(() => {
  runtimes.clear()
})

describe('P0-1 ① 跨租户:urgent 不得抢占他人任务', () => {
  it('并发已满且全是 B 的任务,A 发 urgent ⇒ 自己的单落 queued,B 保持 running 且无 dispatch_preempted', async () => {
    // 全局 6 槽先被 tenant-b 占满(直接注入,不经过派单准入)
    seedDispatch('b-normal', { owner: 'tenant-b', status: 'running', priority: 'normal' })
    seedDispatch('b-low-1', { owner: 'tenant-b', status: 'running', priority: 'low' })
    seedDispatch('b-low-2', { owner: 'tenant-b', status: 'pending', priority: 'low' })
    seedDispatch('b-normal-2', { owner: 'tenant-b', status: 'running', priority: 'normal' })
    seedDispatch('b-high', { owner: 'tenant-b', status: 'running', priority: 'high' })
    seedDispatch('b-normal-3', { owner: 'tenant-b', status: 'running', priority: 'normal' })

    const result = await service.dispatch({ ...baseInput, priority: 'urgent', ownerUserId: 'tenant-a' })

    // F2:满额不再拒绝(不返回 concurrent_limit/429),新派单落 queued 等槽位
    expect(result.outcome).toBe('ok')
    expect(result.dispatch).toBeDefined()
    expect(runtime(result.dispatch!.id)!.dispatch.status).toBe('queued')

    // B 的六条一条都没被写
    expectUntouched('b-normal')
    expectUntouched('b-low-1')
    expectUntouched('b-low-2', 'pending')
    expectUntouched('b-normal-2')
    expectUntouched('b-high')
    expectUntouched('b-normal-3')
    // 新派单只是排队,没有抢占他人
    expect(runtimes.size).toBe(7)
  })
})

describe('P0-1 ② 同租户:urgent 仍能抢占自己的低优先级任务', () => {
  it('并发已满,A 的 low 在跑,A 发 urgent ⇒ 抢 A 自己那条,B 的一条不动', async () => {
    // 全局 6 槽占满:tenant-b 5 条 + tenant-a 自己的 1 条 low
    seedDispatch('b-low', { owner: 'tenant-b', status: 'running', priority: 'low' })
    seedDispatch('a-low', { owner: 'tenant-a', status: 'running', priority: 'low' })
    seedDispatch('b-normal', { owner: 'tenant-b', status: 'running', priority: 'normal' })
    seedDispatch('b-normal-2', { owner: 'tenant-b', status: 'running', priority: 'normal' })
    seedDispatch('b-high', { owner: 'tenant-b', status: 'running', priority: 'high' })
    seedDispatch('b-normal-3', { owner: 'tenant-b', status: 'running', priority: 'normal' })

    const result = await service.dispatch({ ...baseInput, priority: 'urgent', ownerUserId: 'tenant-a' })
    expect(result.outcome).toBe('ok')

    const target = runtime('a-low')!
    expect(target.dispatch.status).toBe('preempted')
    expect(target.completedAt).toBeDefined()
    expect(target.logs.some((l) => l.event === 'dispatch_preempted')).toBe(true)

    // 抢占只打自己人:B 的两条仍原样
    expectUntouched('b-low')
    expectUntouched('b-normal')
  })
})

describe('P0-1 ③ 无归属旧记录(未标注)', () => {
  it('带 owner 的 urgent 不会把未标注记录当成可抢候选(不做跨租户写入)', async () => {
    // 全局 6 槽占满:1 条未标注 + tenant-b 5 条
    seedDispatch('legacy-1', { status: 'running', priority: 'low' })
    seedDispatch('b-1', { owner: 'tenant-b', status: 'running', priority: 'normal' })
    seedDispatch('b-2', { owner: 'tenant-b', status: 'running', priority: 'normal' })
    seedDispatch('b-3', { owner: 'tenant-b', status: 'running', priority: 'normal' })
    seedDispatch('b-4', { owner: 'tenant-b', status: 'running', priority: 'normal' })
    seedDispatch('b-5', { owner: 'tenant-b', status: 'running', priority: 'normal' })

    const result = await service.dispatch({ ...baseInput, priority: 'urgent', ownerUserId: 'tenant-a' })
    expect(result.outcome).toBe('ok')
    expect(runtime(result.dispatch!.id)!.dispatch.status).toBe('queued')

    const legacy = runtime('legacy-1')!
    expect(legacy.dispatch.status).toBe('running')
    expect(legacy.completedAt).toBeUndefined()
    expect(legacy.logs.some((l) => l.event === 'dispatch_preempted')).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
