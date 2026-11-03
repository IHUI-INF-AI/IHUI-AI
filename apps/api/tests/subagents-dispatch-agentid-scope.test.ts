// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @ihui-seat P1 2026-11-02

/**
 * 回归锁:POST /api/subagents/dispatch 的 `agentId` / `conversationId` 归属闸(2026-11-02,P1)。
 *
 * 背景:两个入参只过了 Zod 的 uuid 形状闸,没有归属校验 ——
 *  - 任意登录用户带**别人未上架**的 agentId 建派单 ⇒ `_createAgentTask` 往 `agent_tasks`
 *    写一条属于对方 agent 的轨迹(status=running),既污染对方详情页,也越过 agent 的可见性;
 *  - conversationId 同理:可以把派单挂到不属于自己的会话上,污染对方会话维度的派单列表。
 *
 * 修法(判据单源,§22c):
 *  - agentId:复用 `/subagents/by-agent/:agentId/summary` 的既有判据
 *    「本人所有 或 已上架(status/publishStatus=published)」;
 *  - conversationId:复用 `db/chat-conversation-access.ts#getConversationAccess`
 *    (本人会话 ∪ 已接受协作成员)—— 仓内会话归属的唯一定义,保留该入参而不删。
 *  - 所有新校验失败一律 **404**(取不到与不是你的同形,防枚举;不用 403)。
 *
 * 本文件钉住:
 *  ① 他人未上架 agentId ⇒ 404,且 `agent_tasks` 一行都没写(db.insert 未被调用);
 *  ② agent 不存在 / 无归属未上架 ⇒ 同上 404;
 *  ③ 正例:本人未上架 agent ⇒ 200 且真写入 agent_tasks;
 *  ④ 正例:他人**已上架** agent(公开资源,既有语义)⇒ 200 且写入;
 *  ⑤ 他人 conversationId ⇒ 404,且一行不写;
 *  ⑥ 正例:本人 conversationId ⇒ 200,记录上带 conversationId(未误伤);
 *  ⑦ 反向例(实测,见交付报告):删掉两段新校验 ⇒ ①⑤ 立刻变红。
 *
 * 全程不连库不发网络:db / agent-queries / chat-conversation-access / ai-service fetch 全 mock。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('../src/utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const { mockValues, mockInsert, mockUpdate, mockSelect } = vi.hoisted(() => ({
  mockValues: vi.fn((_values?: Record<string, unknown>) => ({
    returning: async () => [{ id: 'task-1' }],
  })),
  mockInsert: vi.fn(() => ({ values: mockValues })),
  mockUpdate: vi.fn(),
  mockSelect: vi.fn(),
}))

// service 顶层 import 了 db / @ihui/database / workspace-lock-heartbeat —— 与既有
// tests/subagent-dispatch-service.test.ts 同款 mock 面,只为让真实现能在单测里加载。
vi.mock('../src/db/index.js', () => ({
  db: { insert: mockInsert, update: mockUpdate, select: mockSelect },
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

// 两个租户靠请求头切换:authenticate 把 request.userId 写成 x-probe-user(缺省 tenant-a)
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: { userId?: string; headers: Record<string, unknown> }) => {
    const raw = request.headers['x-probe-user']
    request.userId = typeof raw === 'string' && raw.length > 0 ? raw : 'tenant-a'
  },
  checkAuth: async () => true,
}))

const { mockFindAgentById, mockFindAgentTasks, mockGetConversationAccess } = vi.hoisted(() => ({
  mockFindAgentById: vi.fn(),
  mockFindAgentTasks: vi.fn(),
  mockGetConversationAccess: vi.fn(),
}))

vi.mock('../src/db/agent-queries.js', () => ({
  findAgentById: mockFindAgentById,
  findAgentTasksByAgentId: mockFindAgentTasks,
}))

vi.mock('../src/db/chat-conversation-access.js', () => ({
  getConversationAccess: mockGetConversationAccess,
}))

import { subagentDispatchRoutes } from '../src/routes/subagent-dispatch.js'
import { subagentDispatchService } from '../src/services/subagent-dispatch-service.js'

const AGENT_DRAFT_B = '11111111-1111-4111-8111-111111111111'
const AGENT_PUB_B = '22222222-2222-4222-8222-222222222222'
const AGENT_MINE_A = '33333333-3333-4333-8333-333333333333'
const AGENT_MISSING = '99999999-9999-4999-8999-999999999999'
const CONV_B = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const CONV_MINE_A = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const asA = { 'x-probe-user': 'tenant-a' }

const body = {
  goal: 'tenant-scope probe',
  affectedFiles: ['apps/api/src/x.ts'],
  verifyCommands: [],
  constraints: 'only listed files',
  deliverables: 'patch',
  agentRole: 'coder',
  orchestration: 'parallel',
}

let app: FastifyInstance

async function postDispatch(
  payload: Record<string, unknown>,
  headers: Record<string, string> = asA,
): Promise<{ statusCode: number; body: string }> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/subagents/dispatch',
    headers,
    payload,
  })
  return { statusCode: res.statusCode, body: res.body }
}

beforeEach(async () => {
  ;(subagentDispatchService as unknown as { runtimes: Map<string, unknown> }).runtimes.clear()
  mockInsert.mockClear()
  mockValues.mockClear()
  mockFindAgentById.mockReset()
  mockFindAgentTasks.mockReset()
  mockFindAgentTasks.mockResolvedValue([])
  mockGetConversationAccess.mockReset()
  app = Fastify()
  await app.register(subagentDispatchRoutes, { prefix: '/api' })
  await app.ready()
})

afterEach(async () => {
  await app.close()
  ;(subagentDispatchService as unknown as { runtimes: Map<string, unknown> }).runtimes.clear()
})

describe('P1 ① agentId 归属闸:他人未上架 ⇒ 404 且不写 agent_tasks', () => {
  it('A 带 B 的未上架 agentId ⇒ 404,db.insert 一次都没有', async () => {
    mockFindAgentById.mockResolvedValue({
      agentId: AGENT_DRAFT_B,
      userId: 'tenant-b',
      status: 'pending',
      publishStatus: 'draft',
    })

    const res = await postDispatch({ ...body, agentId: AGENT_DRAFT_B })

    expect(res.statusCode).toBe(404)
    expect(mockFindAgentById).toHaveBeenCalledWith(AGENT_DRAFT_B)
    expect(mockInsert).not.toHaveBeenCalled()
    expect(mockValues).not.toHaveBeenCalled()
    // 响应体不得带对方的 agentId(不证实存在性)
    expect(res.body).not.toContain(AGENT_DRAFT_B)
  })

  it('agent 不存在 ⇒ 404(取不到与不是你的同形)', async () => {
    mockFindAgentById.mockResolvedValue(undefined)

    const res = await postDispatch({ ...body, agentId: AGENT_MISSING })

    expect(res.statusCode).toBe(404)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('agent 无归属(userId 为空)且未上架 ⇒ 404,不因「没人认领」就放行', async () => {
    mockFindAgentById.mockResolvedValue({
      agentId: AGENT_DRAFT_B,
      userId: null,
      status: 'pending',
      publishStatus: 'draft',
    })

    const res = await postDispatch({ ...body, agentId: AGENT_DRAFT_B })
    expect(res.statusCode).toBe(404)
    expect(mockInsert).not.toHaveBeenCalled()
  })
})

describe('P1 ③④ agentId 正例:本人 / 已上架', () => {
  it('A 带自己的未上架 agent ⇒ 200,且真写入 agent_tasks(不误伤本人)', async () => {
    mockFindAgentById.mockResolvedValue({
      agentId: AGENT_MINE_A,
      userId: 'tenant-a',
      status: 'pending',
      publishStatus: 'draft',
    })

    const res = await postDispatch({ ...body, agentId: AGENT_MINE_A })

    expect(res.statusCode).toBe(200)
    expect(mockInsert).toHaveBeenCalledTimes(1)
    expect(mockValues.mock.calls[0]?.[0]).toMatchObject({ agentId: AGENT_MINE_A })
    // 归属仍由鉴权注入(不是请求体自报)
    const parsed = JSON.parse(res.body) as { data: { dispatch: { ownerUserId?: string } } }
    expect(parsed.data.dispatch.ownerUserId).toBe('tenant-a')
  })

  it('A 带 B 已上架的 agent(公开资源,既有语义)⇒ 200 且写入', async () => {
    mockFindAgentById.mockResolvedValue({
      agentId: AGENT_PUB_B,
      userId: 'tenant-b',
      status: 'published',
      publishStatus: 'published',
    })

    const res = await postDispatch({ ...body, agentId: AGENT_PUB_B })

    expect(res.statusCode).toBe(200)
    expect(mockInsert).toHaveBeenCalledTimes(1)
    expect(mockValues.mock.calls[0]?.[0]).toMatchObject({ agentId: AGENT_PUB_B })
  })
})

describe('P1 ⑤⑥ conversationId 归属闸', () => {
  it('A 带 B 的会话 ⇒ 404,且不写 agent_tasks', async () => {
    mockGetConversationAccess.mockResolvedValue(null)

    const res = await postDispatch({ ...body, conversationId: CONV_B })

    expect(res.statusCode).toBe(404)
    expect(mockFindAgentById).not.toHaveBeenCalled()
    expect(mockGetConversationAccess).toHaveBeenCalledWith(CONV_B, 'tenant-a')
    expect(mockInsert).not.toHaveBeenCalled()
    expect(res.body).not.toContain(CONV_B)
  })

  it('A 带自己的会话 ⇒ 200,记录上带 conversationId(判据为 owner)', async () => {
    mockGetConversationAccess.mockResolvedValue('owner')
    mockFindAgentById.mockResolvedValue({
      agentId: AGENT_MINE_A,
      userId: 'tenant-a',
      status: 'pending',
      publishStatus: 'draft',
    })

    const res = await postDispatch({ ...body, agentId: AGENT_MINE_A, conversationId: CONV_MINE_A })

    expect(res.statusCode).toBe(200)
    expect(mockGetConversationAccess).toHaveBeenCalledWith(CONV_MINE_A, 'tenant-a')
    const parsed = JSON.parse(res.body) as { data: { dispatch: { conversationId?: string } } }
    expect(parsed.data.dispatch.conversationId).toBe(CONV_MINE_A)
  })

  it('A 带自己作为已接受协作成员的会话 ⇒ 200(协作档与 chat-collab 同源)', async () => {
    mockGetConversationAccess.mockResolvedValue('collaborator')

    const res = await postDispatch({ ...body, conversationId: CONV_B })

    expect(res.statusCode).toBe(200)
    expect(mockGetConversationAccess).toHaveBeenCalledWith(CONV_B, 'tenant-a')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
