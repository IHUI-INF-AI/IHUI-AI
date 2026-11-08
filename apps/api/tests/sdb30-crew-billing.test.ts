// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SDB-30 夹具:Crew 计费必须按"单次 run"结算,且失败/取消不得白嫖。
 *
 * 原缺陷(2026-11-08 复核):
 * 1. 幂等键恒定 `crew:<sessionId>` —— `executeSession` 只挡 `status='running'`,已 completed
 *    的会话可反复 POST /sessions/:id/runs,每次都真实跑完角色 LLM,但第二次起命中
 *    token_flows 的幂等检查 ⇒ 0 扣费(无限免费调用模型)。
 * 2. 计费只挂 `type==='complete'` 且要求 `result.success` —— SSE 在 complete 前断开时
 *    编排器以 `type:'error'`(cancelled)收尾,路由不结算 ⇒ 已发生的 token 免费。
 *
 * 修法(本夹具守护的契约):
 * - 编排器每次执行 `randomUUID()` 生成 runId,同步结果与流式 complete/error 事件都携带;
 * - 路由幂等键改 `crew_run:<runId>`,同一会话重跑 = 不同 runId = 各自结算;
 * - 结算条件只看 `usage.totalTokens > 0 && userId`,不再看 success/终态类型;
 * - 流式结算先于 `send`,客户端断连导致 write 抛错也不会漏扣;
 * - 幂等性仍由既有的 `token_flows_order_op_unique_idx (related_order_no, op_type)` 兜底:
 *   同一 runId 的重放(网络重试/重复事件)写同一条流水 → 第二次 ON CONFLICT DO NOTHING,
 *   不会重复扣。故本条无需迁移文件。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const fixture = vi.hoisted(() => ({
  syncResults: [] as Array<Record<string, unknown>>,
  streamEvents: [] as Array<Array<Record<string, unknown>>>,
  deducts: [] as Array<{ userId: string; amount: number; reason?: string; key?: string }>,
}))

const usage = (totalTokens: number) => ({
  promptTokens: totalTokens,
  completionTokens: 0,
  totalTokens,
  model: 'fixture-model',
  calls: 1,
})

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAuth: vi.fn(async (request: { userId?: string }) => {
    request.userId = 'user-a'
  }),
  isSystemAdmin: () => false,
  requireAdmin: vi.fn(),
}))

vi.mock('../src/services/crew-orchestrator.js', () => ({
  crewOrchestrator: {
    getSession: vi.fn(async (id: string) => ({ id, userId: 'user-a', status: 'completed' })),
    executeSession: vi.fn(async () => {
      const next = fixture.syncResults.shift()
      if (!next) throw new Error('fixture: 未准备 executeSession 结果')
      return next
    }),
    executeSessionStreaming: vi.fn(async function* () {
      const events = fixture.streamEvents.shift() ?? []
      for (const evt of events) yield evt
    }),
    cancel: vi.fn(),
  },
}))

vi.mock('../src/services/crew-agent-registry.js', () => ({
  agentRegistry: { listRoles: () => [] },
}))

vi.mock('../src/services/clawdbot/index.js', () => ({
  getModelManager: () => ({ listPublic: () => [] }),
}))

import { crewRoutes } from '../src/routes/crew.js'

