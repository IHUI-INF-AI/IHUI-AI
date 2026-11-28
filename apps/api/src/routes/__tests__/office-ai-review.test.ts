// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const { aiServiceFetchMock } = vi.hoisted(() => ({
  aiServiceFetchMock: vi.fn(),
}))

vi.mock('../../plugins/require-permission.js', () => ({
  requireAuth: async (request: { userId?: string }) => {
    request.userId = 'test-user'
  },
}))

vi.mock('../../utils/ai-service-fetch.js', () => ({
  aiServiceFetch: aiServiceFetchMock,
  aiServiceFetchStream: vi.fn(),
  AiServiceTimeoutError: class AiServiceTimeoutError extends Error {},
}))

import { officeAiRoutes } from '../office-ai.js'

function llmResponse(findings: unknown[]): {
  ok: boolean
  status: number
  json: () => Promise<{ content: string; model: string }>
} {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      content: JSON.stringify({ findings }),
      model: 'test-model',
    }),
  }
}

describe('POST /api/office/review AI 预审', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(officeAiRoutes, { prefix: '/api/office' })
    await app.ready()
  })

  beforeEach(() => {
    aiServiceFetchMock.mockReset()
  })

  afterAll(async () => {
    await app.close()
  })

  it('返回带证据的 findings,并保留服务端校验过的 PPTX 元素名', async () => {
    aiServiceFetchMock.mockResolvedValueOnce(
      llmResponse([
        {
          title: '合规编号缺失',
          severity: 'high',
          detail: '正文提到算法备案,但没有给出备案号。',
          evidence: '已完成算法备案',
          suggestion: '补充备案号或说明备案状态。',
          element: '标题 1',
        },
      ]),
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/office/review',
      payload: {
        title: '合规材料.pptx',
        anchor: { kind: 'pptx', slide: 1 },
        text: '标题: 合规材料。正文: 已完成算法备案,请核对。',
        elements: [{ name: '标题 1', text: '合规材料' }],
      },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.findings).toHaveLength(1)
    expect(body.data.findings[0]).toMatchObject({
      title: '合规编号缺失',
      severity: 'high',
      element: '标题 1',
      evidence: '已完成算法备案',
    })
    expect(body.data.promptVersion).toBe('ai-review-v1')
  })

  it('模型编造不存在的版式元素时丢弃该条,不生成无法落点的 pin', async () => {
    aiServiceFetchMock.mockResolvedValueOnce(
      llmResponse([
        {
          title: '不存在的元素',
          severity: 'medium',
          detail: '这条不应通过。',
          evidence: '已完成算法备案',
          suggestion: '无',
          element: '不存在的 shape',
        },
      ]),
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/office/review',
      payload: {
        title: '合规材料.pptx',
        anchor: { kind: 'pptx', slide: 1 },
        text: '标题: 合规材料。正文: 已完成算法备案,请核对。',
        elements: [{ name: '标题 1', text: '合规材料' }],
      },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.findings).toEqual([])
  })

  it('片段过短直接 400,不浪费一次模型调用', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/office/review',
      payload: { title: 'a.pdf', text: '太短' },
    })
    expect(res.statusCode).toBe(400)
    expect(aiServiceFetchMock).not.toHaveBeenCalled()
  })

  it('模型返回非 JSON 时报 502,而不是把散文写进页内批注', async () => {
    aiServiceFetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ content: '这是一段解释,不是 JSON', model: 'test-model' }),
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/office/review',
      payload: {
        title: 'a.pdf',
        anchor: { kind: 'pdf', page: 1 },
        text: '这是一段足够长的文档正文,用于触发 AI 预审而不是长度校验。',
      },
    })
    expect(res.statusCode).toBe(502)
    expect(res.json().message).toContain('结构化')
  })

  it('全文预审按 block 定位,保留跨页结论并丢弃越界 block', async () => {
    aiServiceFetchMock.mockResolvedValueOnce(
      llmResponse([
        {
          block: 2,
          title: '第 2 页缺少兜底',
          severity: 'high',
          detail: '正文承诺标识不依赖服务端,但第 2 页没有说明兜底。',
          evidence: '客户端渲染层直接输出',
          suggestion: '补充兜底策略。',
        },
        {
          block: 9,
          title: '越界结论',
          severity: 'low',
          detail: '这条不应通过。',
          evidence: '',
          suggestion: '',
        },
      ]),
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/office/review',
      payload: {
        title: '合规材料.pdf',
        blocks: [
          { anchor: { kind: 'pdf', page: 1 }, text: '第一页正文,说明标识覆盖范围。' },
          { anchor: { kind: 'pdf', page: 2 }, text: '第二页正文,说明客户端渲染层直接输出标识。' },
        ],
      },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.scope).toBe('document')
    expect(body.data.promptVersion).toBe('ai-review-v2')
    expect(body.data.findings).toHaveLength(1)
    expect(body.data.findings[0]).toMatchObject({ block: 2, title: '第 2 页缺少兜底' })
  })

  it('全文片段超限直接 400,不调用模型', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/office/review',
      payload: {
        title: '超长文档.pdf',
        blocks: [
          { anchor: { kind: 'pdf', page: 1 }, text: 'x'.repeat(12_000) },
          { anchor: { kind: 'pdf', page: 2 }, text: 'x'.repeat(12_000) },
          { anchor: { kind: 'pdf', page: 3 }, text: 'x'.repeat(12_000) },
        ],
      },
    })
    expect(res.statusCode).toBe(400)
    expect(aiServiceFetchMock).not.toHaveBeenCalled()
  })
})
