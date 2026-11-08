// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-332 圈子评论完整性(A 面契约)。
 * 旧写法:评论内容不过敏感词、replyCount 用 post.replyCount + 1 读改写、replyUserId 直接采信 body。
 * 本夹具钉住:违规内容 400 不落库、replyCount 以 SQL 原子自增、伪造 replyUserId 被拒/归一。
 * 隔离:mock auth / community-queries / 敏感词 / db,不连库。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const ME = '11111111-1111-4111-8111-111111111111'
const PARENT_AUTHOR = '33333333-3333-4333-8333-333333333333'
const FORGED_AUTHOR = '44444444-4444-4444-8444-444444444444'
const POST_ID = '55555555-5555-4555-8555-555555555555'
const PARENT_ID = '66666666-6666-4666-8666-666666666666'
const MISSING_PARENT_ID = '77777777-7777-4777-8777-777777777777'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const state = vi.hoisted(() => ({
  tokenUserId: '' as string,
  sanitizeOk: true,
  sanitizeText: null as string | null,
  post: null as Record<string, unknown> | null,
  selectRows: [] as unknown[][],
  insertResult: [] as unknown[],
  updateResult: [] as unknown[],
  inserted: null as Record<string, unknown> | null,
  updatedSet: null as Record<string, unknown> | null,
}))

vi.mock('../../plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: { userId?: string }) => {
    request.userId = state.tokenUserId
  }),
}))

vi.mock('../../db/community-queries.js', () => ({
  createPost: vi.fn(),
  deletePost: vi.fn(),
  findCircleById: vi.fn(async () => undefined),
  findCircleByIdOrSlug: vi.fn(async () => undefined),
  findCirclePosts: vi.fn(async () => []),
  findCircles: vi.fn(async () => []),
  findPostById: vi.fn(async () => state.post),
  updatePost: vi.fn(),
}))

vi.mock('../../db/sensitive-words-queries.js', () => ({
  sanitizeUgcInput: vi.fn(async (fields: Record<string, string>) => {
    const hit = !state.sanitizeOk
    const text = state.sanitizeText ?? fields.content
    return {
      ok: !hit,
      fields: Object.fromEntries(
        Object.entries(fields).map(([key, value]) => [
          key,
          { ok: !hit, text: key === 'content' ? text : value, hits: [] },
        ]),
      ),
      hits: hit ? [{ level: 2, word: '违规' }] : [],
    }
  }),
}))

vi.mock('../../db/index.js', () => {
  function createChain(result: unknown[]) {
    const chain: Record<string, any> = {
      then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(result).then(resolve),
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      offset: () => chain,
      returning: () => chain,
      onConflictDoNothing: () => chain,
      onConflictDoUpdate: () => chain,
      values: (value: Record<string, unknown>) => {
        state.inserted = value
        return chain
      },
      set: (value: Record<string, unknown>) => {
        state.updatedSet = value
        return chain
      },
    }
    return chain
  }
  return {
    db: {
      execute: vi.fn().mockResolvedValue([]),
      select: vi.fn(() => createChain(state.selectRows.shift() ?? [])),
      insert: vi.fn(() => createChain(state.insertResult)),
      update: vi.fn(() => createChain(state.updateResult)),
      delete: vi.fn(() => createChain([])),
    },
  }
})

import { db } from '../../db/index.js'
import circlesRoutes from '../community/circles.js'

const COMMENT_URL = `/api/circles/posts/${POST_ID}/comment`

function resetState(): void {
  state.sanitizeOk = true
  state.sanitizeText = null
  state.post = { id: POST_ID, replyCount: 5 }
  state.selectRows = []
  state.insertResult = [{ id: 'comment-1', postId: POST_ID, content: '正常评论' }]
  state.updateResult = []
  state.inserted = null
  state.updatedSet = null
  vi.clearAllMocks()
}

/** 把 drizzle SQL/Column/Aliased 节点拼成可断言的文本。 */
function sqlText(node: unknown): string {
  if (!node || typeof node !== 'object') return String(node ?? '')
  const n = node as Record<string, any>
  const parts: string[] = []
  if (typeof n.name === 'string') parts.push(n.name)
  if (typeof n.value === 'string') parts.push(n.value)
  else if (Array.isArray(n.value)) parts.push(n.value.join(''))
  if (Array.isArray(n.queryChunks)) {
    for (const chunk of n.queryChunks) parts.push(sqlText(chunk))
  }
  if (n.sql) parts.push(sqlText(n.sql))
  return parts.join('')
}

describe('F-332 /circles/posts/:id/comment', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(circlesRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    resetState()
  })

  it('违规评论被拒(400),不 insert、不计数', async () => {
    state.tokenUserId = ME
    state.sanitizeOk = false
    const res = await app.inject({
      method: 'POST',
      url: COMMENT_URL,
      payload: { content: '这是一条违规评论' },
    })
    expect(res.statusCode).toBe(400)
    expect(db.insert).not.toHaveBeenCalled()
    expect(db.update).not.toHaveBeenCalled()
  })

  it('正常评论 201,落库过滤后的文本,replyCount 使用 SQL 原子自增', async () => {
    state.tokenUserId = ME
    state.sanitizeText = '正常**'
    const res = await app.inject({
      method: 'POST',
      url: COMMENT_URL,
      payload: { content: '正常评论' },
    })
    expect(res.statusCode).toBe(201)
    expect(state.inserted?.content).toBe('正常**')
    expect(state.inserted?.replyUserId).toBeNull()
    // 旧写法是数字 6 ⇒ 不是 number 且含 + 1 才通过
    expect(typeof state.updatedSet?.replyCount).not.toBe('number')
    const text = sqlText(state.updatedSet?.replyCount)
    expect(text).toContain('reply_count')
    expect(text).toContain('+ 1')
  })

  it('顶级评论伪造 replyUserId 被拒(400)', async () => {
    state.tokenUserId = ME
    const res = await app.inject({
      method: 'POST',
      url: COMMENT_URL,
      payload: { content: '正常评论', replyUserId: FORGED_AUTHOR },
    })
    expect(res.statusCode).toBe(400)
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('楼中楼伪造 replyUserId(非父评论作者)被拒(400)', async () => {
    state.tokenUserId = ME
    state.selectRows = [[{ id: PARENT_ID, postId: POST_ID, userId: PARENT_AUTHOR }]]
    const res = await app.inject({
      method: 'POST',
      url: COMMENT_URL,
      payload: { content: '回复', pid: PARENT_ID, replyUserId: FORGED_AUTHOR },
    })
    expect(res.statusCode).toBe(400)
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('楼中楼省略 replyUserId 时归一为父评论作者', async () => {
    state.tokenUserId = ME
    state.selectRows = [[{ id: PARENT_ID, postId: POST_ID, userId: PARENT_AUTHOR }]]
    const res = await app.inject({
      method: 'POST',
      url: COMMENT_URL,
      payload: { content: '回复', pid: PARENT_ID },
    })
    expect(res.statusCode).toBe(201)
    expect(state.inserted?.replyUserId).toBe(PARENT_AUTHOR)
  })

  it('pid 指向不存在/不属于本帖的评论被拒(400)', async () => {
    state.tokenUserId = ME
    state.selectRows = [[]]
    const res = await app.inject({
      method: 'POST',
      url: COMMENT_URL,
      payload: { content: '回复', pid: MISSING_PARENT_ID },
    })
    expect(res.statusCode).toBe(400)
    expect(db.insert).not.toHaveBeenCalled()
  })
})
