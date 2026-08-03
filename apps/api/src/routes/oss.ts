import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq, and, ilike, isNull } from 'drizzle-orm'
import { checkAuth } from '../plugins/auth.js'
import { requireAdmin } from '../plugins/require-permission.js'
import {
  findOssDrivers,
  findOssDriverById,
  findOssDriverByName,
  createOssDriver,
  updateOssDriver,
  deleteOssDriver,
  findDefaultOssDriver,
} from '../db/oss-queries.js'
import { createUploadPreHandler } from '../plugins/upload-scanner.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { db } from '../db/index.js'
import { files } from '@ihui/database'
import {
  getOssConfig,
  verifyOssCallback,
  initiateMultipartUpload,
  uploadMultipartPart,
  completeMultipartUpload,
  abortMultipartUpload,
} from '../services/storage-service.js'
import { getOssStsProvider } from '../services/oss-sts-service.js'

// =============================================================================
// Zod schemas
// =============================================================================

const ossDriverTypeSchema = z.enum(['local', 'aliyun-oss', 'tencent-cos', 'qiniu', 's3', 'minio'])

const uuidParamSchema = z.object({ id: z.uuid({ error: '无效的 ID' }) })

const listDriversQuerySchema = z.object({
  driver: z.preprocess(emptyToUndefined, ossDriverTypeSchema.optional()),
})

const createDriverBodySchema = z.object({
  name: z.string().min(1).max(128),
  driver: ossDriverTypeSchema,
  credentials: z.record(z.string(), z.unknown()).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  isEnabled: z.boolean().default(false),
  isDefault: z.boolean().default(false),
  sort: z.number().int().min(0).default(0),
  description: z.string().optional(),
})

const updateDriverBodySchema = z
  .object({
    name: z.string().min(1).max(128).optional(),
    driver: ossDriverTypeSchema.optional(),
    credentials: z.record(z.string(), z.unknown()).optional(),
    config: z.record(z.string(), z.unknown()).optional(),
    isEnabled: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    sort: z.number().int().min(0).optional(),
    description: z.string().nullable().optional(),
  })
  .refine(
    (d) =>
      d.name !== undefined ||
      d.driver !== undefined ||
      d.credentials !== undefined ||
      d.config !== undefined ||
      d.isEnabled !== undefined ||
      d.isDefault !== undefined ||
      d.sort !== undefined ||
      d.description !== undefined,
    { message: '至少需提供一个可更新字段' },
  )

// 上传代理 schema(简化:校验驱动是否存在,实际上传走 files.ts)
const uploadProxyBodySchema = z.object({
  driverId: z.uuid().optional(),
  filename: z.string().min(1),
  size: z.number().int().min(0),
})

// STS 签发 schema
const stsBodySchema = z.object({
  sessionName: z.string().max(64).optional(),
  durationSeconds: z.number().int().min(900).max(3600).optional(),
  // 文件扩展名,用于生成 objectKey(默认 'bin')
  ext: z.string().max(8).optional(),
})

// 分片上传 schema
const multipartInitBodySchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().max(128).optional(),
})

const multipartUploadQuerySchema = z.object({
  uploadId: z.string().min(1, 'uploadId 不能为空'),
  partNumber: z.coerce.number().int().min(1).max(10000),
})

const multipartCompleteBodySchema = z.object({
  uploadId: z.string().min(1, 'uploadId 不能为空'),
  parts: z
    .array(
      z.object({
        partNumber: z.number().int().min(1).max(10000),
        etag: z.string().min(1),
      }),
    )
    .min(1),
})

const multipartAbortBodySchema = z.object({
  uploadId: z.string().min(1, 'uploadId 不能为空'),
})

// =============================================================================
// 公共路由(前缀 /api,需登录):查询可用驱动 + 上传/下载代理
// =============================================================================

