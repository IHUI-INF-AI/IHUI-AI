import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { authenticate } from '../plugins/auth.js'
import { z } from 'zod'
import { deleteFile } from '../services/storage-service.js'

/**
 * 历史项目缺失端点补齐 — OSS 模块(D10/D10补充)。
 * 从原 legacy-completion.ts 拆分,注册 prefix 为 /api/legacy,完整路径保持不变。
 * - D10: OSS 文件删除 + URL转Base64(2端点 /oss/file + /oss/to-base64)
 * - D10补充: OSS 问答图片上传(/oss/ask/question/image)
 */
export const legacyOssRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // ========== D10: OSS 文件删除 + URL转Base64 (2端点) ==========
  fastify.delete('/oss/file', { preHandler: authenticate }, async (request) => {
    const { fileUrl } = z.object({ fileUrl: z.string().optional() }).parse(request.query)
    if (!fileUrl) return { deleted: false, error: 'fileUrl 为必填项' }

    // 从 URL 中提取文件 ID（UUID 格式或最后一段路径）
    const uuidMatch = fileUrl.match(
      /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    )
    const fileId = uuidMatch ? uuidMatch[1] : (fileUrl.split('/').filter(Boolean).pop() ?? null)

    if (!fileId) return { deleted: false, error: '无法从 URL 提取文件 ID' }

    const deleted = deleteFile(fileId)
    return { deleted, fileUrl }
  })

  fastify.get('/oss/to-base64', { preHandler: authenticate }, async (request, reply) => {
    const { url } = z.object({ url: z.string().url() }).parse(request.query)
    try {
      const response = await fetch(url)
      const buffer = Buffer.from(await response.arrayBuffer())
      const base64 = `data:${response.headers.get('content-type') || 'image/png'};base64,${buffer.toString('base64')}`
      return { base64 }
    } catch {
      return reply.code(400).send({ error: 'URL 转换失败' })
    }
  })

  // ========== D10补充: OSS 问答图片上传 ==========
  fastify.post('/oss/ask/question/image', { preHandler: authenticate }, async (_request, reply) => {
    // 复用现有上传逻辑
    return reply.code(501).send({ error: '请使用 /api/oss/upload 端点' })
  })
}
