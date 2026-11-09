// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-366(P2,越权/数据泄露):审核台账(agent_examines)的提交/列表/详情三面此前
 * 只走插件级登录闸,导致:
 *   - POST /api/examine/submit 原样接受 body.status(客户端可直接传 approved),
 *     且不校验 agentId 归属 ⇒ 任意登录用户可为任意智能体伪造"已通过"审核记录;
 *   - GET /api/examine/list 的 userId 过滤取自 query ⇒ 可读他人审核台账;
 *   - GET /api/examine/:recordId 对任意登录用户开放 ⇒ 可读他人审核记录(reason 等)。
 *
 * 本文件钉住路由层的归属语义(与同族 DELETE 的"属主取自令牌主体"同口径):
 *  ① 未登录 ⇒ 401;
 *  ② 普通用户给他人 agent submit(即使 body.status=approved)⇒ 403 且零 insert;
 *  ③ 普通用户给自己的 agent submit 且传 approved ⇒ 成功但落库 status='pending';
 *  ④ 普通用户 list 强制自过滤(query userId=他人也只返回自己);
 *  ⑤ 普通用户读他人记录 ⇒ 404(不暴露存在性,响应不含 reason/agentId);
 *  ⑥ 属主读自己记录 ⇒ 200;
 *  ⑦ 管理员可 list 全量、读他人记录 ⇒ 200。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const h = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  return {
    /** createExamine 真正走到的 insert values —— 用来证明"零 insert"/落库值 */
    inserts: [] as Record<string, unknown>[],
    /** findAgentByAgentId 的固定返回(按用例设置,空数组 ⇒ 404) */
    agents: [] as Record<string, unknown>[],
    /** findExamineById 的固定返回(按用例设置) */
    examineRows: [] as Record<string, unknown>[],
    /** 列表查询返回的行(按用例设置) */
    examines: [] as Record<string, unknown>[],
    /** 路由实际传给 findExamineList 的参数 —— 断言"自过滤来自令牌" */
    listQueries: [] as Record<string, unknown>[],
  }
})

/**
 * 只桩 db 出口(drizzle 构造层)。读面按 table 名分流,写面只统计 insert。
 * 表的 SQL 名取自 drizzle 的 `Symbol.for('drizzle:Name')`。
 */
vi.mock('../src/db/index.js', () => {
  const tableName = (t: unknown): string | undefined =>
    (t as Record<symbol, string> | null | undefined)?.[Symbol.for('drizzle:Name')]
  const makeSelect = () => {
    const b = {
      _table: undefined as unknown,
      from(t: unknown) {
        b._table = t
        return b
      },
      where() {
        return b
      },
      orderBy() {
        return b
      },
      limit() {
        return b
      },
      offset() {
        return b
      },
      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
        const name = tableName(b._table)
        const rows = name === 'agents' ? h.agents : name === 'agent_examines' ? h.examineRows : []
        return Promise.resolve(rows).then(resolve, reject)
      },
    }
    return b
  }
  const db = {
    select: makeSelect,
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        h.inserts.push(values)
        return {
          returning: async () => [{ id: '99999999-9999-4999-8999-999999999999', ...values }],
        }
      },
    }),
  }
  return { db, dbRead: { select: makeSelect }, dbClient: {} }
})

/**
 * 只覆盖 findExamineList(模拟 WHERE userId 的过滤效果),其余查询函数走真实实现。
 * 这样"list 只返回自己"既由路由传参证明,也由响应体证明。
 */
vi.mock('../src/db/agents-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    findExamineList: async (q: Record<string, unknown>) => {
      h.listQueries.push(q)
      let rows = h.examines
      if (q.userId) rows = rows.filter((r) => r.userId === q.userId)
      return { list: rows, total: rows.length, page: q.page ?? 1, pageSize: q.pageSize ?? 20 }
    },
  }
})

/**
 * 身份从请求头注入,JWT 语义(roleId >= 1 为管理员)与真实实现一致。
 * require-permission 保持真实:isSystemAdmin 就读 request.jwtPayload.roleId。
 */
vi.mock('../src/plugins/auth.js', () => {
  interface MockRequest {
    headers: Record<string, string | string[] | undefined>
    userId?: string
    jwtPayload?: { userId?: string; roleId?: number }
  }
  interface MockReply {
    status: (code: number) => { send: (body: unknown) => void }
  }
  const authenticate = (request: MockRequest): void => {
    const role = request.headers['x-test-role']
    if (role === undefined) {
      const err = new Error('Authentication required') as Error & { statusCode: number }
      err.statusCode = 401
      throw err
    }
    request.userId = String(request.headers['x-test-user'] ?? '')
    request.jwtPayload = { userId: request.userId, roleId: Number(role) }
  }
  return {
    authenticate: async (request: MockRequest) => authenticate(request),
    checkAuth: async (request: MockRequest, reply: MockReply): Promise<boolean> => {
      try {
        authenticate(request)
        return true
      } catch (e) {
        const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
        reply.status(statusCode).send({ code: statusCode, message: 'Authentication required' })
        return false
      }
    },
    requireActiveUser: async () => undefined,
  }
})

