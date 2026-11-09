// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-133(P0):任意登录用户可改写/读取任意智能体的 system prompt。
 *
 * `GET/PUT /api/agent-ext/personality/:agentId` 此前直接按 agentId 读写 `agents.agent_prompt`,
 * 插件顶层只有 requireAuth —— 归属与管理员判定都不存在。
 *
 * 本文件钉住"属主或管理员"闸:
 *  ① 未登录 → 401;
 *  ② 他人 PUT → 404 且 UPDATE 零次(计数断言,不是只看出栈文案);
 *  ③ 他人 GET → 404 且响应体不含 prompt(不暴露存在性、不回显他人提示词);
 *  ④ 属主 PUT/GET → 200;
 *  ⑤ 管理员 PUT/GET 他人 agent → 200(正向对照,防"整片写死"骗过 ②③);
 *  ⑥ 不存在的 agentId → 404;
 *  ⑦ 超长 personality(>8000)→ 400 且零写(防超大注入体)。
 *
 * 旧代码(无归属闸/无长度上限)下 ②③⑦ 应为红:② PUT 拿到 200 且 UPDATE 发生 1 次,
 * ③ GET 拿到 200 且 body 带他人 prompt,⑦ 超长仍 200。
 *
 * 隔离:auth/requireActiveUser 全部桩掉;db.execute 为纯内存 mock,不连 PG/Redis、零网络。
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FastifyReply, FastifyRequest } from 'fastify'
import Fastify from 'fastify'
import type { JWTPayload } from '@ihui/auth'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
  requireActiveUser: vi.fn(),
  dbExecute: vi.fn(),
  syncSettlement: vi.fn(),
  calcPermission: vi.fn(),
  getHistory: vi.fn(),
  genOrderNo: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(),
  requireActiveUser: mocks.requireActiveUser,
  default: vi.fn(),
}))
vi.mock('../src/plugins/require-permission.js', () => ({
  requireAuth: mocks.requireAuth,
  requireAdmin: mocks.requireAdmin,
  requirePermission: vi.fn(() => mocks.requireAuth),
  // 按 roleId 复刻 isSystemAdmin 的**语义**(判据本体在 require-permission.ts):
  // 测试只需要"roleId>=1 视为管理员"这一档输入。
  isSystemAdmin: (request: { jwtPayload?: { roleId?: number } }) =>
    (request.jwtPayload?.roleId ?? 0) >= 1,
}))
vi.mock('../src/db/index.js', () => ({
  db: { execute: mocks.dbExecute },
}))
vi.mock('../src/services/settlement-service.js', () => ({
  syncAgentBuyToSettlement: mocks.syncSettlement,
}))
vi.mock('../src/services/agent-service.js', () => ({
  calculateAgentPermission: mocks.calcPermission,
}))
vi.mock('../src/services/context-manager-service.js', () => ({
  getConversationHistory: mocks.getHistory,
}))
vi.mock('../src/utils/crypto-random.js', () => ({
  generateOrderNumber: mocks.genOrderNo,
}))

import agentExtendedRoutes from '../src/routes/agent-extended.js'

const USER_OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_STRANGER = 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb'
const USER_ADMIN = 'cccccccc-cccc-4ccc-accc-cccccccccccc'
const AGENT_OWNED = 'agent-owned-by-me'
const AGENT_OTHER = 'agent-owned-by-stranger'
const AGENT_MISSING = 'agent-does-not-exist'

type ExecCall = { text: string; values: string[] }
type AgentRow = { agent_id: string; user_id: string; agent_prompt: string }

/**
 * 取 db.execute(sql`…`) 里的全部字符串:既含 SQL 文本块(StringChunk.value),
 * 也含真正绑定进去的参数(Param.value)。据此区分 SELECT / UPDATE。
 */
function walkStrings(node: unknown, out: string[]): void {
  if (typeof node === 'string') {
    out.push(node)
    return
  }
  if (Array.isArray(node)) {
    for (const n of node) walkStrings(n, out)
    return
  }
  if (node && typeof node === 'object') {
    const rec = node as Record<string, unknown>
    if ('value' in rec) {
      walkStrings(rec.value, out)
    }
    if ('queryChunks' in rec) walkStrings(rec.queryChunks, out)
  }
}

function inspect(sqlObj: unknown): ExecCall {
  const values: string[] = []
  walkStrings(sqlObj, values)
  return { text: values.join(' '), values }
}

function makePayload(userId: string, roleId: number): JWTPayload {
  return { userId, phone: '', familyId: '', roleId }
}

let execCalls: ExecCall[] = []
/** UPDATE 命中时回给 handler 的行;agent_id 必须与被写的 agent 一致,否则返回空(模拟零命中)。 */
let writeResult: { agentId: string; personality: string } | null = null
let agentsById: Record<string, AgentRow> = {}

function writeCalls(): ExecCall[] {
  return execCalls.filter((c) => c.text.includes('UPDATE'))
}

function asUser(userId: string, roleId = 0): void {
  mocks.requireAuth.mockImplementation(async (request: FastifyRequest) => {
    request.userId = userId
    request.jwtPayload = makePayload(userId, roleId)
  })
  mocks.requireActiveUser.mockResolvedValue(undefined)
}

function asAnonymous(): void {
  mocks.requireAuth.mockImplementation(
    async (_request: FastifyRequest, reply: FastifyReply) => {
      reply.status(401).send({ code: 401, message: 'Authentication required' })
    },
  )
  mocks.requireActiveUser.mockResolvedValue(undefined)
}

