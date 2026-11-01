// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @ihui-seat S-STATS 2026-11-01
/**
 * S-STATS 回归锁:/subagents/stats 的租户口径 + /subagents/by-agent/:agentId/summary 的归属闸
 * (2026-11-01)。
 *
 * 背景(前序席位 S-ACL 留下的两处残余):
 *  ① `/subagents/stats` 的 total / totalTokens / avgDurationMs 读自进程级累加器 `_stats`,
 *     没有租户维度 ⇒ 任何登录用户都能读到**全站**派单数与 token 总量。
 *  ② `/subagents/by-agent/:agentId/summary` 只有 requireAuth + uuid 形状闸 ⇒ 知道 agent 的 uuid
 *     就能读它最近 50 条 agent_tasks(含派单 goal 与产出)。
 *
 * 本文件钉住:
 *  ① 跨租户:A 的 stats 不含 B 的计数与 token;往 store 里塞 B 的数据后 A 的读数**一位不变**;
 *  ② by-agent:A 读 B 的**未上架** agent ⇒ 404,且任务查询根本没被摸到(闸在 SQL 之前);
 *  ③ 正例:A 看自己的数据正常(总数/活跃/完成/token/平均时长都跟着长);
 *  ④ 无归属记录(ownerUserId 缺失)⇒ 与 /all 同判「未标注可见」,明确断言它对每个调用方都计入;
 *  ⑤ 已上架 agent 是公开资源 ⇒ 可读(如实断言,不硬造隔离);
 *  ⑥ 反向例(实测,读数见 .ihui-agent/seats/S-STATS.md):把 stats 的 owner 谓词删掉 ⇒ ① 立刻变红。
 *
 * 判据引生产源(§22c):可见性直接用路由导出的 isDispatchVisibleTo;service 用**真实现**
 * (`subagentDispatchService` 单例,runtimes 经既有测试同款私有字段注入),不另写一份统计口径 ——
 * 否则「路由传了谓词但 service 不按谓词算」这条最危险的分叉测试不到。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

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

// 两个租户靠请求头切换:authenticate 把 request.userId 写成 x-probe-user(缺省 tenant-a)
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: { userId?: string; headers: Record<string, unknown> }) => {
    const raw = request.headers['x-probe-user']
    request.userId = typeof raw === 'string' && raw.length > 0 ? raw : 'tenant-a'
  },
  checkAuth: async () => true,
}))

const { mockFindAgentById, mockFindAgentTasks } = vi.hoisted(() => ({
  mockFindAgentById: vi.fn(),
  mockFindAgentTasks: vi.fn(),
}))

vi.mock('../src/db/agent-queries.js', () => ({
  findAgentById: mockFindAgentById,
  findAgentTasksByAgentId: mockFindAgentTasks,
}))

import { subagentDispatchRoutes } from '../src/routes/subagent-dispatch.js'
import { subagentDispatchService } from '../src/services/subagent-dispatch-service.js'

/** 只描述本票用得到的字段;其余字段真实现不会在本路径上读 */
interface RuntimeLike {
  dispatch: {
    id: string
    goal: string
    status: string
    ownerUserId?: string
    createdAt: string
    updatedAt: string
  }
  steps: Array<{ tokenUsage: { total: number } }>
  logs: unknown[]
  hasFailed: boolean
  checkpoints: Map<string, unknown>
  messages: unknown[]
  dagNodeStatus: Map<string, unknown>
  startedAt?: number
  completedAt?: number
}

const runtimes = (subagentDispatchService as unknown as { runtimes: Map<string, RuntimeLike> })
  .runtimes

/** 直接注入 runtime:与既有服务测试同款(私有字段经 cast 取)—— 避免真跑 ai-service 出网 */
function seedDispatch(
  id: string,
  opts: {
    owner?: string
    status: string
    tokens?: number
    startedAt?: number
    completedAt?: number
  },
): void {
  runtimes.set(id, {
    dispatch: {
      id,
      goal: `goal-${id}`,
      status: opts.status,
      ...(opts.owner ? { ownerUserId: opts.owner } : {}),
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
    },
    steps: opts.tokens ? [{ tokenUsage: { total: opts.tokens } }] : [],
    logs: [],
    hasFailed: false,
    checkpoints: new Map(),
    messages: [],
    dagNodeStatus: new Map(),
    startedAt: opts.startedAt,
    completedAt: opts.completedAt,
  })
}

interface StatsBody {
  code: number
  data: {
    active: number
    completed: number
    failed: number
    total: number
    avgDurationMs: number
    totalTokens: number
  }
}

const asA = { 'x-probe-user': 'tenant-a' }
const asB = { 'x-probe-user': 'tenant-b' }

