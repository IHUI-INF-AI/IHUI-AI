// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @ihui-seat S-ACL 2026-11-01

/**
 * S-ACL 回归锁:按 id 的 6 个 /api/subagents/:id/* 端点的租户归属(2026-11-01)。
 *
 * 背景:S-ACTIVE 把 /subagents/active 收口到 isDispatchVisibleTo 之后,
 * 同文件里按 id 取的 6 个端点仍然只有 requireAuth + id 非空检查:
 *   cancel / resume / stats / dag / quotas / messages
 * ⇒ 知道 id 就能跨租户读消息·DAG·配额·资源统计,甚至**取消/恢复别人的派单**。
 *
 * 本文件钉住:
 *  ① 跨租户 cancel ⇒ 404,且**对方的派单状态一点没动**(防「回了 404 但暗地里取消了」);
 *  ② 跨租户读 messages/dag/quotas/stats ⇒ 全部不可得,响应体里不带对方数据;
 *  ③ 正例:本人对这 6 个端点全部正常(cancel 真的把状态改成 cancelled ——
 *     这条同时证明 ① 的「状态没动」不是 mock 不会写造成的假绿);
 *  ④ 无归属记录(ownerUserId 缺失)⇒ 与 /all 同判:按「未标注」可见(S-G02 已知残余,不在此票扩大);
 *  ⑤ 跨租户 resume 同样被挡(写端点不止 cancel 一个);
 *  ⑥ 聚合面 topology / queue 按调用方收窄;
 *
 * 判据引生产源(§22c):可见性直接用路由导出的 isDispatchVisibleTo(经 __test__ / 具名导出),
 * 测试不另写一份「owner === userId」。
 *
 * 反向例(实测,读数见 .ihui-agent/seats/S-ACL.md):把 ownsDispatch 闸从任一端点删掉 ⇒ 对应用例立刻变红。
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

/**
 * 内存版 service 替身:**复刻**生产语义而不是空壳 ——
 *  - cancel 只在 pending/running 上把状态改 'cancelled'(service:2204-2219);
 *  - resume 只在 failed/preempted/quota_exceeded 上放行,并把状态改 'running'(service:2329-2406);
 *  - 读接口按 id 取 store。
 * 这样「跨租户后状态没动」才有意义:若路由真的调了 cancel,store 会变。
 */
const { store, calls } = vi.hoisted(() => ({
  store: new Map<
    string,
    {
      id: string
      goal: string
      status: string
      ownerUserId?: string
      createdAt: string
      updatedAt: string
      dag?: { nodes: unknown[]; edges: unknown[] }
    }
  >(),
  calls: { cancel: [] as string[], resume: [] as string[] },
}))

vi.mock('../src/services/subagent-dispatch-service.js', () => {
  const RESUME_OK = new Set(['failed', 'preempted', 'quota_exceeded'])
  return {
    subagentDispatchService: {
      setRedisClient: async () => undefined,
      findById: (id: string) => store.get(id) ?? null,
      cancel: (id: string) => {
        calls.cancel.push(id)
        const d = store.get(id)
        if (!d) return false
        if (d.status !== 'pending' && d.status !== 'running') return false
        d.status = 'cancelled'
        d.updatedAt = '2026-11-01T09:00:00Z'
        return true
      },
      resume: async (id: string) => {
        calls.resume.push(id)
        const d = store.get(id)
        if (!d) return { dispatchId: id, resumed: false, skippedSteps: [], error: '派单不存在' }
        if (!RESUME_OK.has(d.status)) {
          return {
            dispatchId: id,
            resumed: false,
            skippedSteps: [],
            error: `派单状态为 ${d.status},仅 failed/preempted/quota_exceeded 可恢复`,
          }
        }
        d.status = 'running'
        return { dispatchId: id, resumed: true, skippedSteps: [] }
      },
      getDispatchStats: (id: string) => {
        const d = store.get(id)
        if (!d) return null
        return {
          dispatchId: id,
          status: d.status,
          totalDurationMs: 1,
          totalTokens: 42,
          estimatedCost: 0.000042,
          steps: [],
        }
      },
      getDag: (id: string) => {
        const d = store.get(id)
        if (!d?.dag) return null
        return {
          dispatchId: id,
          nodes: d.dag.nodes,
          edges: d.dag.edges,
          executionOrder: [],
          hasCycle: false,
        }
      },
      getQuotas: (id: string) => {
        const d = store.get(id)
        if (!d) return null
        return {
          dispatchId: id,
          quotas: { timeoutMs: 1000, tokenQuota: 1000, maxRetries: 1 },
          agents: [],
        }
      },
      getMessages: (id: string) => {
        const d = store.get(id)
        if (!d) return []
        return [{ from: 'coder', to: 'reviewer', content: `msg-of-${d.ownerUserId ?? 'legacy'}` }]
      },
      getTopology: (visible?: (d: { ownerUserId?: string }) => boolean) => {
        const dispatches = Array.from(store.values()).filter((d) =>
          visible ? visible(d as { ownerUserId?: string }) : true,
        )
        return {
          nodes: dispatches.map((d) => ({ id: d.id, goal: d.goal })),
          edges: [],
        }
      },
      getQueue: (visible?: (d: { ownerUserId?: string }) => boolean) => {
        const dispatches = Array.from(store.values()).filter((d) =>
          visible ? visible(d as { ownerUserId?: string }) : true,
        )
        return dispatches.map((d, i) => ({
          dispatchId: d.id,
          goal: d.goal,
          status: d.status,
          priority: 'normal',
          createdAt: d.createdAt,
          position: i + 1,
        }))
      },
      getStats: (visible?: (d: { ownerUserId?: string; status: string }) => boolean) => {
        const rows = Array.from(store.values()).filter((d) => (visible ? visible(d) : true))
        return {
          active: rows.filter((d) => d.status === 'pending' || d.status === 'running').length,
          completed: rows.filter((d) => d.status === 'completed').length,
          failed: rows.filter((d) => d.status === 'failed').length,
          total: rows.length,
          avgDurationMs: 0,
          totalTokens: 0,
        }
      },
      listAll: () => Array.from(store.values()),
      listActive: () =>
        Array.from(store.values()).filter((d) => d.status === 'pending' || d.status === 'running'),
      dispatch: async () => ({ outcome: 'ok' }),
    },
  }
})

