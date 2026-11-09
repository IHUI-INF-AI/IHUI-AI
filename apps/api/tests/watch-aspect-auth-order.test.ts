// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-206(P1):watch-aspect 的计数钩子此前挂在**根实例 preHandler**,
 * Fastify 顺序是「外层插件钩子 → 路由自身 preHandler → handler」,
 * 于是计数跑在鉴权之前:
 *   · 未认证/越权请求在被 401/403 拒绝前就已经把浏览量 +1;
 *   · 钩子内 `request.userId` 恒 undefined ⇒ 观看行为从不落库;
 *   · 详情 handler 再自增一次 ⇒ 一次浏览计两次。
 *
 * 本文件是**请求级**验收(挂载与生产同形的 onRoute 追加链路):
 *   ① 匿名 → 401 且零写库(views / watch 都为 0);
 *   ② 越权(USER_B 访问 USER_A 的资源)→ 403 且零写库;
 *   ③ 属主 → 200,恰好 1 次 viewCount 写 + 1 次观看记录写(不双计);
 *   ④ 同一用户 5 分钟内重复浏览 → Redis 去重,仍只 1 次。
 *
 * 修复前读数(旧根级 preHandler):①② 的计数在鉴权前已写 1 次(断言 0 会红);
 * ③ 只写 viewCount、观看记录为 0(recordWatch 断言会红)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, {
  type FastifyInstance,
  type FastifyPluginAsync,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify'
import fp from 'fastify-plugin'

const h = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  return {
    viewWrites: [] as { table: string; values: Record<string, unknown> }[],
    watchWrites: [] as Record<string, unknown>[],
    redis: new Map<string, string>(),
    redisCalls: 0,
  }
})

vi.mock('../src/db/index.js', async () => {
  const { resources, newsArticles } = await import('@ihui/database')
  const tableName = (table: unknown): string =>
    table === resources ? 'resources' : table === newsArticles ? 'newsArticles' : 'unknown'
  const db = {
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          h.viewWrites.push({ table: tableName(table), values })
        },
      }),
    }),
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => [] }) }),
    }),
  }
  return { db, dbRead: db, dbClient: {} }
})

vi.mock('../src/db/behavior-queries.js', () => ({
  recordWatch: async (input: Record<string, unknown>) => {
    h.watchWrites.push(input)
    return { id: 'watch-1', updated: false }
  },
}))

const mockRedisPlugin = fp(
  async (server: FastifyInstance) => {
    server.decorate('redis', {
      // 模拟 Redis SETNX:同键 5 分钟内第二次返回 null。
      set: async (key: string, value: string) => {
        h.redisCalls += 1
        if (h.redis.has(key)) return null
        h.redis.set(key, value)
        return 'OK'
      },
    } as never)
  },
  { name: 'mock-redis', fastify: '5.x' },
)

import watchAspectPlugin from '../src/plugins/watch-aspect.js'

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const RESOURCE_ID = '11111111-1111-4111-8111-111111111111'

/** 模拟挂鉴权 + 归属校验的详情路由(与 ticket 所述"路由级鉴权"同形)。 */
const resourceOwner: Record<string, string> = { [RESOURCE_ID]: USER_A }

async function authGate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const userId = request.headers['x-test-user']
  if (typeof userId !== 'string' || userId.length === 0) {
    reply.status(401).send({ code: 401, message: 'Authentication required' })
    return
  }
  request.userId = userId
}

async function ownerGate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string }
  if (resourceOwner[id] !== request.userId) {
    reply.status(403).send({ code: 403, message: '无权访问' })
  }
}

const watchRoutePlugin: FastifyPluginAsync = async (server) => {
  server.get(
    '/api/resources/:id',
    { preHandler: [authGate, ownerGate] },
    async (request, reply) =>
      reply.send({ code: 0, message: 'success', data: { id: (request.params as { id: string }).id } }),
  )
}

function authHeaders(userId: string) {
  return { 'x-test-user': userId, 'x-test-role': '0' }
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  app.setErrorHandler((err: Error & { statusCode?: number }, _request, reply) => {
    const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500
    reply.status(status).send({ code: status, message: err.message })
  })
  await app.register(mockRedisPlugin)
  // 与生产一致:计数插件先注册(用 onRoute 把钩子追加到后续路由 preHandler 链末尾)。
  await app.register(watchAspectPlugin)
  await app.register(watchRoutePlugin)
  await app.ready()
  return app
}

beforeEach(() => {
  h.viewWrites.length = 0
  h.watchWrites.length = 0
  h.redis.clear()
  h.redisCalls = 0
})

describe('F-206 watch-aspect 必须在鉴权/授权之后计数', () => {
  it('匿名请求 → 401,且浏览计数与观看记录均零写入', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: `/api/resources/${RESOURCE_ID}` })

    expect(res.statusCode).toBe(401)
    expect(h.viewWrites).toHaveLength(0)
    expect(h.watchWrites).toHaveLength(0)
    // 连去重键都不该被写:钩子根本没跑到。
    expect(h.redisCalls).toBe(0)
    await app.close()
  })

  it('越权请求(USER_B 访问 USER_A 的资源)→ 403,且零写库', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/resources/${RESOURCE_ID}`,
      headers: authHeaders(USER_B),
    })

    expect(res.statusCode).toBe(403)
    expect(h.viewWrites).toHaveLength(0)
    expect(h.watchWrites).toHaveLength(0)
    await app.close()
  })

  it('属主请求 → 200,恰好 1 次 viewCount 写 + 1 次观看记录写(不双计)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/resources/${RESOURCE_ID}`,
      headers: authHeaders(USER_A),
    })

    expect(res.statusCode).toBe(200)
    expect(h.viewWrites).toHaveLength(1)
    expect(h.viewWrites[0]?.table).toBe('resources')
    expect(h.watchWrites).toHaveLength(1)
    expect(h.watchWrites[0]).toMatchObject({
      userId: USER_A,
      topicId: RESOURCE_ID,
      topicType: 'resource',
    })
    await app.close()
  })

  it('同一用户 5 分钟内重复浏览 → Redis 去重,仍只 1 次计数/记录', async () => {
    const app = await buildApp()
    const headers = authHeaders(USER_A)

    const first = await app.inject({ method: 'GET', url: `/api/resources/${RESOURCE_ID}`, headers })
    const second = await app.inject({ method: 'GET', url: `/api/resources/${RESOURCE_ID}`, headers })

    expect(first.statusCode).toBe(200)
    expect(second.statusCode).toBe(200)
    expect(h.viewWrites).toHaveLength(1)
    expect(h.watchWrites).toHaveLength(1)
    await app.close()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
