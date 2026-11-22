// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-76 回归 — merge fileIds 上限 + 异步读文件。
 *
 * 判据:
 *   - merge 的 fileIds 必须带 .max(),且上限常量导出为 20;传 21 条 → 400 且点名「最多」。
 *   - readStoredPdf 必须走 node:fs/promises 的 readFile(不再 readFileSync),且 ENOENT
 *     仍映射为既有「源文件不存在」文案,而不是把原始 errno 文本回给客户端。
 *   - 2 个真实最小 PDF 仍能合并成 201,证明异步读路径没有把正常链路改坏。
 *
 * 隔离:临时 UPLOAD_DIR + 直接注册 pdfRoutes(不挂 barrel 的鉴权 hook),不连 DB/Redis。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PDFDocument } from 'pdf-lib'

/**
 * 路由模块在 import 期就求值 `PDF_UPLOAD_DIR = process.env.UPLOAD_DIR ?? cwd/uploads/public`,
 * 所以临时目录必须先落定,再用动态 import 载入路由(同 pdf-service.test.ts 的理由)。
 */
function mkTmp(): string {
  const base = join(tmpdir(), `ihui-f76-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(base, { recursive: true })
  return base
}

const TMP = mkTmp()
process.env.UPLOAD_DIR = TMP
const { pdfRoutes, MAX_MERGE_FILES } = await import('../src/routes/other/pdf-routes.js')

const ROUTE_SOURCE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'routes',
  'other',
  'pdf-routes.ts',
)

async function makePdf(pageCount: number): Promise<Buffer> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pageCount; i++) doc.addPage([200, 200])
  return Buffer.from(await doc.save())
}

function readStoredPdfSource(): string {
  const src = readFileSync(ROUTE_SOURCE, 'utf8')
  const start = src.indexOf('function readStoredPdf')
  expect(start, 'pdf-routes.ts 应包含 readStoredPdf').toBeGreaterThanOrEqual(0)
  const end = src.indexOf('\n}', start)
  expect(end, 'readStoredPdf 函数体应以行首 } 结束').toBeGreaterThan(start)
  return src.slice(start, end)
}

describe('F-76 /pdf-service/merge 上限与异步读', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    // 直接注册插件:barrel 的 authenticate hook 不在本链路上,用例只测路由自身行为。
    await server.register(pdfRoutes)
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
    rmSync(TMP, { recursive: true, force: true })
  })

  it('上限常量导出且为 20,mergeSchema.fileIds 带 .max()', () => {
    expect(MAX_MERGE_FILES).toBe(20)
    const src = readFileSync(ROUTE_SOURCE, 'utf8')
    expect(src).toMatch(/fileIds:[\s\S]{0,160}?\.max\(/)
  })

  it('readStoredPdf 用 async readFile,不再用 readFileSync', () => {
    const fn = readStoredPdfSource()
    expect(fn).toContain('readFile(')
    expect(fn).not.toContain('readFileSync(')
  })

  it('21 个 fileId → 400,message 点名「最多」', async () => {
    const fileIds = Array.from({ length: 21 }, () => randomUUID())
    const res = await server.inject({
      method: 'POST',
      url: '/pdf-service/merge',
      payload: { fileIds },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('最多')
  })

  it('2 个不存在的 fileId → 400「源文件不存在」(异步读的 ENOENT 映射)', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/pdf-service/merge',
      payload: { fileIds: [randomUUID(), randomUUID()] },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toBe('源文件不存在')
  })

  it('2 个真实最小 PDF 仍合并成功 → 201 + fileCount:2', async () => {
    const fileIds = [randomUUID(), randomUUID()]
    writeFileSync(join(TMP, fileIds[0]), await makePdf(1))
    writeFileSync(join(TMP, fileIds[1]), await makePdf(2))
    const res = await server.inject({
      method: 'POST',
      url: '/pdf-service/merge',
      payload: { fileIds },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.data.operation).toBe('merge')
    expect(body.data.fileCount).toBe(2)
    const merged = await PDFDocument.load(readFileSync(join(TMP, body.data.taskId)))
    expect(merged.getPageCount()).toBe(3)
  })
})
