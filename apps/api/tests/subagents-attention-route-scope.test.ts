// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F3(2026-11-02)POST /api/subagents/:id/attention 的归属闸 + /active 反映。
 *
 * 硬纪律:归属判据只有 utils/dispatch-ownership.ts 一个出口,一律 404、不引 403。
 * 本文件与 S-ACL 同手法(内存 service 替身复刻生产语义 + 请求头切租户),钉住:
 *  ① A 对 B 的派单进 attention ⇒ 404,且 B 记录一点没动、service.setAttention 没被摸到;
 *  ② 本人进入/清除 ⇒ 200,GET /active 的载荷随 attention 出现/消失(路由不改写字段);
 *  ③ 终态派单进入 ⇒ 409(不是 200、也不是 404 —— 记录存在但状态不允许);
 *  ④ 非法 body ⇒ 400,不落任何写入。
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

const { store, calls } = vi.hoisted(() => ({
  store: new Map<
    string,
    {
      id: string
      goal: string
      status: string
      ownerUserId?: string
      attention?: string
      createdAt: string
      updatedAt: string
    }
  >(),
  calls: [] as Array<{ id: string; attention: string | null }>,
}))

const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'preempted', 'quota_exceeded'])

vi.mock('../src/services/subagent-dispatch-service.js', () => ({
  subagentDispatchService: {
    setRedisClient: async () => undefined,
    findById: (id: string) => store.get(id) ?? null,
    setAttention: async (id: string, attention: string | null) => {
      calls.push({ id, attention })
      const d = store.get(id)
      if (!d) return { ok: false, reason: 'not_found' }
      if (attention !== null && TERMINAL.has(d.status)) return { ok: false, reason: 'terminal' }
      if (attention === null) delete d.attention
      else d.attention = attention
      return { ok: true, dispatch: d }
    },
    listActive: () =>
      Array.from(store.values()).filter((d) => d.status === 'pending' || d.status === 'running'),
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

function seed(id: string, ownerUserId: string, status: string, attention?: string): void {
  store.set(id, {
    id,
    goal: `goal-${id}`,
    status,
    ownerUserId,
    ...(attention ? { attention } : {}),
    createdAt: '2026-11-02T00:00:00Z',
    updatedAt: '2026-11-02T00:00:00Z',
  })
}

const asA = { 'x-probe-user': 'tenant-a' }
const _asB = { 'x-probe-user': 'tenant-b' }

beforeEach(async () => {
  store.clear()
  calls.length = 0
  app = Fastify()
  await app.register(subagentDispatchRoutes, { prefix: '/api' })
  await app.ready()
})

afterEach(async () => {
  await app.close()
})

describe('F3 ① 跨租户进 attention:404 + 零副作用', () => {
  it('A 对 B 的 running 派单 POST attention ⇒ 404,记录不变,service.setAttention 未被调用', async () => {
    seed('b-running', 'tenant-b', 'running')

    const res = await app.inject({
      method: 'POST',
      url: '/api/subagents/b-running/attention',
      headers: asA,
      payload: { attention: 'awaiting_answer' },
    })

    expect(store.get('b-running')!.attention).toBeUndefined()
    expect(store.get('b-running')!.updatedAt).toBe('2026-11-02T00:00:00Z')
    expect(calls).toEqual([])
    expect(res.statusCode).toBe(404)
    expect(res.body).not.toContain('goal-b-running')
  })
})

describe('F3 ② 本人 attention:可进可出,/active 随字段变化', () => {
  it('进入 awaiting_answer ⇒ 200;/active 含 attention;清除 ⇒ 200;/active 不含', async () => {
    seed('a-running', 'tenant-a', 'running')

    const enter = await app.inject({
      method: 'POST',
      url: '/api/subagents/a-running/attention',
      headers: asA,
      payload: { attention: 'awaiting_answer' },
    })
    expect(enter.statusCode).toBe(200)
    expect(store.get('a-running')!.attention).toBe('awaiting_answer')

    const active = await app.inject({ method: 'GET', url: '/api/subagents/active', headers: asA })
    expect(active.statusCode).toBe(200)
    const rows = active.json().data.dispatches as Array<Record<string, unknown>>
    expect(rows.find((d) => d.id === 'a-running')?.attention).toBe('awaiting_answer')

    const clear = await app.inject({
      method: 'POST',
      url: '/api/subagents/a-running/attention',
      headers: asA,
      payload: { attention: null },
    })
    expect(clear.statusCode).toBe(200)
    expect(store.get('a-running')!.attention).toBeUndefined()

    const after = await app.inject({ method: 'GET', url: '/api/subagents/active', headers: asA })
    const rowsAfter = after.json().data.dispatches as Array<Record<string, unknown>>
    expect(rowsAfter.find((d) => d.id === 'a-running')?.attention).toBeUndefined()
    // 执行状态不因 attention 改变(正交)
    expect(rowsAfter.find((d) => d.id === 'a-running')?.status).toBe('running')
  })
})

describe('F3 ③ 终态与非法 body', () => {
  it('本人对 completed 派单进入 attention ⇒ 409(记录存在但不再需要人)', async () => {
    seed('a-completed', 'tenant-a', 'completed')

    const res = await app.inject({
      method: 'POST',
      url: '/api/subagents/a-completed/attention',
      headers: asA,
      payload: { attention: 'awaiting_review' },
    })
    expect(res.statusCode).toBe(409)
    expect(store.get('a-completed')!.attention).toBeUndefined()
  })

  it('非法 attention 值 ⇒ 400,不落写入', async () => {
    seed('a-pending', 'tenant-a', 'pending')

    const res = await app.inject({
      method: 'POST',
      url: '/api/subagents/a-pending/attention',
      headers: asA,
      payload: { attention: 'unknown-state' },
    })
    expect(res.statusCode).toBe(400)
    expect(store.get('a-pending')!.attention).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
