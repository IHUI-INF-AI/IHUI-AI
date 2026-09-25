// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 操控桥接「定址投递 + 回执身份对账」不变量测试(2026-09-26 立)。
 *
 * 本票要回答的问题:「两个端同时在线时,A 端的结果能不能把 B 端的执行结论顶掉」——
 * 答案必须是「不能,且有测试钉着」。下面 ① 是这条不变量的阳性对照(双宿主 + 错配回执
 * 被拒 + 指派者后回仍定终),②③ 是反向对照(指派者不回 → TIMEOUT,不得被顶成成功;
 * 令牌伪造被拒),④⑤ 钉向后兼容(无身份存量回执旧语义不变且计数可见)与丢弃数可见性。
 *
 * 夹具形态与 apps/api/tests/agent-control-ui.test.ts 同款:mock 鉴权、mock
 * pushNotification,不触达生产 PG/Redis(§5 测试隔离铁律)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import type { AgentActionAssignment, AgentActionRequest, AgentActionResponse } from '@ihui/types'

const { mockAuthenticate, mockCheckAuth, mockCheckAuthOrInternal } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn<(request: { userId?: string }) => Promise<unknown>>(),
  mockCheckAuth: vi.fn<(request: { userId?: string }, reply: unknown) => Promise<boolean>>(),
  mockCheckAuthOrInternal:
    vi.fn<(request: { userId?: string }, reply: unknown) => Promise<boolean>>(),
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
const INTERNAL_SECRET = 'agent-control-addressed-test-secret'
const USER_A = '00000000-0000-4000-8000-00000000000a'
const ALL_UI_ACTIONS = ['describe', 'navigate', 'click', 'fill', 'submit', 'read', 'invoke']

const INTERNAL_HEADERS = { authorization: `Bearer ${INTERNAL_SECRET}` }

let app: FastifyInstance
const mockPush = vi.fn<(userId: string, payload: unknown) => void>()

async function reportCapability(instanceId: string) {
  mockCheckAuth.mockImplementation(async (request) => {
    request.userId = USER_A
    return true
  })
  const res = await app.inject({
    method: 'POST',
    url: `${PREFIX}/capability`,
    payload: {
      endpoint: 'web',
      instanceId,
      uiActions: ALL_UI_ACTIONS,
      reportedAt: new Date().toISOString(),
    },
  })
  if (res.statusCode !== 200) throw new Error(`capability 注册失败: ${res.statusCode}`)
}

