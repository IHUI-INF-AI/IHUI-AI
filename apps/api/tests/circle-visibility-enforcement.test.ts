// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify, { type FastifyError } from 'fastify'
import { circles, circlePosts } from '@ihui/database'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const ADMIN_ID = '22222222-2222-4222-8222-222222222222'
const CIRCLE_ID = '33333333-3333-4333-8333-333333333333'
const SLUG = 'hidden-circle'
const HIDDEN_NAME = '隐藏圈子-甲'
const PREFIX = '/api'

/**
 * F-330 夹具:圈子 isPublished 只作用于列表 ⇒ 详情/帖子列表/发帖三处读可见性越权。
 *
 * 这里跑生产 handler + 生产 community-queries(只把 db 出口换成顺序队列),断言的是
 * "隐藏圈子不返回行、不建帖、不发第二段查询",而不是只断状态码:
 *  - 读链:findCircleById/BySlug 必须带 is_published 条件(直接遍历 drizzle 条件树的列名);
 *  - 写链:非成员/隐藏圈子那一步之后必须**零 insert**。
 */
const h = vi.hoisted(() => {
  const queue: { items: unknown[][] } = { items: [] }
  const writes: Array<{ op: string; table: unknown }> = []
  const state = {
    userId: '',
    roleId: 0,
    unauth: false,
    selectCalls: 0,
    lastWhere: null as unknown,
  }
  function makeChain(): Record<string, unknown> {
    const chain: Record<string, unknown> = {
      then: (resolve: (v: unknown[]) => unknown) => {
        const result = queue.items.length > 0 ? queue.items.shift()! : []
        return Promise.resolve(result).then(resolve)
      },
    }
    for (const m of [
      'from',
      'limit',
      'orderBy',
      'offset',
      'leftJoin',
      'values',
      'set',
      'returning',
      'onConflictDoNothing',
    ]) {
      chain[m] = () => chain
    }
    chain.where = (cond: unknown) => {
      state.lastWhere = cond
      return chain
    }
    return chain
  }
  const dbMock = {
    select: () => {
      state.selectCalls += 1
      return makeChain()
    },
    insert: (t: unknown) => {
      writes.push({ op: 'insert', table: t })
      return makeChain()
    },
    update: (t: unknown) => {
      writes.push({ op: 'update', table: t })
      return makeChain()
    },
    delete: (t: unknown) => {
      writes.push({ op: 'delete', table: t })
      return makeChain()
    },
    execute: async () => [],
  }
  return { queue, writes, state, makeChain, dbMock }
})

const authMock = vi.hoisted(() => ({
  authenticate: vi.fn(async (request: { userId?: string; jwtPayload?: unknown }) => {
    if (h.state.unauth) {
      const err = new Error('Authentication required') as Error & { statusCode: number }
      err.statusCode = 401
      throw err
    }
    request.userId = h.state.userId
    request.jwtPayload = { userId: h.state.userId, roleId: h.state.roleId }
    return request.jwtPayload
  }),
  hasHumanJwtCredential: vi.fn(
    (request: { headers: Record<string, unknown> }) =>
      typeof request.headers.authorization === 'string' &&
      request.headers.authorization.startsWith('Bearer '),
  ),
}))

const sanitizeMock = vi.hoisted(() => vi.fn())

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: authMock.authenticate,
  hasHumanJwtCredential: authMock.hasHumanJwtCredential,
}))

vi.mock('../src/db/index.js', () => ({
  db: h.dbMock,
  dbRead: { select: () => h.dbMock.select() },
}))

vi.mock('../src/db/sensitive-words-queries.js', () => ({
  sanitizeUgcInput: sanitizeMock,
}))

import circlesRoutes from '../src/routes/community/circles.js'
import { findCircleById, findCircleBySlug } from '../src/db/community-queries.js'

