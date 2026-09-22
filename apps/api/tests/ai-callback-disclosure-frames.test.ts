// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-166 交代帧持久化通道:citations / injections 与 planSteps 同一套契约
// (空数组不写 key、loose 透传额外字段、不挤掉同 metadata 里的既有字段)。
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

/** ai-service _collect_citations 的真实产出形状(url 只在真有链接时携带) */
const CITATIONS = [
  { source: 'knowledge', label: '架构说明 §2', url: 'docs/architecture.md' },
  { source: 'web', label: '无链接来源' },
]

/** 与 SSE injection_applied 同源的列表(帧判别字 type 已被生产侧剥掉) */
const INJECTIONS = [
  {
    kind: 'developer_instructions',
    collapsed: '已应用会话级自定义指令',
    fullText: '按仓库规范回答',
  },
  { kind: 'auto_context', collapsed: '已自动检索并注入 3 段代码上下文', count: 3 },
]

describe('AI callback 交代帧持久化(citations / injections)', () => {
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

  it('两类交代帧一起入队,且不挤掉同 metadata 里的既有字段', async () => {
    mockAdd.mockClear()
    const res = await post({ citations: CITATIONS, injections: INJECTIONS, planSteps: [] })
    expect(res.statusCode).toBe(202)
    const job = mockAdd.mock.calls[0][1] as { metadata: Record<string, unknown> }
    expect(job.metadata.citations).toEqual(CITATIONS)
    expect(job.metadata.injections).toEqual(INJECTIONS)
    expect(job.metadata.model).toBe('stepfun/step-3.7-flash')
    // 空数组不写 key:与"本轮无计划"区分,也不会覆盖 worker 已合并的字段
    expect('planSteps' in job.metadata).toBe(false)
  })

  it('老回调不带这两个 key → 不写字段(向后兼容,不清空已落库交代)', async () => {
    mockAdd.mockClear()
    const res = await post({})
    expect(res.statusCode).toBe(202)
    const job = mockAdd.mock.calls[0][1] as { metadata: Record<string, unknown> }
    expect('citations' in job.metadata).toBe(false)
    expect('injections' in job.metadata).toBe(false)
  })

  it('空数组一律不写 key', async () => {
    mockAdd.mockClear()
    const res = await post({ citations: [], injections: [] })
    expect(res.statusCode).toBe(202)
    const job = mockAdd.mock.calls[0][1] as { metadata: Record<string, unknown> }
    expect('citations' in job.metadata).toBe(false)
    expect('injections' in job.metadata).toBe(false)
  })

  it('缺关键字段的脏条目被拒(400),不会半落库', async () => {
    mockAdd.mockClear()
    const noLabel = await post({ citations: [{ source: 'knowledge' }] })
    expect(noLabel.statusCode).toBe(400)
    const noKind = await post({ injections: [{ collapsed: 'x' }] })
    expect(noKind.statusCode).toBe(400)
    expect(mockAdd).not.toHaveBeenCalled()
  })

  it('loose 透传未声明字段(未来帧扩字段不因校验丢数据)', async () => {
    mockAdd.mockClear()
    const res = await post({ citations: [{ source: 's', label: 'l', noteKind: 'future' }] })
    expect(res.statusCode).toBe(202)
    const job = mockAdd.mock.calls[0][1] as {
      metadata: { citations: Array<Record<string, unknown>> }
    }
    expect(job.metadata.citations[0]).toEqual({ source: 's', label: 'l', noteKind: 'future' })
  })
})

/** 与 SSE compaction 帧同一载荷(ai-service _compaction_payload) */
const COMPACTION = {
  triggered: true,
  tokensBefore: 48000,
  tokensAfter: 12000,
  removedCount: 31,
  usageRatio: 0.88,
  trigger: 'ratio',
}

describe('AI callback compaction 持久化(G-166 第②步)', () => {
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
        metadata: { conversationId: 'conv-1', userId: 'user-1', messageId: 'msg-1' },
        ...payload,
      },
    })

  it('compaction 入队到 metadata.compaction,字段逐字不动', async () => {
    mockAdd.mockClear()
    const res = await post({ compaction: COMPACTION })
    expect(res.statusCode).toBe(202)
    const job = mockAdd.mock.calls[0][1] as { metadata: Record<string, unknown> }
    expect(job.metadata.compaction).toEqual(COMPACTION)
  })

  it('本轮没压缩 → 不带字段(不清空已落库的压缩统计)', async () => {
    mockAdd.mockClear()
    const res = await post({})
    expect(res.statusCode).toBe(202)
    const job = mockAdd.mock.calls[0][1] as { metadata: Record<string, unknown> }
    expect('compaction' in job.metadata).toBe(false)
  })

  it('triggered !== true 被拒(压缩没发生就不该留痕)', async () => {
    mockAdd.mockClear()
    const res = await post({ compaction: { ...COMPACTION, triggered: false } })
    expect(res.statusCode).toBe(400)
    expect(mockAdd).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
