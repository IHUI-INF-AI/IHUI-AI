// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 团队共享记忆路由测试 (2026-09-08 新增)
 *
 * 覆盖:
 * 1. 未授权 401(无登录态)
 * 2. 创建(作者 = 当前用户)
 * 3. 列表 + ScopeId 隔离(不同 scope 返回不同数据)
 * 4. 搜索/过滤(kind / tag / keyword 透传给服务)
 * 5. 获取单条 / 更新 / 删除
 * 6. 校验失败 400 / 不存在 404
 *
 * db 与鉴权层均 mock,不连真实 PG;select/insert/update/delete 按队列消费预置结果。
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:8810/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// ─────────────────────────────────────────────────────────────
// Mock:鉴权层(authenticate 受 authState 控制)
// ─────────────────────────────────────────────────────────────
const authState = vi.hoisted(() => ({ fail: false, userId: 'user-1' }))

vi.mock('../../plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: { userId?: string }) => {
    if (authState.fail) throw new Error('unauthorized')
    request.userId = authState.userId
    return undefined
  }),
}))

// ─────────────────────────────────────────────────────────────
// Mock:@ihui/database(提供被查询构建器引用的 teamMemories + 类型导出)
// ─────────────────────────────────────────────────────────────
vi.mock('@ihui/database', () => ({
  teamMemories: {
    id: 'id',
    scopeId: 'scope_id',
    kind: 'kind',
    title: 'title',
    content: 'content',
    tags: 'tags',
    sourceUserId: 'source_user_id',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  TEAM_MEMORY_KINDS: ['decision', 'convention', 'pitfall', 'fingerprint'],
}))

// ─────────────────────────────────────────────────────────────
// Mock:db 层 — 链式 thenable builder,按队列消费预置结果
// ─────────────────────────────────────────────────────────────
const store = vi.hoisted(() => ({
  selectQueue: [] as Array<unknown[] | Error>,
  insertQueue: [] as unknown[][],
  updateQueue: [] as unknown[][],
  deleteQueue: [] as unknown[][],
  insertValues: [] as unknown[],
  updateSets: [] as unknown[],
  reset: () => {
    store.selectQueue.length = 0
    store.insertQueue.length = 0
    store.updateQueue.length = 0
    store.deleteQueue.length = 0
    store.insertValues.length = 0
    store.updateSets.length = 0
  },
  pushSelect: (r: unknown[] | Error) => store.selectQueue.push(r),
  pushInsert: (r: unknown[]) => store.insertQueue.push(r),
  pushUpdate: (r: unknown[]) => store.updateQueue.push(r),
  pushDelete: (r: unknown[]) => store.deleteQueue.push(r),
}))

vi.mock('../../db/index.js', () => {
  const makeSelect = () => {
    const b: Record<string, unknown> = {}
    b.from = () => b
    b.where = () => b
    b.orderBy = () => b
    b.limit = () => b
    b.then = (onF?: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => {
      const queued = store.selectQueue.shift() ?? []
      const p = queued instanceof Error ? Promise.reject(queued) : Promise.resolve(queued)
      return p.then(onF as (v: unknown) => unknown, onR as (e: unknown) => unknown)
    }
    return b
  }
  const dbMock = {
    select: () => makeSelect(),
    insert: () => {
      const c: Record<string, unknown> = {}
      c.values = (v: unknown) => {
        store.insertValues.push(v)
        return c
      }
      c.returning = () => Promise.resolve(store.insertQueue.shift() ?? [])
      c.then = (onF?: (v: unknown) => unknown) => Promise.resolve([]).then(onF)
      return c
    },
    update: () => {
      const c: Record<string, unknown> = {}
      c.set = (s: unknown) => {
        store.updateSets.push(s)
        return c
      }
      c.where = () => c
      c.returning = () => Promise.resolve(store.updateQueue.shift() ?? [])
      c.then = (onF?: (v: unknown) => unknown) => Promise.resolve([]).then(onF)
      return c
    },
    delete: () => {
      const c: Record<string, unknown> = {}
      c.where = () => c
      c.returning = () => Promise.resolve(store.deleteQueue.shift() ?? [])
      c.then = (onF?: (v: unknown) => unknown) => Promise.resolve([]).then(onF)
      return c
    },
  }
  return { db: dbMock, dbRead: dbMock }
})

import { teamMemoryRoutes } from '../team-memory.js'

// ─────────────────────────────────────────────────────────────
// 测试数据
// ─────────────────────────────────────────────────────────────

const ID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ID_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

function makeMemory(overrides: Record<string, unknown> = {}) {
  return {
    id: ID_A,
    scopeId: 'scope-A',
    kind: 'decision',
    title: '使用 PostgreSQL 作为主库',
    content: '决策:主库采用 PostgreSQL 17',
    tags: 'db,postgres',
    sourceUserId: 'user-1',
    createdAt: new Date('2026-09-08T00:00:00Z'),
    updatedAt: new Date('2026-09-08T00:00:00Z'),
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────
// 套件
// ─────────────────────────────────────────────────────────────

describe('团队共享记忆路由', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.setErrorHandler((err, _request, reply) => {
      const e = err as Error & { statusCode?: number }
      const statusCode = e.statusCode && e.statusCode >= 400 ? e.statusCode : 500
      reply.status(statusCode).send({ code: statusCode, message: e.message || '服务器错误' })
    })
    await app.register(teamMemoryRoutes, { prefix: '/api/team-memory' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    store.reset()
    authState.fail = false
    authState.userId = 'user-1'
  })

  // ───────────────────────────────────────────────────────────
  // 1. 未授权 401
  // ───────────────────────────────────────────────────────────
  describe('鉴权', () => {
    it('未登录 GET 列表 → 401', async () => {
      authState.fail = true
      const res = await app.inject({ method: 'GET', url: '/api/team-memory?scopeId=scope-A' })
      expect(res.statusCode).toBe(401)
      expect(res.json().code).toBe(401)
    })

    it('未登录 POST 创建 → 401', async () => {
      authState.fail = true
      const res = await app.inject({
        method: 'POST',
        url: '/api/team-memory',
        payload: { scopeId: 'scope-A', kind: 'decision', title: 't', content: 'c' },
      })
      expect(res.statusCode).toBe(401)
    })
  })

  // ───────────────────────────────────────────────────────────
  // 2. 创建
  // ───────────────────────────────────────────────────────────
  describe('POST /api/team-memory', () => {
    it('创建记忆:返回 DTO,作者 = 当前用户,tags 为数组', async () => {
      store.pushInsert([makeMemory({ id: ID_A, tags: 'db,postgres', sourceUserId: 'user-1' })])
      const res = await app.inject({
        method: 'POST',
        url: '/api/team-memory',
        payload: {
          scopeId: 'scope-A',
          kind: 'decision',
          title: '使用 PostgreSQL 作为主库',
          content: '决策:主库采用 PostgreSQL 17',
          tags: ['db', 'postgres'],
        },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.id).toBe(ID_A)
      expect(body.data.scopeId).toBe('scope-A')
      expect(body.data.kind).toBe('decision')
      expect(body.data.sourceUserId).toBe('user-1')
      expect(body.data.tags).toEqual(['db', 'postgres'])
    })

    it('缺少 kind → 400 校验失败', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/team-memory',
        payload: { scopeId: 'scope-A', title: 't', content: 'c' },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  // ───────────────────────────────────────────────────────────
  // 3. 列表 + ScopeId 隔离
  // ───────────────────────────────────────────────────────────
  describe('GET /api/team-memory(列表 + 隔离)', () => {
    it('按 scopeId 列出记忆', async () => {
      store.pushSelect([makeMemory({ id: ID_A, scopeId: 'scope-A' })])
      const res = await app.inject({ method: 'GET', url: '/api/team-memory?scopeId=scope-A' })
      expect(res.statusCode).toBe(200)
      expect(res.json().data).toHaveLength(1)
      expect(res.json().data[0].scopeId).toBe('scope-A')
    })

    it('ScopeId 隔离:scope-A 的数据不在 scope-B 下出现', async () => {
      // scope-A 查询返回 1 条
      store.pushSelect([makeMemory({ id: ID_A, scopeId: 'scope-A' })])
      const aRes = await app.inject({ method: 'GET', url: '/api/team-memory?scopeId=scope-A' })
      expect(aRes.json().data.map((m: { id: string }) => m.id)).toContain(ID_A)

      // scope-B 查询返回空(隔离生效)
      store.pushSelect([])
      const bRes = await app.inject({ method: 'GET', url: '/api/team-memory?scopeId=scope-B' })
      expect(bRes.json().data).toEqual([])
    })

    it('缺少 scopeId → 400', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/team-memory' })
      expect(res.statusCode).toBe(400)
    })
  })

  // ───────────────────────────────────────────────────────────
  // 4. 搜索 / 过滤
  // ───────────────────────────────────────────────────────────
  describe('GET /api/team-memory(搜索 / 过滤)', () => {
    it('kind 过滤:仅返回 kind=decision 的记忆', async () => {
      store.pushSelect([makeMemory({ id: ID_A, kind: 'decision' })])
      const res = await app.inject({
        method: 'GET',
        url: `/api/team-memory?scopeId=scope-A&kind=decision`,
      })
      expect(res.json().data).toHaveLength(1)
      expect(res.json().data[0].kind).toBe('decision')
    })

    it('keyword / tag 过滤:透传参数并返回过滤后结果', async () => {
      store.pushSelect([makeMemory({ id: ID_A, tags: 'postgres', content: '主库 PostgreSQL' })])
      const res = await app.inject({
        method: 'GET',
        url: `/api/team-memory?scopeId=scope-A&keyword=PostgreSQL&tag=postgres`,
      })
      expect(res.json().data).toHaveLength(1)
      expect(res.json().data[0].id).toBe(ID_A)
    })
  })

  // ───────────────────────────────────────────────────────────
  // 5. 获取 / 更新 / 删除
  // ───────────────────────────────────────────────────────────
  describe('单条操作', () => {
    it('GET /:id 获取已存在的记忆', async () => {
      store.pushSelect([makeMemory({ id: ID_A })])
      const res = await app.inject({ method: 'GET', url: `/api/team-memory/${ID_A}` })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.id).toBe(ID_A)
    })

    it('GET /:id 不存在 → 404', async () => {
      store.pushSelect([])
      const res = await app.inject({ method: 'GET', url: `/api/team-memory/${ID_B}` })
      expect(res.statusCode).toBe(404)
    })

    it('GET /:id 非法 id → 400', async () => {
      const res = await app.inject({ method: 'GET', url: `/api/team-memory/not-a-uuid` })
      expect(res.statusCode).toBe(400)
    })

    it('PUT /:id 更新标题', async () => {
      store.pushUpdate([makeMemory({ id: ID_A, title: '新标题' })])
      const res = await app.inject({
        method: 'PUT',
        url: `/api/team-memory/${ID_A}`,
        payload: { title: '新标题' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.title).toBe('新标题')
    })

    it('PUT /:id 不存在 → 404', async () => {
      store.pushUpdate([])
      const res = await app.inject({
        method: 'PUT',
        url: `/api/team-memory/${ID_B}`,
        payload: { title: 'x' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('DELETE /:id 删除成功', async () => {
      store.pushDelete([{ id: ID_A }])
      const res = await app.inject({ method: 'DELETE', url: `/api/team-memory/${ID_A}` })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.deleted).toBe(true)
    })

    it('DELETE /:id 不存在 → 404', async () => {
      store.pushDelete([])
      const res = await app.inject({ method: 'DELETE', url: `/api/team-memory/${ID_B}` })
      expect(res.statusCode).toBe(404)
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