vi.mock('../src/db/agent-queries.js', () => ({ findAgentTasksByAgentId: async () => [] }))

import { subagentDispatchRoutes } from '../src/routes/subagent-dispatch.js'

let app: FastifyInstance

function seed(
  id: string,
  ownerUserId: string | undefined,
  status: string,
  opts: { dag?: boolean } = {},
): void {
  store.set(id, {
    id,
    goal: `goal-${id}`,
    status,
    ...(ownerUserId ? { ownerUserId } : {}),
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
    ...(opts.dag
      ? { dag: { nodes: [{ id: 'n1', agentRole: 'coder', task: 't' }], edges: [] } }
      : {}),
  })
}

const asA = { 'x-probe-user': 'tenant-a' }
const asB = { 'x-probe-user': 'tenant-b' }

const ID_ENDPOINTS = [
  { method: 'POST', suffix: '/cancel' },
  { method: 'POST', suffix: '/resume' },
  { method: 'GET', suffix: '/stats' },
  { method: 'GET', suffix: '/dag' },
  { method: 'GET', suffix: '/quotas' },
  { method: 'GET', suffix: '/messages' },
] as const

beforeEach(async () => {
  store.clear()
  calls.cancel.length = 0
  calls.resume.length = 0
  app = Fastify()
  await app.register(subagentDispatchRoutes, { prefix: '/api' })
  await app.ready()
})

afterEach(async () => {
  await app.close()
})

describe('S-ACL ① 跨租户写越权:取消别人的派单', () => {
  it('A 对 B 的 running 派单 cancel ⇒ 404,且 B 的状态仍是 running(不能被"静默取消")', async () => {
    seed('b-running', 'tenant-b', 'running')

    const res = await app.inject({
      method: 'POST',
      url: '/api/subagents/b-running/cancel',
      headers: asA,
    })

    // 先断副作用、再断状态码:反向例里第一枪就该打在「暗地里取消了」上,而不是被 200/404 吃掉
    expect(store.get('b-running')!.status).toBe('running')
    expect(store.get('b-running')!.updatedAt).toBe('2026-11-01T00:00:00Z')
    // 闸在调用之前:service.cancel 根本没被摸到
    expect(calls.cancel).toEqual([])
    // 最关键的一条:响应不可达 ≠ 副作用没发生。状态必须原封不动。
    expect(res.statusCode).toBe(404)
  })

  it('A 对 B 的 failed 派单 resume ⇒ 404,且 B 的状态仍是 failed(没被拉起来重跑)', async () => {
    seed('b-failed', 'tenant-b', 'failed')

    const res = await app.inject({
      method: 'POST',
      url: '/api/subagents/b-failed/resume',
      headers: asA,
    })

    expect(res.statusCode).toBe(404)
    expect(store.get('b-failed')!.status).toBe('failed')
    expect(calls.resume).toEqual([])
  })
})

