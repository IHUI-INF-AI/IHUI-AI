// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import multipart from '@fastify/multipart'

const { aiServiceFetchMock, extractDocumentTextMock } = vi.hoisted(() => ({
  aiServiceFetchMock: vi.fn(),
  extractDocumentTextMock: vi.fn(),
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

vi.mock('../../services/document-text-extract.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, extractDocumentText: extractDocumentTextMock }
})

import { officeAiRoutes } from '../office-ai.js'

/** 真插件 + 手工 boundary(与 conversation-import 测试同模式)。 */
function buildMultipart(parts: Array<{ name: string; filename?: string; content: string }>): {
  body: string
  boundary: string
} {
  const boundary = '----VitestReviseBoundary'
  const lines: string[] = []
  for (const part of parts) {
    lines.push(`--${boundary}`)
    if (part.filename) {
      lines.push(`Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"`)
      lines.push('Content-Type: text/plain')
    } else {
      lines.push(`Content-Disposition: form-data; name="${part.name}"`)
    }
    lines.push('')
    lines.push(part.content)
  }
  lines.push(`--${boundary}--`)
  return { body: lines.join('\r\n'), boundary }
}

function llmResponse(content: string): {
  ok: boolean
  status: number
  json: () => Promise<{ content: string; model: string }>
} {
  return {
    ok: true,
    status: 200,
    json: async () => ({ content, model: 'test-model' }),
  }
}

const ORIGINAL = '第一条 甲方应在三日内付款。\n第二条 乙方应交付。'

describe('POST /api/office/revise AI 修订稿', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(multipart, { limits: { fileSize: 20 * 1024 * 1024 } })
    await app.register(officeAiRoutes, { prefix: '/api/office' })
    await app.ready()
  })

  beforeEach(() => {
    aiServiceFetchMock.mockReset()
    extractDocumentTextMock.mockReset()
    extractDocumentTextMock.mockResolvedValue(ORIGINAL)
  })

  afterAll(async () => {
    await app.close()
  })

  async function revise(
    instruction: string,
    filename = '合同.txt',
  ): Promise<ReturnType<FastifyInstance['inject']>> {
    const { body, boundary } = buildMultipart([
      { name: 'instruction', content: instruction },
      { name: 'file', filename, content: 'ignored-by-mock' },
    ])
    return app.inject({
      method: 'POST',
      url: '/api/office/revise',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: body,
    })
  }

  it('返回原文与修订稿,并把 instruction 带进模型请求', async () => {
    aiServiceFetchMock.mockResolvedValueOnce(
      llmResponse('第一条 甲方应在五个工作日内付款。\n第二条 乙方应交付。'),
    )
    const res = await revise('把付款期限改成五个工作日')

    expect(res.statusCode).toBe(200)
    const payload = res.json()
    expect(payload.code).toBe(0)
    expect(payload.data.originalText).toBe(ORIGINAL)
    expect(payload.data.revisedText).toContain('五个工作日')
    expect(payload.data.instruction).toBe('把付款期限改成五个工作日')
    expect(payload.data.suspicious).toBeNull()

    const [, path, init] = aiServiceFetchMock.mock.calls[0]!
    expect(path).toBe('/api/llm/complete')
    const sent = JSON.parse((init as { body: string }).body) as {
      messages: Array<{ content: string }>
    }
    expect(sent.messages[1]!.content).toContain('把付款期限改成五个工作日')
    expect(sent.messages[1]!.content).toContain('<document>')
  })

  it('模型只回一小段时标记 possible-truncated,不静默当完整稿导出', async () => {
    aiServiceFetchMock.mockResolvedValueOnce(llmResponse('第一条 甲方付款。'))
    const res = await revise('按合规改写')
    expect(res.statusCode).toBe(200)
    expect(res.json().data.suspicious).toBe('possibly-truncated')
  })

  it('模型写成长篇评述(超原文 3.5 倍)直接 502,不产出伪修订稿', async () => {
    aiServiceFetchMock.mockResolvedValueOnce(llmResponse('这是一段很长的分析。'.repeat(40)))
    const res = await revise('按合规改写')
    expect(res.statusCode).toBe(502)
    expect(res.json().message).toContain('偏离原文')
  })

  it('缺少文件字段直接 400,不调用模型', async () => {
    const { body, boundary } = buildMultipart([{ name: 'instruction', content: '改写' }])
    const res = await app.inject({
      method: 'POST',
      url: '/api/office/revise',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: body,
    })
    expect(res.statusCode).toBe(400)
    expect(aiServiceFetchMock).not.toHaveBeenCalled()
  })

  it('正文超过 1.2 万字符时 413,不把半篇送回前端', async () => {
    extractDocumentTextMock.mockResolvedValueOnce('x'.repeat(13_000))
    const res = await revise('改写')
    expect(res.statusCode).toBe(413)
    expect(aiServiceFetchMock).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
