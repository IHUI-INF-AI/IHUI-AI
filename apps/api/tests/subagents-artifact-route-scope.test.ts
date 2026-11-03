// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F4(2026-11-02)GET /api/subagents/:id/artifacts/:stepId 的归属闸。
 *
 * 硬纪律:归属判据只有 utils/dispatch-ownership.ts 一个出口,一律 404、不引 403。
 * 本文件与 attention 路由测试同手法(内存 service 替身 + 请求头切租户),钉住:
 *  ① A 请求 B 的派单产物 ⇒ 404,且 service.getArtifact 完全没被摸到(不泄露产物是否存在);
 *  ② 本人取回 ⇒ 200,content 是全文(不是摘要),truncated 原样透出;
 *  ③ 本人派单但 stepId 不存在 ⇒ 404(与「不是你的」同一状态码,不区分存在性)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: { userId?: string; headers: Record<string, unknown> }) => {
    const raw = request.headers['x-probe-user']
    request.userId = typeof raw === 'string' && raw.length > 0 ? raw : 'tenant-a'
  },
  checkAuth: async () => true,
}))

const { store, artifacts, calls } = vi.hoisted(() => ({
  store: new Map<string, { id: string; goal: string; status: string; ownerUserId?: string }>(),
  artifacts: new Map<
    string,
    {
      id: string
      dispatchId: string
      stepId: string
      content: string
      truncated: boolean
      createdAt: string
    }
  >(),
  calls: [] as Array<{ id: string; stepId: string }>,
}))

vi.mock('../src/services/subagent-dispatch-service.js', () => ({
  subagentDispatchService: {
    setRedisClient: async () => undefined,
    findById: (id: string) => store.get(id) ?? null,
    getArtifact: async (id: string, stepId: string) => {
      calls.push({ id, stepId })
      return artifacts.get(`${id}:${stepId}`) ?? null
    },
    listActive: () => Array.from(store.values()),
    listAll: () => Array.from(store.values()),
    getDispatchStats: () => null,
    getDag: () => null,
  },
}))

vi.mock('../src/db/agent-queries.js', () => ({
  findAgentById: async () => null,
  findAgentTasksByAgentId: async () => [],
}))

import { subagentDispatchRoutes } from '../src/routes/subagent-dispatch.js'

let app: FastifyInstance

function seed(id: string, ownerUserId: string, status = 'completed'): void {
  store.set(id, { id, goal: `goal-${id}`, status, ownerUserId })
}

function seedArtifact(id: string, stepId: string, content: string, truncated = false): void {
  artifacts.set(`${id}:${stepId}`, {
    id: `${id}:${stepId}`,
    dispatchId: id,
    stepId,
    content,
    truncated,
    createdAt: '2026-11-02T00:00:00Z',
  })
}

const asA = { 'x-probe-user': 'tenant-a' }
const asB = { 'x-probe-user': 'tenant-b' }

beforeEach(async () => {
  store.clear()
  artifacts.clear()
  calls.length = 0
  app = Fastify()
  await app.register(subagentDispatchRoutes, { prefix: '/api' })
  await app.ready()
})

afterEach(async () => {
  await app.close()
})

const LONG_TEXT = `${'T'.repeat(1200)}-TAIL-FULL-TEXT`

describe('F4 ① 跨租户取产物:404 + service 零调用', () => {
  it('A 请求 B 的派单产物 ⇒ 404,getArtifact 未被调用,响应不含全文', async () => {
    seed('b-done', 'tenant-b')
    seedArtifact('b-done', 'a', LONG_TEXT)

    const res = await app.inject({
      method: 'GET',
      url: '/api/subagents/b-done/artifacts/a',
      headers: asA,
    })

    expect(res.statusCode).toBe(404)
    expect(calls).toEqual([])
    expect(res.body).not.toContain('TAIL-FULL-TEXT')
  })
})

describe('F4 ② 本人取回:200 + 全文透出', () => {
  it('content 是产物全文(不是摘要),truncated 原样返回', async () => {
    seed('a-done', 'tenant-a')
    seedArtifact('a-done', 'a', LONG_TEXT)

    const res = await app.inject({
      method: 'GET',
      url: '/api/subagents/a-done/artifacts/a',
      headers: asA,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      data: { artifact: { id: string; content: string; truncated: boolean } }
    }
    expect(body.data.artifact.id).toBe('a-done:a')
    expect(body.data.artifact.content).toBe(LONG_TEXT)
    expect(body.data.artifact.truncated).toBe(false)
    expect(calls).toEqual([{ id: 'a-done', stepId: 'a' }])
  })
})

describe('F4 ③ 产物不存在与「不是你的」同一口径', () => {
  it('本人派单但 stepId 不存在 ⇒ 404,不泄露存在性差异', async () => {
    seed('a-done', 'tenant-a')

    const res = await app.inject({
      method: 'GET',
      url: '/api/subagents/a-done/artifacts/missing',
      headers: asA,
    })

    expect(res.statusCode).toBe(404)
  })

  it('派单不存在 ⇒ 404,service.getArtifact 未被调用', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/subagents/unknown/artifacts/a',
      headers: asB,
    })

    expect(res.statusCode).toBe(404)
    expect(calls).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