import { agentsRoutes } from '../src/routes/agents.js'

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const AGENT_ID = '11111111-1111-4111-8111-111111111111'
const AGENT_OTHER = '22222222-2222-4222-8222-222222222222'
const RECORD_ID = '55555555-5555-4555-8555-555555555555'

function agentRow(agentId: string, userId: string) {
  return { agentId, userId, name: '智能体' }
}

function examineRow(recordId: string, agentId: string, userId: string) {
  return {
    id: recordId,
    agentId,
    userId,
    status: 'pending',
    reason: '机密审核意见',
    reviewerId: null,
    reviewedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  }
}

function authHeaders(roleId: number, userId: string) {
  return { 'x-test-role': String(roleId), 'x-test-user': userId }
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(agentsRoutes, { prefix: '/api' })
  await app.ready()
  return app
}

beforeEach(() => {
  h.inserts.length = 0
  h.listQueries.length = 0
  h.agents = []
  h.examineRows = []
  h.examines = []
})

describe('F-366 审核台账归属', () => {
  it('① 未登录 submit → 401 且零 insert', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/examine/submit',
      payload: { agentId: AGENT_ID, status: 'approved' },
    })
    expect(res.statusCode).toBe(401)
    expect(h.inserts).toHaveLength(0)
    await app.close()
  })

  it('② 普通用户给他人 agent submit(带 approved)→ 403 且零 insert', async () => {
    h.agents = [agentRow(AGENT_OTHER, USER_B)]
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/examine/submit',
      headers: authHeaders(0, USER_A),
      payload: { agentId: AGENT_OTHER, status: 'approved', reason: '自填理由' },
    })
    expect(h.inserts).toHaveLength(0)
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it("③ 普通用户给自己的 agent submit 且传 approved → 200 且落库 status='pending'", async () => {
    h.agents = [agentRow(AGENT_ID, USER_A)]
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/examine/submit',
      headers: authHeaders(0, USER_A),
      payload: { agentId: AGENT_ID, status: 'approved', reason: '申请理由' },
    })
    expect(res.statusCode).toBe(200)
    expect(h.inserts).toHaveLength(1)
    expect(h.inserts[0]).toMatchObject({ agentId: AGENT_ID, userId: USER_A, status: 'pending' })
    expect((res.json() as { data: { status: string } }).data.status).toBe('pending')
    await app.close()
  })

  it('④ 普通用户 list 强制自过滤(query userId=他人也只返回自己)', async () => {
    h.examines = [examineRow(RECORD_ID, AGENT_ID, USER_A), examineRow('66666666-6666-4666-8666-666666666666', AGENT_OTHER, USER_B)]
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/examine/list?userId=${USER_B}`,
      headers: authHeaders(0, USER_A),
    })
    expect(res.statusCode).toBe(200)
    expect(h.listQueries[0]).toMatchObject({ userId: USER_A })
    const list = (res.json() as { data: { list: { userId: string }[] } }).data.list
    expect(list).toHaveLength(1)
    expect(list[0]?.userId).toBe(USER_A)
    await app.close()
  })

  it('⑤ 普通用户读他人审核记录 → 404 且响应不含 reason/agentId', async () => {
    h.examineRows = [examineRow(RECORD_ID, AGENT_OTHER, USER_B)]
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/examine/${RECORD_ID}`,
      headers: authHeaders(0, USER_A),
    })
    expect(res.statusCode).toBe(404)
    expect(res.body).not.toContain('机密审核意见')
    expect(res.body).not.toContain(AGENT_OTHER)
    await app.close()
  })

  it('⑥ 属主读自己记录 → 200', async () => {
    h.examineRows = [examineRow(RECORD_ID, AGENT_ID, USER_A)]
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/examine/${RECORD_ID}`,
      headers: authHeaders(0, USER_A),
    })
    expect(res.statusCode).toBe(200)
    expect((res.json() as { data: { id: string } }).data.id).toBe(RECORD_ID)
    await app.close()
  })

  it('⑦ 管理员可 list 全量、读他人记录 → 200', async () => {
    h.examines = [examineRow(RECORD_ID, AGENT_ID, USER_A), examineRow('66666666-6666-4666-8666-666666666666', AGENT_OTHER, USER_B)]
    h.examineRows = [examineRow(RECORD_ID, AGENT_OTHER, USER_B)]
    const app = await buildApp()
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/examine/list',
      headers: authHeaders(1, USER_A),
    })
    expect(listRes.statusCode).toBe(200)
    expect(h.listQueries[0]?.userId).toBeUndefined()
    expect((listRes.json() as { data: { list: unknown[] } }).data.list).toHaveLength(2)

    const detailRes = await app.inject({
      method: 'GET',
      url: `/api/examine/${RECORD_ID}`,
      headers: authHeaders(1, USER_A),
    })
    expect(detailRes.statusCode).toBe(200)
    await app.close()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
