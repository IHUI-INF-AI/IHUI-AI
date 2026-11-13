// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-518 回归锁(2026-11-13)。
 *
 * 票面称 `routes/engine-control-frames.ts` 的 `/engine/rpc` 从未注册(死路由)。
 * 实测:d6d494fc 已在 `routes/index.ts` 以 `{ prefix: '/api' }` 挂载 ⇒ 票面结论过时,
 * 功能仍在被 CLI 端点清单与 d141 用例使用,故按方案 A 保留并补锁,不删文件。
 *
 * 本锁锁两点:
 *   ① 生产注册点存在:index.ts 同时有 import 与 server.register(..., { prefix: '/api' });
 *   ② 可达且鉴权:同一插件挂在 /api 下,无 Authorization 的 POST /api/engine/rpc ⇒ 401,
 *      且鉴权失败前一次都不转发 ai-service(未注册则会落到 404)。
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { mockAiServiceFetch } = vi.hoisted(() => ({
  mockAiServiceFetch: vi.fn(),
}))

vi.mock('@ihui/auth', () => ({
  verifyAccessToken: vi.fn(),
  // 与 d141 同口径:测试进程内 Redis 不可用,黑名单用内存假实现,不回退生产 fail-closed。
  createBlacklist: vi.fn(() => ({
    async has() {
      return false
    },
    async add() {},
    async revoke() {},
  })),
}))

vi.mock('jose', () => ({
  decodeJwt: vi.fn(() => ({ type: 'access' })),
}))

vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
  },
  __esModule: true,
}))

vi.mock('../src/utils/ai-service-fetch.js', () => ({
  aiServiceFetch: mockAiServiceFetch,
  aiServiceFetchStream: mockAiServiceFetch,
}))

import engineControlFrameRoutes from '../src/routes/engine-control-frames.js'
import { verifyAccessToken } from '@ihui/auth'

const ROUTES_INDEX = resolve(dirname(fileURLToPath(import.meta.url)), '../src/routes/index.ts')
const BODY = {
  jsonrpc: '2.0',
  id: 'f518',
  method: 'thread.interrupt',
  params: { threadId: 'th_1' },
}

describe('F-518 引擎控制帧路由可达性', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(engineControlFrameRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockAiServiceFetch.mockReset()
  })

  it('生产注册点:routes/index.ts 导入并以 /api 前缀挂载', () => {
    const src = readFileSync(ROUTES_INDEX, 'utf8')
    expect(src).toMatch(/import\s+engineControlFrameRoutes\s+from\s+'\.\/engine-control-frames\.js'/)
    expect(src).toMatch(
      /server\.register\(\s*engineControlFrameRoutes\s*,\s*\{\s*prefix:\s*'\/api'\s*\}\s*\)/,
    )
  })

  it('未鉴权 POST /api/engine/rpc ⇒ 401,且不转发 ai-service', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/engine/rpc', payload: BODY })

    expect(res.statusCode).toBe(401)
    expect(mockAiServiceFetch).not.toHaveBeenCalled()
  })

  it('无效 token ⇒ 401,同样不转发', async () => {
    vi.mocked(verifyAccessToken).mockRejectedValue(
      Object.assign(new Error('Invalid or expired token'), { statusCode: 401 }),
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/engine/rpc',
      headers: { authorization: 'Bearer invalid' },
      payload: BODY,
    })

    expect(res.statusCode).toBe(401)
    expect(mockAiServiceFetch).not.toHaveBeenCalled()
  })
})
