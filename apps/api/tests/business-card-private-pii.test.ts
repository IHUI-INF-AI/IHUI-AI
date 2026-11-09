// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-156:GET /api/business-card/:id 不得泄露他人私密名片 PII。
 *
 * 判据:
 *   ① 未登录 → 401,且不碰库;
 *   ② 他人访问 isPublic=false 名片 → 404,响应体不含 phone/email/qrCode,且不发生写;
 *   ③ 本人访问自己的私密名片 → 200 且 PII 字段完整;
 *   ④ 任意人访问 isPublic=true 名片 → 200,view_count 为同一笔 UPDATE 的原子自增(非读改写);
 *   ⑤ 不存在的 id → 404。
 *
 * 桩的取舍:db 层整体桩掉(不连真实 PostgreSQL)。为了让"旧实现"必然翻红,
 * 桩在 SELECT 时把 WHERE 当权限策略执行:WHERE 带 is_public/user_id 可见性谓词时
 * 按 `isPublic === true || userId === 当前用户` 过滤,否则原样返回 seeded 行 ——
 * 旧实现只按 id 查,私密卡就会被原样吐出。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyError } from 'fastify'
import { PgDialect } from 'drizzle-orm/pg-core'

const { mockAuthenticate, updateCalls, selectWhereCalls, updateWhereCalls, state } = vi.hoisted(
  () => ({
    mockAuthenticate: vi.fn(),
    // 每次 db.update() 的 holder(setArgs 在 .set() 时回填,where 在 .where() 时回填)
    updateCalls: [] as { setArgs?: Record<string, unknown>; where?: unknown }[],
    selectWhereCalls: [] as unknown[],
    updateWhereCalls: [] as unknown[],
    // 当前登录用户与"库里现有的行"(由用例 seed)
    state: { userId: null as string | null, rows: [] as Record<string, unknown>[] },
  }),
)

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

vi.mock('../src/db/index.js', () => {
  // 在 drizzle SQL 表达式树里找指定列名(用于识别 WHERE 是否含可见性谓词)
  function hasColumn(node: unknown, name: string, seen = new Set<unknown>()): boolean {
    if (!node || typeof node !== 'object' || seen.has(node)) return false
    seen.add(node)
    const n = node as { name?: unknown; queryChunks?: unknown[] }
    if (n.name === name) return true
    if (Array.isArray(n.queryChunks)) return n.queryChunks.some((c) => hasColumn(c, name, seen))
    return false
  }

  function readRows(where: unknown): Record<string, unknown>[] {
    const gated = hasColumn(where, 'is_public') && hasColumn(where, 'user_id')
    if (!gated) return state.rows // 旧实现:WHERE 只有 id ⇒ 私密卡原样返回(红)
    return state.rows.filter((r) => r.isPublic === true || r.userId === state.userId)
  }

  function createChain(mode: 'read' | 'write', holder?: { setArgs?: Record<string, unknown> }) {
    let where: unknown
    const chain: Record<string, unknown> & {
      then: (resolve: (value: unknown) => unknown) => Promise<unknown>
    } = {
      then: (resolve) =>
        Promise.resolve(mode === 'read' ? readRows(where) : []).then(resolve),
    }
    for (const m of [
      'from',
      'orderBy',
      'limit',
      'offset',
      'values',
      'returning',
      'innerJoin',
      'leftJoin',
      'groupBy',
    ]) {
      chain[m] = () => chain
    }
    chain.select = () => chain
    chain.set = (args: Record<string, unknown>) => {
      if (holder) holder.setArgs = args
      return chain
    }
    chain.where = (cond: unknown) => {
      where = cond
      if (mode === 'read') selectWhereCalls.push(cond)
      else updateWhereCalls.push(cond)
      return chain
    }
    return chain
  }

  const dbMock = {
    execute: vi.fn().mockResolvedValue([]),
    select: vi.fn(() => createChain('read')),
    insert: vi.fn(() => createChain('write')),
    update: vi.fn(() => {
      const holder: { setArgs?: Record<string, unknown> } = {}
      updateCalls.push(holder)
      return createChain('write', holder)
    }),
    delete: vi.fn(() => createChain('write')),
  }
  return { db: dbMock, dbRead: dbMock }
})

import { otherRoutes as frontendStubOtherRoutes } from '../src/routes/other/index.js'

const PREFIX = '/api'
const OWNER_ID = '00000000-0000-4000-8000-000000000001'
const OTHER_USER = '00000000-0000-4000-8000-0000000000ff'
const CARD_ID = '11111111-1111-4111-8111-111111111111'

const PRIVATE_PHONE = '13800000000'
const PRIVATE_EMAIL = 'li-private@example.com'
const PRIVATE_QR = 'https://example.com/private-qr.png'

const dialect = new PgDialect()
function renderSql(fragment: unknown): string {
  return dialect.sqlToQuery(fragment as never).sql.toLowerCase()
}

function mockAuthed(userId: string) {
  state.userId = userId
  mockAuthenticate.mockImplementation(
    async (request: { userId?: string; jwtPayload?: unknown }) => {
      request.userId = userId
      request.jwtPayload = { userId, roleId: 0 }
    },
  )
}

