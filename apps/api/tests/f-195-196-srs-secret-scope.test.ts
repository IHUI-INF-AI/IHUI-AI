// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-195 / F-196 回归锁(2026-11-08)。
 *
 * F-195:GET /srs/servers 把整行(含 api_secret)返回给任意登录用户 → SRS 管理面可被接管。
 * F-196:GET /srs/streams(及其详情)无属主过滤,任意登录用户可枚举全站 streamKey/pushUrl,
 *        可冒用他人推流凭据(内容劫持)或盗播。
 * 判据:服务器列表仅管理员可读且响应无 apiSecret;流列表非管理员只见自己的流;详情跨属主 404。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = {
  streams: [] as Record<string, unknown>[],
  servers: [] as Record<string, unknown>[],
}

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    eq: (col: { name?: string }, val: unknown) => ({ op: 'eq', col: col?.name, val }),
    and: (...conds: unknown[]) => ({ op: 'and', conds }),
    desc: (col: { name?: string }) => ({ op: 'desc', col: col?.name }),
  }
})

vi.mock('@ihui/database', () => ({
  srsStreams: {
    id: { name: 'id' },
    userId: { name: 'userId' },
    streamKey: { name: 'streamKey' },
    status: { name: 'status' },
    createdAt: { name: 'createdAt' },
  },
  srsServers: {
    id: { name: 'id' },
    name: { name: 'name' },
    host: { name: 'host' },
    rtmpPort: { name: 'rtmpPort' },
    httpPort: { name: 'httpPort' },
    webrtcPort: { name: 'webrtcPort' },
    apiPort: { name: 'apiPort' },
    maxStreams: { name: 'maxStreams' },
    isActive: { name: 'isActive' },
    healthCheckUrl: { name: 'healthCheckUrl' },
    lastHealthCheck: { name: 'lastHealthCheck' },
    status: { name: 'status' },
    createdAt: { name: 'createdAt' },
    updatedAt: { name: 'updatedAt' },
    apiSecret: { name: 'apiSecret' },
  },
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    select(projection?: Record<string, unknown>) {
      let rows: Record<string, unknown>[] = []
      const builder: Record<string, unknown> = {
        from(table: Record<string, unknown>) {
          rows = table === srsTables.streams ? [...state.streams] : [...state.servers]
          return builder
        },
        where(cond: unknown) {
          if (cond) rows = rows.filter((r) => match(r, cond))
          return builder
        },
        orderBy() {
          return builder
        },
        limit(n: number) {
          rows = rows.slice(0, n)
          return builder
        },
        offset(n: number) {
          rows = rows.slice(n)
          return builder
        },
        then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
          const out = projection
            ? rows.map((r) => Object.fromEntries(Object.keys(projection).map((k) => [k, r[k]])))
            : rows
          return Promise.resolve(out).then(resolve, reject)
        },
      }
      return builder
    },
  },
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAuth: vi.fn(async (req: Record<string, unknown>, reply: ReplyMock) => {
    if (!req.userId) reply.status(401).send({ code: 401 })
  }),
  requireAdmin: vi.fn(async (req: Record<string, unknown>, reply: ReplyMock) => {
    if (!req.userId) return reply.status(401).send({ code: 401 })
    const roleId = (req.jwtPayload as { roleId?: number } | undefined)?.roleId ?? 0
    if (roleId < 1) return reply.status(403).send({ code: 403 })
  }),
}))

vi.mock('../src/services/srs-service.js', () => ({
  createStream: vi.fn(),
  getActiveServer: vi.fn(async () => null),
  getStreamStatusFromSRS: vi.fn(),
  kickStream: vi.fn(),
  healthCheckServer: vi.fn(),
}))

import { srsStreams, srsServers } from '@ihui/database'
import { srsRoutes } from '../src/routes/srs.js'

const srsTables = { streams: srsStreams, servers: srsServers }

type ReplyMock = {
  statusCode: number
  body: unknown
  sent: boolean
  status(c: number): ReplyMock
  send(b: unknown): ReplyMock
}

function makeReply(): ReplyMock {
  const r: ReplyMock = {
    statusCode: 200,
    body: undefined,
    sent: false,
    status(c: number) {
      this.statusCode = c
      return this
    },
    send(b: unknown) {
      this.body = b
      this.sent = true
      return this
    },
  }
  return r
}

