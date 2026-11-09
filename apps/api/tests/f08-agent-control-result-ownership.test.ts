// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-08「/api/agent-control/result 缺归属绑定」不变量测试(2026-11-08 立)。
 *
 * 要回答的问题:
 *  ① 写端:派发时 pending 必须记下「这条指令属于谁」,不能只按 requestId 记账;
 *  ② 读端:B 拿着 A 的 requestId 回传结果(带/不带 responded)都不能结算 A 的 pending;
 *  ③ 派发端:人用 JWT 调 /execute 时,body 里的 userId 不能指向他人(否则会把指令推到
 *     他人端点);
 *  ④ A 本人的旧语义(不带 responded 的存量客户端)不得被这次收口破坏。
 *
 * 夹具形态与 agent-control-addressed-delivery.test.ts 同款:mock 鉴权、mock
 * pushNotification,不触达生产 PG/Redis。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import type { AgentActionAssignment, AgentActionRequest, AgentActionResponse } from '@ihui/types'

const { mockAuthenticate, mockCheckAuth, mockCheckAuthOrInternal } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn<(request: { userId?: string; headers: Record<string, unknown> }) => Promise<unknown>>(),
  mockCheckAuth: vi.fn<(request: { userId?: string; headers: Record<string, unknown> }, reply: unknown) => Promise<boolean>>(),
  mockCheckAuthOrInternal:
    vi.fn<(request: { userId?: string; headers: Record<string, unknown> }, reply: unknown) => Promise<boolean>>(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  checkAuth: mockCheckAuth,
  checkAuthOrInternalService: mockCheckAuthOrInternal,
}))

vi.mock('@ihui/shared', () => ({
  toUserFriendlyMessage: (err: unknown) => String(err),
}))

import { agentControlRoutes, __test__ } from '../src/routes/agent-control.js'

const PREFIX = '/api/agent-control'
const INTERNAL_SECRET = 'agent-control-ownership-test-secret'
const USER_A = '00000000-0000-4000-8000-00000000000a'
const USER_B = '00000000-0000-4000-8000-00000000000b'
const ALL_UI_ACTIONS = ['describe', 'navigate', 'click', 'fill', 'submit', 'read', 'invoke']

const INTERNAL_HEADERS = { authorization: `Bearer ${INTERNAL_SECRET}` }

let app: FastifyInstance
const mockPush = vi.fn<(userId: string, payload: unknown) => void>()

/** 以 header 里的 x-probe-user 作为登录身份(缺省 USER_A) */
function probeUser(request: { headers: Record<string, unknown> }): string {
  const raw = request.headers['x-probe-user']
  return typeof raw === 'string' ? raw : USER_A
}

async function reportCapability(instanceId: string, user: string = USER_A) {
  const res = await app.inject({
    method: 'POST',
    url: `${PREFIX}/capability`,
    headers: { 'x-probe-user': user },
    payload: {
      endpoint: 'web',
      instanceId,
      uiActions: ALL_UI_ACTIONS,
      reportedAt: new Date().toISOString(),
    },
  })
  if (res.statusCode !== 200) throw new Error(`capability 注册失败: ${res.statusCode}`)
}

/** ai-service 内部凭据调 /execute(body.userId 声明目标用户) */
async function executeAsService(body: {
  requestId: string
  category: AgentActionRequest['category']
  action: string
  userId?: string
  timeout?: number
}) {
  return app.inject({
    method: 'POST',
    url: `${PREFIX}/execute`,
    payload: { params: {}, timeout: 1000, ...body },
    headers: INTERNAL_HEADERS,
  })
}

/** 人用 JWT 调 /execute(无内部密钥) */
async function executeAsUser(
  user: string,
  body: {
    requestId: string
    category: AgentActionRequest['category']
    action: string
    userId?: string
    timeout?: number
  },
) {
  return app.inject({
    method: 'POST',
    url: `${PREFIX}/execute`,
    payload: { params: {}, timeout: 1000, ...body },
    headers: { 'x-probe-user': user },
  })
}

