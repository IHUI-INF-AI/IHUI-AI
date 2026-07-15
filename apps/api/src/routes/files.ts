import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'
import { authenticate } from '../plugins/auth.js'
import { findFileById } from '../db/workspace-queries.js'
import {
  searchFiles,
  canAccessFile,
  createShare,
  findShareByToken,
  deleteShare,
  findRecentFiles,
} from '../db/file-queries.js'
import { findTagsByTarget, attachTag, detachTag } from '../db/social-queries.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { buildSchema } from '../utils/swagger.js'

const ADMIN_ROLE_ID = 1

// =============================================================================
// 序列化辅助
// =============================================================================

function serializeFile(f: {
  id: string
  projectId: string
  name: string
  path: string
  size: number | bigint
  mimeType: string
  uploadedBy: string | null
  createdAt: Date
}) {
  return {
    id: f.id,
    projectId: f.projectId,
    name: f.name,
    size: Number(f.size),
    mimeType: f.mimeType,
    uploadedBy: f.uploadedBy,
    createdAt: f.createdAt,
  }
}

function serializeTag(t: {
  id: string
  name: string
  slug: string
  color: string | null
  createdBy: string | null
  createdAt: Date
}) {
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    color: t.color,
    createdBy: t.createdBy,
    createdAt: t.createdAt,
  }
}

// =============================================================================
// Zod schemas
// =============================================================================

const searchQuerySchema = z.object({
  q: z.preprocess(emptyToUndefined, z.string().max(255).optional()),
  projectId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  mimeType: z.preprocess(emptyToUndefined, z.string().max(128).optional()),
  tag: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
})

const recentQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

const idParamSchema = z.object({ id: z.string().uuid('无效的文件 ID') })
const tagIdParamSchema = z.object({
  id: z.string().uuid('无效的文件 ID'),
  tagId: z.string().uuid('无效的标签 ID'),
})
const tokenParamSchema = z.object({ token: z.string().min(1, 'token 不能为空') })
const shareIdParamSchema = z.object({ id: z.string().uuid('无效的分享 ID') })

const addTagsSchema = z.object({
  tagIds: z.array(z.string().uuid()).min(1, '至少选择一个标签').max(50, '一次最多 50 个标签'),
})

const createShareSchema = z.object({
  sharedWith: z.string().uuid().optional(),
  permissions: z.enum(['view', 'edit']).default('view'),
  expiresAt: z
    .string()
    .datetime()
    .transform((v) => new Date(v))
    .optional(),
})

const uploadBase64Schema = z.object({
  base64: z.string().min(1, 'base64 数据不能为空'),
  filename: z.string().min(1).max(255),
  mime: z.string().min(1).max(128),
})

// =============================================================================
// 路由
// =============================================================================

