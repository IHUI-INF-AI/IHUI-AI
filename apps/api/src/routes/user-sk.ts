/**
 * 用户 SK 密钥管理 API 路由
 *
 * D 盘源: coze_zhs_py/api/user_sk.py
 * 路径前缀: /ihui-ai-api/user-sk
 * G 盘 schema: developerApiKeys (packages/database/src/schema/developer-api-keys.ts)
 *   注: D 盘表 user_sk_info 与 G 盘 developerApiKeys 字段不完全对应,
 *       这里将 D 盘 key 字段映射到 developerApiKeys.secret
 *       (D 盘 key 是 G 盘 secret 语义,公开标识通过 key 字段返回)
 *
 * 端点 (1:1 迁移 D 盘):
 *  POST   /ihui-ai-api/user-sk/create         创建用户 SK 密钥
 *  DELETE /ihui-ai-api/user-sk/delete/:sk_id  删除用户 SK 密钥
 *  GET    /ihui-ai-api/user-sk/list           分页查询 SK 密钥列表
 *  PUT    /ihui-ai-api/user-sk/update/:sk_id  更新 SK 密钥
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import { eq, and, desc, sql } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import { developerApiKeys } from '@ihui/database'
import { success, error } from '../utils/response.js'
import { authenticate } from '../plugins/auth.js'

const PREFIX = '/ihui-ai-api/user-sk'

// ==================== Helpers ====================

/** 生成形如 sk-<urlsafe(32)> 的 SK 密钥,与 D 盘一致 */
function generateSkKey(): string {
  return `sk-${randomBytes(32).toString('base64url')}`
}

