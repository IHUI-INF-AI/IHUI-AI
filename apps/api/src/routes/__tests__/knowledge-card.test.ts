// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * Knowledge Card 路由测试 (2026-09-10 新增,2-1 项目知识引擎)
 *
 * 覆盖:
 * 1. 未授权 401(无登录态)
 * 2. 创建(source 固定 manual,作者 = 当前用户)
 * 3. 内部调用写卡(X-Internal-Secret 绕过 JWT,source=agent,userId 取 body)
 * 4. 列表(按 repoName;kind/tag 过滤透传)
 * 5. 关键词检索 /search
 * 6. 详情(全局卡可见 / 他人卡 404)
 * 7. 更新(字段编辑 + markUsed 打点)/ 删除(仅本人)
 * 8. 校验失败 400 / 不存在 404
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
// Mock:config(内部调用密钥由 configState 控制)
// ─────────────────────────────────────────────────────────────
const configState = vi.hoisted(() => ({ callbackSecret: '' }))

vi.mock('../../config/index.js', () => ({
  // getter 动态读取:内部调用测试可在 beforeEach 中切换密钥
  config: {
    get AI_CALLBACK_SECRET() {
      return configState.callbackSecret
    },
  },
}))

// ─────────────────────────────────────────────────────────────
// Mock:@ihui/database(提供被查询构建器引用的 knowledgeCards)
// ─────────────────────────────────────────────────────────────
vi.mock('@ihui/database', () => ({
  knowledgeCards: {
    id: 'id',
    userId: 'user_id',
    repoName: 'repo_name',
    kind: 'kind',
    source: 'source',
    title: 'title',
    content: 'content',
    tags: 'tags',
    context: 'context',
    confidence: 'confidence',
    useCount: 'use_count',
    lastUsedAt: 'last_used_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
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

import { knowledgeCardRoutes } from '../knowledge-card.js'

// ─────────────────────────────────────────────────────────────
// 测试数据
// ─────────────────────────────────────────────────────────────

const ID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function makeCard(overrides: Record<string, unknown> = {}) {
  return {
    id: ID_A,
    userId: 'user-1',
    repoName: 'demo-repo',
    kind: 'experience',
    source: 'manual',
    title: 'Drizzle 迁移规范',
    content: '经验:迁移文件需幂等,使用 IF NOT EXISTS',
    tags: ['drizzle', 'migration'],
    context: null,
    confidence: 100,
    useCount: 0,
    lastUsedAt: null,
    createdAt: new Date('2026-09-10T00:00:00Z'),
    updatedAt: new Date('2026-09-10T00:00:00Z'),
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────
// 套件
// ─────────────────────────────────────────────────────────────

describe('Knowledge Card 路由', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.setErrorHandler((err, _request, reply) => {
      const e = err as Error & { statusCode?: number }
      const statusCode = e.statusCode && e.statusCode >= 400 ? e.statusCode : 500
      reply.status(statusCode).send({ code: statusCode, message: e.message || '服务器错误' })
    })
    await app.register(knowledgeCardRoutes, { prefix: '/api/knowledge-cards' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    store.reset()
    authState.fail = false
    authState.userId = 'user-1'
    configState.callbackSecret = ''
  })

  // ───────────────────────────────────────────────────────────
  // 1. 未授权 401
  // ───────────────────────────────────────────────────────────
  describe('鉴权', () => {
    it('未登录 GET 列表 → 401', async () => {
      authState.fail = true
      const res = await app.inject({
        method: 'GET',
        url: '/api/knowledge-cards?repoName=demo-repo',
      })
      expect(res.statusCode).toBe(401)
      expect(res.json().code).toBe(401)
    })

    it('未登录 POST 创建 → 401', async () => {
      authState.fail = true
      const res = await app.inject({
        method: 'POST',
        url: '/api/knowledge-cards',
        payload: { repoName: 'demo-repo', title: 't', content: 'c' },
      })
      expect(res.statusCode).toBe(401)
    })
  })

  // ───────────────────────────────────────────────────────────
  // 2. 创建
  // ───────────────────────────────────────────────────────────
  describe('POST /api/knowledge-cards', () => {
    it('创建卡片:source 固定 manual,作者 = 当前用户', async () => {
      store.pushInsert([makeCard()])
      const res = await app.inject({
        method: 'POST',
        url: '/api/knowledge-cards',
        payload: {
          repoName: 'demo-repo',
          title: 'Drizzle 迁移规范',
          content: '经验:迁移文件需幂等,使用 IF NOT EXISTS',
          tags: ['drizzle', 'migration'],
        },
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.id).toBe(ID_A)
      expect(body.data.source).toBe('manual')
      expect(body.data.kind).toBe('experience')
      // 入库 values:source 覆写为 manual,userId 取当前用户
      const values = store.insertValues[0] as Record<string, unknown>
      expect(values.source).toBe('manual')
      expect(values.userId).toBe('user-1')
    })

    it('缺少 title → 400 校验失败', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/knowledge-cards',
        payload: { repoName: 'demo-repo', content: 'c' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('非法 kind → 400 校验失败', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/knowledge-cards',
        payload: { repoName: 'demo-repo', kind: 'random', title: 't', content: 'c' },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  // ───────────────────────────────────────────────────────────
  // 3. 内部调用写卡(ai-service 经验抽取,X-Internal-Secret)
  // ───────────────────────────────────────────────────────────
  describe('POST /api/knowledge-cards(内部调用)', () => {
    const UUID_U2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    const SECRET = 'test-internal-secret'

    beforeEach(() => {
      configState.callbackSecret = SECRET
    })

    it('密钥正确:绕过登录,source=agent,userId 取 body', async () => {
      store.pushInsert([makeCard({ source: 'agent', userId: UUID_U2 })])
      const res = await app.inject({
        method: 'POST',
        url: '/api/knowledge-cards',
        headers: { 'x-internal-secret': SECRET },
        payload: {
          repoName: 'demo-repo',
          title: 'Windows 构建路径坑',
          content: 'PowerShell 下路径需双引号包裹',
          kind: 'pitfall',
          userId: UUID_U2,
        },
      })
      expect(res.statusCode).toBe(201)
      const values = store.insertValues[0] as Record<string, unknown>
      expect(values.source).toBe('agent')
      expect(values.kind).toBe('pitfall')
      expect(values.userId).toBe(UUID_U2)
    })

    it('内部调用不带 userId → 全局卡(userId=null)', async () => {
      store.pushInsert([makeCard({ source: 'agent', userId: null })])
      const res = await app.inject({
        method: 'POST',
        url: '/api/knowledge-cards',
        headers: { 'x-internal-secret': SECRET },
        payload: { repoName: 'demo-repo', title: 't', content: 'c' },
      })
      expect(res.statusCode).toBe(201)
      const values = store.insertValues[0] as Record<string, unknown>
      expect(values.source).toBe('agent')
      expect(values.userId).toBeNull()
    })

    it('密钥不匹配 → 回退登录校验(未登录 401)', async () => {
      authState.fail = true
      const res = await app.inject({
        method: 'POST',
        url: '/api/knowledge-cards',
        headers: { 'x-internal-secret': 'wrong-secret' },
        payload: { repoName: 'demo-repo', title: 't', content: 'c' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('未配置 AI_CALLBACK_SECRET → 内部头无效,走登录校验', async () => {
      configState.callbackSecret = ''
      authState.fail = true
      const res = await app.inject({
        method: 'POST',
        url: '/api/knowledge-cards',
        headers: { 'x-internal-secret': SECRET },
        payload: { repoName: 'demo-repo', title: 't', content: 'c' },
      })
      expect(res.statusCode).toBe(401)
    })
  })

  // ───────────────────────────────────────────────────────────
  // 3. 列表 + 过滤
  // ───────────────────────────────────────────────────────────
  describe('GET /api/knowledge-cards(列表)', () => {
    it('按 repoName 列卡片', async () => {
      store.pushSelect([makeCard()])
      const res = await app.inject({
        method: 'GET',
        url: '/api/knowledge-cards?repoName=demo-repo',
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data).toHaveLength(1)
      expect(res.json().data[0].repoName).toBe('demo-repo')
    })

    it('kind 过滤:仅返回 kind=pitfall 的卡片', async () => {
      store.pushSelect([makeCard({ kind: 'pitfall', title: 'PG jsonb ILIKE 踩坑' })])
      const res = await app.inject({
        method: 'GET',
        url: '/api/knowledge-cards?repoName=demo-repo&kind=pitfall',
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data[0].kind).toBe('pitfall')
    })

    it('缺少 repoName → 400', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/knowledge-cards' })
      expect(res.statusCode).toBe(400)
    })
  })

  // ───────────────────────────────────────────────────────────
  // 4. 关键词检索
  // ───────────────────────────────────────────────────────────
  describe('GET /api/knowledge-cards/search', () => {
    it('按关键词检索,返回含 content 的命中卡片', async () => {
      store.pushSelect([makeCard()])
      const res = await app.inject({
        method: 'GET',
        url: '/api/knowledge-cards/search?q=%E8%BF%81%E7%A7%BB', // "迁移"
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data).toHaveLength(1)
      expect(res.json().data[0].content).toContain('迁移')
    })

    it('缺少 q → 400', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/knowledge-cards/search' })
      expect(res.statusCode).toBe(400)
    })
  })

  // ───────────────────────────────────────────────────────────
  // 5. 详情(可见性)
  // ───────────────────────────────────────────────────────────
  describe('GET /api/knowledge-cards/:id', () => {
    it('本人的卡片 → 200', async () => {
      store.pushSelect([makeCard()])
      const res = await app.inject({ method: 'GET', url: `/api/knowledge-cards/${ID_A}` })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.id).toBe(ID_A)
    })

    it('全局卡片(userId=null)→ 200', async () => {
      store.pushSelect([makeCard({ userId: null })])
      const res = await app.inject({ method: 'GET', url: `/api/knowledge-cards/${ID_A}` })
      expect(res.statusCode).toBe(200)
    })

    it('他人的卡片 → 404', async () => {
      store.pushSelect([makeCard({ userId: 'user-2' })])
      const res = await app.inject({ method: 'GET', url: `/api/knowledge-cards/${ID_A}` })
      expect(res.statusCode).toBe(404)
    })

    it('不存在 → 404', async () => {
      store.pushSelect([])
      const res = await app.inject({ method: 'GET', url: `/api/knowledge-cards/${ID_A}` })
      expect(res.statusCode).toBe(404)
    })
  })

  // ───────────────────────────────────────────────────────────
  // 6. 更新(字段编辑 + markUsed 打点)
  // ───────────────────────────────────────────────────────────
  describe('PATCH /api/knowledge-cards/:id', () => {
    it('字段编辑:返回更新后的卡片', async () => {
      store.pushSelect([{ id: ID_A, userId: 'user-1' }]) // 权属预查
      store.pushUpdate([makeCard({ title: 'Drizzle 迁移规范(修订)' })])
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/knowledge-cards/${ID_A}`,
        payload: { title: 'Drizzle 迁移规范(修订)' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.title).toBe('Drizzle 迁移规范(修订)')
    })

    it('markUsed=true:打点 useCount+1 并刷新 lastUsedAt', async () => {
      store.pushSelect([{ id: ID_A, userId: 'user-1' }]) // 权属预查
      store.pushUpdate([makeCard({ useCount: 3, lastUsedAt: new Date() })])
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/knowledge-cards/${ID_A}`,
        payload: { markUsed: true },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.useCount).toBe(3)
      expect(res.json().data.lastUsedAt).not.toBeNull()
    })

    it('他人的卡片 → 404(无权修改)', async () => {
      store.pushSelect([{ id: ID_A, userId: 'user-2' }])
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/knowledge-cards/${ID_A}`,
        payload: { title: 'x' },
      })
      expect(res.statusCode).toBe(404)
    })
  })

  // ───────────────────────────────────────────────────────────
  // 8. 删除
  // ───────────────────────────────────────────────────────────
  describe('DELETE /api/knowledge-cards/:id', () => {
    it('本人的卡片 → 删除成功', async () => {
      store.pushSelect([{ id: ID_A, userId: 'user-1' }])
      store.pushDelete([{ deleted: true }])
      const res = await app.inject({ method: 'DELETE', url: `/api/knowledge-cards/${ID_A}` })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.deleted).toBe(true)
    })

    it('他人的卡片 → 404(无权删除)', async () => {
      store.pushSelect([{ id: ID_A, userId: 'user-2' }])
      const res = await app.inject({ method: 'DELETE', url: `/api/knowledge-cards/${ID_A}` })
      expect(res.statusCode).toBe(404)
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
