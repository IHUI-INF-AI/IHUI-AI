// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @ihui-seat P0-2 2026-11-02

/**
 * P0-2 回归锁:`GET /api/subagents/:id/collaboration` 的派单归属(2026-11-02)。
 *
 * 背景:该端点此前只有 requireAuth —— 知道派单 id 就能跨租户读 `messages[].content`
 * 与 `dispatchStats`(前端 swarm-topology-view 每次拉拓扑都在调,泄漏面是默认路径)。
 *
 * 本文件钉住:
 *  ① A 读 B 的派单 ⇒ 404,响应体**不含** B 的原始消息内容字符串(不是"查了再过滤");
 *  ② 正例:B 读自己的 ⇒ 200 且内容在;B 读自己的 stats 也正常;
 *  ③ 不存在的 id ⇒ 404(取不到与不属于你同形,防枚举,不是 403);
 *  ④ 无归属旧记录(ownerUserId 缺失)⇒ **fail-closed**(2026-11-02 归属回填与 fail-open 收敛):
 *     普通用户一律 404,仅系统管理员可见;回填成功的记录回到「本人可见」,不再走本档;
 *  ⑤ 判据同源:直接引 `utils/dispatch-ownership` 的 ownsDispatchById,与 /:id/messages 一份实现。
 *
 * 反向例(实测见交付报告):删掉 collaboration 里的 ownsDispatchById 闸 ⇒ ①②③ 立刻变红。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

interface MessageLike {
  from: string
  to: string
  type: string
  content: string
  timestamp: string
}

interface DispatchLike {
  id: string
  status: string
  ownerUserId?: string
  messages: MessageLike[]
}

/**
 * 两个租户靠请求头切换:authenticate 把 request.userId 写成 x-probe-user(缺省 tenant-a);
 * x-probe-role=1 时同时注入 jwtPayload.roleId,供 isAdminViewer 判管理面(2026-11-02 fail-closed)
 */
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: {
    userId?: string
    jwtPayload?: { roleId?: number }
    headers: Record<string, unknown>
  }) => {
    const raw = request.headers['x-probe-user']
    request.userId = typeof raw === 'string' && raw.length > 0 ? raw : 'tenant-a'
    const role = request.headers['x-probe-role']
    request.jwtPayload = typeof role === 'string' ? { roleId: Number(role) } : undefined
  },
  checkAuth: async () => true,
}))

// 管理员闸已在 subagent-roles-admin-gate.test.ts 单独覆盖;本票只验归属,放行并注入身份。
// isSystemAdmin 必须一并给:dispatch-ownership 的 isAdminViewer 走的是这个唯一口径。
vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdminRouteGuard: async (request: { userId?: string; headers: Record<string, unknown> }) => {
    const raw = request.headers['x-probe-user']
    request.userId = typeof raw === 'string' && raw.length > 0 ? raw : 'tenant-a'
  },
  isSystemAdmin: (request: { jwtPayload?: { roleId?: number } }) =>
    (request.jwtPayload?.roleId ?? 0) >= 1,
}))

const { store } = vi.hoisted(() => ({
  store: new Map<string, DispatchLike>(),
}))

vi.mock('../src/services/subagent-dispatch-service.js', () => ({
  subagentDispatchService: {
    findById: (id: string) => store.get(id) ?? null,
    getMessages: (id: string) => store.get(id)?.messages ?? [],
    getDispatchStats: (id: string) => {
      const d = store.get(id)
      if (!d) return null
      return {
        dispatchId: id,
        status: d.status,
        totalDurationMs: 1,
        totalTokens: 10,
        estimatedCost: 0,
        steps: [],
      }
    },
  },
}))

import { subagentsExtendedRoutes, __test__ } from '../src/routes/subagents-extended-routes.js'
import { ownsDispatchById } from '../src/utils/dispatch-ownership.js'

const asA = { 'x-probe-user': 'tenant-a' }
const asB = { 'x-probe-user': 'tenant-b' }
const asAdmin = { 'x-probe-user': 'tenant-admin', 'x-probe-role': '1' }