function toIsoOrNull(v: Date | string | null | undefined): string | null {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

// ==================== Zod schemas ====================

const createSchema = z.object({
  user_uuid: z.string().min(1, 'user_uuid 必填'),
  type: z.number().int().min(0).max(2),
  max: z.number().int().min(0).optional(),
  out_time: z.string().datetime().optional(),
})

const updateSchema = z.object({
  status: z.number().int().min(0).max(3).optional(),
  max: z.number().int().min(0).optional(),
  out_time: z.string().datetime().optional(),
})

const listSchema = z.object({
  user_uuid: z.string().optional(),
  status: z.coerce.number().int().min(0).max(3).optional(),
  type: z.coerce.number().int().min(0).max(2).optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(10),
})

// ==================== Routes ====================

export const userSkRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const sc = (e as Error & { statusCode?: number }).statusCode ?? 401
      return reply.status(sc).send(error(sc, (e as Error).message || 'Authentication required'))
    }
  })

  // 1. POST /ihui-ai-api/user-sk/create
  server.post(`${PREFIX}/create`, async (request, reply) => {
    try {
      const parsed = createSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { user_uuid, type, max, out_time } = parsed.data
      if (max !== undefined && max < 0) {
        return reply.status(400).send(error(400, '最大使用额度不能小于 0'))
      }
      const skKey = generateSkKey()
      // name 编码 type (D 盘 0=系统密钥 1=普通密钥 2=子级密钥)
      const name = `type-${type}`

      const [created] = await db
        .insert(developerApiKeys)
        .values({
          userId: user_uuid,
          name,
          key: skKey.slice(0, 24),
          secret: skKey,
          permissions: [],
          status: 'active',
          rateLimit: max ?? 60,
        })
        .returning()

      if (!created) {
        return reply.status(500).send(error(500, '创建 SK 失败'))
      }

      return reply.send(
        success({
          id: created.id,
          user_uuid: created.userId,
          key: created.secret,
          status: 0,
          type,
          max: created.rateLimit,
          out_time: out_time ?? null,
          created_time: toIsoOrNull(created.createdAt),
          updated_time: toIsoOrNull(created.updatedAt),
        }),
      )
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // 2. DELETE /ihui-ai-api/user-sk/delete/:sk_id
  server.delete(`${PREFIX}/delete/:sk_id`, async (request, reply) => {
    try {
      const { sk_id } = request.params as { sk_id: string }
      const [deleted] = await db
        .delete(developerApiKeys)
        .where(eq(developerApiKeys.id, sk_id))
        .returning()
      if (!deleted) return reply.status(404).send(error(404, 'SK 密钥不存在'))
      return reply.send(success({ success: true, message: '删除成功', id: sk_id }))
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // 3. GET /ihui-ai-api/user-sk/list
  server.get(`${PREFIX}/list`, async (request, reply) => {
    try {
      const parsed = listSchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const q = parsed.data
      const conds: ReturnType<typeof eq>[] = []
      if (q.user_uuid) conds.push(eq(developerApiKeys.userId, q.user_uuid))
      // D 盘 status: 0=可用 1=过期 2=用户暂停 3=失效
      // G 盘 status: 'active' | 'revoked'
      if (q.status !== undefined) {
        conds.push(eq(developerApiKeys.status, q.status === 0 ? 'active' : 'revoked'))
      }
      const where = conds.length > 0 ? and(...conds) : undefined

      const countRows = (await dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(developerApiKeys)
        .where(where)) as Array<{ count: number }>
      const count = countRows[0]?.count ?? 0

      const rows = await dbRead
        .select({
          id: developerApiKeys.id,
          userId: developerApiKeys.userId,
          name: developerApiKeys.name,
          key: developerApiKeys.key,
          secret: developerApiKeys.secret,
          status: developerApiKeys.status,
          rateLimit: developerApiKeys.rateLimit,
          createdAt: developerApiKeys.createdAt,
          updatedAt: developerApiKeys.updatedAt,
        })
        .from(developerApiKeys)
        .where(where)
        .orderBy(desc(developerApiKeys.createdAt))
        .limit(q.page_size)
        .offset((q.page - 1) * q.page_size)

      return reply.send(
        success({
          list: rows.map((r) => {
            // 解析 name 还原 type (D 盘 0/1/2)
            const typeMatch = /^type-(\d+)$/.exec(r.name)
            const type = typeMatch ? Number(typeMatch[1]) : 1
            return {
              id: r.id,
              user_uuid: r.userId,
              key: r.secret,
              status: r.status === 'active' ? 0 : 3,
              type,
              max: r.rateLimit,
              out_time: null as string | null,
              created_time: toIsoOrNull(r.createdAt),
              updated_time: toIsoOrNull(r.updatedAt),
            }
          }),
          total: Number(count),
          page: q.page,
          page_size: q.page_size,
        }),
      )
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // 4. PUT /ihui-ai-api/user-sk/update/:sk_id
  server.put(`${PREFIX}/update/:sk_id`, async (request, reply) => {
    try {
      const { sk_id } = request.params as { sk_id: string }
      const parsed = updateSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const [existing] = await dbRead
        .select()
        .from(developerApiKeys)
        .where(eq(developerApiKeys.id, sk_id))
        .limit(1)
      if (!existing) return reply.status(404).send(error(404, 'SK 密钥不存在'))

      const setData: Record<string, unknown> = { updatedAt: new Date() }
      if (parsed.data.status !== undefined) {
        setData.status = parsed.data.status === 0 ? 'active' : 'revoked'
      }
      if (parsed.data.max !== undefined) {
        setData.rateLimit = parsed.data.max
      }
      // out_time 在 G 盘 schema 中无对应字段,忽略;实际项目可考虑扩展 schema

      const [updated] = await db
        .update(developerApiKeys)
        .set(setData)
        .where(eq(developerApiKeys.id, sk_id))
        .returning()

      if (!updated) {
        return reply.status(500).send(error(500, '更新 SK 失败'))
      }

      const typeMatch = /^type-(\d+)$/.exec(updated.name)
      const type = typeMatch ? Number(typeMatch[1]) : 1
      return reply.send(
        success({
          id: updated.id,
          user_uuid: updated.userId,
          key: updated.secret,
          status: updated.status === 'active' ? 0 : 3,
          type,
          max: updated.rateLimit,
          out_time: null,
          created_time: toIsoOrNull(updated.createdAt),
          updated_time: toIsoOrNull(updated.updatedAt),
        }),
      )
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })
}

export default userSkRoutes