const AGENT_DRAFT_B = '11111111-1111-4111-8111-111111111111'
const AGENT_PUB_B = '22222222-2222-4222-8222-222222222222'
const AGENT_MINE_A = '33333333-3333-4333-8333-333333333333'
const AGENT_MISSING = '99999999-9999-4999-8999-999999999999'

/** agent_tasks 行的最小形状(buildAgentRuntimeSummary 只读这些) */
function taskRow(id: string, description: string) {
  return {
    id,
    agentId: AGENT_PUB_B,
    name: 'subagent:parallel:coder',
    description,
    status: 'completed',
    payload: {},
    result: { output: `${description}-output` },
    startedAt: new Date('2026-11-01T00:00:00.000Z'),
    completedAt: new Date('2026-11-01T00:00:01.000Z'),
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
    updatedAt: new Date('2026-11-01T00:00:01.000Z'),
    errorMessage: null,
  }
}

let app: FastifyInstance

async function getStats(headers: Record<string, string>): Promise<StatsBody> {
  const res = await app.inject({ method: 'GET', url: '/api/subagents/stats', headers })
  expect(res.statusCode).toBe(200)
  return res.json() as StatsBody
}

beforeEach(async () => {
  runtimes.clear()
  mockFindAgentById.mockReset()
  mockFindAgentTasks.mockReset()
  mockFindAgentTasks.mockResolvedValue([])
  app = Fastify()
  await app.register(subagentDispatchRoutes, { prefix: '/api' })
  await app.ready()
})

afterEach(async () => {
  await app.close()
  runtimes.clear()
})

describe('S-STATS ① /subagents/stats:跨租户不可见', () => {
  it('A 的读数只含 A 的派单与 token,B 的两条(计数 + 1900 token)一个都不进', async () => {
    seedDispatch('a-1', { owner: 'tenant-a', status: 'completed', tokens: 100 })
    seedDispatch('b-1', { owner: 'tenant-b', status: 'completed', tokens: 900 })
    seedDispatch('b-2', { owner: 'tenant-b', status: 'failed', tokens: 1000 })

    const a = await getStats(asA)

    expect(a.data.total).toBe(1)
    expect(a.data.completed).toBe(1)
    // B 的失败单不得计进 A 的 failed
    expect(a.data.failed).toBe(0)
    expect(a.data.totalTokens).toBe(100)
    // 反向证据:全站口径是 2100 —— 拿到它(或 1900)就是泄漏
    expect(a.data.totalTokens).not.toBe(2100)
    expect(a.data.totalTokens).not.toBe(1900)

    // B 看自己的仍然完整(收窄不是把大家都清空)
    const b = await getStats(asB)
    expect(b.data.total).toBe(2)
    expect(b.data.completed).toBe(1)
    expect(b.data.failed).toBe(1)
    expect(b.data.totalTokens).toBe(1900)
  })

  it('反向例:往 store 里塞入 B 的新数据后,A 的六个读数一位不变', async () => {
    seedDispatch('a-1', {
      owner: 'tenant-a',
      status: 'completed',
      tokens: 100,
      startedAt: 0,
      completedAt: 200,
    })
    const before = (await getStats(asA)).data

    seedDispatch('b-3', {
      owner: 'tenant-b',
      status: 'completed',
      tokens: 5000,
      startedAt: 0,
      completedAt: 900,
    })
    seedDispatch('b-4', { owner: 'tenant-b', status: 'running', tokens: 400 })

    const after = (await getStats(asA)).data
    expect(after).toEqual(before)
    expect(after.totalTokens).toBe(100)
    expect(after.avgDurationMs).toBe(200)
  })
})

describe('S-STATS ③ 正例:A 看自己的数据正常', () => {
  it('自己的派单数/活跃数/token/平均时长都随记录增长', async () => {
    seedDispatch('a-1', {
      owner: 'tenant-a',
      status: 'completed',
      tokens: 100,
      startedAt: 1000,
      completedAt: 1200,
    })
    let s = await getStats(asA)
    expect(s.data).toEqual({
      active: 0,
      completed: 1,
      failed: 0,
      total: 1,
      avgDurationMs: 200,
      totalTokens: 100,
    })

    seedDispatch('a-2', { owner: 'tenant-a', status: 'running', tokens: 50 })
    s = await getStats(asA)
    expect(s.data.total).toBe(2)
    expect(s.data.active).toBe(1)
    expect(s.data.totalTokens).toBe(150)
    // 分母仍是 total(未终态记录按 0 时长参与,与旧累加器口径一致)
    expect(s.data.avgDurationMs).toBe(100)
  })
})

