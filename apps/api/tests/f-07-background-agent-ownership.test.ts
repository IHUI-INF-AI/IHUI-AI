// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top

/**
 * F-07 回归锁:后台 Agent 归属隔离(路由层,mock manager + mock db)。
 *
 * 票面事实(修前):`BackgroundAgentManager.list()/get()/cancel()` 只认 agentId,不接收
 * 调用者身份;路由也不按用户过滤;创建时 `userUuid` 取自 body —— 任一登录用户可列举、
 * 查看、取消他人的长任务(泄露 prompt/workspacePath/事件/结果),还能把归属记到他人名下。
 *
 * 修后契约:
 *   ① list(userId) 只返回调用者自己的 Agent,他人列表为空;
 *   ② get(agentId, userId)/cancel(agentId, userId) 对他人 Agent 一律按"不存在"处理,
 *      路由映射为 404,不泄漏 agentId 是否存在;他人取消不得落到 manager.cancel;
 *   ③ 创建归属只认 `request.userId`,body `userUuid` 被 schema 剥离后忽略。
 *
 * 本文件刻意 mock 掉 manager 与 db:断言的是路由**把谁的身份传下去**(回归一旦退回
 * `list()` / body `userUuid`,调用记录立刻翻红),不重复真实 manager 的内部实现。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const ME = '00000000-0000-4000-8000-0000000000aa'
const OTHER = '00000000-0000-4000-8000-0000000000bb'

const h = vi.hoisted(() => {
  const agents = new Map<string, Record<string, unknown>>()
  const startCalls: Array<Record<string, unknown>> = []
  const listCalls: string[] = []
  const getCalls: Array<[string, string]> = []
  const cancelCalls: Array<[string, string]> = []

  const manager = {
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
      listCalls.push(userId)
      // 与真实 BackgroundAgentManager 同契约:按 userUuid 过滤
      return Array.from(agents.values()).filter((agent) => agent.userUuid === userId)
    },
    get(agentId: string, userId: string) {
      getCalls.push([agentId, userId])
      const agent = agents.get(agentId)
      // 与真实实现同契约:非属主与不存在同为 null(路由映射为同一个 404)
      return agent && agent.userUuid === userId ? agent : null
    },
    cancel(agentId: string, userId: string) {
      cancelCalls.push([agentId, userId])
      const agent = agents.get(agentId)
      if (!agent || agent.userUuid !== userId || agent.status !== 'running') return false
      agent.status = 'cancelled'
      return true
    },
  }

  return { agents, startCalls, listCalls, getCalls, cancelCalls, manager }
})

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async () => {}),
  checkAuth: vi.fn(async () => true),
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
  isSafeCheckpointId: vi.fn(() => true),
}))

import { workspaceAiRoutes } from '../src/routes/workspace-ai.js'

type Handler = (request: unknown, reply: unknown) => unknown
type Reply = {
  code: number
  body: any
  status: (c: number) => Reply
  send: (b: unknown) => Reply
}

function makeReply(): Reply {
  return {
    code: 200,
    body: undefined,
    status(code: number) {
      this.code = code
      return this
    },
    send(body: unknown) {
      this.body = body
      return this
    },
  }
}

async function setup() {
  const handlers = new Map<string, Handler>()
  const register = (method: string) => (path: string, a: unknown, b?: unknown) =>
    handlers.set(`${method} ${path}`, (b ?? a) as Handler)
  const server: Record<string, unknown> = {
    addHook: vi.fn(),
    decorate: vi.fn(),
    get: vi.fn(register('GET')),
    post: vi.fn(register('POST')),
    put: vi.fn(register('PUT')),
    patch: vi.fn(register('PATCH')),
    delete: vi.fn(register('DELETE')),
    pushNotification: vi.fn(),
    log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  }
  await workspaceAiRoutes(server as never)
  return handlers
}

const requestLog = { warn: vi.fn(), error: vi.fn(), info: vi.fn() }

function seedAgent(userUuid: string, prompt: string): string {
  return h.manager.start({ prompt, workspacePath: '/tmp/w', userUuid })
}

beforeEach(() => {
  h.agents.clear()
  h.startCalls.length = 0
  h.listCalls.length = 0
  h.getCalls.length = 0
  h.cancelCalls.length = 0
})

describe('F-07 background-agents 归属隔离(mock manager)', () => {
  it('列表:他人 Agent 不出现在本人的列表中,且 list 收到的是调用者身份', async () => {
    seedAgent(OTHER, 'other-secret-prompt')
    const handlers = await setup()

    const reply = makeReply()
    await handlers.get('GET /background-agents')!({ userId: ME, log: requestLog }, reply)

    expect(reply.code).toBe(200)
    expect(reply.body.data.agents).toEqual([])
    expect(JSON.stringify(reply.body)).not.toContain('other-secret-prompt')
    expect(h.listCalls).toEqual([ME])
  })

  it('查看:他人 Agent 与不存在的 Agent 同为 404(不泄漏存在性),本人 200', async () => {
    const agentId = seedAgent(OTHER, 'other-secret-prompt')
    const handlers = await setup()

    const denied = makeReply()
    await handlers.get('GET /background-agents/:agentId')!(
      { params: { agentId }, userId: ME, log: requestLog },
      denied,
    )
    expect(denied.code).toBe(404)
    expect(JSON.stringify(denied.body)).not.toContain('other-secret-prompt')
    expect(h.getCalls.at(-1)).toEqual([agentId, ME])

    const missing = makeReply()
    await handlers.get('GET /background-agents/:agentId')!(
      { params: { agentId: 'no-such-agent' }, userId: ME, log: requestLog },
      missing,
    )
    expect(missing.code).toBe(404)
    // 他人与不存在同形:相同状态码与文案
    expect(missing.body).toEqual(denied.body)

    const allowed = makeReply()
    await handlers.get('GET /background-agents/:agentId')!(
      { params: { agentId }, userId: OTHER, log: requestLog },
      allowed,
    )
    expect(allowed.code).toBe(200)
    expect(allowed.body.data.agentId).toBe(agentId)
  })

  it('取消:他人 Agent 404 且不触达 cancel(状态不变),本人 200 且已取消', async () => {
    const agentId = seedAgent(OTHER, 'other-secret-prompt')
    const handlers = await setup()

    const denied = makeReply()
    await handlers.get('POST /background-agents/:agentId/cancel')!(
      { params: { agentId }, userId: ME, log: requestLog },
      denied,
    )
    expect(denied.code).toBe(404)
    expect(denied.body.data?.canceled).not.toBe(true)
    expect(h.cancelCalls).toEqual([])
    expect(h.agents.get(agentId)?.status).toBe('running')

    const allowed = makeReply()
    await handlers.get('POST /background-agents/:agentId/cancel')!(
      { params: { agentId }, userId: OTHER, log: requestLog },
      allowed,
    )
    expect(allowed.code).toBe(200)
    expect(allowed.body.data).toEqual({ canceled: true })
    expect(h.cancelCalls.at(-1)).toEqual([agentId, OTHER])
    expect(h.agents.get(agentId)?.status).toBe('cancelled')
  })

  it('创建:body 伪造 userUuid 被忽略,归属固定为 request.userId', async () => {
    const handlers = await setup()

    const reply = makeReply()
    await handlers.get('POST /background-agents')!(
      {
        body: { prompt: 'p', workspacePath: '/tmp/w', userUuid: OTHER },
        userId: ME,
        log: requestLog,
      },
      reply,
    )

    expect(reply.code).toBe(201)
    expect(h.startCalls).toHaveLength(1)
    expect(h.startCalls.at(-1)?.userUuid).toBe(ME)
    expect(h.agents.get('agent-1')?.userUuid).toBe(ME)

    // 归属生效:他人看不到伪造出来的 Agent
    expect(h.manager.list(OTHER)).toEqual([])
  })
})
