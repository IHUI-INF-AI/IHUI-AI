// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'

// 测试隔离:mock chat-queries + config,绝不连生产 PostgreSQL / Redis
vi.mock('../src/db/chat-queries.js', () => ({
  createMessage: vi.fn().mockResolvedValue({ id: 'msg-1', content: 'test' }),
  updateMessage: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    AI_SERVICE_URL: 'http://localhost:8803',
    DATABASE_URL: 'postgres://mock:mock@localhost:5432/mock',
    REDIS_URL: 'redis://localhost:6379/0',
    AI_CALLBACK_SECRET: 'test-secret',
  },
}))

import aiCallbackRoutes from '../src/routes/ai-callback'

/** ai-service _build_plan_snapshot 的真实产出形状(与 SSE plan_updated.plan 逐字段一致) */
const PLAN_SNAPSHOT = [
  {
    id: 'tc-1',
    step: 'run_command: ls -la',
    status: 'completed',
    toolCallIds: ['tc-1'],
    startedAt: '2026-09-21T10:00:00+00:00',
    endedAt: '2026-09-21T10:00:01+00:00',
    durationMs: 1000,
  },
  { id: 'tc-2', step: 'read_file: a.txt', status: 'in_progress' },
  {
    id: 'tc-3',
    step: 'run_command: rm -rf /tmp/x',
    status: 'failed',
    toolCallIds: ['tc-3'],
    error: true,
  },
]

const TOOL_CALLS = [{ id: 'tc-1', toolName: 'run_command', status: 'success' }]

describe('AI callback planSteps 持久化通道(零 schema 迁移)', () => {
  const server = Fastify({ logger: false })
  let mockAdd: ReturnType<typeof vi.fn>

  beforeAll(async () => {
    mockAdd = vi.fn().mockResolvedValue({ id: 'job-1' })
    server.decorate('aiCallbackQueue', { add: mockAdd })
    await server.register(aiCallbackRoutes)
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  const post = (payload: Record<string, unknown>) =>
    server.inject({
      method: 'POST',
      url: '/api/ai/callback',
      headers: { 'x-internal-secret': 'test-secret' },
      payload: {
        content: 'AI 回复',
        model: 'stepfun/step-3.7-flash',
        usage: { total_tokens: 50 },
        stub: false,
        metadata: { conversationId: 'conv-1', userId: 'user-1', messageId: 'msg-1' },
        ...payload,
      },
    })

  it('planSteps 入队到 metadata.planSteps,且与 toolCalls 共存(非整体覆盖)', async () => {
    mockAdd.mockClear()
    const res = await post({ planSteps: PLAN_SNAPSHOT, toolCalls: TOOL_CALLS })
    expect(res.statusCode).toBe(202)
    expect(res.json().data.queued).toBe(true)

    const job = mockAdd.mock.calls[0][1] as { metadata: Record<string, unknown> }
    expect(job.metadata.planSteps).toEqual(PLAN_SNAPSHOT)
    // 关键:同一 metadata 内既有字段不被挤掉(合并写入)
    expect(job.metadata.toolCalls).toEqual(TOOL_CALLS)
    expect(job.metadata.model).toBe('stepfun/step-3.7-flash')
  })

  it('无 planSteps 的老回调不写该 key(向后兼容,不会清空已落库计划)', async () => {
    mockAdd.mockClear()
    const res = await post({ toolCalls: TOOL_CALLS })
    expect(res.statusCode).toBe(202)
    const job = mockAdd.mock.calls[0][1] as { metadata: Record<string, unknown> }
    expect('planSteps' in job.metadata).toBe(false)
  })

  it('空 planSteps 数组不写字段(与"本轮无计划"语义区分)', async () => {
    mockAdd.mockClear()
    const res = await post({ planSteps: [] })
    expect(res.statusCode).toBe(202)
    const job = mockAdd.mock.calls[0][1] as { metadata: Record<string, unknown> }
    expect('planSteps' in job.metadata).toBe(false)
  })

  it('looseObject 透传未声明字段(error/toolCallIds/startedAt 不丢)', async () => {
    mockAdd.mockClear()
    const res = await post({ planSteps: [PLAN_SNAPSHOT[2]] })
    expect(res.statusCode).toBe(202)
    const job = mockAdd.mock.calls[0][1] as {
      metadata: { planSteps: Array<Record<string, unknown>> }
    }
    expect(job.metadata.planSteps[0]).toEqual(PLAN_SNAPSHOT[2])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