describe('S-ACL ② 跨租户读越权:messages / dag / quotas / stats', () => {
  it('A 读 B 的四类数据全部 404,且响应体不含 B 的 payload', async () => {
    seed('b-with-dag', 'tenant-b', 'running', { dag: true })

    for (const suffix of ['/stats', '/dag', '/quotas', '/messages'] as const) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/subagents/b-with-dag${suffix}`,
        headers: asA,
      })
      expect(res.statusCode, `GET ${suffix} 应 404`).toBe(404)
      expect(res.body).not.toContain('msg-of-tenant-b')
      expect(res.body).not.toContain('goal-b-with-dag')
    }
  })
})

describe('S-ACL ③ 正例:本人对自己的派单,6 个端点全通', () => {
  it('GET 四类数据 200 且是本人数据;cancel/resume 各在自己的合法状态上成功', async () => {
    seed('a-running', 'tenant-a', 'running', { dag: true })

    for (const suffix of ['/stats', '/dag', '/quotas', '/messages'] as const) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/subagents/a-running${suffix}`,
        headers: asA,
      })
      expect(res.statusCode, `GET ${suffix} 应 200`).toBe(200)
      if (suffix === '/messages') expect(res.body).toContain('msg-of-tenant-a')
    }

    const cancel = await app.inject({
      method: 'POST',
      url: '/api/subagents/a-running/cancel',
      headers: asA,
    })
    expect(cancel.statusCode).toBe(200)
    // 这条同时是 ① 的「哨兵」:mock 的 cancel 真会写状态,所以 ① 里状态没动是有意义的
    expect(store.get('a-running')!.status).toBe('cancelled')

    seed('a-failed', 'tenant-a', 'failed')
    const resume = await app.inject({
      method: 'POST',
      url: '/api/subagents/a-failed/resume',
      headers: asA,
    })
    expect(resume.statusCode).toBe(200)
    expect(store.get('a-failed')!.status).toBe('running')
  })

  it('每个按 id 端点对自己都真的走到 service(6 个端点没有一个是"谁都取不到")', async () => {
    seed('a-all', 'tenant-a', 'running', { dag: true })
    for (const ep of ID_ENDPOINTS) {
      if (ep.suffix === '/cancel' || ep.suffix === '/resume') continue // 写端点已在上一例覆盖
      const res = await app.inject({
        method: ep.method,
        url: `/api/subagents/a-all${ep.suffix}`,
        headers: asA,
      })
      expect(res.statusCode, `${ep.method} ${ep.suffix}`).toBe(200)
    }
  })
})

describe('S-ACL ④ 无归属记录:与 /all 同判(按「未标注」可见)', () => {
  it('ownerUserId 缺失的派单:任何登录用户都可读(不是本票要收的口径)', async () => {
    seed('legacy', undefined, 'running', { dag: true })

    for (const suffix of ['/stats', '/dag', '/quotas', '/messages'] as const) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/subagents/legacy${suffix}`,
        headers: asB,
      })
      expect(res.statusCode, `GET ${suffix} 应 200(未标注照旧公开)`).toBe(200)
    }
  })
})

describe('S-ACL ⑤ 聚合面 topology / queue 按调用方收窄', () => {
  it('A 的 topology/queue 只含自己的派单,B 的也只含自己的', async () => {
    seed('a-d', 'tenant-a', 'running')
    seed('b-d', 'tenant-b', 'running')

    const topoA = await app.inject({ method: 'GET', url: '/api/subagents/topology', headers: asA })
    expect(topoA.statusCode).toBe(200)
    const nodeIdsA = topoA.json().data.topology.nodes.map((n: { id: string }) => n.id)
    expect(nodeIdsA).toEqual(['a-d'])

    const queueB = await app.inject({ method: 'GET', url: '/api/subagents/queue', headers: asB })
    expect(queueB.statusCode).toBe(200)
    expect(queueB.json().data.queue.map((q: { dispatchId: string }) => q.dispatchId)).toEqual([
      'b-d',
    ])
  })
})

describe('S-ACL ⑥ 聚合面 /subagents/stats 与 topology/queue 同源收窄', () => {
  it('A 的 stats 只数 A 的记录,B 的只数 B 的(不出现"列表按租户、总量按全站")', async () => {
    seed('a-running', 'tenant-a', 'running')
    seed('b-done', 'tenant-b', 'completed')
    seed('b-running', 'tenant-b', 'running')

    const a = await app.inject({ method: 'GET', url: '/api/subagents/stats', headers: asA })
    expect(a.statusCode).toBe(200)
    expect(a.json().data).toMatchObject({ total: 1, active: 1, completed: 0, failed: 0 })

    const b = await app.inject({ method: 'GET', url: '/api/subagents/stats', headers: asB })
    expect(b.statusCode).toBe(200)
    expect(b.json().data).toMatchObject({ total: 2, active: 1, completed: 1, failed: 0 })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
