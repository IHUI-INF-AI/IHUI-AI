// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { authenticate } from '../plugins/auth.js'
import { requireAdmin } from '../plugins/require-permission.js'
import { z } from 'zod'
import { deleteFile } from '../services/storage-service.js'
import { safeFetch } from '../utils/ssrf-guard.js'
import { error } from '../utils/response.js'

/** base64 回显只服务图片(原实现把任意 URL 的响应都塞进 data URI) */
const ALLOWED_IMAGE_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
])
/** 单张图片上限 8MB:再大就不是"给前端内联用"的场景了,挡掉内存放大 */
const MAX_INLINE_BYTES = 8 * 1024 * 1024

/**
 * 文件 ID 白名单(2026-10-27 安全加固)。
 * storage-service 的 filePath() 是 `join(UPLOADS_DIR, fileId)` —— fileId 里带 `..`
 * 或路径分隔符就能越出 uploads 目录读写/删除任意文件。此处只接受
 * 「UUID」或「单段安全文件名」两种形态,含分隔符/点段/空字节一律拒。
 */
const SAFE_FILE_ID =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[A-Za-z0-9_-]{1,128})$/i

/**
 * 历史项目缺失端点补齐 — OSS 模块(D10/D10补充)。
 * 从原 legacy-completion.ts 拆分,注册 prefix 为 /api/legacy,完整路径保持不变。
 * - D10: OSS 文件删除 + URL转Base64(2端点 /oss/file + /oss/to-base64)
 * - D10补充: OSS 问答图片上传(/oss/ask/question/image)
 *
 * 安全(2026-10-27 加固):
 * - DELETE /oss/file 原为「登录即可删」,fileId 从用户给的 URL 里抠出来、无归属校验 ⇒
 *   任何注册用户可删任意用户上传的文件。存储层没有 owner 映射可查(legacy 路径),
 *   故改为**仅管理员**,并对 fileId 做形态白名单(顺带堵住 `..` 越目录删除)。
 * - GET /oss/to-base64 原为裸 `fetch(url)` ⇒ 完整 SSRF(可探内网/云元数据)。
 *   改走全站统一的 safeFetch(私网/保留地址 + 重定向逐跳校验),并限定图片 MIME 与体积。
 */
export const legacyOssRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // ========== D10: OSS 文件删除 + URL转Base64 (2端点) ==========
  fastify.delete(
    '/oss/file',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { fileUrl } = z.object({ fileUrl: z.string().optional() }).parse(request.query)
      if (!fileUrl) return reply.status(400).send(error(400, 'fileUrl 为必填项'))

      // 从 URL 中提取文件 ID(UUID 格式或最后一段路径)
      const uuidMatch = fileUrl.match(
        /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
      )
      const fileId = uuidMatch ? uuidMatch[1] : (fileUrl.split('/').filter(Boolean).pop() ?? null)

      if (!fileId) return reply.status(400).send(error(400, '无法从 URL 提取文件 ID'))
      if (!SAFE_FILE_ID.test(fileId)) {
        return reply.status(400).send(error(400, '文件 ID 形态非法'))
      }

      const deleted = deleteFile(fileId)
      return reply.send({ deleted, fileUrl })
    },
  )

  fastify.get('/oss/to-base64', { preHandler: authenticate }, async (request, reply) => {
    const { url } = z.object({ url: z.url() }).parse(request.query)
    try {
      const response = await safeFetch(url)
      const mime =
        (response.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? ''
      if (!ALLOWED_IMAGE_MIME.has(mime)) {
        return reply.status(400).send(error(400, '仅支持图片类型'))
      }
      const declared = Number(response.headers.get('content-length') ?? '0')
      if (declared > MAX_INLINE_BYTES) {
        return reply.status(413).send(error(413, '图片过大'))
      }
      const buffer = Buffer.from(await response.arrayBuffer())
      if (buffer.length > MAX_INLINE_BYTES) {
        return reply.status(413).send(error(413, '图片过大'))
      }
      const base64 = `data:${mime};base64,${buffer.toString('base64')}`
      return reply.send({ base64 })
    } catch {
      // 不把 safeFetch 的拒绝原因(私网判定细节)回给调用方
      return reply.status(400).send(error(400, 'URL 转换失败'))
    }
  })

  // ========== D10补充: OSS 问答图片上传 ==========
  fastify.post('/oss/ask/question/image', { preHandler: authenticate }, async (_request, reply) => {
    // 复用现有上传逻辑
    return reply.status(501).send(error(501, '请使用 /api/oss/upload 端点'))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
