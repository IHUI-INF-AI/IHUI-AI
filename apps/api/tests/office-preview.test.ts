// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import multipart from '@fastify/multipart'
import { officePreviewRoutes } from '../src/routes/office-preview.js'
import { convertOfficeToPdf, OfficeConversionError } from '../src/services/office-converter.js'

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAuth: async (request: { userId?: string }): Promise<void> => {
    request.userId = 'test-user'
  },
}))

vi.mock('../src/services/office-converter.js', () => {
  class MockOfficeConversionError extends Error {
    readonly code: string
    constructor(code: string, message: string) {
      super(message)
      this.name = 'OfficeConversionError'
      this.code = code
    }
  }
  return {
    OfficeConversionError: MockOfficeConversionError,
    OFFICE_CONVERT_MAX_BYTES: 50 * 1024 * 1024,
    convertOfficeToPdf: vi.fn(async () => Buffer.from('%PDF-1.4 converted')),
  }
})

const convertMock = vi.mocked(convertOfficeToPdf)

function multipartBody(filename: string, content: string): { boundary: string; payload: Buffer } {
  const boundary = '----ihui-office-test-boundary'
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
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } })
  await app.register(officePreviewRoutes, { prefix: '/api/office' })
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  convertMock.mockClear()
})

describe('POST /api/office/preview', () => {
  it('上传 .doc 后返回 PDF 字节,并调用一次转换', async () => {
    const { boundary, payload } = multipartBody('旧版文档.doc', 'fake ole bytes')
    const res = await app.inject({
      method: 'POST',
      url: '/api/office/preview',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload,
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('application/pdf')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.rawPayload.toString()).toBe('%PDF-1.4 converted')
    expect(convertMock).toHaveBeenCalledTimes(1)
    expect(convertMock.mock.calls[0]?.[1]).toBe('旧版文档.doc')
  })

  it('不接受任意扩展名(415),且不触发转换', async () => {
    const { boundary, payload } = multipartBody('payload.zip', 'zip bytes')
    const res = await app.inject({
      method: 'POST',
      url: '/api/office/preview',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload,
    })
    expect(res.statusCode).toBe(415)
    expect(convertMock).not.toHaveBeenCalled()
  })

  it('转换器不可用时返回 503 + 稳定 errorCode', async () => {
    convertMock.mockRejectedValueOnce(
      new OfficeConversionError('unavailable', '宿主机未安装 LibreOffice'),
    )
    const { boundary, payload } = multipartBody('legacy.ppt', 'ppt bytes')
    const res = await app.inject({
      method: 'POST',
      url: '/api/office/preview',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload,
    })
    expect(res.statusCode).toBe(503)
    expect((res.json() as { errorCode?: string }).errorCode).toBe('OFFICE_CONVERT_UNAVAILABLE')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