function mockUnauthed() {
  state.userId = null
  const err = new Error('Authentication required')
  ;(err as Error & { statusCode: number }).statusCode = 401
  mockAuthenticate.mockRejectedValue(err)
}

function privateCard(overrides: Record<string, unknown> = {}) {
  return {
    id: CARD_ID,
    userId: OWNER_ID,
    name: '李春川',
    title: '创始人',
    company: '智汇AI',
    phone: PRIVATE_PHONE,
    email: PRIVATE_EMAIL,
    avatar: null,
    intro: '私密简介',
    qrCode: PRIVATE_QR,
    isPublic: false,
    viewCount: 0,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    ...overrides,
  }
}

function publicCard(overrides: Record<string, unknown> = {}) {
  return privateCard({
    isPublic: true,
    viewCount: 5,
    phone: '13900000000',
    email: 'li-public@example.com',
    qrCode: 'https://example.com/public-qr.png',
    ...overrides,
  })
}

describe('GET /api/business-card/:id — 私密名片 PII 泄露(F-156)', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.setErrorHandler((err: FastifyError, _request, reply) => {
      const statusCode =
        err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500
      reply.status(statusCode).send({
        code: statusCode,
        message: statusCode >= 500 ? '服务器错误' : err.message,
      })
    })
    await server.register(frontendStubOtherRoutes, { prefix: PREFIX })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    state.rows.length = 0
    state.userId = null
    updateCalls.length = 0
    selectWhereCalls.length = 0
    updateWhereCalls.length = 0
    mockAuthenticate.mockReset()
  })

  it('① 未登录 → 401,且不查库、不写库', async () => {
    mockUnauthed()
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/business-card/${CARD_ID}` })
    expect(res.statusCode).toBe(401)
    expect(selectWhereCalls).toHaveLength(0)
    expect(updateCalls).toHaveLength(0)
  })

  it('② 他人访问 isPublic=false 名片 → 404,响应体不含 phone/email/qrCode,且零写入', async () => {
    mockAuthed(OTHER_USER)
    state.rows = [privateCard()]

    const res = await server.inject({ method: 'GET', url: `${PREFIX}/business-card/${CARD_ID}` })

    expect(res.statusCode).toBe(404)
    expect(res.body).not.toContain(PRIVATE_PHONE)
    expect(res.body).not.toContain(PRIVATE_EMAIL)
    expect(res.body).not.toContain(PRIVATE_QR)
    expect(updateCalls).toHaveLength(0)

    // 查询必须真的叠加了可见性谓词(is_public + user_id),而不是只按 id 查后由 handler 判
    expect(selectWhereCalls).toHaveLength(1)
    const whereSql = renderSql(selectWhereCalls[0])
    expect(whereSql).toContain('is_public')
    expect(whereSql).toContain('user_id')
  })

  it('③ 本人访问自己的私密名片 → 200 且 PII 字段完整(属主可见)', async () => {
    mockAuthed(OWNER_ID)
    state.rows = [privateCard()]

    const res = await server.inject({ method: 'GET', url: `${PREFIX}/business-card/${CARD_ID}` })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.isPublic).toBe(false)
    expect(body.data.phone).toBe(PRIVATE_PHONE)
    expect(body.data.email).toBe(PRIVATE_EMAIL)
    expect(body.data.qrCode).toBe(PRIVATE_QR)
    expect(updateCalls).toHaveLength(1)
  })

  it('④ 任意人访问 isPublic=true 名片 → 200,且 view_count 是同一笔 UPDATE 的原子自增', async () => {
    mockAuthed(OTHER_USER)
    state.rows = [publicCard()]

    const res = await server.inject({ method: 'GET', url: `${PREFIX}/business-card/${CARD_ID}` })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.viewCount).toBe(6)

    // 只发一次 UPDATE,且 update 的 WHERE 也带可见性谓词(不允许只按 id 越权写)
    expect(updateCalls).toHaveLength(1)
    expect(updateWhereCalls).toHaveLength(1)
    const updateWhereSql = renderSql(updateWhereCalls[0])
    expect(updateWhereSql).toContain('is_public')
    expect(updateWhereSql).toContain('user_id')

    // 原子自增:set.viewCount 必须是 SQL 表达式,不能是读出来的旧值 + 1(读改写)
    const written = updateCalls[0]!.setArgs!
    expect(typeof written.viewCount).not.toBe('number')
    expect(String(written.viewCount)).not.toBe('6')
    const viewCountSql = renderSql(written.viewCount)
    expect(viewCountSql).toContain('view_count')
    expect(viewCountSql).toContain('+ 1')
  })

  it('⑤ 不存在的 id → 404,且零写入', async () => {
    mockAuthed(OTHER_USER)
    state.rows = []

    const res = await server.inject({ method: 'GET', url: `${PREFIX}/business-card/${CARD_ID}` })

    expect(res.statusCode).toBe(404)
    expect(updateCalls).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
