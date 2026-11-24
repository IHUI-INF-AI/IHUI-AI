// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * super-agent 控制面路由层测试（2026-11-07 补票）。
 *
 * 做法：真路由插件 + 假 host（注入确定性时钟）+ 打桩 auth/派单下游。
 * 覆盖 14 条路径的鉴权主体、越权、入参校验、错误码，以及两条工程欠账的实际行为：
 *  - 隔离：两个工人派发时带各自的 sessionId/绝对目录，目录真实落地且互不相同；
 *  - 并发闸：路由改策略后，宿主 maxWorkers 与下游租户上限读同一个数（引擎到限即不开工）。
 */
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SUPER_AGENT_POLICY, SuperAgentHost } from '@ihui/shared/super-agent'
import { superAgentRoutes } from '../src/routes/super-agent.js'
import { __installSuperAgentHostForTests } from '../src/services/super-agent-pump-service.js'

type MockDispatchInput = {
  sessionId?: string
  directory?: string
  [key: string]: unknown
}

const { mockDispatch, mockSetResolver } = vi.hoisted(() => ({
  mockDispatch: vi.fn<(input: MockDispatchInput) => Promise<unknown>>(async () => ({
    outcome: 'ok',
    dispatch: { id: 'dispatch-1' },
  })),
  mockSetResolver: vi.fn<(resolver?: unknown) => void>(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: FastifyRequest): Promise<void> => {
    const raw = request.headers['x-test-user']
    if (typeof raw !== 'string' || raw === '') {
      const err = new Error('未登录') as Error & { statusCode: number }
      err.statusCode = 401
      throw err
    }
    ;(request as unknown as { userId: string }).userId = raw
  },
}))

vi.mock('../src/services/subagent-dispatch-service.js', () => ({
  subagentDispatchService: { dispatch: mockDispatch },
  setTenantConcurrencyLimitResolver: mockSetResolver,
}))

