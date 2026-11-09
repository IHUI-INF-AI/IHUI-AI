// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify, { type FastifyError } from 'fastify'
import { circlePosts } from '@ihui/database'

const AUTHOR_ID = '11111111-1111-4111-8111-111111111111'
const VIEWER_ID = '22222222-2222-4222-8222-222222222222'
const ADMIN_ID = '33333333-3333-4333-8333-333333333333'
const CIRCLE_ID = '44444444-4444-4444-8444-444444444444'
const PRIVATE_ID = '55555555-5555-4555-8555-555555555555'
const FOLLOWERS_ID = '66666666-6666-4666-8666-666666666666'
const PUBLIC_ID = '77777777-7777-4777-8777-777777777777'
const PREFIX = '/api'

/**
 * F-335 夹具:POST /community/posts 接受 visibility 却丢弃 ⇒ private/followers 帖进入全局公开流。
 *
 * 口径:落库 + 读面过滤(不选 400 拒绝)。断言不只是状态码:
 *  - 写链:insert circle_posts 的 values 必须带 visibility;
 *  - 读链:非管理员的列表/详情 where 必须出现 visibility 列;followers 还必须出现
 *    user_follows 的 follower_id/following_id(关注关系由 SQL 子查询判定);
 *  - 管理员:列表绕过可见性(where 不出现 visibility)。
 */