/** 每个派单的消息里带一条**唯一可检索**的原始内容,便于断言它没出现在响应里 */
function seed(
  id: string,
  opts: { owner?: string; status?: string; secret?: string } = {},
): string {
  const secret = opts.secret ?? `secret-of-${opts.owner ?? 'legacy'}-${id}`
  store.set(id, {
    id,
    status: opts.status ?? 'running',
    ...(opts.owner ? { ownerUserId: opts.owner } : {}),
    messages: [
      {
        from: 'coder',
        to: 'reviewer',
        type: 'review',
        content: secret,
        timestamp: '2026-11-02T00:00:00.000Z',
      },
    ],
  })
  return secret
}

let app: FastifyInstance

beforeEach(async () => {
  store.clear()
  __test__.customRoles.clear()
  __test__.evolutionHistories.clear()
  app = Fastify()
  await app.register(subagentsExtendedRoutes, { prefix: '/api' })
  await app.ready()
})

afterEach(async () => {
  await app.close()
  store.clear()
})

describe('P0-2 ① 跨租户读协作消息', () => {
  it('A 读 B 的派单 ⇒ 404,且响应体不含 B 的原始 content 字符串', async () => {
    const secret = seed('b-collab-1', { owner: 'tenant-b' })

    const res = await app.inject({
      method: 'GET',
      url: '/api/subagents/b-collab-1/collaboration',
      headers: asA,
    })

    expect(res.statusCode).toBe(404)
    // 响应体里不能出现他人 content 的原文(也顺带证明不是"200 里过滤掉")
    expect(res.body).not.toContain(secret)
    expect(res.body).not.toContain('b-collab-1')
  })

  it('A 对 B 的派单:响应一律 404,绝不出现 403(不确认 id 是否存在)', async () => {
    seed('b-collab-2', { owner: 'tenant-b' })
    const res = await app.inject({
      method: 'GET',
      url: '/api/subagents/b-collab-2/collaboration',
      headers: asA,
    })
    expect(res.statusCode).toBe(404)
    expect(res.statusCode).not.toBe(403)
  })
})

describe('P0-2 ② 正例:本人读自己的', () => {
  it('B 读自己的派单 ⇒ 200,消息内容与 stats 都在', async () => {
    const secret = seed('b-collab-3', { owner: 'tenant-b', status: 'completed' })

    const res = await app.inject({
      method: 'GET',
      url: '/api/subagents/b-collab-3/collaboration',
      headers: asB,
    })

    expect(res.statusCode).toBe(200)
    expect(res.body).toContain(secret)
    const body = res.json() as { data: { dispatchStatus: string; totalMessages: number } }
    expect(body.data.dispatchStatus).toBe('completed')
    expect(body.data.totalMessages).toBe(1)
  })
})

describe('P0-2 ③ 不存在的 id', () => {
  it('任意调用方读不存在的派单 ⇒ 404(与"不是你的"同形)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/subagents/missing-collab/collaboration',
      headers: asA,
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('P0-2 ④ 无归属旧记录:fail-closed(仅管理面可见)', () => {
  it('ownerUserId 缺失的派单:普通用户 404(不再按「未标注」公开)', async () => {
    const secret = seed('legacy-collab', { status: 'running' })
    const res = await app.inject({
      method: 'GET',
      url: '/api/subagents/legacy-collab/collaboration',
      headers: asB,
    })
    expect(res.statusCode).toBe(404)
    expect(res.body).not.toContain(secret)
  })

  it('同一记录对系统管理员 200(orphan / 未回填档的独立管理面)', async () => {
    const secret = seed('legacy-collab-admin', { status: 'running' })
    const res = await app.inject({
      method: 'GET',
      url: '/api/subagents/legacy-collab-admin/collaboration',
      headers: asAdmin,
    })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain(secret)
  })
})

describe('P0-2 ⑤ 判据同源', () => {
  it('ownsDispatchById 是同一份实现:B 的派单对 A 为 false,对 B 为 true', () => {
    seed('b-collab-4', { owner: 'tenant-b' })
    expect(ownsDispatchById('b-collab-4', 'tenant-a')).toBe(false)
    expect(ownsDispatchById('b-collab-4', 'tenant-b')).toBe(true)
    expect(ownsDispatchById('missing-collab', 'tenant-a')).toBe(false)
    // 无归属档同源:普通用户 false,管理员 true
    seed('legacy-collab-5', { status: 'running' })
    expect(ownsDispatchById('legacy-collab-5', 'tenant-a')).toBe(false)
    expect(ownsDispatchById('legacy-collab-5', 'tenant-admin', true)).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
