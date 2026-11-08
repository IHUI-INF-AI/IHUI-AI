// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-31(2026-11-08):`agents.ts` 分页 `toInt` 只排除 NaN。
 *
 * `?page=0` 让 `(page-1)*pageSize` 为负 ⇒ PG `OFFSET must not be negative` 500;
 * `?pageSize=100000000` ⇒ 全表载入。本文件钉住:分页参数走 paging.ts 的同一组边界。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://127.0.0.1:5399/test',
    REDIS_URL: 'redis://127.0.0.1:6399',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}))

const { mockAuthenticate, mockCheckAuth, mockListAgents } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockCheckAuth: vi.fn(),
  mockListAgents: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  checkAuth: mockCheckAuth,
  requireActiveUser: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: vi.fn(),
  // agents 详情/管理分支调同步 isSystemAdmin(request);缺导出 ⇒ 500
  isSystemAdmin: () => false,
}))

vi.mock('../src/db/rbac-queries.js', () => ({
  checkPermission: vi.fn().mockResolvedValue(false),
}))

mockCheckAuth.mockImplementation(async (request: { userId?: string }, reply: any) => {
  try {
    await mockAuthenticate(request)
    return true
  } catch (e) {
    reply.status(401).send({ code: 401, message: (e as Error).message })
    return false
  }
})

vi.mock('../src/services/agent-service.js', () => ({
  listAgents: mockListAgents,
  getAgentDetail: vi.fn(),
  createAgent: vi.fn(),
  updateAgent: vi.fn(),
  deleteAgent: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({ db: {}, dbRead: {}, dbClient: {} }))

import { agentsRoutes } from '../src/routes/agents.js'

const REGULAR_USER = '00000000-0000-4000-8000-000000000002'

describe('F-31 agents 分页边界', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(agentsRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    mockListAgents.mockReset().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 })
    mockAuthenticate.mockImplementation(async (request: { userId?: string }) => {
      request.userId = REGULAR_USER
    })
  })

  it('page=0 / page=-5 → 夹到 1(不再把负 OFFSET 送进 PG)', async () => {
    await server.inject({ method: 'GET', url: '/api/agents?page=0' })
    expect(mockListAgents.mock.calls[0]?.[0]).toMatchObject({ page: 1 })

    mockListAgents.mockClear()
    await server.inject({ method: 'GET', url: '/api/agents?page=-5' })
    expect(mockListAgents.mock.calls[0]?.[0]).toMatchObject({ page: 1 })
  })

  it('pageSize=100000000 → 夹到 100(不再全表载入)', async () => {
    await server.inject({ method: 'GET', url: '/api/agents?pageSize=100000000' })
    expect(mockListAgents.mock.calls[0]?.[0]).toMatchObject({ pageSize: 100 })
  })

  it('pageSize=-1 → 抬到 1(与 paging.ts 同一组边界)', async () => {
    await server.inject({ method: 'GET', url: '/api/agents?pageSize=-1' })
    expect(mockListAgents.mock.calls[0]?.[0]).toMatchObject({ pageSize: 1 })
  })

  it('缺省参数保持 undefined 语义(由下层查询给默认值)', async () => {
    await server.inject({ method: 'GET', url: '/api/agents' })
    const args = mockListAgents.mock.calls[0]?.[0] as Record<string, unknown>
    expect(args.page).toBeUndefined()
    expect(args.pageSize).toBeUndefined()
  })

  it('源码面:分页参数不许再直接走 toInt(28 处已全部收敛)', async () => {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const src = readFileSync(
      fileURLToPath(new URL('../src/routes/agents.ts', import.meta.url)),
      'utf8',
    )
    expect(src).not.toMatch(/toInt\(q\.(page|pageSize|limit)\)/)
    expect(src).toContain('toPage(q.page)')
    expect(src).toContain('toPageSize(q.pageSize)')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
