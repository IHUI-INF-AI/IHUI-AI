// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-138(P3,越权写归属):`POST /api/agent-ext/developer` 直接采信 body 的
 * `user_id` / `creator_id`,把开发者链接记录写到他人名下。
 *
 * 根因:developerLinkCreateSchema 由列清单生成、天然接受这两个字段,而 handler 是
 * `rawInsert('zhs_developer_link', developerLinkCols, body, reply)` —— 同文件的
 * /upload、/need-task 在插入前都用 `req.userId` 覆盖,这一处漏了。
 *
 * 本文件钉住修复后的归属语义:
 *  ① 未登录 ⇒ 401 且零 insert;
 *  ② 普通用户 body 传他人 user_id/creator_id ⇒ insert 实际参数被改写为令牌本人;
 *  ③ 成功码仍为 201(包络 code=0),修复没有改成功路径;
 *  ④ 不传 user_id/creator_id ⇒ insert 仍带上令牌本人;
 *  ⑤ 管理员与同文件其它端点同口径 —— 一律强制本人(即便 body 代填他人)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import type { JWTPayload } from '@ihui/auth'

const h = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  return {
    requireAuth: vi.fn(),
    requireAdmin: vi.fn(),
    requireActiveUser: vi.fn(),
    dbExecute: vi.fn(),
    dbSelect: vi.fn(),
    dbInsert: vi.fn(),
    dbUpdate: vi.fn(),
    dbDelete: vi.fn(),
    syncSettlement: vi.fn(),
    calcPermission: vi.fn(),
    getHistory: vi.fn(),
    genOrderNo: vi.fn(),
  }
})

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(),
  requireActiveUser: h.requireActiveUser,
  default: vi.fn(),
}))
vi.mock('../src/plugins/require-permission.js', () => ({
  requireAuth: h.requireAuth,
  requireAdmin: h.requireAdmin,
  requirePermission: vi.fn(() => h.requireAuth),
  // 按 roleId 复刻语义(roleId >= 1 视为管理员),与 require-permission.ts 的真实判据一致。
  isSystemAdmin: (request: { jwtPayload?: { roleId?: number } }) =>
    (request.jwtPayload?.roleId ?? 0) >= 1,
}))
vi.mock('../src/db/index.js', () => ({
  db: {
    execute: h.dbExecute,
    select: h.dbSelect,
    insert: h.dbInsert,
    update: h.dbUpdate,
    delete: h.dbDelete,
  },
}))
vi.mock('../src/services/settlement-service.js', () => ({
  syncAgentBuyToSettlement: h.syncSettlement,
}))
vi.mock('../src/services/agent-service.js', () => ({
  calculateAgentPermission: h.calcPermission,
}))
vi.mock('../src/services/context-manager-service.js', () => ({
  getConversationHistory: h.getHistory,
}))
vi.mock('../src/utils/crypto-random.js', () => ({
  generateOrderNumber: h.genOrderNo,
}))

import agentExtendedRoutes from '../src/routes/agent-extended.js'

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const REC_ID = '11111111-1111-4111-8111-111111111111'
const CREATED_ROW = {
  id: REC_ID,
  user_id: USER_A,
  creator_id: USER_A,
  type: 1,
  count: 2,
  order_no: 'DEV-TEST-ORDER',
  status: 1,
}

function makePayload(userId: string, roleId: number): JWTPayload {
  return { userId, phone: '', familyId: '', roleId }
}

/**
 * 取 drizzle `db.execute(sql\`…\`)` 收到的对象里**实际绑定进去的值**。
 * (`rawInsert` 走 db.execute,不是 drizzle 构造器;值的形态与邻居夹具一致。)
 */
function boundValues(sqlObj: unknown): string[] {
  const out: string[] = []
  const walk = (node: unknown): void => {
    if (typeof node === 'string') {
      out.push(node)
      return
    }
    if (Array.isArray(node)) {
      for (const n of node) walk(n)
      return
    }
    if (node && typeof node === 'object') {
      const rec = node as Record<string, unknown>
      if ('queryChunks' in rec) walk(rec.queryChunks)
    }
  }
  walk(sqlObj)
  return out
}

/** 收集 POST /developer 真正发出的 db.execute 语句对象。 */
function captureExec(rows: unknown[] = [CREATED_ROW]): unknown[] {
  const seen: unknown[] = []
  h.dbExecute.mockImplementation(async (sqlObj: unknown) => {
    seen.push(sqlObj)
    return rows
  })
  return seen
}

