// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * `/api/v1/codebase/*` 接入内部短期票(缺口之二的回归)。
 *
 * 立因:该路由族的 `preHandler` 原先只认「用户 JWT」或「x-api-key」,
 * ai-service 的 codebase_indexer 发来的内部票没有落点 ⇒ 纯票部署下索引写入 401。
 * 修法与其它路由**同一套分流语义**:`hasInternalServiceToken` 认出内部凭据后
 * 交给 `checkInternalServiceToken`,但本路由族额外绑定 `codebase-index` 用途 ——
 * 一枚 memory / im-bridge 票不得读写代码索引。
 *
 * 本文件钉五件事(状态码之外还要看副作用与调用参数):
 *  A. 内部票(scope=codebase-index)⇒ 200,且 service 收到的 owner 正是票/头里的主体;
 *  B. scope 不符 ⇒ 401,且**在 consume 之前**就被拒(service 未调用、重放表零写入);
 *  C. 重放 ⇒ 第二发 401(replayed),service 只被调用一次;
 *  D. 签名伪造 ⇒ 401,且零查库(验签失败早于身份查询);
 *  E. 既有用户 JWT 路径不变(`authenticate` 被调用、正常 200)。
 *
 * 夹具:mocked db/auth/capability/service + 内存 Redis,不连生产 PG/Redis(§5)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { SignJWT } from 'jose'

const { TEST_JWT_SECRET } = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.AI_SERVICE_URL ??= 'http://test-ai-service:8803'
  const secret = 'codebase-internal-ticket-test-secret-at-least-32-chars-0123456789'
  process.env.JWT_SECRET = secret
  process.env.INTERNAL_SERVICE_AUTH_MODE = 'ticket'
  return { TEST_JWT_SECRET: secret }
})

const UUID_PRINCIPAL = '6b8cd0f6-546f-44c8-853a-5f96edbe08be'
const REPO_ID = 'repo-internal-ticket'

const { mockSelect, mockAuthenticate, mockIndexChunks, mockGetStats } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockAuthenticate: vi.fn(),
  mockIndexChunks: vi.fn(),
  mockGetStats: vi.fn(),
}))

vi.mock('../src/db/index.js', () => {
  const chain = {
    select: () => ({ from: () => ({ where: () => ({ limit: () => mockSelect() }) }) }),
  }
  const stub = {
    ...chain,
    execute: vi.fn().mockResolvedValue([]),
    insert: vi.fn(),
    update: vi.fn(),
  }
  return { db: stub, dbRead: stub, dbWriter: stub, dbClient: { end: vi.fn() } }
})

vi.mock('../src/config/index.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  const base = (actual as { config?: Record<string, unknown> }).config ?? {}
  return {
    ...actual,
    config: {
      ...base,
      JWT_SECRET: TEST_JWT_SECRET,
      NODE_ENV: 'test',
      AI_CALLBACK_SECRET: '',
    },
  }
})

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  checkAuth: vi.fn(),
  checkAuthOrInternalService: vi.fn(),
}))

vi.mock('../src/utils/capability-guard.js', () => ({
  hasApiKeyCredential: (request: { headers: Record<string, unknown> }) =>
    typeof request.headers['x-api-key'] === 'string' ||
    (typeof request.headers.authorization === 'string' &&
      request.headers.authorization.startsWith('Bearer ihui_')),
  requireCapabilityRules: () => ({ call: async () => undefined }),
}))

vi.mock('../src/services/codebase-index-service.js', () => ({
  codebaseIndexService: {
    indexChunks: mockIndexChunks,
    getStats: mockGetStats,
    search: vi.fn(),
    keywordSearch: vi.fn(),
    hybridSearch: vi.fn(),
    listPathIndex: vi.fn(),
    readFileChunks: vi.fn(),
    deleteByFiles: vi.fn(),
    deleteByRepo: vi.fn(),
  },
}))

import {
  INTERNAL_TICKET_HEADER,
  mintInternalServiceTicket,
  type InternalTicketScope,
} from '../src/plugins/internal-service-ticket.js'
import { codebaseSearchRoutes } from '../src/routes/v1-codebase-search.js'

function fakeRedis() {
  const setCalls: Array<{ key: string; ttl: number }> = []
  const consumed = new Set<string>()
  return {
    setCalls,
    client: {
      async set(key: string, _value: string, _ex: 'EX', ttl: number) {
        setCalls.push({ key, ttl })
        if (consumed.has(key)) return null
        consumed.add(key)
        return 'OK'
      },
    },
  }
}

let app: FastifyInstance
let redis: ReturnType<typeof fakeRedis>

beforeAll(async () => {
  redis = fakeRedis()
  app = Fastify({ logger: false })
  app.decorate('redis' as never, redis.client as never)
  await app.register(codebaseSearchRoutes, { prefix: '/api/v1/codebase' })
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  mockSelect.mockReset()
  mockSelect.mockResolvedValue([{ id: UUID_PRINCIPAL, status: 1, roleId: 0 }])
  mockAuthenticate.mockReset()
  mockIndexChunks.mockReset()
  mockIndexChunks.mockResolvedValue({ indexed: 1, skipped: 0 })
  mockGetStats.mockReset()
  mockGetStats.mockResolvedValue({ totalChunks: 0, fileCount: 0, embeddedCount: 0 })
  redis.setCalls.length = 0
})