export const fileRoutes: FastifyPluginAsync = async (server) => {
  const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || 'Authentication required'
      return reply.status(statusCode).send(error(statusCode, message))
    }
  }

  // 判断当前用户是否为管理员
  const isAdmin = (request: FastifyRequest): boolean =>
    (request.jwtPayload?.roleId ?? 0) >= ADMIN_ROLE_ID

  const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads')

  // POST /files/upload/base64 - base64 上传（支持 webp→png 转换）
  server.post(
    '/files/upload/base64',
    {
      schema: buildSchema({
        summary: 'Base64 上传文件',
        description: '通过 base64 编码上传文件,支持 webp 自动转 png',
        tags: ['File'],
        body: uploadBase64Schema,
      }),
    },
    async (request, reply) => {
      await requireAuth(request, reply)
      if (!request.userId) return

      const parsed = uploadBase64Schema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      const { base64, filename, mime } = parsed.data

      let finalBuffer: Buffer
      let finalMime: string
      let finalFilename: string

      try {
        const buffer = Buffer.from(base64, 'base64')

        if (mime === 'image/webp') {
          finalBuffer = await sharp(buffer).png().toBuffer()
          finalMime = 'image/png'
          finalFilename = filename.replace(/\.webp$/i, '.png')
        } else {
          finalBuffer = buffer
          finalMime = mime
          finalFilename = filename
        }
      } catch (e) {
        request.log.error({ err: e }, 'base64 解码或图片转换失败')
        return reply.status(400).send(error(400, 'base64 解码或图片转换失败'))
      }

      try {
        if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true })
        const fileId = randomUUID()
        const filePath = join(UPLOAD_DIR, fileId)
        writeFileSync(filePath, finalBuffer)

        return reply.status(201).send(
          success({
            file: {
              id: fileId,
              name: finalFilename,
              size: finalBuffer.length,
              mimeType: finalMime,
              path: filePath,
              uploadedBy: request.userId,
            },
          }),
        )
      } catch (e) {
        request.log.error({ err: e }, '文件保存失败')
        return reply.status(500).send(error(500, '文件保存失败'))
      }
    },
  )

  // GET /files/search - 搜索文件（query: q / projectId / mimeType / tag）
  server.get(
    '/files/search',
    {
      schema: buildSchema({
        summary: '搜索文件',
        description: '按关键字、项目、MIME 类型、标签搜索文件',
        tags: ['File'],
        querystring: searchQuerySchema,
      }),
    },
    async (request, reply) => {
      await requireAuth(request, reply)
      if (!request.userId) return

      const parsed = searchQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      const list = await searchFiles({
        userId: request.userId,
        q: parsed.data.q,
        projectId: parsed.data.projectId,
        mimeType: parsed.data.mimeType,
        tag: parsed.data.tag,
      })
      return reply.send(success({ files: list.map(serializeFile) }))
    },
  )

  // GET /files/recent - 最近文件（按 createdAt 倒序）
  server.get(
    '/files/recent',
    {
      schema: buildSchema({
        summary: '最近文件',
        description: '返回当前用户最近上传的文件列表(按 createdAt 倒序)',
        tags: ['File'],
        querystring: recentQuerySchema,
      }),
    },
    async (request, reply) => {
      await requireAuth(request, reply)
      if (!request.userId) return

      const parsed = recentQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      const list = await findRecentFiles(request.userId, parsed.data.limit)
      return reply.send(success({ files: list.map(serializeFile) }))
    },
  )

  // GET /files/shared/:token - 公开访问分享的文件信息（无需登录）
  server.get(
    '/files/shared/:token',
    {
      schema: buildSchema({
        summary: '获取分享文件信息',
        description: '通过分享 token 公开访问文件信息(无需登录)',
        tags: ['File'],
        params: tokenParamSchema,
        auth: false,
      }),
    },
    async (request, reply) => {
      const parsed = tokenParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      const share = await findShareByToken(parsed.data.token)
      if (!share) {
        return reply.status(404).send(error(404, '分享不存在或已过期'))
      }

      const file = await findFileById(share.fileId)
      if (!file) {
        return reply.status(404).send(error(404, '文件不存在'))
      }

      return reply.send(
        success({
          share: {
            id: share.id,
            permissions: share.permissions,
            expiresAt: share.expiresAt,
            createdAt: share.createdAt,
          },
          file: {
            id: file.id,
            name: file.name,
            size: Number(file.size),
            mimeType: file.mimeType,
            createdAt: file.createdAt,
          },
        }),
      )
    },
  )

  // GET /files/:id/tags - 获取文件标签
  server.get(
    '/files/:id/tags',
    {
      schema: buildSchema({
        summary: '获取文件标签',
        description: '返回指定文件绑定的所有标签',
        tags: ['File'],
        params: idParamSchema,
      }),
    },
    async (request, reply) => {
      await requireAuth(request, reply)
      if (!request.userId) return
      const userId = request.userId

      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      const file = await findFileById(parsed.data.id)
      if (!file) {
        return reply.status(404).send(error(404, '文件不存在'))
      }
      if (!isAdmin(request) && !(await canAccessFile(userId, file))) {
        return reply.status(403).send(error(403, '无权访问该文件'))
      }

      const tags = await findTagsByTarget('file', file.id)
      return reply.send(success({ tags: tags.map(serializeTag) }))
    },
  )

  // POST /files/:id/tags - 给文件打标签（覆盖式追加）
  server.post(
    '/files/:id/tags',
    {
      schema: buildSchema({
        summary: '给文件打标签',
        description: '为指定文件追加标签(支持批量)',
        tags: ['File'],
        params: idParamSchema,
        body: addTagsSchema,
      }),
    },
    async (request, reply) => {
      await requireAuth(request, reply)
      if (!request.userId) return
      const userId = request.userId

      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const bodyParsed = addTagsSchema.safeParse(request.body)
      if (!bodyParsed.success) {
        return reply.status(400).send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'))
      }

      const file = await findFileById(parsed.data.id)
      if (!file) {
        return reply.status(404).send(error(404, '文件不存在'))
      }
      if (!isAdmin(request) && !(await canAccessFile(userId, file))) {
        return reply.status(403).send(error(403, '无权操作该文件'))
      }

      for (const tagId of bodyParsed.data.tagIds) {
        await attachTag({
          tagId,
          resourceType: 'file',
          resourceId: file.id,
          createdBy: userId,
        })
      }
      const tags = await findTagsByTarget('file', file.id)
      return reply.send(success({ tags: tags.map(serializeTag) }))
    },
  )

  // DELETE /files/:id/tags/:tagId - 移除文件上的标签
  server.delete(
    '/files/:id/tags/:tagId',
    {
      schema: buildSchema({
        summary: '移除文件标签',
        description: '从指定文件移除一个标签',
        tags: ['File'],
        params: tagIdParamSchema,
      }),
    },
    async (request, reply) => {
      await requireAuth(request, reply)
      if (!request.userId) return
      const userId = request.userId

      const parsed = tagIdParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      const file = await findFileById(parsed.data.id)
      if (!file) {
        return reply.status(404).send(error(404, '文件不存在'))
      }
      if (!isAdmin(request) && !(await canAccessFile(userId, file))) {
        return reply.status(403).send(error(403, '无权操作该文件'))
      }

      const removed = await detachTag({
        tagId: parsed.data.tagId,
        resourceType: 'file',
        resourceId: file.id,
      })
      if (!removed) {
        return reply.status(404).send(error(404, '该标签未绑定到此文件'))
      }
      return reply.send(success({ removed: true }))
    },
  )

  // POST /files/:id/share - 创建分享
  server.post(
    '/files/:id/share',
    {
      schema: buildSchema({
        summary: '创建文件分享',
        description: '为指定文件创建分享链接(可指定接收人与权限)',
        tags: ['File'],
        params: idParamSchema,
        body: createShareSchema,
      }),
    },
    async (request, reply) => {
      await requireAuth(request, reply)
      if (!request.userId) return
      const userId = request.userId

      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const bodyParsed = createShareSchema.safeParse(request.body)
      if (!bodyParsed.success) {
        return reply.status(400).send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'))
      }

      const file = await findFileById(parsed.data.id)
      if (!file) {
        return reply.status(404).send(error(404, '文件不存在'))
      }
      if (!isAdmin(request) && !(await canAccessFile(userId, file))) {
        return reply.status(403).send(error(403, '无权分享该文件'))
      }

      let share
      try {
        share = await createShare({
          fileId: file.id,
          sharedBy: userId,
          sharedWith: bodyParsed.data.sharedWith,
          permissions: bodyParsed.data.permissions,
          expiresAt: bodyParsed.data.expiresAt,
        })
      } catch (e) {
        request.log.error({ err: e }, '创建分享失败')
        return reply.status(500).send(error(500, '创建分享失败'))
      }

      return reply.status(201).send(
        success({
          share: {
            id: share.id,
            shareToken: share.shareToken,
            permissions: share.permissions,
            sharedWith: share.sharedWith,
            expiresAt: share.expiresAt,
            createdAt: share.createdAt,
          },
        }),
      )
    },
  )

  // DELETE /files/shares/:id - 撤销分享（仅创建者本人）
  server.delete(
    '/files/shares/:id',
    {
      schema: buildSchema({
        summary: '撤销文件分享',
        description: '撤销指定分享(仅创建者本人可操作)',
        tags: ['File'],
        params: shareIdParamSchema,
      }),
    },
    async (request, reply) => {
      await requireAuth(request, reply)
      if (!request.userId) return

      const parsed = shareIdParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      const deleted = await deleteShare(parsed.data.id, request.userId)
      if (!deleted) {
        return reply.status(404).send(error(404, '分享不存在或无权撤销'))
      }
      return reply.send(success({ deleted: true }))
    },
  )

  // =============================================================================
  // 扩展上传端点（multipart / octet-stream）
  // =============================================================================

  // 为 application/octet-stream 注册 content-type parser（原始二进制流）
  server.addContentTypeParser(
    'application/octet-stream',
    { parseAs: 'buffer' },
    (_req, body, done) => {
      done(null, body)
    },
  )

  /**
   * multipart/form-data 文件上传。
   * 使用 @fastify/multipart 解析，单文件限制 100MB（见 server.ts 注册配置）。
   * @form field "file" — 文件二进制（必填）
   * @returns { file: { id, name, size, mimeType, path, uploadedBy } }
   */
  server.post(
    '/files/upload/form',
    {
      schema: buildSchema({
        summary: 'Multipart 表单上传文件',
        description: '通过 multipart/form-data 上传文件(单文件限制 100MB)',
        tags: ['File'],
      }),
    },
    async (request, reply) => {
      await requireAuth(request, reply)
      if (!request.userId) return

      if (!request.isMultipart()) {
        return reply.status(400).send(error(400, '请求必须是 multipart/form-data'))
      }

      const data = await request.file()
      if (!data) {
        return reply.status(400).send(error(400, '未找到上传文件'))
      }

      const buffer = await data.toBuffer()
      if (buffer.length === 0) {
        return reply.status(400).send(error(400, '文件内容为空'))
      }

      const filename = data.filename || `upload-${Date.now()}`
      const mimeType = data.mimetype || 'application/octet-stream'

      try {
        if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true })
        const fileId = randomUUID()
        const filePath = join(UPLOAD_DIR, fileId)
        writeFileSync(filePath, buffer)

        return reply.status(201).send(
          success({
            file: {
              id: fileId,
              name: filename,
              size: buffer.length,
              mimeType,
              path: filePath,
              uploadedBy: request.userId,
            },
          }),
        )
      } catch (e) {
        request.log.error({ err: e }, '文件保存失败')
        return reply.status(500).send(error(500, '文件保存失败'))
      }
    },
  )

  /**
   * application/octet-stream 原始流上传。
   * @header x-filename — 可选，指定保存文件名
   * @returns { file: { id, name, size, mimeType, path, uploadedBy } }
   */
  server.post(
    '/files/upload/octet',
    {
      schema: buildSchema({
        summary: '原始流上传文件',
        description: '通过 application/octet-stream 上传原始二进制流(支持 x-filename 头)',
        tags: ['File'],
      }),
    },
    async (request, reply) => {
      await requireAuth(request, reply)
      if (!request.userId) return

      const buffer = request.body as Buffer | undefined
      if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
        return reply.status(400).send(error(400, '文件内容为空'))
      }

      const rawFilename = request.headers['x-filename']
      const filename =
        (Array.isArray(rawFilename) ? rawFilename[0] : rawFilename) ?? `upload-${Date.now()}`

      try {
        if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true })
        const fileId = randomUUID()
        const filePath = join(UPLOAD_DIR, fileId)
        writeFileSync(filePath, buffer)

        return reply.status(201).send(
          success({
            file: {
              id: fileId,
              name: filename,
              size: buffer.length,
              mimeType: 'application/octet-stream',
              path: filePath,
              uploadedBy: request.userId,
            },
          }),
        )
      } catch (e) {
        request.log.error({ err: e }, '文件保存失败')
        return reply.status(500).send(error(500, '文件保存失败'))
      }
    },
  )
}
