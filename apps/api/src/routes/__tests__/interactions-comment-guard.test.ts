// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-479 /interactions/comment 别名层守卫(A 面契约)。
 * 旧写法只 safeParse 后直调 createComment:敏感词过滤与父评论存在/同资源校验被完全绕过。
 * 本夹具钉住:违规词 400、父评论不存在 404、父评论跨资源 400、正常评论 201。
 * 隔离:mock auth / comment-queries / 敏感词,不连库。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const ME = '11111111-1111-4111-8111-111111111111'
const RESOURCE_ID = '88888888-8888-4888-8888-888888888888'
const PARENT_ID = '99999999-9999-4999-8999-999999999999'
const OTHER_RESOURCE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const state = vi.hoisted(() => ({
  tokenUserId: '' as string,
  sanitizeOk: true,
  sanitizeText: null as string | null,
  parent: null as Record<string, unknown> | null,
  createdInput: null as Record<string, unknown> | null,
}))

vi.mock('../../plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: { userId?: string }) => {
    request.userId = state.tokenUserId
  }),
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

vi.mock('../../db/comment-queries.js', () => ({
  findComments: vi.fn(async () => ({ list: [], total: 0, page: 1, pageSize: 20 })),
  findCommentById: vi.fn(async () => state.parent),
  createComment: vi.fn(async (input: Record<string, unknown>) => {
    state.createdInput = input
    return { id: 'comment-1', ...input }
  }),
  updateComment: vi.fn(),
  softDeleteComment: vi.fn(),
  likeComment: vi.fn(),
  unlikeComment: vi.fn(),
  findReplies: vi.fn(async () => []),
  createFeedback: vi.fn(),
  findFeedbacksByUser: vi.fn(async () => []),
  findFeedbackById: vi.fn(),
  findAllFeedbacksForAdmin: vi.fn(async () => []),
  updateFeedback: vi.fn(),
  rateFeedback: vi.fn(),
  deleteFeedback: vi.fn(),
}))

import interactionsRoutes from '../interactions.js'

const COMMENT_URL = '/api/interactions/comment'

function resetState(): void {
  state.sanitizeOk = true
  state.sanitizeText = null
  state.parent = null
  state.createdInput = null
  vi.clearAllMocks()
}

describe('F-479 /interactions/comment 不得绕过合规与父评论校验', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(interactionsRoutes, { prefix: '/api/interactions' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    resetState()
  })

  it('违规词经别名入口同样被拒(400)', async () => {
    state.tokenUserId = ME
    state.sanitizeOk = false
    const res = await app.inject({
      method: 'POST',
      url: COMMENT_URL,
      payload: { resourceType: 'post', resourceId: RESOURCE_ID, content: '违规内容' },
    })
    expect(res.statusCode).toBe(400)
    expect(state.createdInput).toBeNull()
  })

  it('parentId 指向不存在的评论返回 404', async () => {
    state.tokenUserId = ME
    const res = await app.inject({
      method: 'POST',
      url: COMMENT_URL,
      payload: {
        resourceType: 'post',
        resourceId: RESOURCE_ID,
        content: '正常评论',
        parentId: PARENT_ID,
      },
    })
    expect(res.statusCode).toBe(404)
    expect(state.createdInput).toBeNull()
  })

  it('parentId 属于不同资源返回 400', async () => {
    state.tokenUserId = ME
    state.parent = {
      id: PARENT_ID,
      resourceType: 'post',
      resourceId: OTHER_RESOURCE_ID,
      userId: ME,
    }
    const res = await app.inject({
      method: 'POST',
      url: COMMENT_URL,
      payload: {
        resourceType: 'post',
        resourceId: RESOURCE_ID,
        content: '正常评论',
        parentId: PARENT_ID,
      },
    })
    expect(res.statusCode).toBe(400)
    expect(state.createdInput).toBeNull()
  })

  it('正常评论仍 201,且落库过滤后的内容', async () => {
    state.tokenUserId = ME
    state.sanitizeText = '正常**'
    const res = await app.inject({
      method: 'POST',
      url: COMMENT_URL,
      payload: { resourceType: 'post', resourceId: RESOURCE_ID, content: '正常评论' },
    })
    expect(res.statusCode).toBe(201)
    expect(state.createdInput?.content).toBe('正常**')
    expect(state.createdInput?.userId).toBe(ME)
  })
})
