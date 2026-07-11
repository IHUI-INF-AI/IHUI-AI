import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
  rmSync,
  createWriteStream,
} from 'node:fs'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { success, error } from '../utils/response.js'
import { authenticate } from '../plugins/auth.js'
import { uploadSessions } from '@ihui/database'

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads')

// =============================================================================
// 鉴权辅助
// =============================================================================

async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  try {
    await authenticate(request)
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    const message = (e as Error).message || 'Authentication required'
    reply.status(statusCode).send(error(statusCode, message))
    return false
  }
  return true
}

// =============================================================================
// Zod schemas
// =============================================================================

const initBodySchema = z.object({
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

const mergeBodySchema = z.object({
  uploadId: z.string().min(1, 'uploadId 不能为空'),
})

const cancelBodySchema = z.object({
  uploadId: z.string().min(1, 'uploadId 不能为空'),
})

const statusQuerySchema = z.object({
  uploadId: z.string().min(1, 'uploadId 不能为空'),
})

// =============================================================================
// 路由
// =============================================================================

export const chunkedUploadRoutes: FastifyPluginAsync = async (server) => {
  // 为 application/octet-stream 注册 content-type parser（原始二进制流）
  server.addContentTypeParser(
    'application/octet-stream',
    { parseAs: 'buffer' },
    (_req, body, done) => {
      done(null, body)
    },
  )

  // POST /chunked-upload/init - 初始化分片上传
  server.post('/chunked-upload/init', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return

    const parsed = initBodySchema.safeParse(request.body)
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
      request.log.error({ err: e }, '初始化分片上传会话失败')
      return reply.status(500).send(error(500, '初始化分片上传会话失败'))
    }

    // 创建分片临时存储目录 uploads/chunks/{uploadId}/
    const chunkDir = join(UPLOAD_DIR, 'chunks', uploadId)
    try {
      if (!existsSync(chunkDir)) mkdirSync(chunkDir, { recursive: true })
    } catch (e) {
      request.log.error({ err: e }, '创建分片目录失败')
      return reply.status(500).send(error(500, '创建分片目录失败'))
    }

    return reply.status(201).send(
      success({
        uploadId,
        uploadedChunks: 0,
        chunkSize,
      }),
    )
  })

  // POST /chunked-upload/upload - 上传单个分片（application/octet-stream）
  server.post('/chunked-upload/upload', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return

    const uploadId = request.headers['x-upload-id']
    const chunkNumberRaw = request.headers['x-chunk-number']
    const uploadIdStr = Array.isArray(uploadId) ? uploadId[0] : uploadId
    const chunkNumberStr = Array.isArray(chunkNumberRaw) ? chunkNumberRaw[0] : chunkNumberRaw

    if (!uploadIdStr) {
      return reply.status(400).send(error(400, '缺少 x-upload-id 请求头'))
    }
    if (!chunkNumberStr) {
      return reply.status(400).send(error(400, '缺少 x-chunk-number 请求头'))
    }
    const chunkNumber = Number(chunkNumberStr)
    if (!Number.isInteger(chunkNumber) || chunkNumber < 1) {
      return reply.status(400).send(error(400, 'x-chunk-number 必须为正整数'))
    }

    // 查询 uploadSessions 确认 uploadId 有效且 status=uploading
    const rows = await db
      .select()
      .from(uploadSessions)
      .where(eq(uploadSessions.uploadId, uploadIdStr))
      .limit(1)

    const session = rows[0]
    if (!session) {
      return reply.status(404).send(error(404, '上传会话不存在'))
    }
    if (session.status !== 'uploading') {
      return reply.status(400).send(error(400, `上传会话状态为 ${session.status}，无法继续上传`))
    }

    const buffer = request.body as Buffer | undefined
    if (!buffer || !Buffer.isBuffer(buffer)) {
      return reply.status(400).send(error(400, '分片内容为空'))
    }

    // 将分片写入 uploads/chunks/{uploadId}/{chunkNumber}.part
    const chunkDir = join(UPLOAD_DIR, 'chunks', uploadIdStr)
    const chunkPath = join(chunkDir, `${chunkNumber}.part`)
    try {
      if (!existsSync(chunkDir)) mkdirSync(chunkDir, { recursive: true })
      writeFileSync(chunkPath, buffer)
    } catch (e) {
      request.log.error({ err: e }, '分片写入失败')
      return reply.status(500).send(error(500, '分片写入失败'))
    }

    // 更新 uploadSessions.uploadedChunks += 1
    const updated = await db
      .update(uploadSessions)
      .set({
        uploadedChunks: sql`${uploadSessions.uploadedChunks} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(uploadSessions.uploadId, uploadIdStr))
      .returning({ uploadedChunks: uploadSessions.uploadedChunks })

    const uploadedChunks = updated[0]?.uploadedChunks ?? session.uploadedChunks + 1

    return reply.send(
      success({
        uploadId: uploadIdStr,
        chunkNumber,
        uploadedChunks,
        totalChunks: session.totalChunks,
      }),
    )
  })

  // POST /chunked-upload/merge - 合并分片
  server.post('/chunked-upload/merge', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return

    const parsed = mergeBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { uploadId } = parsed.data

    const rows = await db
      .select()
      .from(uploadSessions)
      .where(eq(uploadSessions.uploadId, uploadId))
      .limit(1)

    const session = rows[0]
    if (!session) {
      return reply.status(404).send(error(404, '上传会话不存在'))
    }

    // 验证 uploadedChunks === totalChunks
    if (session.uploadedChunks !== session.totalChunks) {
      return reply
        .status(400)
        .send(error(400, `分片未上传完整: ${session.uploadedChunks}/${session.totalChunks}`))
    }

    // 更新 status=merging
    await db
      .update(uploadSessions)
      .set({ status: 'merging', updatedAt: new Date() })
      .where(eq(uploadSessions.uploadId, uploadId))

    const chunkDir = join(UPLOAD_DIR, 'chunks', uploadId)
    const fileId = randomUUID()
    const finalPath = join(UPLOAD_DIR, fileId)

    try {
      if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true })

      // 按 1..totalChunks 顺序读取所有 .part 文件合并为最终文件
      const writeStream = createWriteStream(finalPath)
      for (let i = 1; i <= session.totalChunks; i++) {
        const partPath = join(chunkDir, `${i}.part`)
        if (!existsSync(partPath)) {
          writeStream.destroy()
          // 清理已写入的半成品文件
          try {
            unlinkSync(finalPath)
          } catch {
            // ignore
          }
          return reply.status(400).send(error(400, `分片 ${i} 缺失，无法合并`))
        }
        const chunkBuffer = readFileSync(partPath)
        writeStream.write(chunkBuffer)
      }
      await new Promise<void>((resolve, reject) => {
        writeStream.on('error', reject)
        writeStream.end(() => resolve())
      })

      // 清理 chunks 目录
      if (existsSync(chunkDir)) rmSync(chunkDir, { recursive: true, force: true })
    } catch (e) {
      request.log.error({ err: e }, '合并分片失败')
      return reply.status(500).send(error(500, '合并分片失败'))
    }

    // 更新 status=completed, filePath
    await db
      .update(uploadSessions)
      .set({
        status: 'completed',
        filePath: finalPath,
        updatedAt: new Date(),
      })
      .where(eq(uploadSessions.uploadId, uploadId))

    return reply.send(
      success({
        uploadId,
        fileId,
        fileName: session.fileName,
        fileSize: session.fileSize,
        url: `/uploads/${fileId}`,
      }),
    )
  })

  // DELETE /chunked-upload/cancel - 取消上传
  server.delete('/chunked-upload/cancel', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return

    const parsed = cancelBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { uploadId } = parsed.data

    // 删除 chunks 目录
    const chunkDir = join(UPLOAD_DIR, 'chunks', uploadId)
    try {
      if (existsSync(chunkDir)) rmSync(chunkDir, { recursive: true, force: true })
    } catch (e) {
      request.log.error({ err: e }, '清理分片目录失败')
    }

    // 更新 status=cancelled
    await db
      .update(uploadSessions)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(uploadSessions.uploadId, uploadId))

    return reply.send(success({ uploadId, cancelled: true }))
  })

  // GET /chunked-upload/status - 查询上传状态
  server.get('/chunked-upload/status', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return

    const parsed = statusQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { uploadId } = parsed.data

    const rows = await db
      .select()
      .from(uploadSessions)
      .where(eq(uploadSessions.uploadId, uploadId))
      .limit(1)

    const session = rows[0]
    if (!session) {
      return reply.status(404).send(error(404, '上传会话不存在'))
    }

    return reply.send(success(session))
  })
}
