// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  unlinkSync,
  rmSync,
  statSync,
  createWriteStream,
  createReadStream,
} from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { success, error } from '../utils/response.js'
import { checkAuth } from '../plugins/auth.js'
import { uploadSessions, UPLOAD_SESSION_STATUS, type UploadSessionStatus } from '@ihui/database'
import {
  PROTOCOL_UPLOAD_LIMITS,
  countUniqueReceivedChunks,
  findMissingChunkNumbers,
  hashFile,
  digestMatches,
  listReceivedChunkNumbers,
} from '../services/upload-integrity.js'

/** 校验和失败后的会话终态:不再接受分片、不再产出 url、由 reaper 到期收目录。
 *  取值取自 `@ihui/database` 的词表 —— 本文件不得再自拼状态字面量(那正是
 *  `checksum_mismatch` 曾长期不在"状态字典"里的原因:字典只是另一处的注释)。 */
const STATUS_CHECKSUM_MISMATCH: UploadSessionStatus = UPLOAD_SESSION_STATUS.checksumMismatch

function expiresAtFrom(now: Date): Date {
  return new Date(now.getTime() + PROTOCOL_UPLOAD_LIMITS.ttlMs)
}

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads')
// P2 修复(2026-08-06):合并后的成品文件(返回公开 URL /uploads/<id>)写入
// uploads/public —— 静态白名单只暴露该子目录;分片临时目录仍留在
// uploads/chunks(非公开目录,不对外提供)。
const PUBLIC_UPLOAD_DIR = join(UPLOAD_DIR, 'public')