function match(row: Record<string, unknown>, cond: unknown): boolean {
  const c = cond as { op?: string; col?: string; val?: unknown; conds?: unknown[] }
  if (!c || !c.op) return true
  if (c.op === 'eq') return row[c.col as string] === c.val
  if (c.op === 'and') return (c.conds ?? []).every((x) => match(row, x))
  return true
}

type Handler = (request: unknown, reply: unknown) => unknown

function makeServer() {
  const handlers = new Map<string, Handler>()
  const server = {
    get: vi.fn((p: string, ...a: unknown[]) =>
      handlers.set(`GET ${p}`, a[a.length - 1] as Handler),
    ),
    post: vi.fn((p: string, ...a: unknown[]) =>
      handlers.set(`POST ${p}`, a[a.length - 1] as Handler),
    ),
    put: vi.fn((p: string, ...a: unknown[]) =>
      handlers.set(`PUT ${p}`, a[a.length - 1] as Handler),
    ),
    delete: vi.fn((p: string, ...a: unknown[]) =>
      handlers.set(`DELETE ${p}`, a[a.length - 1] as Handler),
    ),
  }
  return { server, handlers }
}

const made = makeServer()
await srsRoutes(made.server as never, {} as never)

const OWN = { id: 's1', userId: 'u1', streamKey: 'own-key', status: 'active', title: 'own' }
const OTHER = { id: 's2', userId: 'u2', streamKey: 'other-key', status: 'active', title: 'other' }

beforeEach(() => {
  state.streams = [OWN, OTHER]
  state.servers = [
    { id: 'srv1', name: 'SRS-1', host: '127.0.0.1', apiSecret: 'super-secret', status: 'online' },
  ]
})

function body(reply: ReplyMock): { code: number; data: Record<string, unknown> } {
  return reply.body as { code: number; data: Record<string, unknown> }
}

describe('F-196 流列表/详情必须按属主收敛', () => {
  it('普通用户列表只返回自己的流', async () => {
    const handler = made.handlers.get('GET /streams')!
    const reply = makeReply()
    await handler({ userId: 'u1', jwtPayload: { roleId: 0 }, query: {} }, reply)
    const list = body(reply).data.list as Record<string, unknown>[]
    expect(list).toHaveLength(1)
    expect(list[0].userId).toBe('u1')
    expect(list.some((s) => s.streamKey === 'other-key')).toBe(false)
  })

  it('管理员列表可见全部流', async () => {
    const handler = made.handlers.get('GET /streams')!
    const reply = makeReply()
    await handler({ userId: 'admin', jwtPayload: { roleId: 1 }, query: {} }, reply)
    expect((body(reply).data.list as unknown[]).length).toBe(2)
  })

  it('详情:访问他人的 streamKey → 404', async () => {
    const handler = made.handlers.get('GET /streams/:key')!
    const reply = makeReply()
    await handler({ userId: 'u1', jwtPayload: { roleId: 0 }, params: { key: 'other-key' } }, reply)
    expect(reply.statusCode).toBe(404)
    expect(JSON.stringify(reply.body)).not.toContain('other-key')
  })

  it('详情:访问自己的流 → 200', async () => {
    const handler = made.handlers.get('GET /streams/:key')!
    const reply = makeReply()
    await handler({ userId: 'u1', jwtPayload: { roleId: 0 }, params: { key: 'own-key' } }, reply)
    expect(reply.statusCode).toBe(200)
    expect(body(reply).data.streamKey).toBe('own-key')
  })
})

describe('F-195 服务器列表不得回传 apiSecret 且仅管理员可读', () => {
  it('普通用户 → 403', async () => {
    const handler = made.handlers.get('GET /servers')!
    const reply = makeReply()
    await handler({ userId: 'u1', jwtPayload: { roleId: 0 } }, reply)
    expect(reply.statusCode).toBe(403)
    expect(JSON.stringify(reply.body)).not.toContain('super-secret')
  })

  it('管理员 → 200 且响应不含 apiSecret', async () => {
    const handler = made.handlers.get('GET /servers')!
    const reply = makeReply()
    await handler({ userId: 'admin', jwtPayload: { roleId: 1 } }, reply)
    expect(reply.statusCode).toBe(200)
    const list = body(reply).data as unknown as Record<string, unknown>[]
    expect(list).toHaveLength(1)
    expect(list[0]).not.toHaveProperty('apiSecret')
    expect(JSON.stringify(reply.body)).not.toContain('super-secret')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
