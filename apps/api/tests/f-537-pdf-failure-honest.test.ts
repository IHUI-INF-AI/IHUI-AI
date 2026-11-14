// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-537 回归锁(2026-11-13)。
 *
 * 病灶:pdf-service 把「无 pdfkit」与「任意渲染异常」都折叠成 stub(空白 PDF) + 200,
 * report / edu-public / ai-modules 三处调用方只取 .buffer 直接 send ⇒ 用户拿到空白文件且无告警。
 *
 * 本文件锁:
 *   ① 生成失败时服务返回 ok:false 显式失败体,不再伪装成成功;
 *   ② 三处调用方都检查失败并返回 503,响应体不是 PDF、不含内部异常/栈;
 *   ③ 成功路径仍原样返回 PDF 字节与 Content-Type / Content-Disposition;
 *   ④ 失败文案只用固定中文,不泄露 pdfkit 异常或源码栈。
 *
 * mock 生成器(pdf-service 与 pdfkit),不触达真实 DB/Redis/字体渲染。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

interface PDFResultLike {
  ok: boolean
  buffer: Buffer
  stub: boolean
  error?: string
}

type GenerateFn = (input: unknown) => Promise<PDFResultLike>

const { mockGenerate, realGenerateRef } = vi.hoisted(() => ({
  mockGenerate: vi.fn(),
  realGenerateRef: { current: null as GenerateFn | null },
}))

// 只替换 generateReportPDF,其余导出(证书/发票)保留真实实现
vi.mock('../src/services/pdf-service.js', async (importOriginal) => {
  const actual = (await importOriginal()) as { generateReportPDF: unknown }
  realGenerateRef.current = actual.generateReportPDF as GenerateFn
  return { ...actual, generateReportPDF: mockGenerate }
})

// pdfkit 构造即抛错,用来复现真实服务层的渲染失败
vi.mock('pdfkit', () => ({
  default: class {
    constructor() {
      throw new Error('pdfkit internal boom')
    }
  },
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: { userId?: string }) => {
    request.userId = 'f537-user'
  }),
  checkAuth: vi.fn(async () => true),
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: async () => undefined,
  requirePermission: () => async () => undefined,
}))

vi.mock('../src/db/index.js', () => {
  const rows: unknown[] = []
  // 同时支持 await 与 .groupBy().orderBy() 链式调用
  const chain = {
    from: () => chain,
    where: () => chain,
    groupBy: () => chain,
    orderBy: async () => rows,
    limit: () => chain,
    then: (resolve: (value: unknown[]) => unknown) => resolve(rows),
  }
  return {
    db: { select: () => chain, insert: () => chain, update: () => chain, delete: () => chain },
    dbRead: { select: () => chain },
    dbClient: {},
  }
})

vi.mock('../src/db/learn-queries.js', () => ({
  findMyLessons: async () => ({ total: 0, list: [] }),
}))
vi.mock('../src/db/exam-queries.js', () => ({
  findMyExamRecords: async () => ({ total: 0, list: [] }),
}))
vi.mock('../src/db/certificate-queries.js', () => ({
  findCertificates: async () => ({ total: 0, list: [] }),
}))

import aiModulesRoutes from '../src/routes/user/ai-modules-routes.js'
import { adminReportRoutes } from '../src/routes/report.js'
import { sendStudentReport } from '../src/routes/edu-public.js'

/** 成功路径的固定字节,断言「原样透传」。 */
const OK_BYTES = Buffer.from('%PDF-1.4\n% F-537 real report bytes\n%%EOF')
const INTERNAL_DETAIL = 'pdfkit internal boom at pdf-service.ts:349'

function failResult(): PDFResultLike {
  return { ok: false, buffer: Buffer.alloc(0), stub: true, error: INTERNAL_DETAIL }
}

function okResult(): PDFResultLike {
  return { ok: true, buffer: OK_BYTES, stub: false }
}

function expectNoLeak(body: string): void {
  expect(body).not.toContain('pdfkit internal boom')
  expect(body).not.toContain('pdf-service.ts')
  expect(body).not.toContain('at ')
}