// P2 修复(2026-08-25):merge 返回的 url 由固定相对路径改为公开可访问 URL,
// 配置 FILE_CDN_BASE(可选,如 https://file.aizhs.top)时返回 CDN 前缀地址;
// 未配置时返回相对路径 /uploads/<id>(与 server.ts 静态服务 prefix 对应)。
function resolvePublicUrl(fileId: string): string {
  const cdnBase = process.env.FILE_CDN_BASE
  return cdnBase ? `${cdnBase}/uploads/${fileId}` : `/uploads/${fileId}`
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
    if (!(await checkAuth(request, reply))) return

    const parsed = initBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { fileName, fileSize, totalChunks, fileMd5, mimeType, chunkSize } = parsed.data

    // 参数自洽性(2026-09-26):声明的字节数装不进声明的分片数 = 客户端把参数写错了,
    // 当场拒比等全部数据传完才在 merge 处失败便宜得多。chunkSize 亦不得超过协议档。
    if (chunkSize > PROTOCOL_UPLOAD_LIMITS.maxChunkBytes) {
      return reply
        .status(400)
        .send(error(400, `chunkSize 不得超过 ${PROTOCOL_UPLOAD_LIMITS.maxChunkBytes} 字节`))
    }
    if (fileSize > totalChunks * PROTOCOL_UPLOAD_LIMITS.maxChunkBytes) {
      return reply
        .status(400)
        .send(error(400, `fileSize(${fileSize}) 与 totalChunks(${totalChunks}) 不自洽`))
    }

    const uploadId = randomUUID()
    const now = new Date()

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
        status: UPLOAD_SESSION_STATUS.uploading,
        userId: request.userId,
        // TTL 回收的读侧在 services/upload-integrity.ts 的 cleanupExpiredUploadSessions
        expiresAt: expiresAtFrom(now),
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
    if (!(await checkAuth(request, reply))) return

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
    if (session.status !== UPLOAD_SESSION_STATUS.uploading) {
      return reply.status(400).send(error(400, `上传会话状态为 ${session.status}，无法继续上传`))
    }

    const buffer = request.body as Buffer | undefined
    if (!buffer || !Buffer.isBuffer(buffer)) {
      return reply.status(400).send(error(400, '分片内容为空'))
    }

    if (chunkNumber > session.totalChunks) {
      return reply
        .status(400)
        .send(error(400, `x-chunk-number 超出 totalChunks(${session.totalChunks})`))
    }
    if (buffer.byteLength > PROTOCOL_UPLOAD_LIMITS.maxChunkBytes) {
      return reply
        .status(413)
        .send(error(413, `单片不得超过 ${PROTOCOL_UPLOAD_LIMITS.maxChunkBytes} 字节`))
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

    // 进度以**磁盘上真实收到的分片索引集合**为准,不再是 `uploadedChunks + 1` 累加计数器。
    // 旧写法的错误语义:重传第 3 片两次 + 漏传第 5 片 ⇒ 计数 5/5 通过完整性判定,
    // merge 时读 5.part 才 ENOENT —— 计数与磁盘集合可以背离,而账本看起来是齐的。
    const uploadedChunks = countUniqueReceivedChunks(
      listReceivedChunkNumbers(chunkDir),
      session.totalChunks,
    )
    await db
      .update(uploadSessions)
      .set({
        uploadedChunks,
        expiresAt: expiresAtFrom(new Date()),
        updatedAt: new Date(),
      })
      .where(eq(uploadSessions.uploadId, uploadIdStr))

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
    if (!(await checkAuth(request, reply))) return

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

    // 完整性判定按"1..totalChunks 每一片是否真的在磁盘上",不是按计数相等。
    // 缺哪几片直接点名 —— 让客户端能补传,而不是回一句"不完整"再让它猜。
    const chunkDir = join(UPLOAD_DIR, 'chunks', uploadId)
    const missingChunks = findMissingChunkNumbers(
      listReceivedChunkNumbers(chunkDir),
      session.totalChunks,
    )
    if (missingChunks.length > 0) {
      return reply
        .status(400)
        .send(
          error(
            400,
            `分片未收齐:缺第 ${missingChunks.join('、')} 片(共 ${session.totalChunks} 片,实收 ${session.totalChunks - missingChunks.length} 片)`,
          ),
        )
    }

    // 更新 status=merging
    await db
      .update(uploadSessions)
      .set({ status: UPLOAD_SESSION_STATUS.merging, updatedAt: new Date() })
      .where(eq(uploadSessions.uploadId, uploadId))

    const fileId = randomUUID()
    const finalPath = join(PUBLIC_UPLOAD_DIR, fileId)

    try {
      if (!existsSync(PUBLIC_UPLOAD_DIR)) mkdirSync(PUBLIC_UPLOAD_DIR, { recursive: true })

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
        // P1 修复:用流式读取替代 readFileSync,避免阻塞 event loop
        await pipeline(createReadStream(partPath), writeStream, { end: false })
      }
      await new Promise<void>((resolve, reject) => {
        writeStream.on('error', reject)
        writeStream.end(() => resolve())
      })

      // 校验和兑现(2026-09-26 补):此前 `fileMd5` 全仓零验证点 —— 客户端声明什么
      // 都收,校验位形同装饰。现在合并完就按服务端**实算**摘要逐字比对,不符即:
      // 删除已合并文件 + 会话置终态 + 返回 4xx **不带 url**。绝不"记条日志继续交付"。
      const digests = await hashFile(finalPath)
      if (!digestMatches(session.fileMd5, digests.md5)) {
        const actualSize = statSync(finalPath).size
        try {
          unlinkSync(finalPath)
        } catch (cleanErr) {
          request.log.error({ err: cleanErr, finalPath }, '校验失败后清理合并文件失败')
        }
        await db
          .update(uploadSessions)
          .set({ status: STATUS_CHECKSUM_MISMATCH, updatedAt: new Date() })
          .where(eq(uploadSessions.uploadId, uploadId))
        request.log.error(
          {
            uploadId,
            declaredMd5: session.fileMd5,
            actualMd5: digests.md5,
            actualSha256: digests.sha256,
            actualSize,
          },
          '分片合并结果与声明校验和不符,已拒绝交付',
        )
        return reply
          .status(400)
          .send(
            error(
              400,
              `校验和不符:声明 md5=${session.fileMd5 ?? '(未声明)'} 实算 md5=${digests.md5}(sha256=${digests.sha256}, ${actualSize} 字节),已拒绝并清理合并文件`,
            ),
          )
      }

      // 校验通过才清理 chunks 目录
      if (existsSync(chunkDir)) rmSync(chunkDir, { recursive: true, force: true })
    } catch (e) {
      request.log.error({ err: e }, '合并分片失败')
      return reply.status(500).send(error(500, '合并分片失败'))
    }

    // 更新 status=completed, filePath
    await db
      .update(uploadSessions)
      .set({
        status: UPLOAD_SESSION_STATUS.completed,
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
        url: resolvePublicUrl(fileId),
      }),
    )
  })

  // DELETE /chunked-upload/cancel - 取消上传
  server.delete('/chunked-upload/cancel', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return

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
      .set({ status: UPLOAD_SESSION_STATUS.cancelled, updatedAt: new Date() })
      .where(eq(uploadSessions.uploadId, uploadId))

    return reply.send(success({ uploadId, cancelled: true }))
  })

  // GET /chunked-upload/status - 查询上传状态
  server.get('/chunked-upload/status', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return

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

    // 脱敏:filePath 是服务器磁盘路径,不返回客户端(与 files.ts path 语义修复一致)
    const { filePath: _filePath, ...safeSession } = session

    return reply.send(success(safeSession))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