vi.mock('../src/db/user-preferences-queries.js', () => ({
  USER_PREFERENCE_GROUPS: { superAgent: 'super-agent' },
  findUserPreferences: vi.fn(async () => ({ list: [] })),
  upsertUserPreference: vi.fn(async () => undefined),
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const USER_A = 'user-a'
const USER_B = 'user-b'

let app: FastifyInstance
let workspaceRoot = ''
let clockNow = 1_000_000
let seq = 0

function installHost(): SuperAgentHost {
  const host = new SuperAgentHost(undefined, {
    now: () => clockNow,
    id: (prefix: string) => `${prefix}-${++seq}`,
  })
  __installSuperAgentHostForTests(host)
  return host
}

function trigger(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: `trg-${++seq}`,
    sourceId: 'src-1',
    threadId: `thread-${seq}`,
    actorId: USER_A,
    addressed: true,
    fromBot: false,
    text: '把这件事做完',
    ...over,
  }
}

async function call(
  method: 'GET' | 'POST',
  url: string,
  user: string | null,
  payload?: Record<string, unknown>,
) {
  const headers: Record<string, string> = user ? { 'x-test-user': user } : {}
  const res = await app.inject({
    method,
    url,
    headers,
    ...(payload === undefined ? {} : { payload }),
  })
  return { status: res.statusCode, body: res.json() as Record<string, unknown> }
}

beforeEach(async () => {
  workspaceRoot = mkdtempSync(join(tmpdir(), 'ihui-sa-routes-'))
  process.env.IHUI_SUPER_AGENT_WORKSPACE_ROOT = workspaceRoot
  mockDispatch.mockClear()
  mockDispatch.mockResolvedValue({ outcome: 'ok', dispatch: { id: 'dispatch-1' } })
  installHost()
  app = Fastify({ logger: false })
  await app.register(superAgentRoutes)
  await app.ready()
})

afterEach(async () => {
  await app.close()
  rmSync(workspaceRoot, { recursive: true, force: true })
  delete process.env.IHUI_SUPER_AGENT_WORKSPACE_ROOT
})

describe('鉴权与主体来源', () => {
  it('未登录一律 401，且不触碰宿主', async () => {
    const res = await call('GET', '/super-agent/panel', null)
    expect(res.status).toBe(401)
    expect(res.body.code).toBe(401)
  })

  it('主体取自登录态，请求体actorId与登录不符只记不派（默认 allowlist）', async () => {
    const res = await call('POST', '/super-agent/triggers', USER_A, trigger({ actorId: USER_B }))
    expect(res.status).toBe(200)
    const data = res.body.data as Record<string, unknown>
    expect(data.disposition).toBe('filtered')
    expect(data.reason).toBe('actor_mismatch')
    // 没有被冒名顶替进 user-b 的账单，也没有占执行槽派发
    const panelB = await call('GET', '/super-agent/panel', USER_B)
    expect((panelB.body.data as { needsPerson: unknown[] }).needsPerson).toEqual([])
    expect(mockDispatch).not.toHaveBeenCalled()
  })
})

describe('入参校验与错误码', () => {
  it('触发缺字段 → 400', async () => {
    const res = await call('POST', '/super-agent/triggers', USER_A, { id: 'x' })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe(400)
  })

  it('策略越界 → 400', async () => {
    const res = await call('POST', '/super-agent/policy', USER_A, {
      ...DEFAULT_SUPER_AGENT_POLICY,
      maxWorkers: 0,
    })
    expect(res.status).toBe(400)
  })

  it('replies 缺 sourceId/threadId → 400；report 非法 state → 400', async () => {
    const replies = await call('GET', '/super-agent/replies?sourceId=only', USER_A)
    expect(replies.status).toBe(400)
    const host = installHost()
    host.applyPolicy(USER_A, { ...DEFAULT_SUPER_AGENT_POLICY })
    const created = await call('POST', '/super-agent/triggers', USER_A, trigger())
    const ticketId = (created.body.data as { ticketId: string }).ticketId
    const report = await call('POST', `/super-agent/tickets/${ticketId}/report`, USER_A, {
      state: 'done',
      text: 'x',
    })
    expect(report.status).toBe(400)
  })
})

describe('越权主体读不到别人的工单', () => {
  it('跨租户 assignment/lease 404，report/stop/heartbeat 只回 filtered', async () => {
    const created = await call('POST', '/super-agent/triggers', USER_A, trigger())
    const ticketId = (created.body.data as { ticketId: string }).ticketId
    expect(ticketId).toBeTruthy()

    expect((await call('GET', `/super-agent/tickets/${ticketId}/assignment`, USER_B)).status).toBe(
      404,
    )
    expect((await call('GET', `/super-agent/tickets/${ticketId}/lease`, USER_B)).status).toBe(404)

    const report = await call('POST', `/super-agent/tickets/${ticketId}/report`, USER_B, {
      state: 'ready',
      text: '冒充回报',
    })
    expect((report.body.data as { disposition: string }).disposition).toBe('filtered')
    const stop = await call('POST', `/super-agent/tickets/${ticketId}/stop`, USER_B, {})
    expect((stop.body.data as { disposition: string }).disposition).toBe('filtered')
    const heartbeat = await call('POST', `/super-agent/tickets/${ticketId}/heartbeat`, USER_B)
    expect((heartbeat.body.data as { ok: boolean }).ok).toBe(false)
    const failed = await call('POST', `/super-agent/tickets/${ticketId}/delivery-failed`, USER_B, {
      error: 'x',
    })
    expect((failed.body.data as { disposition: string }).disposition).toBe('filtered')
  })
})

describe('14 条路径的正常行为', () => {
  it('触发→assignment→replies→report/panel→context→attach→handback→delivery-failed→stop', async () => {
    const host = installHost()
    host.applyPolicy(USER_A, { ...DEFAULT_SUPER_AGENT_POLICY, workerLeaseMs: 60_000 })
    const body = trigger({ threadId: 'thread-main' })
    const created = await call('POST', '/super-agent/triggers', USER_A, body)
    expect(created.status).toBe(200)
    const createdData = created.body.data as Record<string, unknown>
    expect(createdData.disposition).toBe('accepted')
    const ticketId = createdData.ticketId as string

    // replies（应答已入 outbox）
    const replies = await call(
      'GET',
      '/super-agent/replies?sourceId=src-1&threadId=thread-main',
      USER_A,
    )
    expect(replies.status).toBe(200)
    expect((replies.body.data as unknown[]).length).toBeGreaterThan(0)

    // assignment：真实带出隔离身份
    const assignment = await call('GET', `/super-agent/tickets/${ticketId}/assignment`, USER_A)
    expect(assignment.status).toBe(200)
    const work = assignment.body.data as Record<string, unknown>
    expect(work.sessionId).toBe(`worker-${ticketId}`)
    expect(work.directory).toBe(`super-agent/${USER_A}/${ticketId}`)

    // lease：按注入时钟推进，剩余额度可算
    clockNow += 1_000
    const lease = await call('GET', `/super-agent/tickets/${ticketId}/lease`, USER_A)
    expect(lease.status).toBe(200)
    expect((lease.body.data as { remainingMs: number }).remainingMs).toBe(59_000)

    // heartbeat：running 且有租约 → 续租成功
    const heartbeat = await call('POST', `/super-agent/tickets/${ticketId}/heartbeat`, USER_A)
    expect((heartbeat.body.data as { ok: boolean }).ok).toBe(true)

    // report(waiting+question) 让人进面板
    const report = await call('POST', `/super-agent/tickets/${ticketId}/report`, USER_A, {
      state: 'waiting',
      text: '需要确认',
      question: '选哪个方案?',
    })
    expect(report.status).toBe(200)
    expect(['accepted', 'fanout']).toContain(
      (report.body.data as { disposition: string }).disposition,
    )
    const panel = await call('GET', '/super-agent/panel', USER_A)
    const needsPerson = (panel.body.data as { needsPerson: { ticketId: string }[] }).needsPerson
    expect(needsPerson.map((row) => row.ticketId)).toContain(ticketId)

    // context：相关线程只提供上下文
    const ctx = await call('POST', `/super-agent/tickets/${ticketId}/context`, USER_A, {
      sourceId: 'src-1',
      threadId: 'thread-related',
    })
    expect((ctx.body.data as { disposition: string }).disposition).toBe('context')

    // attach：新触发并入既有工单（不新开授权）
    const attach = await call('POST', `/super-agent/tickets/${ticketId}/attach`, USER_A, {
      ...trigger(),
      threadId: 'thread-main',
    })
    expect(attach.status).toBe(200)
    expect(['fanout', 'duplicate', 'filtered']).toContain(
      (attach.body.data as { disposition: string }).disposition,
    )

    // handback：工人交还触发
    const handback = await call('POST', `/super-agent/tickets/${ticketId}/handback`, USER_A, {
      triggerId: body.id as string,
      reason: '换人做',
    })
    expect(handback.status).toBe(200)

    // delivery-failed
    const failed = await call('POST', `/super-agent/tickets/${ticketId}/delivery-failed`, USER_A, {
      error: '下游超时',
    })
    expect(failed.status).toBe(200)

    // stop
    const stop = await call('POST', `/super-agent/tickets/${ticketId}/stop`, USER_A, {
      reason: '不做了',
    })
    expect(stop.status).toBe(200)
  })

  it('policy 路由生效并回报 notified', async () => {
    const created = await call('POST', '/super-agent/triggers', USER_A, trigger())
    const ticketId = (created.body.data as { ticketId: string }).ticketId
    const res = await call('POST', '/super-agent/policy', USER_A, {
      ...DEFAULT_SUPER_AGENT_POLICY,
      version: 'v2',
    })
    expect(res.status).toBe(200)
    expect((res.body.data as { notified: string[] }).notified).toContain(ticketId)
  })

  it('recorded/:id/accept：推断积压在 auto 档下可开工', async () => {
    const body = trigger({ addressed: false, threadId: 'thread-recorded' })
    const recorded = await call('POST', '/super-agent/triggers', USER_A, body)
    expect((recorded.body.data as { disposition: string }).disposition).toBe('recorded')

    await call('POST', '/super-agent/policy', USER_A, {
      ...DEFAULT_SUPER_AGENT_POLICY,
      acceptMode: 'auto',
    })
    const accepted = await call(
      'POST',
      `/super-agent/recorded/${body.id as string}/accept`,
      USER_A,
      { ruleId: 'rule-1' },
    )
    expect(accepted.status).toBe(200)
    expect((accepted.body.data as { disposition: string }).disposition).toBe('accepted')
  })
})

describe('隔离与并发闸的接线行为', () => {
  it('两个工人的同名文件落在各自目录（路由派发链真实落地）', async () => {
    const host = installHost()
    host.applyPolicy(USER_A, { ...DEFAULT_SUPER_AGENT_POLICY })
    const first = await call(
      'POST',
      '/super-agent/triggers',
      USER_A,
      trigger({ threadId: 'thread-iso-a' }),
    )
    const second = await call(
      'POST',
      '/super-agent/triggers',
      USER_A,
      trigger({ threadId: 'thread-iso-b' }),
    )
    const firstData = first.body.data as { dispatched: { sessionId: string }[] }
    const secondData = second.body.data as { dispatched: { sessionId: string }[] }
    expect(firstData.dispatched).toHaveLength(1)
    expect(secondData.dispatched).toHaveLength(1)
    expect(firstData.dispatched[0]!.sessionId).not.toBe(secondData.dispatched[0]!.sessionId)

    const calls = mockDispatch.mock.calls.map((c) => c[0])
    expect(calls).toHaveLength(2)
    const dirs = calls.map((c) => c.directory as string)
    expect(new Set(dirs).size).toBe(2)
    for (const dir of dirs) {
      expect(dir.startsWith(workspaceRoot)).toBe(true)
      expect(existsSync(dir)).toBe(true)
    }
    expect(calls.every((c) => typeof c.sessionId === 'string')).toBe(true)
  })

  it('路由改策略后宿主到限即不再开工，下游解析器读同一上限', async () => {
    const host = installHost()
    const policy = await call('POST', '/super-agent/policy', USER_A, {
      ...DEFAULT_SUPER_AGENT_POLICY,
      maxWorkers: 1,
    })
    expect(policy.status).toBe(200)
    expect(host.maxWorkersFor(USER_A)).toBe(1)

    const first = await call(
      'POST',
      '/super-agent/triggers',
      USER_A,
      trigger({ threadId: 'thread-gate-1' }),
    )
    const second = await call(
      'POST',
      '/super-agent/triggers',
      USER_A,
      trigger({ threadId: 'thread-gate-2' }),
    )
    expect((first.body.data as { dispatched: unknown[] }).dispatched).toHaveLength(1)
    // 宿主 maxWorkers=1：第二张已接收但排队，不再占据执行槽
    expect((second.body.data as { dispatched: unknown[] }).dispatched).toHaveLength(0)
    expect(mockDispatch.mock.calls).toHaveLength(1)

    // 下游租户闸注册时读的就是宿主 maxWorkers（单一真相源，非另一份默认值）
    const resolver = mockSetResolver.mock.calls[0]?.[0] as
      ((owner: string | undefined) => number | undefined) | undefined
    expect(typeof resolver).toBe('function')
    expect(resolver!(USER_A)).toBe(1)
    expect(resolver!(undefined)).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