describe('F-537 PDF 生成失败必须如实报错', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(aiModulesRoutes, { prefix: '/api' })
    await app.register(adminReportRoutes, { prefix: '/api/admin' })
    app.post('/test/edu-report', async (_request, reply) =>
      sendStudentReport(reply, 'f537-user', 'pdf'),
    )
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    mockGenerate.mockReset()
  })

  const reportCall = () =>
    app.inject({
      method: 'POST',
      url: '/api/admin/reports/generate',
      payload: {
        type: 'visit-summary',
        startDate: '2026-11-01',
        endDate: '2026-11-02',
        format: 'pdf',
      },
    })

  const eduCall = () => app.inject({ method: 'POST', url: '/test/edu-report' })

  const careerCall = () =>
    app.inject({
      method: 'POST',
      url: '/api/ai/career-advice/export',
      headers: { authorization: 'Bearer f537-token' },
      payload: { format: 'pdf', school: '示例中学' },
    })

  it('① 服务层:渲染抛错返回 ok:false 显式失败,不再产出空白 PDF 冒充成功', async () => {
    const generate = realGenerateRef.current
    expect(generate).toBeTypeOf('function')

    const result = await generate!({ title: 't', sections: [], generatedAt: new Date() })
    expect(result.ok).toBe(false)
    expect(result.stub).toBe(true)
    expect(result.buffer.length).toBe(0)
    expect(result.error).toBeTruthy()
    expect(result.error).not.toContain('pdfkit internal boom')
    expect(result.error).not.toContain('pdf-service.ts')
  })

  it('② report 调用方:失败 → 503 JSON,不是空白 PDF + 200', async () => {
    mockGenerate.mockResolvedValueOnce(failResult())
    const res = await reportCall()
    expect(res.statusCode).toBe(503)
    expect(res.headers['content-type']).toContain('application/json')
    expect(res.headers['content-type']).not.toContain('application/pdf')
    expect(res.json()).toMatchObject({ code: 503 })
    expect(res.json().message).toContain('PDF')
    expectNoLeak(res.body)
  })

  it('② edu 调用方:失败 → 503 JSON,不是空白 PDF + 200', async () => {
    mockGenerate.mockResolvedValueOnce(failResult())
    const res = await eduCall()
    expect(res.statusCode).toBe(503)
    expect(res.headers['content-type']).toContain('application/json')
    expect(res.json()).toMatchObject({ code: 503 })
    expect(res.json().message).toContain('PDF')
    expectNoLeak(res.body)
  })

  it('② career 调用方:失败 → 503 JSON,不是空白 PDF + 200', async () => {
    mockGenerate.mockResolvedValueOnce(failResult())
    const res = await careerCall()
    expect(res.statusCode).toBe(503)
    expect(res.headers['content-type']).toContain('application/json')
    expect(res.json()).toMatchObject({ code: 503 })
    expect(res.json().message).toContain('PDF')
    expectNoLeak(res.body)
  })

  it('③ 成功路径:三处调用方仍原样返回 PDF 字节与响应头', async () => {
    const cases: Array<[string, () => Promise<{ statusCode: number; rawPayload: Buffer; headers: Record<string, unknown> }>]> = [
      ['report', reportCall],
      ['edu', eduCall],
      ['career', careerCall],
    ]
    for (const [name, call] of cases) {
      mockGenerate.mockResolvedValueOnce(okResult())
      const res = await call()
      expect(res.statusCode, name).toBe(200)
      expect(String(res.headers['content-type']), name).toContain('application/pdf')
      expect(String(res.headers['content-disposition']), name).toContain('attachment')
      expect(res.rawPayload.equals(OK_BYTES), name).toBe(true)
    }
  })

  it('④ 生成器调用契约:三处都向 generateReportPDF 传了标题与 sections', async () => {
    for (const call of [reportCall, eduCall, careerCall]) {
      mockGenerate.mockResolvedValueOnce(okResult())
      await call()
      const input = mockGenerate.mock.calls.at(-1)?.[0] as {
        title?: string
        sections?: unknown[]
        generatedAt?: Date
      }
      expect(typeof input.title).toBe('string')
      expect(Array.isArray(input.sections)).toBe(true)
      expect(input.generatedAt instanceof Date).toBe(true)
    }
  })
})