/** /execute 先 push 再登记 pending,微任务落地后才能回传结果 */
async function waitPending(requestId: string): Promise<void> {
  for (let i = 0; i < 200; i++) {
    if (__test__.pending.has(requestId)) return
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  throw new Error(`pending 未登记 requestId=${requestId}`)
}

async function postResult(user: string, body: Record<string, unknown>) {
  return app.inject({
    method: 'POST',
    url: `${PREFIX}/result`,
    headers: { 'x-probe-user': user },
    payload: body,
  })
}

function lastAssignment(): AgentActionAssignment {
  const payload = mockPush.mock.calls.at(-1)?.[1] as { assignment?: AgentActionAssignment }
  expect(payload?.assignment, '投递载荷必须携带 assignment 目标身份').toBeTruthy()
  return payload.assignment as AgentActionAssignment
}

describe('agent-control result 归属绑定 — F-08', () => {
  beforeAll(async () => {
    process.env.AGENT_CONTROL_INTERNAL_SECRET = INTERNAL_SECRET
    app = Fastify({ logger: false })
    app.decorate('pushNotification', mockPush)
    await app.register(agentControlRoutes, { prefix: PREFIX })
    await app.ready()
  })

  afterAll(async () => {
    delete process.env.AGENT_CONTROL_INTERNAL_SECRET
    await app.close()
  })

  beforeEach(() => {
    __test__.endpoints.clear()
    for (const p of __test__.pending.values()) clearTimeout(p.timer)
    __test__.pending.clear()
    Object.assign(__test__.droppedResults, {
      tokenMismatch: 0,
      instanceMismatch: 0,
      unattributed: 0,
      ownerMismatch: 0,
    })
    mockPush.mockReset()
    mockCheckAuth.mockReset()
    mockCheckAuth.mockImplementation(async (request) => {
      request.userId = probeUser(request)
      return true
    })
    mockCheckAuthOrInternal.mockReset()
    mockCheckAuthOrInternal.mockImplementation(async (request) => {
      request.userId = probeUser(request)
      return true
    })
    mockAuthenticate.mockReset()
    mockAuthenticate.mockImplementation(async (request) => {
      request.userId = probeUser(request)
      return { userId: request.userId }
    })
  })

  it('① 写端归属:B 不带 responded 拿 A 的 requestId 回传 → 404,不得结算 A 的 pending', async () => {
    await reportCapability('web-a', USER_A)
    const executePromise = executeAsService({
      requestId: 'req-f08-cross-legacy',
      category: 'ui',
      action: 'describe',
      userId: USER_A,
    })
    await waitPending('req-f08-cross-legacy')

    // 写端:派发时 pending 必须记下属主,而不是只有 requestId
    expect(__test__.pending.get('req-f08-cross-legacy')?.userId).toBe(USER_A)

    const forged = await postResult(USER_B, {
      requestId: 'req-f08-cross-legacy',
      success: true,
      durationMs: 1,
      executedBy: 'web',
      data: { marker: 'FAKE-FROM-B' },
    })
    expect(forged.statusCode).toBe(404)
    expect(__test__.pending.has('req-f08-cross-legacy')).toBe(true)
    expect(__test__.droppedResults.ownerMismatch).toBe(1)

    // A 本人后回仍须被受理,执行结论不得被 B 顶掉
    const real = await postResult(USER_A, {
      requestId: 'req-f08-cross-legacy',
      success: true,
      durationMs: 2,
      executedBy: 'web',
      data: { marker: 'REAL-FROM-A' },
    })
    expect(real.statusCode).toBe(200)
    const body = (await executePromise).json<{ data: AgentActionResponse }>().data
    expect(body.data?.marker).toBe('REAL-FROM-A')
  })

  it('② 读端归属:B 带完整 responded(真令牌+真实例)也不能结算 A 的 pending', async () => {
    await reportCapability('web-a', USER_A)
    const executePromise = executeAsService({
      requestId: 'req-f08-cross-responded',
      category: 'ui',
      action: 'read',
      userId: USER_A,
    })
    await waitPending('req-f08-cross-responded')
    const assignment = lastAssignment()

    const forged = await postResult(USER_B, {
      requestId: 'req-f08-cross-responded',
      success: true,
      durationMs: 1,
      executedBy: 'web',
      data: { marker: 'FAKE-FROM-B' },
      responded: { instanceId: assignment.instanceId, assignmentToken: assignment.token },
    })
    expect(forged.statusCode).toBe(404)
    expect(__test__.pending.has('req-f08-cross-responded')).toBe(true)

    const real = await postResult(USER_A, {
      requestId: 'req-f08-cross-responded',
      success: true,
      durationMs: 9,
      executedBy: 'web',
      responded: { instanceId: assignment.instanceId, assignmentToken: assignment.token },
    })
    const json = real.json<{ data: { accepted: boolean } }>().data
    expect(json.accepted).toBe(true)
    expect((await executePromise).json<{ data: AgentActionResponse }>().data.success).toBe(true)
  })

  it('③ 派发端归属:人用 JWT 不能用 body.userId 把指令推给他人端点', async () => {
    await reportCapability('web-b', USER_B)
    const res = await executeAsUser(USER_A, {
      requestId: 'req-f08-cross-dispatch',
      category: 'ui',
      action: 'click',
      userId: USER_B,
    })
    expect(res.statusCode).toBe(403)
    expect(mockPush).not.toHaveBeenCalled()
    expect(__test__.pending.size).toBe(0)
  })

  it('④ 向后兼容:A 本人不带 responded 的存量回执仍按旧语义受理且计数可见', async () => {
    await reportCapability('web-a', USER_A)
    const executePromise = executeAsService({
      requestId: 'req-f08-own-legacy',
      category: 'ui',
      action: 'describe',
      userId: USER_A,
    })
    await waitPending('req-f08-own-legacy')

    const res = await postResult(USER_A, {
      requestId: 'req-f08-own-legacy',
      success: true,
      durationMs: 3,
      executedBy: 'web',
    })
    expect(res.statusCode).toBe(200)
    expect(res.json<{ data: { accepted: boolean } }>().data.accepted).toBe(true)
    expect((await executePromise).json<{ data: AgentActionResponse }>().data.success).toBe(true)
    expect(__test__.droppedResults.unattributed).toBe(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
