/**
 * OSS 资源文件上传初始化(从 frontend-stub-other-routes.ts 拆分)。
 * POST /oss/resource/file — 兼容入口:等价于 /api/chunked-upload/init,写入 upload_sessions 表
 */
import type { FastifyPluginAsync } from 'fastify'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import { db } from '../../db/index.js'
import { uploadSessions } from '@ihui/database'

const ossFileInitSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileSize: z.coerce.number().int().min(0).default(0),
  totalChunks: z.coerce.number().int().min(1),
  fileMd5: z.string().max(64).optional(),
  mimeType: z.string().max(128).optional(),
  chunkSize: z.coerce
    .number()
    .int()
    .min(1)
    .default(5 * 1024 * 1024),
})

export const ossResourceRoutes: FastifyPluginAsync = async (server) => {
  server.post('/oss/resource/file', async (request, reply) => {
    const parsed = ossFileInitSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { fileName, fileSize, totalChunks, fileMd5, mimeType, chunkSize } = parsed.data
    const uploadId = randomUUID()
    try {
      await db.insert(uploadSessions).values({
        uploadId,
        fileName,
        fileSize,
        fileMd5,
        totalChunks,
        uploadedChunks: 0,
        chunkSize,
        mimeType,
        status: 'uploading',
        userId: request.userId,
      })
    } catch (e) {
      request.log.error({ err: e }, 'oss/resource/file 初始化上传会话失败')
      return reply.status(500).send(error(500, '初始化上传会话失败'))
    }
    return reply.status(201).send(
      success({
        uploadId,
        uploadUrl: '/api/chunked-upload/chunk',
        mergeUrl: '/api/chunked-upload/merge',
        statusUrl: '/api/chunked-upload/status',
        totalChunks,
        chunkSize,
      }),
    )
  })
}