describe('agent-extended 人设归属闸(F-133)', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(agentExtendedRoutes)
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuth.mockReset()
    mocks.requireActiveUser.mockReset()
    mocks.dbExecute.mockReset()
    mocks.requireActiveUser.mockResolvedValue(undefined)

    execCalls = []
    writeResult = null
    agentsById = {
      [AGENT_OWNED]: {
        agent_id: AGENT_OWNED,
        user_id: USER_OWNER,
        agent_prompt: 'owner-agent-prompt',
      },
      [AGENT_OTHER]: {
        agent_id: AGENT_OTHER,
        user_id: USER_STRANGER,
        agent_prompt: 'other-agent-secret-prompt',
      },
    }

    mocks.dbExecute.mockImplementation(async (sqlObj: unknown) => {
      const call = inspect(sqlObj)
      execCalls.push(call)
      if (call.text.includes('UPDATE')) {
        if (!writeResult) return []
        return call.values.includes(writeResult.agentId)
          ? [{ agent_id: writeResult.agentId, agent_prompt: writeResult.personality }]
          : []
      }
      // SELECT 分支:按绑定值里出现的 agentId 回对应行;没有则"不存在"。
      const agentId = call.values.find((v) => v in agentsById)
      return agentId ? [{ ...agentsById[agentId] }] : []
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('① 未登录 PUT → 401,零写', async () => {
    asAnonymous()
    const res = await server.inject({
      method: 'PUT',
      url: `/personality/${AGENT_OWNED}`,
      payload: { personality: 'pwned' },
    })
    expect(res.statusCode).toBe(401)
    expect(writeCalls()).toHaveLength(0)
  })

  it('② 他人 PUT 任意 agent → 404 且零 UPDATE(旧代码 200 + 1 次 UPDATE)', async () => {
    asUser(USER_STRANGER)
    writeResult = { agentId: AGENT_OWNED, personality: 'pwned-by-stranger' }
    const res = await server.inject({
      method: 'PUT',
      url: `/personality/${AGENT_OWNED}`,
      payload: { personality: 'pwned-by-stranger' },
    })
    expect(res.statusCode).toBe(404)
    expect(writeCalls()).toHaveLength(0)
    // 只允许 1 次归属 SELECT;UPDATE 语句根本没发出去
    expect(execCalls).toHaveLength(1)
    expect(res.body).not.toContain('pwned-by-stranger')
  })

  it('③ 他人 GET 他人 agent → 404 且响应体不含 prompt(旧代码 200 + 回显)', async () => {
    // 请求者是 AGENT_OWNED 的属主,但去读 AGENT_OTHER(属主为 USER_STRANGER)
    asUser(USER_OWNER)
    const res = await server.inject({ method: 'GET', url: `/personality/${AGENT_OTHER}` })
    expect(res.statusCode).toBe(404)
    expect(res.body).not.toContain('other-agent-secret-prompt')
    expect(res.json()).toEqual({ code: 404, message: '智能体不存在' })
  })

  it('④ 属主 PUT/GET → 200', async () => {
    asUser(USER_OWNER)
    writeResult = { agentId: AGENT_OWNED, personality: 'owner-updated-prompt' }

    const putRes = await server.inject({
      method: 'PUT',
      url: `/personality/${AGENT_OWNED}`,
      payload: { personality: 'owner-updated-prompt' },
    })
    expect(putRes.statusCode).toBe(200)
    expect((putRes.json() as { data: { personality: string } }).data.personality).toBe(
      'owner-updated-prompt',
    )
    expect(writeCalls()).toHaveLength(1)

    const getRes = await server.inject({ method: 'GET', url: `/personality/${AGENT_OWNED}` })
    expect(getRes.statusCode).toBe(200)
    expect((getRes.json() as { data: { personality: string } }).data.personality).toBe(
      'owner-agent-prompt',
    )
  })

  it('⑤ 管理员 PUT/GET 他人 agent → 200(正向对照)', async () => {
    asUser(USER_ADMIN, 1)
    writeResult = { agentId: AGENT_OTHER, personality: 'admin-updated-prompt' }

    const putRes = await server.inject({
      method: 'PUT',
      url: `/personality/${AGENT_OTHER}`,
      payload: { personality: 'admin-updated-prompt' },
    })
    expect(putRes.statusCode).toBe(200)
    expect((putRes.json() as { data: { personality: string } }).data.personality).toBe(
      'admin-updated-prompt',
    )
    expect(writeCalls()).toHaveLength(1)

    const getRes = await server.inject({ method: 'GET', url: `/personality/${AGENT_OTHER}` })
    expect(getRes.statusCode).toBe(200)
    expect((getRes.json() as { data: { personality: string } }).data.personality).toBe(
      'other-agent-secret-prompt',
    )
  })

  it('⑥ 不存在的 agentId → GET/PUT 均 404', async () => {
    asUser(USER_OWNER)
    const getRes = await server.inject({ method: 'GET', url: `/personality/${AGENT_MISSING}` })
    expect(getRes.statusCode).toBe(404)

    const putRes = await server.inject({
      method: 'PUT',
      url: `/personality/${AGENT_MISSING}`,
      payload: { personality: 'x' },
    })
    expect(putRes.statusCode).toBe(404)
    expect(writeCalls()).toHaveLength(0)
  })

  it('⑦ 超长 personality(>8000)→ 400 且零写(旧代码 200 + UPDATE)', async () => {
    asUser(USER_OWNER)
    writeResult = { agentId: AGENT_OWNED, personality: 'long-updated' }
    const res = await server.inject({
      method: 'PUT',
      url: `/personality/${AGENT_OWNED}`,
      payload: { personality: 'x'.repeat(8001) },
    })
    expect(res.statusCode).toBe(400)
    expect(writeCalls()).toHaveLength(0)
    // 长度校验先于归属查询:连 SELECT 都不发
    expect(execCalls).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
