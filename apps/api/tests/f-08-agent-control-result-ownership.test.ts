// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-08（`/api/agent-control/result` 缺归属绑定，可伪结算他人待处理动作）不变量用例。
 *
 * 缺陷台账：docs/tickets/2026-11/findings-api.md §F-08。
 * 这里只钉三件事：
 *  ① 写端：pending 必须记下这条指令的属主（不只有 requestId）；
 *  ② 读端：B 拿着 A 的 requestId 回传结果，带不带 responded 都不得结算 A 的 pending
 *     （拒绝后 A 的 pending 仍在，A 本人随后仍能正常结算）；
 *  ③ 历史在途条目（pending 自身没有 userId）必须 fail-closed 拒绝，不得因"两侧缺省相等"放行。
 *
 * 夹具形态与 agent-control-addressed-delivery.test.ts 同款：mock 鉴权、mock pushNotification，
 * pending 一律走真实 /execute 路径创建（无 userId 的历史条目是唯一例外，直接落表模拟）。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import type { AgentActionAssignment, AgentActionRequest, AgentActionResponse } from '@ihui/types'

const { mockAuthenticate, mockCheckAuth, mockCheckAuthOrInternal } = vi.hoisted(() => ({
  mockAuthenticate:
    vi.fn<(request: { userId?: string; headers: Record<string, unknown> }) => Promise<unknown>>(),
  mockCheckAuth:
    vi.fn<
      (
        request: { userId?: string; headers: Record<string, unknown> },
        reply: unknown,
      ) => Promise<boolean>
    >(),
  mockCheckAuthOrInternal:
    vi.fn<
      (
        request: { userId?: string; headers: Record<string, unknown> },
        reply: unknown,
      ) => Promise<boolean>
    >(),
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
import type { PendingRequest } from '../src/routes/agent-control.js'

const PREFIX = '/api/agent-control'
const INTERNAL_SECRET = 'f-08-agent-control-result-ownership-secret'
const USER_A = '00000000-0000-4000-8000-00000000000a'
const USER_B = '00000000-0000-4000-8000-00000000000b'
const ALL_UI_ACTIONS = ['describe', 'navigate', 'click', 'fill', 'submit', 'read', 'invoke']

let app: FastifyInstance
const mockPush = vi.fn<(userId: string, payload: unknown) => void>()

/** 登录身份取自 x-probe-user（缺省 USER_A） */
function probeUser(request: { headers: Record<string, unknown> }): string {
  const raw = request.headers['x-probe-user']
  return typeof raw === 'string' ? raw : USER_A
}

async function reportCapability(instanceId: string, user: string): Promise<void> {
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

/** ai-service 内部凭据派发（body.userId 声明目标用户），走真实路径写入 pending */
function executeAsService(body: {
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
    headers: { authorization: `Bearer ${INTERNAL_SECRET}` },
  })
}

/** /execute 先 push 再登记 pending，微任务落地后才能回传结果 */
async function waitPending(requestId: string): Promise<void> {
  for (let i = 0; i < 200; i++) {
    if (__test__.pending.has(requestId)) return
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  throw new Error(`pending 未登记 requestId=${requestId}`)
}

function postResult(user: string, body: Record<string, unknown>) {
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

/** 直接落一条"升级前写入"的历史 pending（没有 userId 字段） */
function seedPendingWithoutOwner(requestId: string): {
  resolve: ReturnType<typeof vi.fn>
  timer: NodeJS.Timeout
} {
  const resolve = vi.fn<(response: AgentActionResponse) => void>()
  const timer = setTimeout(() => {}, 60_000)
  const legacy = {
    resolve,
    reject: vi.fn(),
    timer,
    startedAt: Date.now(),
    assignment: { endpoint: 'web', instanceId: 'web-a', token: 'legacy-token-without-owner' },
  } as unknown as PendingRequest
  __test__.pending.set(requestId, legacy)
  return { resolve, timer }
}

describe('agent-control /result 归属绑定 — F-08', () => {
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

  afterEach(() => {
    for (const p of __test__.pending.values()) clearTimeout(p.timer)
    __test__.pending.clear()
  })

  it('写端：pending 记录属主（A 的指令记 USER_A，不是回执者）', async () => {
    await reportCapability('web-a', USER_A)
    const executePromise = executeAsService({
      requestId: 'req-f08-owner-recorded',
      category: 'ui',
      action: 'describe',
      userId: USER_A,
    })
    await waitPending('req-f08-owner-recorded')

    expect(__test__.pending.get('req-f08-owner-recorded')?.userId).toBe(USER_A)

    await postResult(USER_A, {
      requestId: 'req-f08-owner-recorded',
      success: true,
      durationMs: 1,
      executedBy: 'web',
    })
    await executePromise
  })

  it('B 用 A 的 requestId（不带 responded）→ 拒绝，A 的 pending 仍在且随后可由 A 结算', async () => {
    await reportCapability('web-a', USER_A)
    const executePromise = executeAsService({
      requestId: 'req-f08-cross-legacy',
      category: 'ui',
      action: 'describe',
      userId: USER_A,
    })
    await waitPending('req-f08-cross-legacy')

    const forged = await postResult(USER_B, {
      requestId: 'req-f08-cross-legacy',
      success: true,
      durationMs: 1,
      executedBy: 'web',
      data: { marker: 'FAKE-FROM-B' },
    })
    // 拒绝形态：台账写 403；现行实现取 404（与"不存在"同形，不泄漏他人 pending 是否存在）
    expect([403, 404]).toContain(forged.statusCode)
    expect(forged.json<{ data?: { accepted?: boolean } }>().data?.accepted).not.toBe(true)
    expect(__test__.droppedResults.ownerMismatch).toBe(1)
    // 不 resolve、不 delete：真正的属主仍可完成
    expect(__test__.pending.has('req-f08-cross-legacy')).toBe(true)

    const real = await postResult(USER_A, {
      requestId: 'req-f08-cross-legacy',
      success: true,
      durationMs: 2,
      executedBy: 'web',
      data: { marker: 'REAL-FROM-A' },
    })
    expect(real.statusCode).toBe(200)
    expect(real.json<{ data: { accepted: boolean } }>().data.accepted).toBe(true)
    const outcome = (await executePromise).json<{ data: AgentActionResponse }>().data
    expect(outcome.data?.marker).toBe('REAL-FROM-A')
  })

  it('B 携带完整 responded（真令牌 + 真实例）仍被拒：归属校验先于 responded 分支', async () => {
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
    expect([403, 404]).toContain(forged.statusCode)
    expect(__test__.droppedResults.ownerMismatch).toBe(1)
    expect(__test__.droppedResults.tokenMismatch).toBe(0)
    expect(__test__.pending.has('req-f08-cross-responded')).toBe(true)

    const real = await postResult(USER_A, {
      requestId: 'req-f08-cross-responded',
      success: true,
      durationMs: 3,
      executedBy: 'web',
      data: { marker: 'REAL-FROM-A' },
      responded: { instanceId: assignment.instanceId, assignmentToken: assignment.token },
    })
    expect(real.json<{ data: { accepted: boolean } }>().data.accepted).toBe(true)
    const outcome = (await executePromise).json<{ data: AgentActionResponse }>().data
    expect(outcome.data?.marker).toBe('REAL-FROM-A')
  })

  it('A 本人提交 → 正常结算（成功路径响应结构不变）', async () => {
    await reportCapability('web-a', USER_A)
    const executePromise = executeAsService({
      requestId: 'req-f08-own',
      category: 'ui',
      action: 'click',
      userId: USER_A,
    })
    await waitPending('req-f08-own')

    const res = await postResult(USER_A, {
      requestId: 'req-f08-own',
      success: true,
      durationMs: 5,
      executedBy: 'web',
    })
    expect(res.statusCode).toBe(200)
    expect(res.json<{ data: { accepted: boolean } }>().data).toEqual({ accepted: true })
    expect(__test__.pending.has('req-f08-own')).toBe(false)
    const outcome = (await executePromise).json<{ data: AgentActionResponse }>().data
    expect(outcome.success).toBe(true)
    expect(outcome.durationMs).toBe(5)
  })

  it('旧客户端兼容：A 本人不带 responded 仍按旧语义受理，unattributed 计数可见', async () => {
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
    expect(res.json<{ data: { accepted: boolean } }>().data.accepted).toBe(true)
    expect(__test__.droppedResults.unattributed).toBe(1)
    expect(__test__.droppedResults.ownerMismatch).toBe(0)
    await executePromise
  })

  it('历史在途条目缺 userId → fail-closed 拒绝，不 resolve、不删除', async () => {
    const seeded = seedPendingWithoutOwner('req-f08-legacy-no-owner')

    const res = await postResult(USER_A, {
      requestId: 'req-f08-legacy-no-owner',
      success: true,
      durationMs: 1,
      executedBy: 'web',
    })
    expect([403, 404]).toContain(res.statusCode)
    expect(seeded.resolve).not.toHaveBeenCalled()
    expect(__test__.pending.has('req-f08-legacy-no-owner')).toBe(true)
    expect(__test__.droppedResults.ownerMismatch).toBe(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
