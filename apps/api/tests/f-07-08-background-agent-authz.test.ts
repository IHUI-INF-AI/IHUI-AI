// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-07 / F-08 回归锁(2026-11-08,apps/api P1 越权组)。
 *
 * F-07 `background-agents` 的 list/get/cancel 只按 agentId,任何人可看/可停他人长任务;
 *      创建时 `userUuid` 还取自 body,可伪造归属。
 * F-08 `agent-control/result` 只校验登录态,知道 requestId 的任意用户可伪结算他人动作
 *      (不带 `responded` 时直接走"存量客户端"分支 resolve)。
 *
 * 判据(与 F-04/F-05 同口径):非属主一律 403,且不结算、不删 pending;
 * 属主本人恒放行;F-07 创建归属只取认证身份。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const ME = '00000000-0000-4000-8000-0000000000aa'
const VICTIM = '00000000-0000-4000-8000-0000000000bb'

type FakeAgent = {
  agentId: string
  prompt: string
  workspacePath: string
  modelId: string
  userUuid: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  createdAt: number
  events: unknown[]
  result: string | null
}

const h = vi.hoisted(() => {
  const agents = new Map<string, any>()
  const startCalls: Array<Record<string, unknown>> = []
  return {
    agents,
    startCalls,
    manager: {
      start(params: Record<string, unknown>) {
        const agentId = `agent-${agents.size + 1}`
        agents.set(agentId, {
          agentId,
          prompt: params.prompt,
          workspacePath: params.workspacePath,
          modelId: params.modelId ?? 'default',
          userUuid: params.userUuid,
          status: 'running',
          createdAt: 1,
          events: [],
          result: null,
        })
        startCalls.push(params)
        return agentId
      },
      list(userId: string) {
        return Array.from(agents.values()).filter((a) => a.userUuid === userId)
      },
      get(agentId: string) {
        return agents.get(agentId) ?? null
      },
      cancel(agentId: string) {
        const agent = agents.get(agentId)
        if (!agent || agent.status !== 'running') return false
        agent.status = 'cancelled'
        return true
      },
    },
  }
})

const state = vi.hoisted(() => ({ userId: '00000000-0000-4000-8000-0000000000aa' }))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: { userId?: string }) => {
    request.userId = state.userId
  }),
  checkAuth: vi.fn(async (request: { userId?: string }) => {
    request.userId = state.userId
    return true
  }),
  checkAuthOrInternalService: vi.fn(async () => true),
  requireActiveUser: vi.fn(async () => {}),
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  resolveAdminRoleId: vi.fn(() => 0),
  ADMIN_ROLE_ID: 1,
  requireAuth: vi.fn(async () => {}),
  requireAdmin: vi.fn(async () => {}),
  isSystemAdmin: vi.fn(async () => false),
}))

vi.mock('../src/db/index.js', () => {
  function makeChain() {
    const chain: Record<string, unknown> = {}
    chain.from = () => chain
    chain.where = () => chain
    chain.orderBy = () => chain
    chain.limit = () => chain
    chain.offset = () => chain
    chain.then = (resolve: (v: unknown) => void) => resolve([])
    return chain
  }
  const db = {
    execute: vi.fn(async () => []),
    select: vi.fn(() => makeChain()),
    insert: vi.fn(() => makeChain()),
    update: vi.fn(() => makeChain()),
    delete: vi.fn(() => makeChain()),
  }
  return { db, dbRead: db }
})

vi.mock('../src/services/agent-service.js', () => ({
  calculateAgentPermission: vi.fn(async (agentId: string, userId: string) => ({
    agentId,
    userId,
    hasPermission: true,
  })),
}))

vi.mock('../src/services/context-manager-service.js', () => ({
  getConversationHistory: vi.fn(async () => []),
}))

vi.mock('../src/services/workspace-ai-service.js', () => ({
  swarmManager: {},
  subagentManager: {},
  agentLoop: {},
  sandboxExecutor: {},
  computerUse: {},
  codebaseIndexer: {},
  incrementalIndexer: {},
  vectorIndexer: {},
  checkpointManager: {},
  backgroundAgentManager: h.manager,
  permissionManager: { setPushFn: vi.fn(), check: vi.fn() },
  personaRegistry: {},
  routineManager: {},
  githubClient: {},
  fsBridge: {},
  SubagentWorkspaceAccessError: class extends Error {},
  SubagentLinkError: class extends Error {},
}))

vi.mock('../src/services/self-healing.js', () => ({
  detectWorkspaceIssues: vi.fn(),
  repairWorkspaceIssue: vi.fn(),
}))

