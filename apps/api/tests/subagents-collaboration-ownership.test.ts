// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @ihui-seat S-ACL-COLLAB 2026-11-02

/**
 * S-ACL-COLLAB 回归锁:GET /api/subagents/:id/collaboration 的租户归属(2026-11-02)。
 *
 * 背景(上一轮 S-ACL 只收了 subagent-dispatch.ts 里的 6 个按 id 端点):
 *   routes/subagents-extended-routes.ts 的 `:id/collaboration` 仍直接拿 id 调
 *   service.getMessages / getDispatchStats,不看 ownerUserId ⇒ 知道 id 就能跨租户读
 *   他人的协作消息内容与派单运行统计。
 *
 * 本文件钉住:
 *  ① 跨租户读 ⇒ 404,响应体不含对方消息内容,且 service 的两个读接口**一次都没被调用**
 *     (闸在读之前,不是"读了再过滤");
 *  ② 正例:本人读自己的 ⇒ 200,消息与 dispatchStatus 原样返回(同租户行为不变);
 *  ③ 未标注记录(ownerUserId 缺失)⇒ 与其余按 id 端点同判「未标注可见」(已知残余,不在此扩大);
 *  ④ 不存在的 id ⇒ 404(与其余按 id 端点同形:不存在与不属于你合并,防枚举)。
 *
 * 判据引生产源(§22c):路由用的是 utils/dispatch-ownership.ts 的 ownsDispatchById,
 * 本文件不另写一份「owner === userId」。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// 两个租户靠请求头切换:authenticate 把 request.userId 写成 x-probe-user(缺省 tenant-a)
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: { userId?: string; headers: Record<string, unknown> }) => {
    const raw = request.headers['x-probe-user']
    request.userId = typeof raw === 'string' && raw.length > 0 ? raw : 'tenant-a'
  },
  checkAuth: async () => true,
}))

// 本票不触达 LLM 端点,但模块顶层会 import 这个 fetch helper —— 置空以免读 config/网络面
vi.mock('../src/utils/ai-service-fetch.js', () => ({ aiServiceFetch: vi.fn() }))

const { store, calls } = vi.hoisted(() => ({
  store: new Map<string, { id: string; status: string; ownerUserId?: string; message: string }>(),
  calls: { messages: [] as string[], stats: [] as string[] },
}))

vi.mock('../src/services/subagent-dispatch-service.js', () => ({
  subagentDispatchService: {
    setRedisClient: async () => undefined,
    findById: (id: string) => store.get(id) ?? null,
    getMessages: (id: string) => {
      calls.messages.push(id)
      const d = store.get(id)
      if (!d) return []
      return [{ from: 'coder', to: 'reviewer', type: 'handoff', content: d.message }]
    },
    getDispatchStats: (id: string) => {
      calls.stats.push(id)
      const d = store.get(id)
      if (!d) return null
      return { dispatchId: id, status: d.status, totalDurationMs: 1, totalTokens: 42, steps: [] }
    },
  },
}))

import { subagentsExtendedRoutes } from '../src/routes/subagents-extended-routes.js'

let app: FastifyInstance

function seed(id: string, ownerUserId: string | undefined, status: string): void {
  store.set(id, {
    id,
    status,
    ...(ownerUserId ? { ownerUserId } : {}),
    message: `msg-of-${ownerUserId ?? 'legacy'}`,
  })
}

const asA = { 'x-probe-user': 'tenant-a' }
const asB = { 'x-probe-user': 'tenant-b' }

beforeEach(async () => {
  store.clear()
  calls.messages.length = 0
  calls.stats.length = 0
  app = Fastify()
  await app.register(subagentsExtendedRoutes, { prefix: '/api' })
  await app.ready()
})

afterEach(async () => {
  await app.close()
})

describe('S-ACL-COLLAB ① 跨租户读协作消息被拒', () => {
  it('A 读 B 的 running 派单 ⇒ 404,响应体不含 B 的消息,且读接口没被摸到', async () => {
    seed('b-running', 'tenant-b', 'running')

    const res = await app.inject({
      method: 'GET',
      url: '/api/subagents/b-running/collaboration',
      headers: asA,
    })

    // 先断副作用(没读),再断状态码 —— 回 404 但暗地里读过数据同样算泄漏
    expect(calls.messages).toEqual([])
    expect(calls.stats).toEqual([])
    expect(res.statusCode).toBe(404)
    expect(res.body).not.toContain('msg-of-tenant-b')
    expect(JSON.stringify(res.json())).not.toContain('b-running')
  })
})

describe('S-ACL-COLLAB ② 正例:同租户读自己的不变', () => {
  it('B 读自己的派单 ⇒ 200,消息与 dispatchStatus 原样返回', async () => {
    seed('b-running', 'tenant-b', 'running')

    const res = await app.inject({
      method: 'GET',
      url: '/api/subagents/b-running/collaboration',
      headers: asB,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      data: {
        dispatchId: string
        dispatchStatus: string
        totalMessages: number
        messages: unknown[]
      }
    }
    expect(body.data.dispatchId).toBe('b-running')
    expect(body.data.dispatchStatus).toBe('running')
    expect(body.data.totalMessages).toBe(1)
    expect(JSON.stringify(body.data.messages)).toContain('msg-of-tenant-b')
  })
})

describe('S-ACL-COLLAB ③ 未标注记录:与其余按 id 端点同判', () => {
  it('ownerUserId 缺失 ⇒ 任何登录用户可读(已知残余,不是本票收窄的口径)', async () => {
    seed('legacy', undefined, 'running')

    const res = await app.inject({
      method: 'GET',
      url: '/api/subagents/legacy/collaboration',
      headers: asA,
    })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('msg-of-legacy')
  })
})

describe('S-ACL-COLLAB ④ 不存在的 id', () => {
  it('⇒ 404(不存在与不属于你同形,不提示该 id 是否真实存在)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/subagents/nope/collaboration',
      headers: asA,
    })
    expect(res.statusCode).toBe(404)
    expect(calls.messages).toEqual([])
  })
})