describe('SDB-30 Crew 计费按 run 结算', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.decorate('tokenBalance', {
      deductTokens: vi.fn(async (userId: string, amount: number, reason?: string, key?: string) => {
        fixture.deducts.push({ userId, amount, reason, key })
        return { success: true, remaining: 0 }
      }),
    })
    await app.register(crewRoutes, { prefix: '/api/crew' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    fixture.syncResults.length = 0
    fixture.streamEvents.length = 0
    fixture.deducts.length = 0
  })

  it('同一 completed 会话重跑两次:两个独立 runId 各扣一次(不再被 session 级幂等键吃掉)', async () => {
    fixture.syncResults.push(
      {
        success: true,
        sessionId: 's-1',
        runId: 'run-1',
        result: 'ok',
        usage: usage(120),
        userId: 'user-a',
      },
      {
        success: true,
        sessionId: 's-1',
        runId: 'run-2',
        result: 'ok',
        usage: usage(80),
        userId: 'user-a',
      },
    )

    for (let i = 0; i < 2; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/crew/sessions/s-1/runs',
      })
      expect(res.statusCode).toBe(200)
    }

    expect(fixture.deducts).toHaveLength(2)
    expect(fixture.deducts.map((d) => d.key)).toEqual(['crew_run:run-1', 'crew_run:run-2'])
    expect(fixture.deducts.map((d) => d.amount)).toEqual([120, 80])
    expect(fixture.deducts.every((d) => d.userId === 'user-a')).toBe(true)
  })

  it('同步执行失败但已消耗 token:照常结算,响应仍为 400', async () => {
    fixture.syncResults.push({
      success: false,
      runId: 'run-fail',
      error: 'LLM 上游超时',
      usage: usage(50),
      userId: 'user-a',
    })

    const res = await app.inject({ method: 'POST', url: '/api/crew/sessions/s-1/runs' })

    expect(res.statusCode).toBe(400)
    expect(fixture.deducts).toHaveLength(1)
    expect(fixture.deducts[0]).toMatchObject({ amount: 50, key: 'crew_run:run-fail' })
  })

  it('零用量(未真正调用模型)不扣费', async () => {
    fixture.syncResults.push({
      success: true,
      runId: 'run-zero',
      result: 'ok',
      usage: usage(0),
      userId: 'user-a',
    })

    const res = await app.inject({ method: 'POST', url: '/api/crew/sessions/s-1/runs' })

    expect(res.statusCode).toBe(200)
    expect(fixture.deducts).toHaveLength(0)
  })

  it('SSE 正常 complete:按 runId 扣一次,并把 runId 透传给客户端', async () => {
    fixture.streamEvents.push([
      { type: 'start', content: '开始', sessionId: 's-1', runId: 'run-stream-1' },
      {
        type: 'complete',
        content: '完成',
        sessionId: 's-1',
        usage: usage(200),
        userId: 'user-a',
        runId: 'run-stream-1',
      },
    ])

    const res = await app.inject({ method: 'GET', url: '/api/crew/runs/s-1/stream' })

    expect(res.statusCode).toBe(200)
    expect(fixture.deducts).toHaveLength(1)
    expect(fixture.deducts[0]).toMatchObject({ amount: 200, key: 'crew_run:run-stream-1' })
    expect(res.payload).toContain('run-stream-1')
  })

  it('SSE 客户端断连(编排器以 error/cancelled 收尾):已消耗的 usage 必须结算', async () => {
    fixture.streamEvents.push([
      { type: 'start', content: '开始', sessionId: 's-1', runId: 'run-stream-2' },
      {
        type: 'error',
        content: '客户端断开连接,会话已取消',
        sessionId: 's-1',
        usage: usage(300),
        userId: 'user-a',
        runId: 'run-stream-2',
      },
    ])

    const res = await app.inject({ method: 'GET', url: '/api/crew/runs/s-1/stream' })

    expect(res.statusCode).toBe(200)
    expect(fixture.deducts).toHaveLength(1)
    expect(fixture.deducts[0]).toMatchObject({ amount: 300, key: 'crew_run:run-stream-2' })
    expect(res.payload).toContain('会话已取消')
  })

  it('SSE 启动前失败(无 usage)不扣费', async () => {
    fixture.streamEvents.push([{ type: 'error', content: '会话正在执行中', runId: 'run-stream-3' }])

    const res = await app.inject({ method: 'GET', url: '/api/crew/runs/s-1/stream' })

    expect(res.statusCode).toBe(200)
    expect(fixture.deducts).toHaveLength(0)
  })

  it('缺 runId 时拒绝结算(不退化成 session 级恒定键),且不阻断响应', async () => {
    fixture.streamEvents.push([
      {
        type: 'complete',
        content: '完成',
        sessionId: 's-1',
        usage: usage(100),
        userId: 'user-a',
      },
    ])

    const res = await app.inject({ method: 'GET', url: '/api/crew/runs/s-1/stream' })

    expect(res.statusCode).toBe(200)
    expect(fixture.deducts).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
