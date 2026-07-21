import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql, or, ilike } from 'drizzle-orm'
import { db } from '../db/index.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { checkAuth } from '../plugins/auth.js'
import { requireAdmin } from '../plugins/require-permission.js'
import { userAuthInfo } from '@ihui/database'

// =============================================================================
// Zod schemas
// =============================================================================

const submitBodySchema = z.object({
  realName: z.string().min(1, '真实姓名不能为空').max(50),
  idCard: z.string().min(1, '身份证号不能为空').max(20),
  authSource: z.string().max(50).optional(),
})

const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}

const listQuerySchema = z.object({
  ...paginationQuery,
  status: z.preprocess(emptyToUndefined, z.string().max(32).optional()),
  keyword: z.preprocess(emptyToUndefined, z.string().max(100).optional()),
})

const userUuidParamSchema = z.object({
  userUuid: z.string().uuid('无效的用户 ID'),
})

const auditBodySchema = z.object({
  action: z.enum(['approve', 'reject']),
  rejectReason: z.string().max(255).optional(),
})

// =============================================================================
// 路由
// =============================================================================

export const authIdentityRoutes: FastifyPluginAsync = async (server) => {
  // 实名认证响应含 idCard(用户自身 + admin 列表查看),需跳过响应脱敏
  // 防止 response-sanitizer 把 idCard 字段误伤为 '***'
  server.addHook('onRequest', async (request) => {
    request.skipResponseSanitization = true
  })

  // POST /auth/realname/submit - 提交实名认证
  server.post('/auth/realname/submit', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const parsed = submitBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { realName, idCard, authSource } = parsed.data

    // 检查是否已认证（authStatus=approved 则拒绝重复提交）
    const existing = await db
      .select()
      .from(userAuthInfo)
      .where(eq(userAuthInfo.userUuid, userId))
      .limit(1)

    if (existing[0]?.authStatus === 'approved') {
      return reply.status(400).send(error(400, '已通过实名认证，无需重复提交'))
    }

    // upsert userAuthInfo 记录: realName, idCard, authStatus=pending, authSource
    try {
      await db
        .insert(userAuthInfo)
        .values({
          userUuid: userId,
          realName,
          idCard,
          authStatus: 'pending',
          authSource,
        })
        .onConflictDoUpdate({
          target: userAuthInfo.userUuid,
          set: {
            realName,
            idCard,
            authStatus: 'pending',
            authSource,
            rejectReason: null,
            updatedAt: new Date(),
          },
        })
    } catch (e) {
      request.log.error({ err: e }, '提交实名认证失败')
      return reply.status(500).send(error(500, '提交实名认证失败'))
    }

    return reply.status(201).send(
      success({
        userUuid: userId,
        realName,
        idCard,
        authStatus: 'pending',
        authSource,
      }),
    )
  })

  // GET /auth/realname/my - 查询我的认证状态
  server.get('/auth/realname/my', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const rows = await db
      .select()
      .from(userAuthInfo)
      .where(eq(userAuthInfo.userUuid, userId))
      .limit(1)

    const info = rows[0]
    if (!info) {
      // 无记录时返回未认证默认状态
      return reply.send(
        success({
          userUuid: userId,
          authStatus: 'unverified',
          realName: null,
          idCard: null,
          authSource: null,
          authAt: null,
          rejectReason: null,
        }),
      )
    }

    return reply.send(success(info))
  })

  // GET /auth/realname/list - 管理员列表（分页）
  server.get('/auth/realname/list', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return

    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, status, keyword } = parsed.data

    const conds = []
    if (status) conds.push(eq(userAuthInfo.authStatus, status))
    if (keyword) {
      conds.push(
        or(
          ilike(userAuthInfo.realName, `%${keyword}%`),
          ilike(userAuthInfo.idCard, `%${keyword}%`),
        ),
      )
    }

    const list = await db
      .select()
      .from(userAuthInfo)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(userAuthInfo.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)

    const countRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userAuthInfo)
      .where(conds.length ? and(...conds) : undefined)
    const total = countRows[0]?.count ?? 0

    return reply.send(success({ list, total, page, pageSize }))
  })

  // PUT /auth/realname/:userUuid/audit - 管理员审核
  server.put('/auth/realname/:userUuid/audit', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return

    const paramParsed = userUuidParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, paramParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { userUuid } = paramParsed.data

    const bodyParsed = auditBodySchema.safeParse(request.body)
    if (!bodyParsed.success) {
      return reply.status(400).send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { action, rejectReason } = bodyParsed.data

    // 查询待审核记录
    const rows = await db
      .select()
      .from(userAuthInfo)
      .where(eq(userAuthInfo.userUuid, userUuid))
      .limit(1)

    const info = rows[0]
    if (!info) {
      return reply.status(404).send(error(404, '用户认证记录不存在'))
    }
    if (info.authStatus !== 'pending') {
      return reply.status(400).send(error(400, `当前认证状态为 ${info.authStatus}，不允许审核`))
    }

    if (action === 'approve') {
      await db
        .update(userAuthInfo)
        .set({
          authStatus: 'approved',
          authAt: new Date(),
          rejectReason: null,
          updatedAt: new Date(),
        })
        .where(eq(userAuthInfo.userUuid, userUuid))
    } else {
      await db
        .update(userAuthInfo)
        .set({
          authStatus: 'rejected',
          rejectReason: rejectReason ?? null,
          updatedAt: new Date(),
        })
        .where(eq(userAuthInfo.userUuid, userUuid))
    }

    return reply.send(
      success({
        userUuid,
        action,
        authStatus: action === 'approve' ? 'approved' : 'rejected',
      }),
    )
  })
}