vi.mock('../src/services/atomic-rollback.js', () => ({
  createAtomicCheckpoint: vi.fn(),
  listAtomicCheckpoints: vi.fn(),
  planAtomicRollback: vi.fn(),
  executeAtomicRollback: vi.fn(),
}))

import { workspaceAiRoutes } from '../src/routes/workspace-ai.js'
import { agentControlRoutes, __test__ } from '../src/routes/agent-control.js'
import agentExtendedPlugin from '../src/routes/agent-extended.js'
import { calculateAgentPermission } from '../src/services/agent-service.js'

type Handler = (request: unknown, reply: unknown) => unknown
type Reply = {
  code: number
  body: any
  sent: boolean
  status: (c: number) => Reply
  send: (b: unknown) => Reply
}

function makeServer() {
  const handlers = new Map<string, Handler>()
  const register = (method: string) => (path: string, a: unknown, b?: unknown) =>
    handlers.set(`${method} ${path}`, (b ?? a) as Handler)
  const pushNotification = vi.fn()
  const server: Record<string, unknown> = {
    addHook: vi.fn(),
    decorate: vi.fn(),
    get: vi.fn(register('GET')),
    post: vi.fn(register('POST')),
    put: vi.fn(register('PUT')),
    patch: vi.fn(register('PATCH')),
    delete: vi.fn(register('DELETE')),
    pushNotification,
    log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  }
  return { server, handlers, pushNotification }
}

function makeReply(): Reply {
  const reply: Reply = {
    code: 200,
    body: undefined,
    sent: false,
    status(c: number) {
      this.code = c
      return this
    },
    send(b: unknown) {
      this.body = b
      this.sent = true
      return this
    },
  }
  return reply
}

const requestLog = { warn: vi.fn(), error: vi.fn(), info: vi.fn() }

beforeEach(() => {
  state.userId = ME
  h.agents.clear()
  h.startCalls.length = 0
  vi.mocked(calculateAgentPermission).mockClear()
  __test__.pending.clear()
  __test__.endpoints.clear()
  for (const key of Object.keys(__test__.droppedResults) as Array<
    keyof typeof __test__.droppedResults
  >) {
    __test__.droppedResults[key] = 0
  }
})

afterEach(() => {
  for (const pending of __test__.pending.values()) clearTimeout(pending.timer)
  __test__.pending.clear()
})

async function setupWorkspace() {
  const { server, handlers } = makeServer()
  await workspaceAiRoutes(server as never)
  return handlers
}

async function setupAgentControl() {
  const { server, handlers } = makeServer()
  await agentControlRoutes(server as never)
  return handlers
}

describe('F-07 background-agents 必须按调用者归属收敛', () => {
  it('他人创建 → 创建归属仍记本人(body.userUuid 被忽略)', async () => {
    const handlers = await setupWorkspace()
    const reply = makeReply()
    await handlers.get('POST /background-agents')!(
      {
        body: {
          prompt: 'p',
          workspacePath: '/tmp/w',
          userUuid: VICTIM,
        },
        userId: ME,
        log: requestLog,
      },
      reply,
    )
    expect(reply.code).toBe(201)
    expect(h.startCalls.at(-1)?.userUuid).toBe(ME)
    expect(h.agents.get('agent-1')?.userUuid).toBe(ME)
  })

  it('列表只返回本人的 Agent', async () => {
    h.manager.start({ prompt: 'mine', workspacePath: '/w', userUuid: ME })
    h.manager.start({ prompt: 'victim', workspacePath: '/w', userUuid: VICTIM })
    const handlers = await setupWorkspace()

    const meReply = makeReply()
    await handlers.get('GET /background-agents')!({ userId: ME, log: requestLog }, meReply)
    expect(meReply.code).toBe(200)
    expect(meReply.body.data.agents.map((a: FakeAgent) => a.userUuid)).toEqual([ME])

    state.userId = VICTIM
    const victimReply = makeReply()
    await handlers.get('GET /background-agents')!({ userId: VICTIM, log: requestLog }, victimReply)
    expect(victimReply.body.data.agents.map((a: FakeAgent) => a.prompt)).toEqual(['victim'])
  })

  it('查看他人 Agent → 403;本人 → 200;不存在 → 404', async () => {
    h.manager.start({ prompt: 'victim', workspacePath: '/w', userUuid: VICTIM })
    const handlers = await setupWorkspace()

    const denied = makeReply()
    await handlers.get('GET /background-agents/:agentId')!(
      { params: { agentId: 'agent-1' }, userId: ME, log: requestLog },
      denied,
    )
    expect(denied.code).toBe(403)

    state.userId = VICTIM
    const allowed = makeReply()
    await handlers.get('GET /background-agents/:agentId')!(
      { params: { agentId: 'agent-1' }, userId: VICTIM, log: requestLog },
      allowed,
    )
    expect(allowed.code).toBe(200)
    expect(allowed.body.data.agentId).toBe('agent-1')

    const missing = makeReply()
    await handlers.get('GET /background-agents/:agentId')!(
      { params: { agentId: 'nope' }, userId: VICTIM, log: requestLog },
      missing,
    )
    expect(missing.code).toBe(404)
  })

  it('取消他人 Agent → 403 且仍 running;本人 → 取消成功', async () => {
    h.manager.start({ prompt: 'victim', workspacePath: '/w', userUuid: VICTIM })
    const handlers = await setupWorkspace()

    const denied = makeReply()
    await handlers.get('POST /background-agents/:agentId/cancel')!(
      { params: { agentId: 'agent-1' }, userId: ME, log: requestLog },
      denied,
    )
    expect(denied.code).toBe(403)
    expect(h.agents.get('agent-1')?.status).toBe('running')

    state.userId = VICTIM
    const allowed = makeReply()
    await handlers.get('POST /background-agents/:agentId/cancel')!(
      { params: { agentId: 'agent-1' }, userId: VICTIM, log: requestLog },
      allowed,
    )
    expect(allowed.code).toBe(200)
    expect(h.agents.get('agent-1')?.status).toBe('cancelled')
  })
})