function asRegular(userId: string): void {
  h.requireAuth.mockImplementation(async (request: FastifyRequest) => {
    request.userId = userId
    request.jwtPayload = makePayload(userId, 0)
  })
  h.requireActiveUser.mockResolvedValue(undefined)
}

function asAdmin(userId: string): void {
  h.requireAuth.mockImplementation(async (request: FastifyRequest) => {
    request.userId = userId
    request.jwtPayload = makePayload(userId, 1)
  })
  h.requireAdmin.mockImplementation(async (request: FastifyRequest) => {
    request.userId = userId
    request.jwtPayload = makePayload(userId, 1)
  })
  h.requireActiveUser.mockResolvedValue(undefined)
}

function asAnonymous(): void {
  h.requireAuth.mockImplementation(async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.status(401).send({ code: 401, message: 'Authentication required' })
  })
  h.requireActiveUser.mockResolvedValue(undefined)
}

describe('F-138 开发者链接写归属', () => {
  let server: FastifyInstance

  beforeAll(async () => {
    server = Fastify({ logger: false })
    await server.register(agentExtendedRoutes, { prefix: '/api/agent-ext' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    h.requireAuth.mockReset()
    h.requireAdmin.mockReset()
    h.requireActiveUser.mockReset()
    h.dbExecute.mockReset()
    h.requireActiveUser.mockResolvedValue(undefined)
    h.dbExecute.mockResolvedValue([])
    h.genOrderNo.mockReturnValue('DEV-TEST-ORDER')
  })

  it('① 未登录 POST /developer → 401 且零 insert', async () => {
    asAnonymous()
    const seen = captureExec()
    const res = await server.inject({
      method: 'POST',
      url: '/api/agent-ext/developer',
      payload: { user_id: USER_B, creator_id: USER_B, type: 1, count: 1 },
    })
    expect(res.statusCode).toBe(401)
    expect(seen).toHaveLength(0)
  })

  it('② 普通用户传他人 user_id/creator_id → insert 参数被改写为令牌本人', async () => {
    asRegular(USER_A)
    const seen = captureExec()
    const res = await server.inject({
      method: 'POST',
      url: '/api/agent-ext/developer',
      payload: {
        user_id: USER_B,
        creator_id: USER_B,
        user_name: '外部名称',
        creator_name: '外部创建者',
        type: 1,
        count: 2,
      },
    })
    expect(res.statusCode).toBe(201)
    expect(seen).toHaveLength(1)
    const bound = boundValues(seen[0])
    const raw = `insert 参数原文=${JSON.stringify(bound)}`
    expect(bound, raw).not.toContain(USER_B)
    expect(bound.filter((v) => v === USER_A), raw).toHaveLength(2)
    // 其它字段语义不动:非归属字段仍按 body 落库
    expect(bound).toContain('外部名称')
    expect(bound).toContain('外部创建者')
  })

  it('③ 成功码不变:普通用户创建仍返回 201 且包络 code=0', async () => {
    asRegular(USER_A)
    captureExec()
    const res = await server.inject({
      method: 'POST',
      url: '/api/agent-ext/developer',
      payload: { user_id: USER_A, creator_id: USER_A, type: 1, count: 1 },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json() as { code: number; data: { id: string } }
    expect(body.code).toBe(0)
    expect(body.data.id).toBe(REC_ID)
  })

  it('④ 不传 user_id/creator_id → insert 仍为令牌本人', async () => {
    asRegular(USER_A)
    const seen = captureExec()
    const res = await server.inject({
      method: 'POST',
      url: '/api/agent-ext/developer',
      payload: { type: 1, count: 1 },
    })
    expect(res.statusCode).toBe(201)
    expect(seen).toHaveLength(1)
    const bound = boundValues(seen[0])
    const raw = `insert 参数原文=${JSON.stringify(bound)}`
    expect(bound, raw).not.toContain(USER_B)
    expect(bound.filter((v) => v === USER_A), raw).toHaveLength(2)
  })

  it('⑤ 管理员代填他人 → 与同文件 /upload、/need-task 同口径,仍强制本人', async () => {
    asAdmin(USER_A)
    const seen = captureExec()
    const res = await server.inject({
      method: 'POST',
      url: '/api/agent-ext/developer',
      payload: { user_id: USER_B, creator_id: USER_B, type: 1, count: 2 },
    })
    expect(res.statusCode).toBe(201)
    expect(seen).toHaveLength(1)
    const bound = boundValues(seen[0])
    const raw = `insert 参数原文=${JSON.stringify(bound)}`
    expect(bound, raw).not.toContain(USER_B)
    expect(bound.filter((v) => v === USER_A), raw).toHaveLength(2)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
