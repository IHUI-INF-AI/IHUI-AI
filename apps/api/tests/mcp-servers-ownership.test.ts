// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​​‌​‌​​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​‌‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍‌‌​‌​​​‍‍‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​​‌​​‌‌​‍‍​​‌​​​‌‍‍​​‌‌‌‌‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-101(P1) 回归锁：`/api/ai/mcp/servers` 的全局表 `mcp_servers` 没有 owner 列，
 * 此前插件层只校验登录 —— 任意登录用户可列全量端点、删任意服务器、注入任意 endpoint。
 *
 * 最小 schema-free 收口：全局 MCP 配置视为管理员资源。
 *  ① 普通用户 GET 不再返回任何全局行（deny-by-default，不泄露他人 endpoint）；
 *  ② 普通用户 POST / DELETE 一律 403 且零写库/零删除语句；
 *  ③ 管理员路径（列全量、创建、删除）保持原能力。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const h = vi.hoisted(() => ({
  servers: [] as Array<Record<string, unknown>>,
  writes: [] as Array<Record<string, unknown>>,
  deletes: [] as string[][],
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

vi.mock('../src/db/index.js', async () => {
  const { mcpServers } = await import('@ihui/database')
  /** 递归收集 drizzle 条件里的字符串参数，让 where 在夹具里真的按 id 收窄。 */
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
  const db = {
    select: () => ({
      from: () => ({
        orderBy: async () => h.servers.map((row) => ({ ...row })),
      }),
    }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        if (table !== mcpServers) throw new Error('unexpected table')
        const row = {
          id: `server-${h.servers.length + 1}`,
          status: 1,
          createdAt: new Date('2026-11-08T00:00:00Z'),
          updatedAt: new Date('2026-11-08T00:00:00Z'),
          ...values,
        }
        h.writes.push({ ...values })
        h.servers.push(row)
        return { returning: async () => [row] }
      },
    }),
    delete: (table: unknown) => ({
      where: (condition: unknown) => {
        if (table !== mcpServers) throw new Error('unexpected table')
        const ids = collectedValues(condition)
        h.deletes.push(ids)
        const removed = h.servers.filter((row) => ids.includes(String(row.id)))
        h.servers = h.servers.filter((row) => !ids.includes(String(row.id)))
        return { returning: async () => removed.map((row) => ({ id: row.id })) }
      },
    }),
  }
  return { db, dbRead: db, dbClient: {} }
})

/**
 * 只替换验签这一格：身份由请求头注入，roleId>=1 为管理员（与生产 ADMIN_ROLE_ID 语义一致）。
 */
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: {
    headers: Record<string, string | string[] | undefined>
    userId?: string
    jwtPayload?: { userId?: string; roleId?: number }
  }) => {
    const role = request.headers['x-test-role']
    if (!role) {
      throw Object.assign(new Error('Authentication required'), { statusCode: 401 })
    }
    const userId = String(request.headers['x-test-user'] ?? '')
    request.userId = userId
    request.jwtPayload = { userId, roleId: Number(role) }
    return request.jwtPayload
  },
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  ADMIN_ROLE_ID: 1,
  isSystemAdmin: (request: { jwtPayload?: { roleId?: number } }) =>
    (request.jwtPayload?.roleId ?? 0) >= 1,
}))

import { aiFrontendRoutes } from '../src/routes/ai-frontend-routes.js'

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SERVER_A_ID = '11111111-1111-4111-8111-111111111111'
const SERVER_B_ID = '22222222-2222-4222-8222-222222222222'
const ENDPOINT_A = 'https://a.example.com/mcp'
const ENDPOINT_B = 'https://b.example.com/SECRET-MCP-ENDPOINT'

const SERVER_A = {
  id: SERVER_A_ID,
  name: 'A 的服务器',
  description: null,
  endpoint: ENDPOINT_A,
  status: 1,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
}
const SERVER_B = {
  ...SERVER_A,
  id: SERVER_B_ID,
  name: 'B 的服务器',
  endpoint: ENDPOINT_B,
}

function authHeaders(roleId: number, userId: string) {
  return { 'x-test-role': String(roleId), 'x-test-user': userId }
}

let app: FastifyInstance

beforeAll(async () => {
  app = Fastify({ logger: false })
  await app.register(aiFrontendRoutes, { prefix: '/api' })
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  h.servers = [{ ...SERVER_A }, { ...SERVER_B }]
  h.writes.length = 0
  h.deletes.length = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })),
  )
})

describe('F-101 普通登录用户不能触达全局 MCP 服务器', () => {
  it('GET /api/ai/mcp/servers → 200 但列表为空，响应不含他人的 endpoint', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/ai/mcp/servers',
      headers: authHeaders(0, USER_A),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: Array<Record<string, unknown>> }
    expect(body.data).toHaveLength(0)
    expect(res.body).not.toContain(ENDPOINT_B)
    expect(res.body).not.toContain(ENDPOINT_A)
  })

  it('DELETE /api/ai/mcp/servers/:id（他人的行）→ 403，零 delete 语句，行仍在', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/ai/mcp/servers/${SERVER_B_ID}`,
      headers: authHeaders(0, USER_A),
    })
    expect(res.statusCode).toBe(403)
    expect(h.deletes).toHaveLength(0)
    expect(h.servers.some((row) => row.id === SERVER_B_ID)).toBe(true)
    expect(res.body).not.toContain(ENDPOINT_B)
  })

  it('POST /api/ai/mcp/servers（注入任意 endpoint）→ 403，零 insert 写库', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/mcp/servers',
      headers: authHeaders(0, USER_A),
      payload: { name: '注入的服务器', endpoint: 'https://evil.example.com/mcp' },
    })
    expect(res.statusCode).toBe(403)
    expect(h.writes).toHaveLength(0)
    expect(h.servers).toHaveLength(2)
    expect(res.body).not.toContain('evil.example.com')
  })
})

describe('F-101 管理员全局管理路径不被收口误伤', () => {
  it('GET /api/ai/mcp/servers → 200，管理员可见全部全局行', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/ai/mcp/servers',
      headers: authHeaders(1, USER_A),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: Array<Record<string, unknown>> }
    expect(body.data).toHaveLength(2)
    expect(res.body).toContain(ENDPOINT_A)
    expect(res.body).toContain(ENDPOINT_B)
  })

  it('POST /api/ai/mcp/servers → 201，管理员创建照常落库', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/mcp/servers',
      headers: authHeaders(1, USER_A),
      payload: { name: '管理员创建', endpoint: 'https://admin.example.com/mcp' },
    })
    expect(res.statusCode).toBe(201)
    expect(h.writes).toHaveLength(1)
    expect((res.json() as { data: Record<string, unknown> }).data.endpoint).toBe(
      'https://admin.example.com/mcp',
    )
  })

  it('DELETE /api/ai/mcp/servers/:id → 200，管理员删除照常生效', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/ai/mcp/servers/${SERVER_B_ID}`,
      headers: authHeaders(1, USER_A),
    })
    expect(res.statusCode).toBe(200)
    expect(h.deletes).toHaveLength(1)
    expect(h.deletes[0]).toEqual([SERVER_B_ID])
    expect(h.servers.some((row) => row.id === SERVER_B_ID)).toBe(false)
  })
})
