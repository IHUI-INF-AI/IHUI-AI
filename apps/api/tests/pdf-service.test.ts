// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PDFDocument } from 'pdf-lib'

const { mockAuthenticate } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

/**
 * 路由模块在 **import 期** 就求值 `PDF_UPLOAD_DIR = process.env.UPLOAD_DIR ?? cwd/uploads/public`，
 * 所以临时目录必须先落定、再用动态 import 载入路由。写成静态 import 的话，用例会把生成物
 * 落进真实 uploads 目录（且同名互相覆盖）。
 */
function mkTmp(): string {
  const base = join(tmpdir(), `ihui-pdf-svc-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(base, { recursive: true })
  return base
}

const TMP = mkTmp()
process.env.UPLOAD_DIR = TMP
const { otherRoutes } = await import('../src/routes/other/index.js')

const USER_ID = '00000000-0000-4000-8000-000000000001'
const PREFIX = '/api'

const FILE_A = '00000000-0000-4000-8000-000000000aaa' // 2 页
const FILE_B = '00000000-0000-4000-8000-000000000bbb' // 3 页
const FILE_MISSING = '00000000-0000-4000-8000-000000000ccc'

function mockAuthed(userId: string = USER_ID) {
  mockAuthenticate.mockImplementation(
    async (request: { userId?: string; jwtPayload?: unknown }) => {
      request.userId = userId
      request.jwtPayload = { userId, roleId: 0 }
    },
  )
}

function mockUnauthed() {
  const err = new Error('Authentication required')
  ;(err as Error & { statusCode: number }).statusCode = 401
  mockAuthenticate.mockRejectedValue(err)
}

async function makePdf(pageCount: number): Promise<Buffer> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pageCount; i++) doc.addPage([200, 200])
  return Buffer.from(await doc.save())
}

/** 落盘文件的真实页数 —— 响应里的自述数字不能当证据。 */
async function pageCountOfStored(id: string): Promise<number> {
  const doc = await PDFDocument.load(readFileSync(join(TMP, id)))
  return doc.getPageCount()
}

describe('pdf-service routes — /api/pdf-service/*', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.setErrorHandler((err, _request, reply) => {
      const statusCode =
        err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500
      reply.status(statusCode).send({
        code: statusCode,
        message: statusCode >= 500 ? '服务器错误' : err.message,
      })
    })
    await server.register(otherRoutes, { prefix: PREFIX })
    await server.ready()
    writeFileSync(join(TMP, FILE_A), await makePdf(2))
    writeFileSync(join(TMP, FILE_B), await makePdf(3))
  })

  afterAll(async () => {
    await server.close()
    rmSync(TMP, { recursive: true, force: true })
  })

  beforeEach(() => {
    mockAuthenticate.mockReset()
  })

  it('未登录 POST /pdf-service/merge 返回 401', async () => {
    mockUnauthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/pdf-service/merge`,
      payload: { fileIds: [FILE_A, FILE_B] },
    })
    expect(res.statusCode).toBe(401)
  })

  it('merge 真合并：taskId 已落盘，页数 = 两份源之和', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/pdf-service/merge`,
      payload: { fileIds: [FILE_A, FILE_B] },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.taskId).toMatch(/^[0-9a-f-]{36}$/)
    expect(body.data.operation).toBe('merge')
    expect(body.data.status).toBe('done')
    expect(body.data.fileCount).toBe(2)
    expect(existsSync(join(TMP, body.data.taskId))).toBe(true)
    expect(await pageCountOfStored(body.data.taskId)).toBe(5)
  })

  it('taskId 可经 GET /pdf-service/result/:id 取回 PDF 字节', async () => {
    mockAuthed()
    const merged = await server.inject({
      method: 'POST',
      url: `${PREFIX}/pdf-service/merge`,
      payload: { fileIds: [FILE_A, FILE_B] },
    })
    const taskId: string = merged.json().data.taskId
    const dl = await server.inject({ method: 'GET', url: `${PREFIX}/pdf-service/result/${taskId}` })
    expect(dl.statusCode).toBe(200)
    expect(dl.headers['content-type']).toContain('application/pdf')
    expect((await PDFDocument.load(dl.rawPayload)).getPageCount()).toBe(5)
  })

  it('merge 源文件不存在 → 400 并点名，绝不回一个取不到的 taskId', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/pdf-service/merge`,
      payload: { fileIds: [FILE_A, FILE_MISSING] },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('源文件不存在')
  })

  it('merge fileIds 不足 2 → 400', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/pdf-service/merge`,
      payload: { fileIds: [FILE_A] },
    })
    expect(res.statusCode).toBe(400)
  })

  it('split 按 ranges 提取：结果页数等于所选页', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/pdf-service/split`,
      payload: { fileId: FILE_B, ranges: '1-2,3' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.data.operation).toBe('split')
    expect(body.data.status).toBe('done')
    expect(body.data.ranges).toBe('1-2,3')
    expect(body.data.pageCount).toBe(3)
    expect(await pageCountOfStored(body.data.taskId)).toBe(3)
  })

  it('split 页码越界 → 400（不静默丢页）', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/pdf-service/split`,
      payload: { fileId: FILE_A, ranges: '1-99' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('页码范围')
  })

  it('split ranges 非法格式 → 400', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/pdf-service/split`,
      payload: { fileId: FILE_A, ranges: 'abc' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('watermark 逐页加水印：结果仍是可读 PDF 且页数不变', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/pdf-service/watermark`,
      payload: { fileId: FILE_A, text: 'IHUI', fontSize: 30, opacity: 0.2, rotation: 30 },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.data.operation).toBe('watermark')
    expect(body.data.status).toBe('done')
    expect(body.data.text).toBe('IHUI')
    expect(body.data.pageCount).toBe(2)
    expect(await pageCountOfStored(body.data.taskId)).toBe(2)
  })

  it('watermark 源文件不存在 → 400', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/pdf-service/watermark`,
      payload: { fileId: FILE_MISSING },
    })
    expect(res.statusCode).toBe(400)
  })

  // print/sign 曾只回 status:'pending' + 随机 taskId,全仓零消费方 ⇒ 端点已整条删除。
  // 这两条留成 404 断言而不是删掉:防"顺手把假 pending 加回来"(加了也没人接,不如让用例先响)。
  it('print / sign 端点已不存在 ⇒ 404', async () => {
    mockAuthed()
    for (const op of ['print', 'sign']) {
      const res = await server.inject({
        method: 'POST',
        url: `${PREFIX}/pdf-service/${op}`,
        payload: { fileId: FILE_A },
      })
      expect(res.statusCode, op).toBe(404)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
