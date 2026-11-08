// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-196(P1,数据外泄域):SRS 管理面此前只校验登录,任意登录用户即可枚举
 * 全部推流地址与 streamKey(可盗播 / 顶替推流)。
 *
 * 本文件钉住两条边界:
 *  ① 普通用户只能看到自己的流列表 / 详情 / 直播状态,他人的一律 404(不暴露 key 是否存在);
 *    改他人流 403 且不落库 —— 不是"藏字段",是整条跨用户路径封死;
 *  ② 属主的合法路径(查自己的流、结束自己的流)与管理员的全量能力都不被收口误伤。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const h = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  return {
    streams: [] as Record<string, unknown>[],
    servers: [] as Record<string, unknown>[],
    writes: [] as Record<string, unknown>[],
  }
})

vi.mock('../src/db/index.js', async () => {
  const { srsStreams } = await import('@ihui/database')
  const rowsFor = (table: unknown) => (table === srsStreams ? h.streams : h.servers)
  /** 递归收集 drizzle 条件里的标量参数(eq / and(...) 都覆盖),让 where 在夹具里真的收窄。 */
  const collectedValues = (node: unknown, out: string[] = []): string[] => {
    if (!node || typeof node !== 'object') return out
    const chunks = (node as { queryChunks?: unknown[] }).queryChunks
    if (Array.isArray(chunks)) {
      for (const chunk of chunks) collectedValues(chunk, out)
      return out
    }
    const value = (node as { value?: unknown }).value
    if (typeof value === 'string') out.push(value)
    return out
  }
  const matchedRows = (table: unknown, condition?: unknown) => {
    const rows = rowsFor(table)
    const values = collectedValues(condition)
    if (values.length === 0) return rows
    return rows.filter((row) => values.every((v) => Object.values(row).includes(v)))
  }
  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: (condition?: unknown) => {
          const rows = matchedRows(table, condition)
          return {
            orderBy: () => ({ limit: (n: number) => ({ offset: async () => rows.slice(0, n) }) }),
            limit: async (n?: number) => rows.slice(0, n ?? rows.length),
          }
        },
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => {
        h.writes.push(values)
        return {
          where: () => ({ returning: async () => [{ ...h.streams[0], ...values }] }),
        }
      },
    }),
  }
  return { db, dbRead: db, dbClient: {} }
})