describe('F-07 同族 agent-extended/permission 身份不得回退 query', () => {
  async function setupAgentExtended() {
    const { server, handlers } = makeServer()
    await agentExtendedPlugin(server as never)
    return handlers
  }

  it('query 指定他人 → 403 且不计算权限', async () => {
    const handlers = await setupAgentExtended()
    const reply = makeReply()
    await handlers.get('GET /permission/:agentId')!(
      { params: { agentId: 'a1' }, query: { userId: VICTIM }, userId: ME, log: requestLog },
      reply,
    )
    expect(reply.code).toBe(403)
    expect(calculateAgentPermission).not.toHaveBeenCalled()
  })

  it('无认证主体 → 401,即使 query 带了合法 userId 也不回退', async () => {
    const handlers = await setupAgentExtended()
    const reply = makeReply()
    await handlers.get('GET /permission/:agentId')!(
      {
        params: { agentId: 'a1' },
        query: { userId: VICTIM },
        userId: undefined,
        log: requestLog,
      },
      reply,
    )
    expect(reply.code).toBe(401)
    expect(calculateAgentPermission).not.toHaveBeenCalled()
  })

  it('本人(不带 query / query 是本人)→ 放行,主体恒为本人', async () => {
    const handlers = await setupAgentExtended()

    const noQuery = await handlers.get('GET /permission/:agentId')!(
      { params: { agentId: 'a1' }, query: {}, userId: ME, log: requestLog },
      makeReply(),
    )
    expect((noQuery as { data: { userId: string } }).data.userId).toBe(ME)
    expect(calculateAgentPermission).toHaveBeenCalledWith('a1', ME)

    const ownQuery = await handlers.get('GET /permission/:agentId')!(
      { params: { agentId: 'a2' }, query: { userId: ME }, userId: ME, log: requestLog },
      makeReply(),
    )
    expect((ownQuery as { data: { userId: string } }).data.userId).toBe(ME)
    expect(calculateAgentPermission).toHaveBeenLastCalledWith('a2', ME)
  })
})