async function mint(scope: InternalTicketScope, jti: string): Promise<string> {
  return await mintInternalServiceTicket({ userId: UUID_PRINCIPAL, scope, jti })
}

const INDEX_BODY = {
  repoId: REPO_ID,
  chunks: [
    { filePath: 'src/a.ts', lineStart: 1, lineEnd: 2, content: 'export const a = 1' },
  ],
}

async function postIndex(headers: Record<string, string>) {
  return await app.inject({
    method: 'POST',
    url: '/api/v1/codebase/index',
    payload: INDEX_BODY,
    headers,
  })
}

describe('A. 内部票(scope=codebase-index)可读写本路由族', () => {
  it('POST /index 带票 ⇒ 200,service 收到的 owner = 票主体', async () => {
    const ticket = await mint('codebase-index', 'jti-cb-a-index')
    const res = await postIndex({
      [INTERNAL_TICKET_HEADER]: ticket,
      'x-user-id': UUID_PRINCIPAL,
    })
    expect(res.statusCode).toBe(200)
    expect(mockIndexChunks).toHaveBeenCalledTimes(1)
    expect(mockIndexChunks.mock.calls[0]?.[0]).toBe(REPO_ID)
    expect(mockIndexChunks.mock.calls[0]?.[2]).toBe(UUID_PRINCIPAL)
    // 身份查询恰好一次(票在验签后仍走"用户存在+活跃"那一关)
    expect(mockSelect).toHaveBeenCalledTimes(1)
  })

  it('GET /stats 带票 ⇒ 200(读面同样接票)', async () => {
    const ticket = await mint('codebase-index', 'jti-cb-a-stats')
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/codebase/stats',
      headers: { [INTERNAL_TICKET_HEADER]: ticket, 'x-user-id': UUID_PRINCIPAL },
    })
    expect(res.statusCode).toBe(200)
    expect(mockGetStats).toHaveBeenCalledWith(undefined, UUID_PRINCIPAL)
  })
})

describe('B. 用途必须匹配:crew 票不得读写代码索引', () => {
  it('scope=memory 的票打 /index ⇒ 401,service 未调用,且零消费(判 scope 先于 consume)', async () => {
    const ticket = await mint('memory', 'jti-cb-b-scope')
    const res = await postIndex({
      [INTERNAL_TICKET_HEADER]: ticket,
      'x-user-id': UUID_PRINCIPAL,
    })
    expect(res.statusCode).toBe(401)
    expect(res.json().message).toContain('Invalid internal service ticket')
    expect(mockIndexChunks).not.toHaveBeenCalled()
    // scope_mismatch 在 consume 之前返回 ⇒ 这张 memory 票没有被烧掉
    expect(redis.setCalls).toHaveLength(0)
    expect(mockSelect).not.toHaveBeenCalled()
  })
})

describe('C. 单次使用:重放只在鉴权层拒', () => {
  it('同一张 codebase-index 票两发:第一发 200,第二发 401(replayed),service 只跑一次', async () => {
    const ticket = await mint('codebase-index', 'jti-cb-c-replay')
    const first = await postIndex({
      [INTERNAL_TICKET_HEADER]: ticket,
      'x-user-id': UUID_PRINCIPAL,
    })
    expect(first.statusCode).toBe(200)

    const second = await postIndex({
      [INTERNAL_TICKET_HEADER]: ticket,
      'x-user-id': UUID_PRINCIPAL,
    })
    expect(second.statusCode).toBe(401)
    expect(second.json().message).toContain('Invalid internal service ticket')
    expect(mockIndexChunks).toHaveBeenCalledTimes(1)
    expect(redis.setCalls).toHaveLength(2)
  })
})

describe('D. 伪造签名:401 且零查库(验签失败早于身份查询)', () => {
  it('HS256 错密钥签出的同形票 ⇒ 401,service 未调用,SQL 零次', async () => {
    const now = Math.floor(Date.now() / 1000)
    const forged = await new SignJWT({
      type: 'internal-service-ticket',
      scope: 'codebase-index',
      jti: 'jti-cb-d-forged',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(UUID_PRINCIPAL)
      .setAudience('ihui-internal-service')
      .setIssuedAt(now)
      .setExpirationTime(now + 60)
      .sign(new TextEncoder().encode('attacker-controlled-secret-at-least-32-chars-0123456789'))

    const res = await postIndex({
      [INTERNAL_TICKET_HEADER]: forged,
      'x-user-id': UUID_PRINCIPAL,
    })
    expect(res.statusCode).toBe(401)
    expect(mockIndexChunks).not.toHaveBeenCalled()
    expect(mockSelect).not.toHaveBeenCalled()
  })
})

describe('E. 既有用户 JWT 路径不受影响', () => {
  it('无内部凭据 ⇒ 仍走 authenticate;成功后 200', async () => {
    mockAuthenticate.mockImplementation(async (request: { userId?: string }) => {
      request.userId = UUID_PRINCIPAL
    })
    const res = await postIndex({})
    expect(mockAuthenticate).toHaveBeenCalledTimes(1)
    expect(res.statusCode).toBe(200)
    expect(mockIndexChunks.mock.calls[0]?.[2]).toBe(UUID_PRINCIPAL)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌‌​‌‍‍​‌​​​​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​‌‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍⁠
