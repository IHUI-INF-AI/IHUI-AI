// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SDB-30 / F-203 夹具:Crew 计费只收一次。
 *
 * 原缺陷(2026-11-08 复核):
 * 1. 路由按 run 的 totalTokens 扣钱包,而 crew-llm-adapter 已在每次 callRealLlm 内
 *    按真实成本(分)结算 ⇒ 同一 run 双扣(逐次成本 + run token 数)。
 * 2. 旧夹具把「路由按 run 扣 token」当契约写死,等于把错口径固化。
 *
 * 现口径(F-203 口径 B):
 * - 编排器每次 callRealLlm 都传 userId,adapter 在调用点按定价折算后结算;
 * - 路由**不再**按 run 二次扣费,同步/流式(含 error/cancelled)都不例外;
 * - 本夹具守护「路由侧 0 扣费」,逐次结算的正确性由 f-203-crew-llm-billing.test.ts 守护。
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

describe('SDB-30 / F-203 Crew 路由不重复扣费', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    // 仍然挂上 tokenBalance:若路由又退回按 run 扣费,deducts 会立刻变非空。
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

  it('同一 completed 会话重跑两次:路由 0 扣费(逐次成本已由 adapter 结算)', async () => {
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

    // 逐次成本结算发生在 crew-llm-adapter;路由再扣就是双扣
    expect(fixture.deducts).toHaveLength(0)
  })

  it('同步执行失败但已消耗 usage:路由不扣费,响应仍为 400', async () => {
    fixture.syncResults.push({
      success: false,
      runId: 'run-fail',
      error: 'LLM 上游超时',
      usage: usage(50),
      userId: 'user-a',
    })

    const res = await app.inject({ method: 'POST', url: '/api/crew/sessions/s-1/runs' })

    expect(res.statusCode).toBe(400)
    expect(fixture.deducts).toHaveLength(0)
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

  it('SSE 正常 complete:路由 0 扣费,runId 仍透传给客户端', async () => {
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
    expect(fixture.deducts).toHaveLength(0)
    expect(res.payload).toContain('run-stream-1')
  })

  it('SSE 客户端断连(编排器以 error/cancelled 收尾):路由仍 0 扣费', async () => {
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
    expect(fixture.deducts).toHaveLength(0)
    expect(res.payload).toContain('会话已取消')
  })

  it('SSE 启动前失败(无 usage)不扣费', async () => {
    fixture.streamEvents.push([{ type: 'error', content: '会话正在执行中', runId: 'run-stream-3' }])

    const res = await app.inject({ method: 'GET', url: '/api/crew/runs/s-1/stream' })

    expect(res.statusCode).toBe(200)
    expect(fixture.deducts).toHaveLength(0)
  })

  it('同步响应仍透传 usage 与 runId(结算不在路由,但用量仍可见)', async () => {
    fixture.syncResults.push({
      success: true,
      sessionId: 's-1',
      runId: 'run-1',
      result: 'ok',
      usage: usage(120),
      userId: 'user-a',
    })

    const res = await app.inject({ method: 'POST', url: '/api/crew/sessions/s-1/runs' })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.usage.totalTokens).toBe(120)
    expect(fixture.deducts).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