describe('F-07 同族 agent-control/execute 投递目标不得取 body.userId', () => {
  function seedEndpoint(instanceId: string, userId: string) {
    __test__.endpoints.set(instanceId, {
      capability: { endpoint: 'extension', instanceId, version: '1.0.0' },
      userId,
      lastSeen: Date.now(),
    } as never)
  }

  async function setupExecute() {
    const { server, handlers, pushNotification } = makeServer()
    await agentControlRoutes(server as never)
    return { handlers, pushNotification }
  }

  function executeRequest(body: Record<string, unknown>) {
    return { body, userId: ME, headers: {}, log: requestLog }
  }

  it('JWT 用户 body 指定他人 → 403,且不向他人端推送', async () => {
    seedEndpoint('victim-ext', VICTIM)
    const { handlers, pushNotification } = await setupExecute()

    const reply = makeReply()
    await handlers.get('POST /execute')!(
      executeRequest({
        requestId: 'r-cross',
        category: 'browser',
        action: 'click',
        params: {},
        userId: VICTIM,
        timeout: 1000,
      }),
      reply,
    )
    expect(reply.code).toBe(403)
    expect(pushNotification).not.toHaveBeenCalled()
    expect(__test__.pending.size).toBe(0)
  })

  it('JWT 用户省略 userId → 不落到他人端(本人无端即 TARGET_NOT_CONNECTED)', async () => {
    seedEndpoint('victim-ext', VICTIM)
    const { handlers, pushNotification } = await setupExecute()

    const reply = makeReply()
    await handlers.get('POST /execute')!(
      executeRequest({
        requestId: 'r-nobody',
        category: 'browser',
        action: 'click',
        params: {},
        timeout: 1000,
      }),
      reply,
    )
    expect(reply.code).toBe(200)
    expect(reply.body.data.errorCode).toBe('TARGET_NOT_CONNECTED')
    expect(pushNotification).not.toHaveBeenCalled()
    expect(__test__.pending.size).toBe(0)
  })

  it('JWT 用户本人端在线 → 正常投递并结算', async () => {
    seedEndpoint('me-ext', ME)
    const { handlers, pushNotification } = await setupExecute()

    const reply = makeReply()
    const call = handlers.get('POST /execute')!(
      executeRequest({
        requestId: 'r-own',
        category: 'browser',
        action: 'click',
        params: {},
        userId: ME,
        timeout: 5000,
      }),
      reply,
    )
    await vi.waitFor(() => expect(__test__.pending.has('r-own')).toBe(true))
    __test__.pending.get('r-own')!.resolve({
      requestId: 'r-own',
      success: true,
      durationMs: 1,
      executedBy: 'extension',
    })
    await call

    expect(pushNotification).toHaveBeenCalledTimes(1)
    expect(pushNotification.mock.calls[0]?.[0]).toBe(ME)
    expect(reply.body.data.success).toBe(true)
  })
})

describe('F-08 agent-control/result 必须绑定待处理动作的属主', () => {
  const REQUEST_ID = 'req-1'
  const ASSIGNMENT = { endpoint: 'extension', instanceId: 'inst-1', token: 'tok-1' }

  function seedPending() {
    const resolve = vi.fn()
    const pending = {
      resolve,
      reject: vi.fn(),
      timer: setTimeout(() => {}, 60_000),
      startedAt: Date.now(),
      userId: VICTIM,
      assignment: ASSIGNMENT,
    }
    __test__.pending.set(REQUEST_ID, pending as never)
    return { resolve, pending }
  }

  function resultBody(overrides: Record<string, unknown> = {}) {
    return {
      requestId: REQUEST_ID,
      success: true,
      durationMs: 12,
      executedBy: 'extension',
      ...overrides,
    }
  }

  it('他人回执(无 responded)→ 403,不 resolve、不删 pending', async () => {
    const { resolve } = seedPending()
    const handlers = await setupAgentControl()

    const reply = makeReply()
    await handlers.get('POST /result')!({ body: resultBody(), userId: ME, log: requestLog }, reply)
    expect(reply.code).toBe(403)
    expect(resolve).not.toHaveBeenCalled()
    expect(__test__.pending.has(REQUEST_ID)).toBe(true)
    expect(__test__.droppedResults.ownerMismatch).toBe(1)
  })

  it('他人回执(带正确 responded)同样 403,令牌对也不能跨用户结算', async () => {
    const { resolve } = seedPending()
    const handlers = await setupAgentControl()

    const reply = makeReply()
    await handlers.get('POST /result')!(
      {
        body: resultBody({ responded: { instanceId: 'inst-1', assignmentToken: 'tok-1' } }),
        userId: ME,
        log: requestLog,
      },
      reply,
    )
    expect(reply.code).toBe(403)
    expect(resolve).not.toHaveBeenCalled()
    expect(__test__.pending.has(REQUEST_ID)).toBe(true)
  })

  it('属主本人回执 → 结算并删除 pending', async () => {
    const { resolve } = seedPending()
    const handlers = await setupAgentControl()

    state.userId = VICTIM
    const reply = makeReply()
    await handlers.get('POST /result')!(
      { body: resultBody(), userId: VICTIM, log: requestLog },
      reply,
    )
    expect(reply.code).toBe(200)
    expect(reply.body.data).toEqual({ accepted: true })
    expect(resolve).toHaveBeenCalledTimes(1)
    expect(__test__.pending.has(REQUEST_ID)).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