const h = vi.hoisted(() => {
  const queue: { items: unknown[][] } = { items: [] }
  const writes: Array<{ op: string; table: unknown; values?: unknown }> = []
  const state = {
    userId: '',
    roleId: 0,
    unauth: false,
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
    select: () => makeChain(),
    insert: (t: unknown) => {
      const write: { op: string; table: unknown; values?: unknown } = { op: 'insert', table: t }
      writes.push(write)
      const chain = makeChain()
      chain.values = (v: unknown) => {
        write.values = v
        return chain
      }
      return chain
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

const sanitizeMock = vi.hoisted(() =>
  vi.fn(async (fields: Record<string, string>) => ({
    ok: true,
    fields: {
      title: { text: fields.title },
      content: { text: fields.content },
    },
  })),
)

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

import postsRoutes from '../src/routes/community/posts.js'
import circlesRoutes from '../src/routes/community/circles.js'

function row(id: string, visibility: string, userId = AUTHOR_ID) {
  return {
    id,
    circleId: CIRCLE_ID,
    userId,
    title: `${visibility}-标题`,
    content: `${visibility}-正文`,
    images: null,
    visibility,
    status: 1,
    createdAt: new Date('2026-11-08T00:00:00Z'),
    updatedAt: new Date('2026-11-08T00:00:00Z'),
  }
}

const PRIVATE_ROW = row(PRIVATE_ID, 'private')
const FOLLOWERS_ROW = row(FOLLOWERS_ID, 'followers')
const PUBLIC_ROW = row(PUBLIC_ID, 'public')

/** 遍历 drizzle 条件树,收集其中出现的列名(visibility / user_id / follower_id...)。 */
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

function postInsertValues(): Record<string, unknown> | undefined {
  const w = h.writes.find((x) => x.op === 'insert' && x.table === circlePosts)
  return w?.values as Record<string, unknown> | undefined
}

describe('F-335 社区帖子 visibility:落库 + 全局列表过滤', () => {
  const app = Fastify({ logger: false })

  beforeAll(async () => {
    app.setErrorHandler((err: FastifyError, _request, reply) => {
      const statusCode =
        err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500
      reply.status(statusCode).send({ code: statusCode, message: err.message })
    })
    await app.register(postsRoutes, { prefix: PREFIX })
    await app.register(circlesRoutes, { prefix: PREFIX })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    h.queue.items.length = 0
    h.writes.length = 0
    h.state.userId = AUTHOR_ID
    h.state.roleId = 0
    h.state.unauth = false
    h.state.lastWhere = null
    sanitizeMock.mockClear()
  })

  const asUser = { authorization: 'Bearer user-token' }
  const asAdmin = { authorization: 'Bearer admin-token' }
  const publishBody = (visibility: string) => ({
    title: '标题',
    content: '正文',
    circleId: CIRCLE_ID,
    visibility,
  })

  async function listAs(header: Record<string, string> | undefined, rows: unknown[], total: number) {
    h.queue.items.push(rows, [{ count: total }])
    const res = await app.inject({
      method: 'GET',
      url: `${PREFIX}/community/posts`,
      ...(header ? { headers: header } : {}),
    })
    return res
  }

  it('① 未登录发帖 ⇒ 401 且零 insert', async () => {
    h.state.unauth = true
    const res = await app.inject({
      method: 'POST',
      url: `${PREFIX}/community/posts`,
      payload: publishBody('private'),
    })
    expect(res.statusCode).toBe(401)
    expect(h.writes).toEqual([])
  })

  it('② 普通用户发 private ⇒ 落库带 visibility=private,且不出现在他人全局列表', async () => {
    h.queue.items.push([PRIVATE_ROW])
    const create = await app.inject({
      method: 'POST',
      url: `${PREFIX}/community/posts`,
      headers: asUser,
      payload: publishBody('private'),
    })
    expect(create.statusCode).toBe(201)
    expect(postInsertValues()).toMatchObject({ visibility: 'private' })

    // 他人看全局列表:DB 按可见性只回 public 行(旧代码无过滤会连 private 一起回)
    h.state.userId = VIEWER_ID
    const res = await listAs(asUser, [PUBLIC_ROW], 1)
    expect(res.statusCode).toBe(200)
    const list = res.json().data.list as Array<{ id: string }>
    expect(list.map((p) => p.id)).toEqual([PUBLIC_ID])
    expect(list.some((p) => p.id === PRIVATE_ID)).toBe(false)
    // 过滤证据:where 必须带 visibility,且作者分支用 user_id
    const names = columnNames(h.state.lastWhere)
    expect(names).toEqual(expect.arrayContaining(['visibility', 'user_id']))
  })

  it('③ followers 帖:关注者可见、非关注者不可见(关注关系走 user_follows 子查询)', async () => {
    h.state.userId = VIEWER_ID
    const follower = await listAs(asUser, [FOLLOWERS_ROW, PUBLIC_ROW], 2)
    expect(follower.statusCode).toBe(200)
    expect((follower.json().data.list as Array<{ id: string }>).map((p) => p.id)).toEqual([
      FOLLOWERS_ID,
      PUBLIC_ID,
    ])

    // 关注关系判定必须落在 SQL:where 含 visibility + follower_id/following_id
    const names = columnNames(h.state.lastWhere)
    expect(names).toEqual(expect.arrayContaining(['visibility', 'follower_id', 'following_id']))

    // 非关注者:DB 返回空 ⇒ 客户端拿不到 followers 帖
    h.state.userId = ADMIN_ID // 仅换个非关注者身份,roleId 仍 0
    const nonFollower = await listAs(asUser, [], 0)
    expect(nonFollower.statusCode).toBe(200)
    expect(nonFollower.json().data.list as unknown[]).toEqual([])
    expect(nonFollower.json().data.total).toBe(0)
  })

  it('④ public 帖照常全局可见', async () => {
    h.state.userId = VIEWER_ID
    const res = await listAs(asUser, [PUBLIC_ROW], 1)
    expect(res.statusCode).toBe(200)
    const list = res.json().data.list as Array<{ id: string }>
    expect(list.map((p) => p.id)).toEqual([PUBLIC_ID])
    expect(columnNames(h.state.lastWhere)).toContain('visibility')
  })

  it('⑤ 作者本人在详情可见自己的 private 帖;他人详情被可见性条件挡住', async () => {
    // 作者:详情 select 返回行 → 200
    h.queue.items.push([PRIVATE_ROW])
    const own = await app.inject({
      method: 'GET',
      url: `${PREFIX}/circles/posts/${PRIVATE_ID}`,
      headers: asUser,
    })
    expect(own.statusCode).toBe(200)
    expect(own.json().data.post.id).toBe(PRIVATE_ID)
    expect(columnNames(h.state.lastWhere)).toEqual(
      expect.arrayContaining(['id', 'visibility', 'user_id']),
    )

    // 他人:DB 按可见性返回空 → 404(旧代码仅按 id,回行 ⇒ 泄露)
    h.state.userId = VIEWER_ID
    h.queue.items.push([])
    const other = await app.inject({
      method: 'GET',
      url: `${PREFIX}/circles/posts/${PRIVATE_ID}`,
      headers: asUser,
    })
    expect(other.statusCode).toBe(404)
    expect(columnNames(h.state.lastWhere)).toEqual(
      expect.arrayContaining(['id', 'visibility']),
    )
  })

  it('⑥ 管理员列表可见全部(private/followers 一并返回,where 不带 visibility)', async () => {
    h.state.userId = ADMIN_ID
    h.state.roleId = 1
    const res = await listAs(asAdmin, [PRIVATE_ROW, FOLLOWERS_ROW, PUBLIC_ROW], 3)
    expect(res.statusCode).toBe(200)
    const list = res.json().data.list as Array<{ id: string }>
    expect(list.map((p) => p.id)).toEqual([PRIVATE_ID, FOLLOWERS_ID, PUBLIC_ID])
    expect(columnNames(h.state.lastWhere)).not.toContain('visibility')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
