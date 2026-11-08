// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify, { type FastifyError } from 'fastify'
import { circles, circleMembers, circlePostComments, circlePosts } from '@ihui/database'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const PARENT_AUTHOR_ID = '22222222-2222-4222-8222-222222222222'
const MEMBER_ID = '33333333-3333-4333-8333-333333333333'
const OUTSIDER_ID = '99999999-9999-4999-8999-999999999999'
const MISSING_ID = '88888888-8888-4888-8888-888888888888'
const CIRCLE_ID = '44444444-4444-4444-8444-444444444444'
const POST_ID = '55555555-5555-4555-8555-555555555555'
const PARENT_ID = '66666666-6666-4666-8666-666666666666'
const COMMENT_ID = '77777777-7777-4777-8777-777777777777'
const PREFIX = '/api'

/**
 * F-332 夹具:圈子评论发表需过敏感词过滤、replyCount 原子自增、replyUserId 归属校验。
 *
 * 跑生产 handler + 生产 community-queries(只把 db 出口换成按表键控的队列):
 *  - 断言"零 insert"用写入日志,不只看状态码;
 *  - 断言 replyCount 用 update 的 set 载荷(必须是 sql 片段而非读改写常量)。
 */
const h = vi.hoisted(() => {
  const selectQueue = new Map<unknown, unknown[][]>()
  const writeQueue = new Map<unknown, unknown[][]>()
  const writes: Array<{ op: string; table: unknown }> = []
  const captured = {
    insertValues: undefined as unknown,
    setValues: undefined as unknown,
  }
  const state = {
    userId: '',
    roleId: 0,
    unauth: false,
    selectCalls: 0,
  }

  function makeChain(
    kind: 'select' | 'insert' | 'update' | 'delete',
    initialTable?: unknown,
  ): Record<string, unknown> {
    const ctx: { table: unknown } = { table: initialTable }
    const chain: Record<string, unknown> = {}
    for (const m of [
      'limit',
      'orderBy',
      'offset',
      'leftJoin',
      'returning',
      'onConflictDoNothing',
    ]) {
      chain[m] = () => chain
    }
    chain.from = (t: unknown) => {
      ctx.table = t
      return chain
    }
    chain.where = () => chain
    chain.values = (v: unknown) => {
      captured.insertValues = v
      return chain
    }
    chain.set = (v: unknown) => {
      captured.setValues = v
      return chain
    }
    chain.then = (resolve: (v: unknown[]) => unknown) => {
      const q = kind === 'select' ? selectQueue.get(ctx.table) : writeQueue.get(ctx.table)
      const result = q && q.length > 0 ? q.shift()! : []
      return Promise.resolve(result).then(resolve)
    }
    return chain
  }

  const dbMock = {
    select: () => {
      state.selectCalls += 1
      return makeChain('select')
    },
    insert: (t: unknown) => {
      writes.push({ op: 'insert', table: t })
      return makeChain('insert', t)
    },
    update: (t: unknown) => {
      writes.push({ op: 'update', table: t })
      return makeChain('update', t)
    },
    delete: (t: unknown) => {
      writes.push({ op: 'delete', table: t })
      return makeChain('delete', t)
    },
    execute: async () => [],
  }

  return { selectQueue, writeQueue, writes, captured, state, dbMock }
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

const POST_ROW = {
  id: POST_ID,
  circleId: CIRCLE_ID,
  userId: USER_ID,
  title: '帖子标题',
  content: '帖子正文',
  images: null,
  replyCount: 1,
  status: 1,
}
const PARENT_COMMENT = {
  id: PARENT_ID,
  postId: POST_ID,
  userId: PARENT_AUTHOR_ID,
  content: '父评论',
}
const MEMBER_ROW = {
  id: 'membership-a',
  circleId: CIRCLE_ID,
  userId: MEMBER_ID,
  status: 1,
}
const COMMENT_ROW = {
  id: COMMENT_ID,
  postId: POST_ID,
  userId: USER_ID,
  content: '评论',
  pid: null,
  replyUserId: null,
  likeCount: 0,
  status: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
}
const HIDDEN_CIRCLE = {
  id: CIRCLE_ID,
  name: '隐藏圈子-丙',
  slug: 'hidden-circle',
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

function queueSelect(table: unknown, rows: unknown[]) {
  const q = h.selectQueue.get(table) ?? []
  q.push(rows)
  h.selectQueue.set(table, q)
}

function queueWrite(table: unknown, rows: unknown[]) {
  const q = h.writeQueue.get(table) ?? []
  q.push(rows)
  h.writeQueue.set(table, q)
}

function insertsOf(table: unknown) {
  return h.writes.filter((w) => w.op === 'insert' && w.table === table)
}

/** 展平 drizzle sql 片段:列名 + 文本 chunk,用于断言 "+ 1"。 */
function sqlText(node: unknown): string {
  if (node == null) return ''
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(sqlText).join('')
  if (typeof node === 'object') {
    const obj = node as { name?: unknown; queryChunks?: unknown[]; value?: unknown }
    let out = ''
    if (typeof obj.name === 'string') out += obj.name
    if (Array.isArray(obj.value)) out += obj.value.join('')
    if (Array.isArray(obj.queryChunks)) out += obj.queryChunks.map(sqlText).join('')
    return out
  }
  return ''
}

describe('F-332 圈子评论发布:内容过滤 / 原子计数 / 回复归属', () => {
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
    h.selectQueue.clear()
    h.writeQueue.clear()
    h.writes.length = 0
    h.captured.insertValues = undefined
    h.captured.setValues = undefined
    h.state.userId = USER_ID
    h.state.roleId = 0
    h.state.unauth = false
    h.state.selectCalls = 0
    sanitizeMock.mockReset()
    sanitizeMock.mockImplementation(async (fields: Record<string, string>) => ({
      ok: true,
      fields: Object.fromEntries(
        Object.entries(fields).map(([k, v]) => [k, { text: v, hits: [] }]),
      ),
      hits: [],
    }))
  })

  const asUser = { authorization: 'Bearer user-token' }
  const commentUrl = `${PREFIX}/circles/posts/${POST_ID}/comment`

  it('① 未登录发表评论 ⇒ 401,零 insert,不触达敏感词过滤', async () => {
    h.state.unauth = true
    const res = await app.inject({
      method: 'POST',
      url: commentUrl,
      payload: { content: '正常评论' },
    })
    expect(res.statusCode).toBe(401)
    expect(h.writes).toEqual([])
    expect(sanitizeMock).not.toHaveBeenCalled()
  })

  it('② 违规文本 ⇒ 400,零 insert,过滤入参形状与 topics 对齐', async () => {
    queueSelect(circlePosts, [POST_ROW])
    // 旧实现会走到 insert;保留这条出口,让红态暴露"违规内容被入库"。
    queueWrite(circlePostComments, [COMMENT_ROW])
    sanitizeMock.mockImplementation(async () => ({
      ok: false,
      fields: { content: { text: '***', hits: [{ word: '违规词', level: 2, field: 'content' }] } },
      hits: [{ word: '违规词', level: 2, field: 'content' }],
    }))

    const res = await app.inject({
      method: 'POST',
      url: commentUrl,
      headers: asUser,
      payload: { content: '包含违规词的内容' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('违规')
    expect(insertsOf(circlePostComments)).toEqual([])
    expect(sanitizeMock).toHaveBeenCalledTimes(1)
    expect(sanitizeMock.mock.calls[0]?.[0]).toEqual({ content: '包含违规词的内容' })
    expect(sanitizeMock.mock.calls[0]?.[1]).toMatchObject({
      action: 'ugc.comment.create',
      resourceId: POST_ID,
      userId: USER_ID,
    })
  })

  it('③ 合法评论 ⇒ 201,insert 使用过滤后文本', async () => {
    queueSelect(circlePosts, [POST_ROW])
    queueWrite(circlePostComments, [COMMENT_ROW])
    sanitizeMock.mockImplementation(async (fields: Record<string, string>) => ({
      ok: true,
      fields: { content: { text: `过滤后:${fields.content}`, hits: [] } },
      hits: [],
    }))

    const res = await app.inject({
      method: 'POST',
      url: commentUrl,
      headers: asUser,
      payload: { content: '边缘文本' },
    })
    expect(res.statusCode).toBe(201)
    expect(h.writes).toEqual([
      { op: 'insert', table: circlePostComments },
      { op: 'update', table: circlePosts },
    ])
    expect((h.captured.insertValues as { content?: string }).content).toBe('过滤后:边缘文本')
  })

  it('④ replyCount 必须是原子自增 sql 片段,不是读改写常量', async () => {
    queueSelect(circlePosts, [POST_ROW])
    queueWrite(circlePostComments, [COMMENT_ROW])

    const res = await app.inject({
      method: 'POST',
      url: commentUrl,
      headers: asUser,
      payload: { content: '合法评论' },
    })
    expect(res.statusCode).toBe(201)

    const set = h.captured.setValues as { replyCount?: unknown } | undefined
    expect(set).toBeTruthy()
    expect(typeof set!.replyCount).not.toBe('number')
    const expr = sqlText(set!.replyCount)
    expect(expr).toContain('reply_count')
    expect(expr).toContain('+ 1')
    expect(expr).not.toMatch(/^\d+$/)
  })

  it('⑤ replyUserId 指向非圈子成员 ⇒ 403,零 insert', async () => {
    queueSelect(circlePosts, [POST_ROW])
    queueSelect(circleMembers, [])
    queueWrite(circlePostComments, [COMMENT_ROW])

    const res = await app.inject({
      method: 'POST',
      url: commentUrl,
      headers: asUser,
      payload: { content: '合法评论', replyUserId: OUTSIDER_ID },
    })
    expect(res.statusCode).toBe(403)
    expect(insertsOf(circlePostComments)).toEqual([])
    expect(sanitizeMock).not.toHaveBeenCalled()
  })

  it('⑤b replyUserId 指向不存在的用户 ⇒ 403,零 insert', async () => {
    queueSelect(circlePosts, [POST_ROW])
    queueSelect(circleMembers, [])
    queueWrite(circlePostComments, [COMMENT_ROW])

    const res = await app.inject({
      method: 'POST',
      url: commentUrl,
      headers: asUser,
      payload: { content: '合法评论', replyUserId: MISSING_ID },
    })
    expect(res.statusCode).toBe(403)
    expect(insertsOf(circlePostComments)).toEqual([])
    expect(sanitizeMock).not.toHaveBeenCalled()
  })

  it('⑥ 合法回复对象(父评论作者)⇒ 201,replyUserId 落库', async () => {
    queueSelect(circlePosts, [POST_ROW])
    queueSelect(circlePostComments, [PARENT_COMMENT])
    queueWrite(circlePostComments, [COMMENT_ROW])

    const res = await app.inject({
      method: 'POST',
      url: commentUrl,
      headers: asUser,
      payload: {
        content: '回复父评论',
        pid: PARENT_ID,
        replyUserId: PARENT_AUTHOR_ID,
      },
    })
    expect(res.statusCode).toBe(201)
    expect((h.captured.insertValues as { replyUserId?: string }).replyUserId).toBe(
      PARENT_AUTHOR_ID,
    )
  })

  it('⑥b 合法 @ 圈子成员(无 pid)⇒ 201,replyUserId 落库', async () => {
    queueSelect(circlePosts, [POST_ROW])
    queueSelect(circleMembers, [[MEMBER_ROW]])
    queueWrite(circlePostComments, [COMMENT_ROW])

    const res = await app.inject({
      method: 'POST',
      url: commentUrl,
      headers: asUser,
      payload: { content: '@ 成员', replyUserId: MEMBER_ID },
    })
    expect(res.statusCode).toBe(201)
    expect((h.captured.insertValues as { replyUserId?: string }).replyUserId).toBe(MEMBER_ID)
  })

  it('⑦ 既有闸门回归:未登录 401;隐藏圈子 404;帖子不存在 404 且均零 insert', async () => {
    h.state.unauth = true
    const unauth = await app.inject({
      method: 'POST',
      url: commentUrl,
      payload: { content: '评论' },
    })
    expect(unauth.statusCode).toBe(401)
    expect(h.writes).toEqual([])

    h.state.unauth = false
    queueSelect(circles, [HIDDEN_CIRCLE])
    const hidden = await app.inject({
      method: 'GET',
      url: `${PREFIX}/circles/${CIRCLE_ID}`,
      headers: asUser,
    })
    expect(hidden.statusCode).toBe(404)
    expect(h.writes).toEqual([])

    const missingPost = await app.inject({
      method: 'POST',
      url: commentUrl,
      headers: asUser,
      payload: { content: '评论' },
    })
    expect(missingPost.statusCode).toBe(404)
    expect(h.writes).toEqual([])
  })
})
