// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * PDF 工具与服务(从 frontend-stub-other-routes.ts 拆分)。
 *
 * 端点契约:
 *   GET    /tools/pdf/{convert,merge,split,watermark}  — 可用操作元数据查询
 *   POST   /pdf-service/{merge,split,watermark}        — 真处理,返回 taskId + status:'done'
 *   GET    /pdf-service/result/:id                     — 结果下载
 *
 * 实现策略:
 *   - POST 接受 JSON body(Zod 校验),返回 201 + taskId + operation + status:'done'
 *   - 任务化响应契约保留;真实处理逻辑内联于本文件,从未接线的 services/pdf-tools.ts 已随 G-1079151 移除
 *   - 曾经有 print / sign 两条 POST 只回 `status:'pending'` + 一个随机 taskId:全仓零消费者
 *     (web 的 /tools/pdf 四页只用 merge/split/watermark),轮询 /result/:id 恒 404 ——
 *     那是"点了没反应"的按钮,已整条删除,不是功能缺失。打印属客户端能力(浏览器 window.print),
 *     签名要做就得先定"视觉签章还是 PKCS#7"并连着消费方一起进 PLAN。
 */
import type { FastifyPluginAsync } from 'fastify'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import { parseIdParam } from './_shared.js'
import { PDFDocument, degrees, rgb } from 'pdf-lib'

const pdfFileIdQuerySchema = z.object({
  fileId: z.uuid().optional(),
})

// P2 修复(2026-08-06):PDF 工具读取/输出的文件位于公开目录 uploads/public(静态白名单只暴露 public/)
const PDF_UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads', 'public')

const mergeSchema = z.object({
  fileIds: z.array(z.uuid()).min(2, '至少需要 2 个文件'),
})

const splitSchema = z.object({
  fileId: z.uuid(),
  ranges: z
    .string()
    .min(1, 'ranges 不能为空')
    .regex(/^(\d+(-\d+)?)(,\d+(-\d+)?)*$/, 'ranges 格式非法,示例:1-3,5,7-9'),
})

const watermarkSchema = z.object({
  fileId: z.uuid(),
  text: z.string().max(200).optional(),
  fontSize: z.number().int().min(8).max(200).optional(),
  opacity: z.number().min(0).max(1).optional(),
  rotation: z.number().min(-180).max(180).optional(),
})

/**
 * 源文件定位:落盘名 = fileId 本身(files.ts:235-236 的 `join(UPLOAD_DIR, fileId)`,无扩展名)。
 * 路径遍历防御与 GET /pdf-service/result/:id 同一条判据(解析后必须仍在 PDF_UPLOAD_DIR 内)。
 */
function readStoredPdf(id: string): Buffer {
  const resolved = resolve(join(PDF_UPLOAD_DIR, id))
  if (!resolved.startsWith(resolve(PDF_UPLOAD_DIR) + sep)) throw new Error('无效的文件路径')
  if (!existsSync(resolved)) throw new Error('源文件不存在')
  return readFileSync(resolved)
}

/** 结果落盘名 = taskId,与 result/:id 的读出口同一条路径规则;返回 201 后前端可直接下载。 */
function writePdfResult(bytes: Uint8Array): string {
  if (!existsSync(PDF_UPLOAD_DIR)) mkdirSync(PDF_UPLOAD_DIR, { recursive: true })
  const taskId = randomUUID()
  writeFileSync(join(PDF_UPLOAD_DIR, taskId), bytes)
  return taskId
}

/** "1-3,5,7-9" → 0-based 页下标;越界或非升序当场报错，不静默丢页。 */
function parseRanges(ranges: string, pageCount: number): number[] {
  const picked: number[] = []
  for (const part of ranges.split(',')) {
    const [fromRaw, toRaw] = part.split('-')
    const from = Number(fromRaw)
    const to = toRaw === undefined ? from : Number(toRaw)
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > pageCount || from > to) {
      throw new Error(`页码范围非法或超出文档页数(共 ${pageCount} 页)：${part}`)
    }
    for (let i = from; i <= to; i++) picked.push(i - 1)
  }
  return picked
}