export const ossRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // /oss/callback 由 OSS 服务端调用,使用 RSA-SHA1 验签替代 JWT 鉴权
    if (request.url.startsWith('/oss/callback')) return
    if (!(await checkAuth(request, reply))) return
  })

  // 分片上传接收二进制 body(application/octet-stream)
  server.addContentTypeParser(
    'application/octet-stream',
    { parseAs: 'buffer' },
    (_req, body, done) => {
      done(null, body)
    },
  )

  // GET /oss/drivers - 启用中的驱动列表(不返回 credentials)
  server.get(
    '/oss/drivers',
    {
      schema: {
        summary: '可用存储驱动列表',
        tags: ['oss'],
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const list = await findOssDrivers()
      // 公共接口仅返回启用的驱动
      const enabled = list.filter((d) => d.isEnabled)
      return reply.send(success({ list: enabled }))
    },
  )

  // POST /oss/upload - 上传代理(简化:校验驱动配置后返回上传地址,实际上传走 files.ts)
  server.post(
    '/oss/upload',
    {
      preHandler: [createUploadPreHandler({ maxSize: 50 * 1024 * 1024 })],
      schema: {
        summary: '上传代理(预校验驱动)',
        tags: ['oss'],
        body: { type: 'object', additionalProperties: true },
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = uploadProxyBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { driverId, filename, size } = parsed.data
      // 选定驱动:显式传入 > 默认驱动
      const driver = driverId ? await findOssDriverById(driverId) : await findDefaultOssDriver()
      if (!driver || !driver.isEnabled) {
        return reply.status(400).send(error(400, '无可用的存储驱动'))
      }
      return reply.send(
        success({
          driverId: driver.id,
          driver: driver.driver,
          filename,
          size,
          // 实际写入由 files.ts 完成,这里仅返回驱动信息
          message: `驱动 ${driver.name} 已就绪,请通过 /files 接口完成上传`,
        }),
      )
    },
  )

  // DELETE /oss/files - 按 url 软删文件(清理孤儿文件,前端 ImageUpload onRemove 调用)
  // 接受 body { url: string },按 path 模糊匹配 files 表,软删 deleted_at + deleted_by
  // 注意:OSS 实际删除可能是异步任务(BullMQ),此处只保证 DB 软删
  server.delete(
    '/oss/files',
    {
      schema: {
        summary: '按 URL 删除文件(软删)',
        tags: ['oss'],
        body: {
          type: 'object',
          properties: {
            url: { type: 'string', description: '文件 URL 或服务端路径' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          403: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          500: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const body = z.object({ url: z.string().min(1).max(1024) }).safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
      }
      const url = body.data.url
      const userId = request.userId
      const roleId = request.jwtPayload?.roleId ?? 0
      try {
        // 按 path 精确匹配或后缀匹配(防止误删,只用 ilike 匹配结尾)
        const rows = await db
          .select({ id: files.id, uploadedBy: files.uploadedBy, path: files.path })
          .from(files)
          .where(and(ilike(files.path, `%${url}`), isNull(files.deletedAt)))
          .limit(5)
        const target = rows[0]
        if (target) {
          // 权限校验:本人或管理员
          if (target.uploadedBy !== userId && roleId < 1) {
            return reply.status(403).send(error(403, '无权删除该文件'))
          }
          await db
            .update(files)
            .set({ deletedAt: new Date(), deletedBy: userId ?? null })
            .where(eq(files.id, target.id))
          return reply.send(success({ id: target.id, deleted: true, matched: true }))
        }
        // 未匹配到 DB 记录(可能是直传 OSS 的 URL),返回成功让前端继续清理本地状态
        return reply.send(success({ deleted: false, matched: false }))
      } catch (e) {
        request.log.error(e)
        return reply.status(500).send(error(500, '文件删除失败'))
      }
    },
  )

  // GET /oss/download/:id - 下载代理(简化:返回驱动信息,实际下载由 files.ts 处理)
  server.get(
    '/oss/download/:id',
    {
      schema: {
        summary: '下载代理(返回驱动信息)',
        tags: ['oss'],
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          404: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = uuidParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const driver = await findOssDriverById(parsed.data.id)
      if (!driver) {
        return reply.status(404).send(error(404, '驱动不存在'))
      }
      return reply.send(
        success({
          driverId: driver.id,
          driver: driver.driver,
          config: driver.config,
          message: '请通过 /files 接口完成下载',
        }),
      )
    },
  )

  // ===========================================================================
  // OSS 直传能力(P2-1):STS 签发 + 直传回调验签 + 分片上传
  // 迁移自 D3 OssServiceApplication
  // ===========================================================================

  // POST /oss/sts - 签发 STS 临时凭证(客户端直传)
  server.post(
    '/oss/sts',
    {
      schema: {
        summary: '签发 STS 临时凭证(直传)',
        tags: ['oss'],
        body: { type: 'object', additionalProperties: true },
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          503: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = stsBodySchema.safeParse(request.body ?? {})
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      // aliyun provider 依赖 storage-service 的 getOssConfig;其他 provider 内部自检 env
      const provider = getOssStsProvider()
      if (provider.type === 'aliyun' && !getOssConfig()) {
        return reply
          .status(503)
          .send(
            error(
              503,
              'OSS 未配置(OSS_ACCESS_KEY_ID/OSS_ACCESS_KEY_SECRET/OSS_ROLE_ARN/OSS_BUCKET 环境变量缺失)',
            ),
          )
      }
      try {
        const userId = request.userId ?? 'anonymous'
        const sessionName = parsed.data.sessionName ?? `ihui-${userId.slice(-8)}`
        const duration = parsed.data.durationSeconds ?? 900
        const creds = await provider.assumeRole(sessionName, duration, {
          userId,
          ext: parsed.data.ext ?? 'bin',
        })
        return reply.send(success({ credentials: creds, provider: provider.type }))
      } catch (e) {
        request.log.error(e)
        return reply.status(503).send(error(503, (e as Error).message || 'STS 签发失败'))
      }
    },
  )

  // POST /oss/callback - 直传回调验签(OSS 服务端调用,无 JWT,使用 RSA-SHA1 验签)
  // 注册在子插件中以覆盖 body parser,获取原始 body 字符串用于验签
  server.register(async (sub) => {
    // OSS 回调可能以 application/x-www-form-urlencoded 或 application/json 发送
    // 验签需要原始 body 字符串,所以 parser 返回 string 而非解析后的对象
    sub.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) =>
      done(null, body),
    )
    // application/x-www-form-urlencoded 已在 server.ts:204 注册,子插件继承即可,
    // 重复注册会触发 FST_ERR_CTP_ALREADY_PRESENT 导致进程崩溃

    sub.post(
      '/oss/callback',
      {
        schema: {
          summary: '直传回调验签(OSS 调用)',
          tags: ['oss'],
          body: { type: 'string' },
          response: {
            200: {
              type: 'object',
              properties: {
                Result: { type: 'string' },
              },
            },
            401: {
              type: 'object',
              properties: { code: { type: 'number' }, message: { type: 'string' } },
            },
          },
        },
      },
      async (request, reply) => {
        const authHeader = request.headers.authorization ?? ''
        const pubKeyUrlB64 = (request.headers['x-oss-pub-key-url'] as string) ?? ''

        if (!authHeader || !pubKeyUrlB64) {
          return reply.status(401).send(error(401, '缺少验签 header'))
        }

        // request.body 为原始字符串(parser 已配置为返回 string)
        const body = (request.body as string | undefined) ?? ''
        const urlPath = request.url.split('?')[0] ?? ''
        const urlQuery = request.url.split('?')[1] ?? ''

        const verified = await verifyOssCallback({
          method: request.method,
          path: urlPath,
          query: urlQuery,
          body,
          authorization: authHeader,
          pubKeyUrlB64,
        })

        if (!verified) {
          return reply.status(401).send(error(401, '回调验签失败'))
        }

        // 验签通过,返回 Result: success(OSS 协议要求)
        return reply.send({ Result: 'success' })
      },
    )
  })

  // POST /oss/multipart/init - 分片上传初始化
  server.post(
    '/oss/multipart/init',
    {
      schema: {
        summary: '分片上传初始化',
        tags: ['oss'],
        body: { type: 'object', additionalProperties: true },
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          503: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = multipartInitBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      if (!getOssConfig()) {
        return reply.status(503).send(error(503, 'OSS 未配置'))
      }
      try {
        const userId = request.userId!
        const result = await initiateMultipartUpload(userId, parsed.data)
        return reply.send(success(result))
      } catch (e) {
        request.log.error(e)
        return reply.status(503).send(error(503, (e as Error).message || '分片上传初始化失败'))
      }
    },
  )

  // POST /oss/multipart/upload - 分片上传(二进制 body,query 传 uploadId + partNumber)
  server.post(
    '/oss/multipart/upload',
    {
      schema: {
        summary: '分片上传(二进制)',
        tags: ['oss'],
        querystring: {
          type: 'object',
          properties: {
            uploadId: { type: 'string' },
            partNumber: { type: 'number' },
          },
          required: ['uploadId', 'partNumber'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
      bodyLimit: 10 * 1024 * 1024, // 单片最大 10MB(默认 5MB + 余量)
    },
    async (request, reply) => {
      const parsed = multipartUploadQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const body = request.body as Buffer | undefined
      if (!body || body.length === 0) {
        return reply.status(400).send(error(400, '分片数据不能为空'))
      }
      try {
        const userId = request.userId!
        const result = await uploadMultipartPart(
          parsed.data.uploadId,
          parsed.data.partNumber,
          body,
          userId,
        )
        return reply.send(success(result))
      } catch (e) {
        request.log.error(e)
        return reply.status(400).send(error(400, (e as Error).message || '分片上传失败'))
      }
    },
  )

  // POST /oss/multipart/complete - 完成分片上传
  server.post(
    '/oss/multipart/complete',
    {
      schema: {
        summary: '完成分片上传',
        tags: ['oss'],
        body: { type: 'object', additionalProperties: true },
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = multipartCompleteBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      try {
        const userId = request.userId!
        const result = await completeMultipartUpload(
          parsed.data.uploadId,
          parsed.data.parts,
          userId,
        )
        return reply.send(success(result))
      } catch (e) {
        request.log.error(e)
        return reply.status(400).send(error(400, (e as Error).message || '完成分片上传失败'))
      }
    },
  )

  // POST /oss/multipart/abort - 取消分片上传
  server.post(
    '/oss/multipart/abort',
    {
      schema: {
        summary: '取消分片上传',
        tags: ['oss'],
        body: { type: 'object', additionalProperties: true },
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = multipartAbortBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      try {
        const userId = request.userId!
        await abortMultipartUpload(parsed.data.uploadId, userId)
        return reply.send(success({ aborted: true }))
      } catch (e) {
        request.log.error(e)
        return reply.status(400).send(error(400, (e as Error).message || '取消分片上传失败'))
      }
    },
  )
}

// =============================================================================
// 管理员路由(前缀 /api/admin,驱动 CRUD)
// =============================================================================

export const adminOssRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // GET /oss/drivers - 全部驱动列表(支持 driver 筛选)
  server.get(
    '/oss/drivers',
    {
      schema: {
        summary: '存储驱动列表(管理)',
        tags: ['oss'],
        querystring: {
          type: 'object',
          properties: {
            driver: {
              type: 'string',
              enum: ['local', 'aliyun-oss', 'tencent-cos', 'qiniu', 's3', 'minio'],
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = listDriversQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const list = await findOssDrivers(parsed.data.driver)
      return reply.send(success({ list }))
    },
  )

  // GET /oss/drivers/:id - 驱动详情(含 credentials)
  server.get(
    '/oss/drivers/:id',
    {
      schema: {
        summary: '驱动详情',
        tags: ['oss'],
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          404: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = uuidParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const driver = await findOssDriverById(parsed.data.id)
      if (!driver) {
        return reply.status(404).send(error(404, '驱动不存在'))
      }
      return reply.send(success({ driver }))
    },
  )

  // POST /oss/drivers - 创建驱动
  server.post(
    '/oss/drivers',
    {
      schema: {
        summary: '创建存储驱动',
        tags: ['oss'],
        body: { type: 'object', additionalProperties: true },
        response: {
          201: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          409: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = createDriverBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findOssDriverByName(parsed.data.name)
      if (existing) {
        return reply.status(409).send(error(409, '驱动 name 已存在'))
      }
      const driver = await createOssDriver({
        ...parsed.data,
        updatedBy: request.userId,
      })
      return reply.status(201).send(success({ driver }))
    },
  )

  // PATCH /oss/drivers/:id - 更新驱动
  server.patch(
    '/oss/drivers/:id',
    {
      schema: {
        summary: '更新存储驱动',
        tags: ['oss'],
        body: { type: 'object', additionalProperties: true },
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          404: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsedParams = uuidParamSchema.safeParse(request.params)
      if (!parsedParams.success) {
        return reply
          .status(400)
          .send(error(400, parsedParams.error.issues[0]?.message ?? '参数错误'))
      }
      const parsedBody = updateDriverBodySchema.safeParse(request.body)
      if (!parsedBody.success) {
        return reply.status(400).send(error(400, parsedBody.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findOssDriverById(parsedParams.data.id)
      if (!existing) {
        return reply.status(404).send(error(404, '驱动不存在'))
      }
      const driver = await updateOssDriver(parsedParams.data.id, {
        ...parsedBody.data,
        updatedBy: request.userId,
      })
      return reply.send(success({ driver }))
    },
  )

  // DELETE /oss/drivers/:id - 删除驱动
  server.delete(
    '/oss/drivers/:id',
    {
      schema: {
        summary: '删除存储驱动',
        tags: ['oss'],
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          404: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsedParams = uuidParamSchema.safeParse(request.params)
      if (!parsedParams.success) {
        return reply
          .status(400)
          .send(error(400, parsedParams.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findOssDriverById(parsedParams.data.id)
      if (!existing) {
        return reply.status(404).send(error(404, '驱动不存在'))
      }
      await deleteOssDriver(parsedParams.data.id)
      return reply.send(success({ id: parsedParams.data.id, deleted: true }))
    },
  )
}