/**
 * 只替换鉴权闸本体(真实实现已在 require-permission 专项测试覆盖),
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
  getStreamStatusFromSRS: async (_srv: unknown, key: string) => ({ online: true, key }),
  kickStream: async () => true,
  healthCheckServer: async () => ({ healthy: true }),
}))

import { srsRoutes } from '../src/routes/srs'

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const STREAM_A_KEY = 'stream_a_key_SECRET_9f2c'
const STREAM_B_KEY = 'stream_b_key_SECRET_71d4'

const STREAM_A = {
  id: '11111111-1111-4111-8111-111111111111',
  streamKey: STREAM_A_KEY,
  userId: USER_A,
  channelId: null,
  title: 'A 的直播',
  pushUrl: `rtmp://srs.example.com:1935/live/${STREAM_A_KEY}`,
  playUrl: `rtmp://srs.example.com:1935/live/${STREAM_A_KEY}`,
  webrtcUrl: `webrtc://srs.example.com:1985/live/${STREAM_A_KEY}.flv`,
  hlsUrl: `http://srs.example.com:8802/live/${STREAM_A_KEY}.m3u8`,
  flvUrl: `http://srs.example.com:8802/live/${STREAM_A_KEY}.flv`,
  status: 'active',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
}

const STREAM_B = {
  ...STREAM_A,
  id: '22222222-2222-4222-8222-222222222222',
  streamKey: STREAM_B_KEY,
  userId: USER_B,
  title: 'B 的直播',
  pushUrl: `rtmp://srs.example.com:1935/live/${STREAM_B_KEY}`,
  playUrl: `rtmp://srs.example.com:1935/live/${STREAM_B_KEY}`,
  webrtcUrl: `webrtc://srs.example.com:1985/live/${STREAM_B_KEY}.flv`,
  hlsUrl: `http://srs.example.com:8802/live/${STREAM_B_KEY}.m3u8`,
  flvUrl: `http://srs.example.com:8802/live/${STREAM_B_KEY}.flv`,
}

function authHeaders(roleId: number, userId: string) {
  return { 'x-test-role': String(roleId), 'x-test-user': userId }
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(srsRoutes, { prefix: '/api/srs' })
  await app.ready()
  return app
}

beforeEach(() => {
  h.streams = [STREAM_A, STREAM_B]
  h.servers = []
  h.writes.length = 0
})

describe('F-196 普通登录用户只能触达自己的推流密钥', () => {
  it('GET /streams(流列表)→ 200 但只含自己的流,响应里没有 B 的 streamKey / 推流地址', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/srs/streams',
      headers: authHeaders(0, USER_A),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: { list: (typeof STREAM_A)[] } }
    expect(body.data.list).toHaveLength(1)
    expect(body.data.list[0]?.streamKey).toBe(STREAM_A_KEY)
    expect(res.body).not.toContain(STREAM_B_KEY)
    expect(res.body).not.toContain(STREAM_B.pushUrl)
    await app.close()
  })

  it('GET /streams/:key(他人流详情)→ 404,A 看不到 B 的 key 与推流地址', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/srs/streams/${STREAM_B_KEY}`,
      headers: authHeaders(0, USER_A),
    })
    expect(res.statusCode).toBe(404)
    expect(res.body).not.toContain(STREAM_B_KEY)
    expect(res.body).not.toContain('rtmp://')
    await app.close()
  })

  it('GET /streams/:key → 200 属主可查自己的流', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/srs/streams/${STREAM_A_KEY}`,
      headers: authHeaders(0, USER_A),
    })
    expect(res.statusCode).toBe(200)
    expect((res.json() as { data: typeof STREAM_A }).data.streamKey).toBe(STREAM_A_KEY)
    await app.close()
  })

  it('GET /streams/:key/status(他人直播状态)→ 404,不回显 streamKey', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/srs/streams/${STREAM_B_KEY}/status`,
      headers: authHeaders(0, USER_A),
    })
    expect(res.statusCode).toBe(404)
    expect(res.body).not.toContain(STREAM_B_KEY)
    await app.close()
  })

  it('GET /streams/:key/status → 200 属主可查自己的直播状态', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/srs/streams/${STREAM_A_KEY}/status`,
      headers: authHeaders(0, USER_A),
    })
    expect(res.statusCode).toBe(200)
    expect((res.json() as { data: { srsStatus: { online: boolean } } }).data.srsStatus.online).toBe(
      true,
    )
    await app.close()
  })

  it('PUT /streams/:id(改他人流)→ 403 且不产生任何写库', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PUT',
      url: `/api/srs/streams/${STREAM_B.id}`,
      headers: authHeaders(0, USER_A),
      payload: { title: 'A 试图改 B 的流' },
    })
    expect(res.statusCode).toBe(403)
    expect(h.writes).toHaveLength(0)
    expect(res.body).not.toContain(STREAM_B_KEY)
    await app.close()
  })

  it('PUT /streams/:id → 200 属主可结束自己的流(合法路径未被误伤)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PUT',
      url: `/api/srs/streams/${STREAM_A.id}`,
      headers: authHeaders(0, USER_A),
      payload: { status: 'inactive' },
    })
    expect(res.statusCode).toBe(200)
    expect(h.writes).toHaveLength(1)
    expect(h.writes[0]).toMatchObject({ status: 'inactive' })
    await app.close()
  })
})

describe('F-196 管理员一侧能力不被收口误伤', () => {
  it('GET /streams → 200,完整字段(streamKey / pushUrl / playUrl / hlsUrl 均在)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/srs/streams',
      headers: authHeaders(1, USER_A),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      data: { list: (typeof STREAM_A)[]; page: number; pageSize: number }
    }
    expect(body.data.list).toHaveLength(2)
    expect(body.data.list[0]?.streamKey).toBe(STREAM_A_KEY)
    expect(body.data.list[1]?.streamKey).toBe(STREAM_B_KEY)
    expect(body.data.list[1]?.pushUrl).toBe(STREAM_B.pushUrl)
    expect(body.data.list[1]?.playUrl).toBe(STREAM_B.playUrl)
    expect(body.data.list[1]?.hlsUrl).toBe(STREAM_B.hlsUrl)
    await app.close()
  })

  it('GET /streams/:key → 200,管理员按 key 查询仍是完整实体', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/srs/streams/${STREAM_B_KEY}`,
      headers: authHeaders(1, USER_A),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: typeof STREAM_B }
    expect(body.data.streamKey).toBe(STREAM_B_KEY)
    expect(body.data.pushUrl).toBe(STREAM_B.pushUrl)
    await app.close()
  })

  it('PUT /streams/:id → 200,管理员编辑照常落库', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PUT',
      url: `/api/srs/streams/${STREAM_A.id}`,
      headers: authHeaders(1, USER_A),
      payload: { title: '管理员改名' },
    })
    expect(res.statusCode).toBe(200)
    expect(h.writes).toHaveLength(1)
    expect((res.json() as { data: { title: string } }).data.title).toBe('管理员改名')
    await app.close()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