describe('S-STATS ④ 无归属记录(ownerUserId 缺失)', () => {
  it('与 /all 同判:未标注记录对每个登录用户都计入(不隐藏历史,也是已知残余)', async () => {
    seedDispatch('legacy-1', { status: 'completed', tokens: 7 })
    seedDispatch('a-1', { owner: 'tenant-a', status: 'completed', tokens: 100 })

    const a = await getStats(asA)
    // A:自己的 1 条 + 未标注的 1 条
    expect(a.data.total).toBe(2)
    expect(a.data.totalTokens).toBe(107)

    const b = await getStats(asB)
    // B:只有未标注的 1 条 —— 说明未标注不是「算进某个默认租户」,而是按可见性规则公开
    expect(b.data.total).toBe(1)
    expect(b.data.totalTokens).toBe(7)
  })
})

describe('S-STATS ② /subagents/by-agent/:agentId/summary 归属闸', () => {
  it('A 读 B 的未上架 agent ⇒ 404,且任务查询根本没被摸到(闸在 SQL 之前)', async () => {
    mockFindAgentById.mockResolvedValue({
      agentId: AGENT_DRAFT_B,
      userId: 'tenant-b',
      status: 'pending',
      publishStatus: 'draft',
    })

    const res = await app.inject({
      method: 'GET',
      url: `/api/subagents/by-agent/${AGENT_DRAFT_B}/summary`,
      headers: asA,
    })

    expect(res.statusCode).toBe(404)
    // 反证不是「查了再过滤」:越权时一行都不该出库
    expect(mockFindAgentTasks).not.toHaveBeenCalled()
    // 响应体里不得带对方数据
    expect(JSON.stringify(res.json())).not.toContain(AGENT_DRAFT_B)
  })

  it('B 读自己的未上架 agent ⇒ 200(闸只挡跨租户,不挡本人)', async () => {
    mockFindAgentById.mockResolvedValue({
      agentId: AGENT_DRAFT_B,
      userId: 'tenant-b',
      status: 'pending',
      publishStatus: 'draft',
    })
    mockFindAgentTasks.mockResolvedValue([taskRow('t-1', 'B 的草稿运行记录')])

    const res = await app.inject({
      method: 'GET',
      url: `/api/subagents/by-agent/${AGENT_DRAFT_B}/summary`,
      headers: asB,
    })

    expect(res.statusCode).toBe(200)
    expect(mockFindAgentTasks).toHaveBeenCalledWith(AGENT_DRAFT_B, 50)
    expect(JSON.stringify(res.json())).toContain('B 的草稿运行记录')
  })

  it('A 读自己的 agent ⇒ 200', async () => {
    mockFindAgentById.mockResolvedValue({
      agentId: AGENT_MINE_A,
      userId: 'tenant-a',
      status: 'pending',
      publishStatus: 'draft',
    })

    const res = await app.inject({
      method: 'GET',
      url: `/api/subagents/by-agent/${AGENT_MINE_A}/summary`,
      headers: asA,
    })
    expect(res.statusCode).toBe(200)
  })

  it('⑤ 已上架 agent 是公开资源 ⇒ 跨租户可读(如实断言,不硬造隔离)', async () => {
    mockFindAgentById.mockResolvedValue({
      agentId: AGENT_PUB_B,
      userId: 'tenant-b',
      status: 'published',
      publishStatus: 'published',
    })
    mockFindAgentTasks.mockResolvedValue([taskRow('t-2', '已上架 agent 的运行记录')])

    const res = await app.inject({
      method: 'GET',
      url: `/api/subagents/by-agent/${AGENT_PUB_B}/summary`,
      headers: asA,
    })
    // 残余(见 seat):已上架 agent 的任务行没有租户维度 ⇒ 这一步在下一张工单前仍然是可读的
    expect(res.statusCode).toBe(200)
  })

  it('agent 不存在 ⇒ 404(取不到与不是你的同形,防枚举)', async () => {
    mockFindAgentById.mockResolvedValue(undefined)

    const res = await app.inject({
      method: 'GET',
      url: `/api/subagents/by-agent/${AGENT_MISSING}/summary`,
      headers: asA,
    })
    expect(res.statusCode).toBe(404)
    expect(mockFindAgentTasks).not.toHaveBeenCalled()
  })

  it('无归属 agent(userId 为空)且未上架 ⇒ 404,不因「没人认领」就公开', async () => {
    mockFindAgentById.mockResolvedValue({
      agentId: AGENT_DRAFT_B,
      userId: null,
      status: 'pending',
      publishStatus: 'draft',
    })

    const res = await app.inject({
      method: 'GET',
      url: `/api/subagents/by-agent/${AGENT_DRAFT_B}/summary`,
      headers: asA,
    })
    expect(res.statusCode).toBe(404)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
