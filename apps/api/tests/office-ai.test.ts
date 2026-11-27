// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import multipart from '@fastify/multipart'
import { officeAiRoutes } from '../src/routes/office-ai.js'

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAuth: async (request: { userId?: string }): Promise<void> => {
    request.userId = 'test-user'
  },
}))

vi.mock('../src/services/document-parser.js', () => {
  class MockFileTooLargeError extends Error {}
  class MockUnsupportedFormatError extends Error {
    readonly mime: string
    constructor(mime: string) {
      super(mime)
      this.mime = mime
    }
  }
  return {
    FileTooLargeError: MockFileTooLargeError,
    UnsupportedFormatError: MockUnsupportedFormatError,
    parseDocument: vi.fn(async () => '季度营收 1200 万元，同比增长 18%。\n重点客户续约率 92%。'),
  }
})

vi.mock('../src/services/office-converter.js', () => {
  class MockOfficeConversionError extends Error {
    readonly code: string
    constructor(code: string, message: string) {
      super(message)
      this.code = code
    }
  }
  return {
    OfficeConversionError: MockOfficeConversionError,
    convertOfficeToPdf: vi.fn(async () => Buffer.from('%PDF-1.4 converted')),
  }
})

vi.mock('../src/utils/ai-service-fetch.js', async () => {
  const actual = await vi.importActual('../src/utils/ai-service-fetch.js')
  return {
    ...actual,
    aiServiceFetch: vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            content: '**一句话总结**：季度营收 1200 万元，同比增长 18%。',
            model: 'test-model',
            usage: { total_tokens: 88 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    ),
    aiServiceFetchStream: vi.fn(
      async () =>
        new Response(
          [
            'data: {"type":"chunk","content":"**流式摘要**"}\n\n',
            'data: {"type":"chunk","content":"：季度营收 1200 万元"}\n\n',
            'data: {"type":"done","model":"stream-model","usage":{"total_tokens":12}}\n\n',
          ].join(''),
          { status: 200, headers: { 'content-type': 'text/event-stream' } },
        ),
    ),
  }
})

const { parseDocument } = await import('../src/services/document-parser.js')
const { aiServiceFetch, aiServiceFetchStream } = await import('../src/utils/ai-service-fetch.js')
const { clearDocumentTextCache } = await import('../src/services/document-text-extract.js')
const parseMock = vi.mocked(parseDocument)
const aiMock = vi.mocked(aiServiceFetch)
const aiStreamMock = vi.mocked(aiServiceFetchStream)

function multipartBody(filename: string, content: string): { boundary: string; payload: Buffer } {
  const boundary = '----ihui-office-ai-test-boundary'
  const payload = Buffer.from(
    [
      `--${boundary}`,
      `Content-Disposition: form-data; name="file"; filename="${filename}"`,
      'Content-Type: application/octet-stream',
      '',
      content,
      `--${boundary}--`,
      '',
    ].join('\r\n'),
  )
  return { boundary, payload }
}

let app: FastifyInstance

beforeAll(async () => {
  app = Fastify({ logger: false })
  await app.register(multipart, { limits: { fileSize: 20 * 1024 * 1024 } })
  await app.register(officeAiRoutes, { prefix: '/api/office' })
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  clearDocumentTextCache()
  parseMock.mockClear()
  aiMock.mockClear()
  aiStreamMock.mockClear()
})

describe('POST /api/office/analyze', () => {
  it('提取正文并返回 AI 摘要', async () => {
    const { boundary, payload } = multipartBody('季度报告.txt', '季度营收 1200 万元')
    const res = await app.inject({
      method: 'POST',
      url: '/api/office/analyze?mode=summary',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      code: number
      data: { answer: string; mode: string; extractedChars: number; model: string }
    }
    expect(body.code).toBe(0)
    expect(body.data.answer).toContain('1200 万元')
    expect(body.data.mode).toBe('summary')
    expect(body.data.extractedChars).toBeGreaterThan(0)
    expect(body.data.model).toBe('test-model')
    expect(parseMock).toHaveBeenCalledTimes(1)
    expect(aiMock).toHaveBeenCalledTimes(1)
  })

  it('流式接口先发 meta,再透传 chunk/done 帧', async () => {
    const { boundary, payload } = multipartBody('季度报告.txt', '季度营收 1200 万元')
    const res = await app.inject({
      method: 'POST',
      url: '/api/office/analyze/stream?mode=summary',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload,
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/event-stream')
    expect(res.body).toContain('"type":"meta"')
    expect(res.body).toContain('"type":"chunk"')
    expect(res.body).toContain('流式摘要')
    expect(res.body).toContain('"type":"done"')
    expect(parseMock).toHaveBeenCalledTimes(1)
    expect(aiMock).not.toHaveBeenCalled()
    expect(aiStreamMock).toHaveBeenCalledTimes(1)
    const init = aiStreamMock.mock.calls[0]?.[2] as { body?: string }
    expect(init.body).toContain('季度营收 1200 万元')
  })

  it('同一份字节第二次分析命中正文缓存,不重复解析', async () => {
    const { boundary, payload } = multipartBody('季度报告.txt', '季度营收 1200 万元')
    const first = await app.inject({
      method: 'POST',
      url: '/api/office/analyze?mode=summary',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload,
    })
    const second = await app.inject({
      method: 'POST',
      url: '/api/office/analyze?mode=keypoints',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload,
    })
    expect(first.statusCode).toBe(200)
    expect(second.statusCode).toBe(200)
    expect(parseMock).toHaveBeenCalledTimes(1)
    expect(aiMock).toHaveBeenCalledTimes(2)
  })

  it('问答模式把用户问题带进模型消息里', async () => {
    const { boundary, payload } = multipartBody('报告.txt', '季度营收 1200 万元')
    const res = await app.inject({
      method: 'POST',
      url: '/api/office/analyze?mode=qa&question=续约率是多少',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload,
    })

    expect(res.statusCode).toBe(200)
    const call = aiMock.mock.calls[0]
    const init = call?.[2] as { body?: string }
    expect(init.body).toContain('续约率是多少')
    expect(init.body).toContain('季度营收 1200 万元')
  })

  it('问答模式缺少 question 时 400', async () => {
    const { boundary, payload } = multipartBody('报告.txt', '正文')
    const res = await app.inject({
      method: 'POST',
      url: '/api/office/analyze?mode=qa',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload,
    })
    expect(res.statusCode).toBe(400)
    expect(aiMock).not.toHaveBeenCalled()
  })

  it('正文为空时 422,不调用模型', async () => {
    parseMock.mockResolvedValueOnce('   ')
    const { boundary, payload } = multipartBody('扫描件.pdf', 'fake pdf')
    const res = await app.inject({
      method: 'POST',
      url: '/api/office/analyze?mode=summary',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload,
    })
    expect(res.statusCode).toBe(422)
    expect(aiMock).not.toHaveBeenCalled()
  })

  it('不支持的文件类型 415,且不解析正文', async () => {
    const { boundary, payload } = multipartBody('archive.zip', 'zip bytes')
    const res = await app.inject({
      method: 'POST',
      url: '/api/office/analyze?mode=summary',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload,
    })
    expect(res.statusCode).toBe(415)
    expect(parseMock).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