export const pdfRoutes: FastifyPluginAsync = async (server) => {
  // GET /tools/pdf/convert — 操作元数据
  server.get('/tools/pdf/convert', async (request, reply) => {
    const q = pdfFileIdQuerySchema.safeParse(request.query)
    if (!q.success)
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    return reply.send(
      success({
        operation: 'convert',
        description: '将文档转换为 PDF(支持 doc/docx/ppt/pptx/xls/xlsx/jpg/png)',
        status: 'available',
        fileId: q.data.fileId ?? null,
        endpoint: '/pdf-service/convert (POST)',
        params: { fileId: 'uuid', options: 'convert-specific flags' },
      }),
    )
  })

  server.get('/tools/pdf/merge', async (request, reply) => {
    const q = pdfFileIdQuerySchema.safeParse(request.query)
    if (!q.success)
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    return reply.send(
      success({
        operation: 'merge',
        description: '合并多个 PDF 为单个 PDF',
        status: 'available',
        fileId: q.data.fileId ?? null,
        endpoint: '/pdf-service/merge (POST)',
        params: { fileIds: 'uuid[] (2+ items)' },
      }),
    )
  })

  server.get('/tools/pdf/split', async (request, reply) => {
    const q = pdfFileIdQuerySchema.safeParse(request.query)
    if (!q.success)
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    return reply.send(
      success({
        operation: 'split',
        description: '按页范围拆分 PDF 为多个文件',
        status: 'available',
        fileId: q.data.fileId ?? null,
        endpoint: '/pdf-service/split (POST)',
        params: { fileId: 'uuid', ranges: '1-3,5,7-9' },
      }),
    )
  })

  server.get('/tools/pdf/watermark', async (request, reply) => {
    const q = pdfFileIdQuerySchema.safeParse(request.query)
    if (!q.success)
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    return reply.send(
      success({
        operation: 'watermark',
        description: '在 PDF 页面叠加文本或图片水印',
        status: 'available',
        fileId: q.data.fileId ?? null,
        endpoint: '/pdf-service/watermark (POST)',
        params: { fileId: 'uuid', text: 'string', opacity: '0-1' },
      }),
    )
  })

  // POST /pdf-service/merge — 合并多个 PDF(真处理；taskId 即结果文件名)
  server.post('/pdf-service/merge', async (request, reply) => {
    const body = mergeSchema.safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    try {
      const out = await PDFDocument.create()
      for (const id of body.data.fileIds) {
        const src = await PDFDocument.load(readStoredPdf(id))
        const pages = await out.copyPages(src, src.getPageIndices())
        pages.forEach((pg) => out.addPage(pg))
      }
      const taskId = writePdfResult(await out.save())
      return reply.status(201).send(
        success({
          taskId,
          operation: 'merge',
          status: 'done',
          fileCount: body.data.fileIds.length,
        }),
      )
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message))
    }
  })

  // POST /pdf-service/split — 按页码范围提取(真处理；越界当场 400，不静默丢页)
  server.post('/pdf-service/split', async (request, reply) => {
    const body = splitSchema.safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    try {
      const src = await PDFDocument.load(readStoredPdf(body.data.fileId))
      const picked = parseRanges(body.data.ranges, src.getPageCount())
      const out = await PDFDocument.create()
      const pages = await out.copyPages(src, picked)
      pages.forEach((pg) => out.addPage(pg))
      const taskId = writePdfResult(await out.save())
      return reply.status(201).send(
        success({
          taskId,
          operation: 'split',
          status: 'done',
          ranges: body.data.ranges,
          pageCount: pages.length,
        }),
      )
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message))
    }
  })

  // POST /pdf-service/watermark — 逐页加文本水印(真处理)
  server.post('/pdf-service/watermark', async (request, reply) => {
    const body = watermarkSchema.safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    try {
      const text = body.data.text?.trim() || 'IHUI AI'
      const fontSize = body.data.fontSize ?? 40
      const opacity = body.data.opacity ?? 0.15
      const rotation = body.data.rotation ?? 45
      const doc = await PDFDocument.load(readStoredPdf(body.data.fileId))
      // 不传 font：pdf-lib 对未嵌字体的标准 Helvetica 走 drawText 默认档。Helvetica 不含 CJK，
      // 中文水印需要嵌入字体子集（另一件事）—— 此处绝不为"看起来能跑"把中文静默渲成空白。
      for (const page of doc.getPages()) {
        const { width, height } = page.getSize()
        page.drawText(text, {
          x: width / 2 - (text.length * fontSize) / 6,
          y: height / 2,
          size: fontSize,
          color: rgb(0.45, 0.45, 0.45),
          rotate: degrees(rotation),
          opacity,
        })
      }
      const taskId = writePdfResult(await doc.save())
      return reply.status(201).send(
        success({
          taskId,
          operation: 'watermark',
          status: 'done',
          text,
          pageCount: doc.getPageCount(),
        }),
      )
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message))
    }
  })

  // GET /pdf-service/result/:id — 下载 PDF 处理结果
  server.get('/pdf-service/result/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const filePath = join(PDF_UPLOAD_DIR, id)
    // 2026-08-02 修复 P0 路径遍历:纵深防御,即使 idParamSchema 被绕过也拒绝逃逸 PDF_UPLOAD_DIR
    const resolvedPath = resolve(filePath)
    const resolvedBase = resolve(PDF_UPLOAD_DIR)
    if (!resolvedPath.startsWith(resolvedBase + sep)) {
      return reply.status(400).send(error(400, '无效的文件路径'))
    }
    if (!existsSync(filePath)) return reply.status(404).send(error(404, '结果文件不存在'))
    reply.header('Content-Type', 'application/pdf')
    return reply.send(readFileSync(filePath))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
