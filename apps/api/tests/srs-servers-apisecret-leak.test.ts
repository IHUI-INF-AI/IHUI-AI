// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-195(P1,凭据外泄):SRS 服务器列表此前只校验登录(`requireAuth`),
 * `db.select().from(srsServers)` 返回整行,把 `apiSecret`(SRS HTTP API 管理密钥)
 * 原样发给任意登录用户 —— 拿到即可直连 SRS 踢流 / 改配置 / 拉全量流信息。
 *
 * 本文件钉住三条边界:
 *  ① 未登录 → 401,响应里没有密钥;
 *  ② 普通用户(roleId 0)→ 403(管理面端点),响应体不含 apiSecret 值;
 *  ③ 管理员(roleId 1)→ 200 且仍拿得到 apiSecret(控制台配置能力不被误伤)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const h = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  return {
    servers: [] as Record<string, unknown>[],
  }
})

vi.mock('../src/db/index.js', async () => {
  const { srsServers } = await import('@ihui/database')
  const db = {
    select: () => ({
      from: (table: unknown) => {
        const rows = table === srsServers ? h.servers : []
        return {
          // GET /srs/servers 旧/新实现都是 select().from().orderBy()
          orderBy: async () => rows.slice(),
          where: () => ({
            limit: async (n?: number) => rows.slice(0, n ?? rows.length),
          }),
        }
      },
    }),
  }
  return { db, dbRead: db, dbClient: {} }
})

/**
 * 只替换鉴权闸本体(真实实现已由 require-permission 专项测试覆盖),
 * 身份由请求头注入,JWT 语义(roleId >= 1 为管理员)保持一致。
 */
vi.mock('../src/plugins/require-permission.js', () => {
  interface MockRequest {
    headers: Record<string, string | string[] | undefined>
    userId?: string
    jwtPayload?: { userId?: string; roleId?: number }
  }
  interface MockReply {
    status: (code: number) => { send: (body: unknown) => void }
    sent?: boolean
  }
  const authenticate = (request: MockRequest, reply: MockReply): boolean => {
    const role = request.headers['x-test-role']
    if (!role) {
      reply.status(401).send({ code: 401, message: 'Authentication required' })
      return false
    }
    request.userId = String(request.headers['x-test-user'] ?? '')
    request.jwtPayload = { userId: request.userId, roleId: Number(role) }
    return true
  }
  return {
    requireAuth: async (request: MockRequest, reply: MockReply) => {
      authenticate(request, reply)
    },
    requireAdmin: async (request: MockRequest, reply: MockReply) => {
      if (!authenticate(request, reply)) return
      if ((request.jwtPayload?.roleId ?? 0) < 1) {
        reply.status(403).send({ code: 403, message: '需要管理员权限' })
      }
    },
  }
})

vi.mock('../src/services/srs-service.js', () => ({
  createStream: async () => ({ stream: {} }),
  getActiveServer: async () => ({ id: 'srv-1', host: 'srs.example.com' }),
  getStreamStatusFromSRS: async () => null,
  kickStream: async () => true,
  healthCheckServer: async () => ({ healthy: true, latency: 0 }),
}))

import { srsRoutes } from '../src/routes/srs'

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const API_SECRET = 'super-secret-value'

const SERVER_ROW = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'SRS 主节点',
  host: 'srs.example.com',
  rtmpPort: 1935,
  httpPort: 8802,
  webrtcPort: 1985,
  apiPort: 1985,
  apiSecret: API_SECRET,
  maxStreams: 100,
  isActive: true,
  healthCheckUrl: null,
  lastHealthCheck: null,
  status: 'online',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
}

function authHeaders(roleId: number, userId = USER_ID) {
  return { 'x-test-role': String(roleId), 'x-test-user': userId }
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(srsRoutes, { prefix: '/api/srs' })
  await app.ready()
  return app
}

beforeEach(() => {
  h.servers = [SERVER_ROW]
})

describe('F-195 SRS 服务器列表不再向普通用户泄露 apiSecret', () => {
  it('未登录 GET /srs/servers → 401,响应里没有密钥', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/srs/servers' })
    expect(res.statusCode).toBe(401)
    expect(res.body).not.toContain(API_SECRET)
    await app.close()
  })

  it('普通用户 GET /srs/servers → 403(管理面端点)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/srs/servers',
      headers: authHeaders(0),
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('普通用户响应体不含 apiSecret 值', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/srs/servers',
      headers: authHeaders(0),
    })
    expect(res.body).not.toContain(API_SECRET)
    await app.close()
  })

  it('管理员 GET /srs/servers → 200 且仍能看到 apiSecret(管理配置能力不误伤)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/srs/servers',
      headers: authHeaders(1),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: (typeof SERVER_ROW)[] }
    expect(body.data).toHaveLength(1)
    expect(body.data[0]?.apiSecret).toBe(API_SECRET)
    expect(res.body).toContain(API_SECRET)
    await app.close()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
