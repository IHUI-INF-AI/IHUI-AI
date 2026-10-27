// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * GET /api/comments/mine 行为契约(2026-10-27 立)。
 *
 * 立因是跨端覆盖盘点里量到的一个**取错数据**的断链,而不是"想加接口":
 *   apps/web/app/(main)/user/comment/page.tsx:39 打的是 `GET /api/comments?authorId=<本人>`,
 *   但 apps/api/src/routes/comments.ts 的列表面(107 行起)只认 resourceType/resourceId/parentId ——
 *   zod 默认剥未知键,`authorId` 被静默丢弃 ⇒ 该页拿到的是"全站顶级评论",不是"我的评论"。
 *   这不是 404,是**看起来正常但数据错**,比空页面更难被发现。
 * 补法不选"给公开列表面加 authorId 参数"(那会让任意用户的评论成为可枚举目标),
 * 而是新开一条自范围面:主体一律取自令牌的 request.userId,§5「认证不等于授权」。
 *
 * 它钉四件事,摘掉任一条即翻红:
 *   A 面存在且 200(路由没注册时这里就是 404);
 *   B 范围锁令牌主体 —— 阳性对照:query 里**故意传别人的 authorId**,必须被忽略;
 *   C 分页边界与公开面同口径(page 下限 1、pageSize 夹在 1..100);
 *   D 回归护栏:既有公开列表面带 resource 对仍正常,且未登录时 /mine 走 401
 *     (对照"我顺手把鉴权写漏"这一型)。
 * 隔离:全程 mock 查询函数与鉴权插件,不连库、不连 Redis(AGENTS §5 测试隔离铁律)。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const ME = '3f2a1b6c-0000-4000-8000-abcdef0000me'
const SOMEONE_ELSE = '9s9e9n9e-0000-4000-8000-abcdef0000el'

const store = vi.hoisted(() => ({
  /** 令牌里的主体;置 null 模拟未登录 */
  tokenUserId: null as string | null,
  /** 记录 findComments 实际收到的过滤条件 */
  lastOpts: null as Record<string, unknown> | null,
}))

vi.mock('../../plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: { userId?: string }) => {
    if (!store.tokenUserId) {
      throw Object.assign(new Error('未登录'), { statusCode: 401 })
    }
    request.userId = store.tokenUserId
  }),
}))

vi.mock('../../db/comment-queries.js', () => ({
  findComments: vi.fn(async (opts: Record<string, unknown>) => {
    store.lastOpts = opts
    return {
      list: [
        {
          id: 'c1',
          userId: opts.authorId,
          content: '我的一句话',
          resourceType: 'post',
          resourceId: 'r1',
        },
      ],
      total: 1,
    }
  }),
  findCommentById: vi.fn(async () => undefined),
  createComment: vi.fn(async () => ({})),
  updateComment: vi.fn(async () => ({})),
  deleteComment: vi.fn(async () => false),
  likeComment: vi.fn(async () => false),
  unlikeComment: vi.fn(async () => false),
  getCommentReplies: vi.fn(async () => ({ list: [], total: 0 })),
  countUserComments: vi.fn(async () => 0),
  countUserLikes: vi.fn(async () => 0),
}))

// 该路由件在创建/更新评论时才用它;此处给透传,避免拉进敏感词库与其 db 依赖
vi.mock('../../db/sensitive-words-queries.js', () => ({
  sanitizeUgcInput: vi.fn((s: string) => s),
}))

/** 断言用取值器:直接写 opt('x') 会在 TS 窄化后落到 never 上取属性(实测 TS2339)。 */
function opt(key: string): unknown {
  const seen = store.lastOpts as Record<string, unknown> | null
  return seen?.[key]
}

function mineUrl(extra = ''): string {
  return `/api/comments/mine${extra}`
}

describe('GET /api/comments/mine — 自范围与令牌主体', () => {
  const server: FastifyInstance = Fastify({ logger: false })

  beforeAll(async () => {
    const { commentRoutes } = await import('../../routes/comments.js')
    await server.register(commentRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  it('A 面存在且 200(未注册时这一条就是 404)', async () => {
    store.tokenUserId = ME
    const res = await server.inject({ method: 'GET', url: mineUrl() })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.list).toHaveLength(1)
  })

  it('B 范围锁令牌:query 里传别人的 authorId 必须被忽略', async () => {
    store.tokenUserId = ME
    store.lastOpts = null
    const res = await server.inject({ method: 'GET', url: mineUrl(`?authorId=${SOMEONE_ELSE}`) })
    expect(res.statusCode).toBe(200)
    // 关键断言:落到 db 层的过滤条件是令牌主体,不是客户端自报的那个
    expect(opt('authorId')).toBe(ME)
    expect(opt('authorId')).not.toBe(SOMEONE_ELSE)
    // 作者自范围面要连回复一起看到(不套"只回顶级"语义)
    expect(opt('anyDepth')).toBe(true)
  })

  it('C 分页与公开面同口径:合法值原样透传,越界由 query 模式先拒(不发查询)', async () => {
    store.tokenUserId = ME

    store.lastOpts = null
    const ok = await server.inject({ method: 'GET', url: mineUrl('?page=2&pageSize=50') })
    expect(ok.statusCode).toBe(200)
    expect(opt('page')).toBe(2)
    expect(opt('pageSize')).toBe(50)

    // page/pageSize 的 1..100 约束住在 paginationQuerySchema 里,越界是 400 而不是被悄悄夹住;
    // 这条同时钉住"我给 /mine 挂了与公开面同一份分页模式"——漏挂就会在这里翻红。
    for (const bad of ['?page=0', '?pageSize=9999', '?pageSize=0']) {
      store.lastOpts = null
      const res = await server.inject({ method: 'GET', url: mineUrl(bad) })
      expect(res.statusCode).toBe(400)
      expect(store.lastOpts).toBe(null)
    }
  })

  it('D1 未登录 ⇒ 401 且不发查询(鉴权写漏会被这条逮住)', async () => {
    store.tokenUserId = null
    store.lastOpts = null
    const res = await server.inject({ method: 'GET', url: mineUrl() })
    expect(res.statusCode).toBe(401)
    expect(store.lastOpts).toBe(null)
  })

  it('D2 回归:既有公开列表面带 resource 对仍走 resource 过滤', async () => {
    store.tokenUserId = ME
    store.lastOpts = null
    const res = await server.inject({
      method: 'GET',
      url: '/api/comments?resourceType=post&resourceId=r1&page=1&pageSize=20',
    })
    expect(res.statusCode).toBe(200)
    expect(opt('resourceType')).toBe('post')
    expect(opt('resourceId')).toBe('r1')
    // 公开面不授权者维,也不关顶级语义
    expect(opt('authorId')).toBeUndefined()
    expect(opt('anyDepth')).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