const HIDDEN_CIRCLE = {
  id: CIRCLE_ID,
  name: HIDDEN_NAME,
  slug: SLUG,
  description: null,
  coverImage: null,
  categoryId: null,
  cidList: null,
  memberCount: 0,
  postCount: 1,
  isPublished: false,
  createdBy: USER_ID,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const PUBLISHED_CIRCLE = { ...HIDDEN_CIRCLE, name: '已发布圈子-乙', isPublished: true }

const POST_ROW = {
  id: '44444444-4444-4444-8444-444444444444',
  circleId: CIRCLE_ID,
  userId: USER_ID,
  title: '帖子',
  content: '正文',
  images: null,
  status: 1,
}

const MEMBER_ROW = { id: '55555555-5555-4555-8555-555555555555', circleId: CIRCLE_ID, userId: USER_ID, status: 1 }

/** 遍历 drizzle 条件树,收集其中出现的列名(is_published / id / slug...)。 */
function columnNames(node: unknown, out: string[] = []): string[] {
  if (!node || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (const n of node) columnNames(n, out)
    return out
  }
  const obj = node as { name?: unknown; queryChunks?: unknown[] }
  if (typeof obj.name === 'string') out.push(obj.name)
  if (Array.isArray(obj.queryChunks)) for (const c of obj.queryChunks) columnNames(c, out)
  return out
}

function writesNamed() {
  return h.writes.map((w) => ({
    op: w.op,
    table: w.table === circles ? 'circles' : w.table === circlePosts ? 'circlePosts' : 'other',
  }))
}

describe('F-330 圈子可见性闸:详情/帖子列表/发帖', () => {
  const app = Fastify({ logger: false })

  beforeAll(async () => {
    app.setErrorHandler((err: FastifyError, _request, reply) => {
      const statusCode =
        err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500
      reply.status(statusCode).send({ code: statusCode, message: err.message })
    })
    await app.register(circlesRoutes, { prefix: PREFIX })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    h.queue.items.length = 0
    h.writes.length = 0
    h.state.userId = USER_ID
    h.state.roleId = 0
    h.state.unauth = false
    h.state.selectCalls = 0
    h.state.lastWhere = null
    sanitizeMock.mockReset()
    sanitizeMock.mockImplementation(async (fields: Record<string, string>) => ({
      ok: true,
      fields: {
        title: { text: fields.title },
        content: { text: fields.content },
        name: { text: fields.name },
        description: { text: fields.description },
      },
    }))
  })

  const asUser = { authorization: 'Bearer user-token' }
  const asAdmin = { authorization: 'Bearer admin-token' }
  const postBody = { title: '帖子标题', content: '帖子正文' }

  // ① 票面写"未登录详情/帖子 401";但这两条 GET 在既有路由里是**公开读**(preHandler 白名单)。
  // 本票范围只做隐藏圈子可见性与发帖闸,不动公开读口径,故此处如实断言 200;401 只覆盖发帖。
  it('① 未登录:公开读详情/帖子仍是 200(票面 401 与既有公开读白名单不符);未登录发帖 401 且零写', async () => {
    h.queue.items.push([PUBLISHED_CIRCLE])
    const detail = await app.inject({ method: 'GET', url: `${PREFIX}/circles/${CIRCLE_ID}` })
    expect(detail.statusCode).toBe(200)

    h.queue.items.push([PUBLISHED_CIRCLE], [[POST_ROW]], [[{ count: 1 }]])
    const posts = await app.inject({ method: 'GET', url: `${PREFIX}/circles/${CIRCLE_ID}/posts` })
    expect(posts.statusCode).toBe(200)

    h.state.unauth = true
    const create = await app.inject({
      method: 'POST',
      url: `${PREFIX}/circles/${CIRCLE_ID}/posts`,
      payload: postBody,
    })
    expect(create.statusCode).toBe(401)
    expect(writesNamed()).toEqual([])
  })

  it('② 普通用户读 isPublished=false 圈子详情 ⇒ 404,体不含圈子名,且只有圈子那一次查询', async () => {
    h.queue.items.push([HIDDEN_CIRCLE])
    const res = await app.inject({
      method: 'GET',
      url: `${PREFIX}/circles/${CIRCLE_ID}`,
      headers: asUser,
    })
    expect(res.statusCode).toBe(404)
    expect(JSON.stringify(res.json())).not.toContain(HIDDEN_NAME)
    expect(h.state.selectCalls).toBe(1)
    expect(writesNamed()).toEqual([])
  })

  it('③ 普通用户读隐藏圈子帖子 ⇒ 404,零帖子查询(只发生圈子可见性那一次 select)', async () => {
    h.queue.items.push([HIDDEN_CIRCLE], [[POST_ROW]], [[{ count: 1 }]])
    const res = await app.inject({
      method: 'GET',
      url: `${PREFIX}/circles/${CIRCLE_ID}/posts`,
      headers: asUser,
    })
    expect(res.statusCode).toBe(404)
    expect(JSON.stringify(res.json())).not.toContain(HIDDEN_NAME)
    expect(h.state.selectCalls).toBe(1)
  })

  it('④ 普通用户向隐藏圈子发帖 ⇒ 404 且零 insert', async () => {
    h.queue.items.push([HIDDEN_CIRCLE], [[POST_ROW]], [])
    const res = await app.inject({
      method: 'POST',
      url: `${PREFIX}/circles/${CIRCLE_ID}/posts`,
      headers: asUser,
      payload: postBody,
    })
    expect(res.statusCode).toBe(404)
    expect(writesNamed()).toEqual([])
    expect(sanitizeMock).not.toHaveBeenCalled()
  })

  it('⑤ 普通用户向未加入的已发布圈子发帖 ⇒ 403 且零 insert(圈子表无公开可发语义 ⇒ 要成员)', async () => {
    h.queue.items.push([PUBLISHED_CIRCLE], [], [[POST_ROW]], [])
    const res = await app.inject({
      method: 'POST',
      url: `${PREFIX}/circles/${CIRCLE_ID}/posts`,
      headers: asUser,
      payload: postBody,
    })
    expect(res.statusCode).toBe(403)
    expect(writesNamed()).toEqual([])
    expect(sanitizeMock).not.toHaveBeenCalled()
  })

  it('⑥ 成员向已发布圈子发帖 ⇒ 成功一次(insert circle_posts 一次 + circles 计数一次)', async () => {
    h.queue.items.push([PUBLISHED_CIRCLE], [[MEMBER_ROW]], [[POST_ROW]], [])
    const res = await app.inject({
      method: 'POST',
      url: `${PREFIX}/circles/${CIRCLE_ID}/posts`,
      headers: asUser,
      payload: postBody,
    })
    expect(res.statusCode).toBe(201)
    expect(writesNamed()).toEqual([
      { op: 'insert', table: 'circlePosts' },
      { op: 'update', table: 'circles' },
    ])
  })

  it('⑦ 管理员可绕过:读隐藏圈子详情 200;向隐藏圈子发帖 201 且不查成员关系', async () => {
    h.state.userId = ADMIN_ID
    h.state.roleId = 1
    h.queue.items.push([HIDDEN_CIRCLE])
    const detail = await app.inject({
      method: 'GET',
      url: `${PREFIX}/circles/${CIRCLE_ID}`,
      headers: asAdmin,
    })
    expect(detail.statusCode).toBe(200)
    expect(detail.json().data.circle.name).toBe(HIDDEN_NAME)

    h.queue.items.push([HIDDEN_CIRCLE], [[POST_ROW]], [])
    const selectsBeforeCreate = h.state.selectCalls
    const create = await app.inject({
      method: 'POST',
      url: `${PREFIX}/circles/${CIRCLE_ID}/posts`,
      headers: asAdmin,
      payload: postBody,
    })
    expect(create.statusCode).toBe(201)
    // 发帖只新增圈子可见性那一次 select:管理员不落成员校验
    expect(h.state.selectCalls - selectsBeforeCreate).toBe(1)
    expect(writesNamed()).toEqual([
      { op: 'insert', table: 'circlePosts' },
      { op: 'update', table: 'circles' },
    ])
  })
})

describe('F-330 查询层:isPublished 条件由查询统一携带', () => {
  beforeEach(() => {
    h.queue.items.length = 0
    h.state.selectCalls = 0
    h.state.lastWhere = null
  })

  it('findCircleById(publishedOnly=true) 的 where 含 is_published 与 id;隐藏行不返回', async () => {
    h.queue.items.push([])
    const found = await findCircleById(CIRCLE_ID, { publishedOnly: true })
    expect(found).toBeUndefined()
    expect(columnNames(h.state.lastWhere)).toEqual(expect.arrayContaining(['id', 'is_published']))
  })

  it('findCircleById 默认(publishedOnly=false)保留管理端口径:where 不额外加 is_published', async () => {
    h.queue.items.push([HIDDEN_CIRCLE])
    const found = await findCircleById(CIRCLE_ID)
    expect(found).toEqual(HIDDEN_CIRCLE)
    expect(columnNames(h.state.lastWhere)).not.toContain('is_published')
  })

  it('findCircleBySlug(publishedOnly=true) 的 where 含 slug 与 is_published', async () => {
    h.queue.items.push([])
    const found = await findCircleBySlug(SLUG, { publishedOnly: true })
    expect(found).toBeUndefined()
    expect(columnNames(h.state.lastWhere)).toEqual(expect.arrayContaining(['slug', 'is_published']))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