async function executeCommand(body: {
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

/** /execute 先 push 再登记 pending,微任务落地后才能回传结果 */
async function waitPending(requestId: string): Promise<void> {
  for (let i = 0; i < 200; i++) {
    if (__test__.pending.has(requestId)) return
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  throw new Error(`pending 未登记 requestId=${requestId}`)
}

async function reportResult(body: Record<string, unknown>) {
  const res = await app.inject({ method: 'POST', url: `${PREFIX}/result`, payload: body })
  return res.json<{ data: { accepted: boolean; reasonCode?: string } }>().data
}

/** 从最近一次投递里取服务端写下的定址信封(投递面自证) */
function lastAssignment(): AgentActionAssignment {
  const payload = mockPush.mock.calls.at(-1)?.[1] as { assignment?: AgentActionAssignment }
  expect(payload?.assignment, '投递载荷必须携带 assignment 目标身份').toBeTruthy()
  return payload.assignment as AgentActionAssignment
}

describe('agent-control 定址投递与回执身份 — 双宿主不变量', () => {
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
    // 超时用例可能留下未 clear 的 timer,复位前统一清掉
    for (const p of __test__.pending.values()) clearTimeout(p.timer)
    __test__.pending.clear()
    Object.assign(__test__.droppedResults, {
      tokenMismatch: 0,
      instanceMismatch: 0,
      unattributed: 0,
    })
    mockPush.mockReset()
    mockCheckAuth.mockReset()
    mockCheckAuth.mockImplementation(async (request) => {
      request.userId = USER_A
      return true
    })
    mockCheckAuthOrInternal.mockReset()
    mockCheckAuthOrInternal.mockImplementation(async (request) => {
      request.userId = USER_A
      return true
    })
    mockAuthenticate.mockReset()
    mockAuthenticate.mockRejectedValue(new Error('Authentication required'))
  })

  it('① 阳性对照:同 category 双宿主,A 端先回假成功被拒并计丢弃数,B(指派端)后回才定终', async () => {
    await reportCapability('web-a')
    // 同毫秒并列时择端取严格大于 → 隔开 5ms 使"指派了谁"确定(同 agent-control-ui ⑧ 手法)
    await new Promise((r) => setTimeout(r, 5))
    await reportCapability('web-b') // 后注册心跳更新,择端指向 web-b

    const executePromise = executeCommand({
      requestId: 'req-dual-host',
      category: 'ui',
      action: 'describe',
      userId: USER_A,
    })
    await waitPending('req-dual-host')

    // 判据 1(定址):载荷带"这条给谁"= 端种类 + 实例 ID + 一次性令牌
    const assignment = lastAssignment()
    expect(assignment.endpoint).toBe('web')
    expect(assignment.instanceId).toBe('web-b')
    expect(assignment.token).toMatch(/^[0-9a-f-]{36}$/)
    // 派发时服务端已把期望身份记进 pending(客户端只回显,无第二真相)
    expect(__test__.pending.get('req-dual-host')?.assignment).toEqual(assignment)

    // A 端(未指派)先回一条假成功:令牌是真的(它也收到了广播),但自报实例不符 → 拒
    const rejected = await reportResult({
      requestId: 'req-dual-host',
      success: true,
      durationMs: 5,
      executedBy: 'web',
      data: { marker: 'FAKE-FROM-A' },
      responded: { instanceId: 'web-a', assignmentToken: assignment.token },
    })
    expect(rejected.accepted).toBe(false)
    expect(rejected.reasonCode).toBe('RESPONDER_INSTANCE_MISMATCH')
    // 关键:被拒不得销毁 pending —— 真指派者的慢回执仍要能被接受
    expect(__test__.pending.has('req-dual-host')).toBe(true)
    expect(__test__.droppedResults.instanceMismatch).toBe(1)

    // B 端(指派者)后回真结果 → 受理并 resolve
    const accepted = await reportResult({
      requestId: 'req-dual-host',
      success: true,
      durationMs: 42,
      executedBy: 'web',
      data: { marker: 'REAL-FROM-B' },
      responded: { instanceId: 'web-b', assignmentToken: assignment.token },
    })
    expect(accepted.accepted).toBe(true)

    const body = (await executePromise).json<{ data: AgentActionResponse }>().data
    // 顶掉证明:最终执行结论是 B 的,而不是先到的 A
    expect(body.data?.marker).toBe('REAL-FROM-B')
    expect(body.success).toBe(true)
    expect(__test__.pending.size).toBe(0)
  })

  it('② 反向对照:被指派端不回 → 如实 TIMEOUT,A 端的假成功永远顶不成结论', async () => {
    await reportCapability('web-a')
    // 同毫秒并列时择端取严格大于 → 隔开 5ms 使"指派了谁"确定(同 agent-control-ui ⑧ 手法)
    await new Promise((r) => setTimeout(r, 5))
    await reportCapability('web-b')

    const executePromise = executeCommand({
      requestId: 'req-timeout-standoff',
      category: 'ui',
      action: 'click',
      userId: USER_A,
      timeout: 1000,
    })
    await waitPending('req-timeout-standoff')
    const assignment = lastAssignment()
    expect(assignment.instanceId).toBe('web-b')

    // 非指派端 A 多次伪回执(带自己身份)——每次都被拒、每次都计数
    for (let i = 0; i < 3; i++) {
      const r = await reportResult({
        requestId: 'req-timeout-standoff',
        success: true,
        durationMs: 1,
        executedBy: 'web',
        responded: { instanceId: 'web-a', assignmentToken: assignment.token },
      })
      expect(r.accepted).toBe(false)
      expect(r.reasonCode).toBe('RESPONDER_INSTANCE_MISMATCH')
    }
    expect(__test__.droppedResults.instanceMismatch).toBe(3)

    // 指派端 B 始终不回 → 到点如实 TIMEOUT,而不是被顶成成功
    const body = (await executePromise).json<{ data: AgentActionResponse }>().data
    expect(body.success).toBe(false)
    expect(body.errorCode).toBe('TIMEOUT')
    expect(__test__.pending.size).toBe(0)
  })

  it('③ 令牌对账:没收到过该投递的回执(伪造/串单)按可区分原因码拒,不误配实例检查', async () => {
    await reportCapability('web-a')
    // 同毫秒并列时择端取严格大于 → 隔开 5ms 使"指派了谁"确定(同 agent-control-ui ⑧ 手法)
    await new Promise((r) => setTimeout(r, 5))
    await reportCapability('web-b')

    const executePromise = executeCommand({
      requestId: 'req-bad-token',
      category: 'ui',
      action: 'read',
      userId: USER_A,
    })
    await waitPending('req-bad-token')
    const assignment = lastAssignment()

    // 自报"我是被指派的 web-b"但令牌是编的 → 拒,且原因码区别于实例不符
    const forged = await reportResult({
      requestId: 'req-bad-token',
      success: true,
      durationMs: 1,
      executedBy: 'web',
      responded: {
        instanceId: 'web-b',
        assignmentToken: '00000000-0000-4000-8000-0000000000ff',
      },
    })
    expect(forged.accepted).toBe(false)
    expect(forged.reasonCode).toBe('ASSIGNMENT_TOKEN_MISMATCH')
    expect(__test__.droppedResults.tokenMismatch).toBe(1)
    expect(__test__.droppedResults.instanceMismatch).toBe(0)

    // 真令牌 + 真实例仍须被受理(拒错不误伤对的)
    const ok = await reportResult({
      requestId: 'req-bad-token',
      success: true,
      durationMs: 7,
      executedBy: 'web',
      responded: { instanceId: 'web-b', assignmentToken: assignment.token },
    })
    expect(ok.accepted).toBe(true)
    const body = (await executePromise).json<{ data: AgentActionResponse }>().data
    expect(body.success).toBe(true)
  })

  it('④ 向后兼容:不带回执身份的存量客户端按旧语义受理,但"无身份回执数"如实可见', async () => {
    await reportCapability('web-a')
    const executePromise = executeCommand({
      requestId: 'req-legacy-client',
      category: 'ui',
      action: 'describe',
      userId: USER_A,
    })
    await waitPending('req-legacy-client')

    const r = await reportResult({
      requestId: 'req-legacy-client',
      success: true,
      durationMs: 3,
      executedBy: 'web',
    })
    expect(r.accepted).toBe(true)
    expect((await executePromise).json<{ data: AgentActionResponse }>().data.success).toBe(true)
    // 静默绿是本票最禁止的形态:旧通道保留,但它必须可数
    expect(__test__.droppedResults.unattributed).toBe(1)
  })

  it('⑤ 丢弃数经 /status 对外可见(管理/调试面不留盲区)', async () => {
    await reportCapability('web-a')
    // 同毫秒并列时择端取严格大于 → 隔开 5ms 使"指派了谁"确定(同 agent-control-ui ⑧ 手法)
    await new Promise((r) => setTimeout(r, 5))
    await reportCapability('web-b')
    const executePromise = executeCommand({
      requestId: 'req-visible-drops',
      category: 'ui',
      action: 'describe',
      userId: USER_A,
    })
    await waitPending('req-visible-drops')
    const assignment = lastAssignment()
    await reportResult({
      requestId: 'req-visible-drops',
      success: true,
      durationMs: 1,
      executedBy: 'web',
      responded: { instanceId: 'web-a', assignmentToken: assignment.token },
    })

    const st = await app.inject({ method: 'GET', url: `${PREFIX}/status` })
    const data = st.json<{
      data: {
        droppedResults: { tokenMismatch: number; instanceMismatch: number; unattributed: number }
      }
    }>().data
    expect(data.droppedResults.instanceMismatch).toBe(1)
    expect(data.droppedResults.tokenMismatch).toBe(0)

    // 收尾:指派端正常回执,避免 pending/timer 泄漏
    await reportResult({
      requestId: 'req-visible-drops',
      success: true,
      durationMs: 1,
      executedBy: 'web',
      responded: { instanceId: 'web-b', assignmentToken: assignment.token },
    })
    await executePromise
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
