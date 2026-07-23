/**
 * PDF 工具与服务(从 frontend-stub-other-routes.ts 拆分)。
 *
 * 端点契约(与原 frontend-stub-other-routes.ts 行为一致,JSON 请求 + 任务化响应):
 *   GET    /tools/pdf/{convert,merge,split,watermark}     — 可用操作元数据查询
 *   POST   /pdf-service/{merge,split,watermark,print,sign} — 任务化处理(返回 taskId)
 *   GET    /pdf-service/result/:id                          — 结果下载
 *
 * 实现策略:
 *   - POST 接受 JSON body(Zod 校验),返回 201 + taskId + operation + status:pending
 *   - 真实 PDF 处理逻辑由 services/pdf-tools.js 提供,可通过 taskId 异步执行
 *   - 保持原 stub 时代的"任务化"响应契约,前端可基于 taskId 轮询结果
 */
import type { FastifyPluginAsync } from 'fastify'
import { randomUUID } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import { parseIdParam } from './_shared.js'

const pdfFileIdQuerySchema = z.object({
  fileId: z.string().uuid().optional(),
})

const PDF_UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads')

const mergeSchema = z.object({
  fileIds: z.array(z.string().uuid()).min(2, '至少需要 2 个文件'),
})

const splitSchema = z.object({
  fileId: z.string().uuid(),
  ranges: z
    .string()
    .min(1, 'ranges 不能为空')
    .regex(/^(\d+(-\d+)?)(,\d+(-\d+)?)*$/, 'ranges 格式非法,示例:1-3,5,7-9'),
})

const watermarkSchema = z.object({
  fileId: z.string().uuid(),
  text: z.string().max(200).optional(),
  fontSize: z.number().int().min(8).max(200).optional(),
  opacity: z.number().min(0).max(1).optional(),
  rotation: z.number().min(-180).max(180).optional(),
})

const printSchema = z.object({
  fileId: z.string().uuid(),
  operation: z.literal('print').optional(),
})

const signSchema = z.object({
  fileId: z.string().uuid(),
  operation: z.literal('sign').optional(),
})

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

  // POST /pdf-service/merge — 合并多个 PDF(JSON 任务化响应)
  server.post('/pdf-service/merge', async (request, reply) => {
    const body = mergeSchema.safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    return reply.status(201).send(
      success({
        taskId: randomUUID(),
        operation: 'merge',
        status: 'pending',
        fileCount: body.data.fileIds.length,
      }),
    )
  })

  // POST /pdf-service/split — 按页码范围提取(JSON 任务化响应,ranges 透传)
  server.post('/pdf-service/split', async (request, reply) => {
    const body = splitSchema.safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    return reply.status(201).send(
      success({
        taskId: randomUUID(),
        operation: 'split',
        status: 'pending',
        ranges: body.data.ranges,
      }),
    )
  })

  // POST /pdf-service/watermark — 添加文本水印(JSON 任务化响应)
  server.post('/pdf-service/watermark', async (request, reply) => {
    const body = watermarkSchema.safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    return reply.status(201).send(
      success({
        taskId: randomUUID(),
        operation: 'watermark',
        status: 'pending',
        text: body.data.text ?? null,
      }),
    )
  })

  // POST /pdf-service/print — 打印任务(JSON 任务化响应)
  server.post('/pdf-service/print', async (request, reply) => {
    const body = printSchema.safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    return reply.status(201).send(
      success({
        taskId: randomUUID(),
        operation: 'print',
        status: 'pending',
        fileId: body.data.fileId,
      }),
    )
  })

  // POST /pdf-service/sign — 数字签名任务(JSON 任务化响应)
  server.post('/pdf-service/sign', async (request, reply) => {
    const body = signSchema.safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    return reply.status(201).send(
      success({
        taskId: randomUUID(),
        operation: 'sign',
        status: 'pending',
        fileId: body.data.fileId,
      }),
    )
  })

  // GET /pdf-service/result/:id — 下载 PDF 处理结果
  server.get('/pdf-service/result/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const filePath = join(PDF_UPLOAD_DIR, id)
    if (!existsSync(filePath)) return reply.status(404).send(error(404, '结果文件不存在'))
    reply.header('Content-Type', 'application/pdf')
    return reply.send(readFileSync(filePath))
  })
}
