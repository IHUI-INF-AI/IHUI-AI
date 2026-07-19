import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, or, desc, sql, lt } from 'drizzle-orm'
import { db } from '../db/index.js'
import { tPrivateLetter, users } from '@ihui/database'
import { authenticate } from '../plugins/auth.js'
import { success, error, emptyToUndefined } from '../utils/response.js'

// =============================================================================
// 私信(legacy /auth-api/private-letter 补开发,7 个端点)
// 数据表: t_private_letter(D 盘 legacy 补迁移,social-supplement.ts)
// =============================================================================

const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}

const createSchema = z.object({
  receiverId: z.string().min(1, '接收者不能为空'),
  content: z.string().min(1, '内容不能为空').max(5000, '内容过长'),
})

const deleteSchema = z.object({
  id: z.coerce.number().int().positive('id 必须为正整数'),
})

const getByIdQuery = z.object({
  id: z.coerce.number().int().positive('id 必须为正整数'),
})

const memberListQuery = z.object({
  ...paginationQuery,
  memberNameKeyword: z.preprocess(emptyToUndefined, z.string().min(1).max(100).optional()),
})

const memberQuery = z.object({
  memberId: z.string().min(1, 'memberId 不能为空'),
})

const letterListQuery = z.object({
  ...paginationQuery,
  senderId: z.string().min(1, 'senderId 不能为空'),
  id: z.coerce.number().int().min(0).default(0),
})

const newLetterListQuery = z.object({
  ...paginationQuery,
  senderId: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  id: z.coerce.number().int().min(0).default(0),
})

const privateLetterRoutes: FastifyPluginAsync = async (server) => {
  // 全部端点需登录(对应 Java /auth-api/* 鉴权)
  server.addHook('preHandler', async (request, reply) => {
    try {
      await authenticate(request)
    } catch {
      return reply.status(401).send(error(401, '未授权'))
    }
  })

  // POST / — 发送私信(Java: POST /auth-api/private-letter)
  server.post('/', async (request, reply) => {
    const senderId = request.userId!
    const parsed = createSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { receiverId, content } = parsed.data
    if (receiverId === senderId) {
      return reply.status(400).send(error(400, '不能给自己发私信'))
    }
    const [record] = await db
      .insert(tPrivateLetter)
      .values({
        senderId,
        receiverId,
        content,
        isRead: false,
        status: 'normal',
      })
      .returning()
    if (!record) return reply.status(500).send(error(500, '发送失败'))
    return reply.status(201).send(success(record))
  })

  // DELETE / — 删除私信(Java: DELETE /auth-api/private-letter, body: { id })
  // 仅允许发送者或接收者删除自己持有的私信
  server.delete('/', async (request, reply) => {
    const userId = request.userId!
    const parsed = deleteSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [deleted] = await db
      .delete(tPrivateLetter)
      .where(
        and(
          eq(tPrivateLetter.id, parsed.data.id),
          or(eq(tPrivateLetter.senderId, userId), eq(tPrivateLetter.receiverId, userId)),
        ),
      )
      .returning()
    if (!deleted) return reply.status(404).send(error(404, '私信不存在或无权删除'))
    return reply.send(success({ id: deleted.id, deleted: true }))
  })

  // GET / — 获取私信详情(Java: GET /auth-api/private-letter, query: ?id=)
  server.get('/', async (request, reply) => {
    const userId = request.userId!
    const parsed = getByIdQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [record] = await db
      .select()
      .from(tPrivateLetter)
      .where(
        and(
          eq(tPrivateLetter.id, parsed.data.id),
          or(eq(tPrivateLetter.senderId, userId), eq(tPrivateLetter.receiverId, userId)),
        ),
      )
      .limit(1)
    if (!record) return reply.status(404).send(error(404, '私信不存在或无权查看'))
    return reply.send(success(record))
  })

  // GET /members — 获取私信会员列表(Java: GET /auth-api/private-letter/member/list)
  // 返回与当前用户有过私信往来的会员,按最新私信时间倒序
  server.get('/members', async (request, reply) => {
    const userId = request.userId!
    const parsed = memberListQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, memberNameKeyword } = parsed.data
    const offset = (page - 1) * pageSize
    // 对方 userId: 当前用户是 sender 时取 receiverId, 否则取 senderId
    const counterpartExpr = sql`CASE 
      WHEN ${tPrivateLetter.senderId} = ${userId} THEN ${tPrivateLetter.receiverId}
      ELSE ${tPrivateLetter.senderId}
    END`
    const baseFilter = and(
      or(eq(tPrivateLetter.senderId, userId), eq(tPrivateLetter.receiverId, userId)),
      memberNameKeyword
        ? sql`${counterpartExpr} IN (SELECT id FROM users WHERE nickname ILIKE ${`%${memberNameKeyword}%`})`
        : undefined,
    )
    const list = await db
      .select({
        letter: tPrivateLetter,
        counterpartId: sql<string>`${counterpartExpr}`.as('counterpart_id'),
        counterpartName: users.nickname,
      })
      .from(tPrivateLetter)
      .leftJoin(users, eq(users.id, counterpartExpr))
      .where(baseFilter)
      .orderBy(desc(tPrivateLetter.createTime))
      .limit(pageSize)
      .offset(offset)

    const countResult = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${counterpartExpr})::int` })
      .from(tPrivateLetter)
      .where(baseFilter)
    const total = countResult[0]?.count ?? 0

    return reply.send(success({ list, total, page, pageSize }))
  })

  // GET /member — 获取与某会员的最新一条私信(Java: GET /auth-api/private-letter/member, query: ?memberId=)
  server.get('/member', async (request, reply) => {
    const userId = request.userId!
    const parsed = memberQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { memberId } = parsed.data
    const [record] = await db
      .select()
      .from(tPrivateLetter)
      .where(
        or(
          and(eq(tPrivateLetter.senderId, userId), eq(tPrivateLetter.receiverId, memberId)),
          and(eq(tPrivateLetter.senderId, memberId), eq(tPrivateLetter.receiverId, userId)),
        ),
      )
      .orderBy(desc(tPrivateLetter.createTime))
      .limit(1)
    return reply.send(success(record))
  })

  // GET /list — 获取与某会员的私信内容列表(Java: GET /auth-api/private-letter/list)
  // query: ?senderId=&id=cursor(最小聊天 id,用于分页游标)
  server.get('/list', async (request, reply) => {
    const userId = request.userId!
    const parsed = letterListQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, senderId, id } = parsed.data
    const offset = (page - 1) * pageSize
    const conds = [
      or(
        and(eq(tPrivateLetter.senderId, userId), eq(tPrivateLetter.receiverId, senderId)),
        and(eq(tPrivateLetter.senderId, senderId), eq(tPrivateLetter.receiverId, userId)),
      ),
    ]
    if (id > 0) conds.push(lt(tPrivateLetter.id, id))
    const list = await db
      .select()
      .from(tPrivateLetter)
      .where(and(...conds))
      .orderBy(desc(tPrivateLetter.id))
      .limit(pageSize)
      .offset(offset)
    return reply.send(success({ list, currentUserId: userId, page, pageSize }))
  })

  // GET /new — 获取最新私信列表(Java: GET /auth-api/private-letter/new/list)
  // 每个 senderId 一条最新消息,支持 senderId 过滤与 id 游标
  server.get('/new', async (request, reply) => {
    const userId = request.userId!
    const parsed = newLetterListQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, senderId, id } = parsed.data
    const offset = (page - 1) * pageSize
    const conds = [or(eq(tPrivateLetter.senderId, userId), eq(tPrivateLetter.receiverId, userId))]
    if (senderId) {
      conds.push(
        or(
          and(eq(tPrivateLetter.senderId, userId), eq(tPrivateLetter.receiverId, senderId)),
          and(eq(tPrivateLetter.senderId, senderId), eq(tPrivateLetter.receiverId, userId)),
        ),
      )
    }
    if (id > 0) conds.push(lt(tPrivateLetter.id, id))
    const list = await db
      .select()
      .from(tPrivateLetter)
      .where(and(...conds))
      .orderBy(desc(tPrivateLetter.id))
      .limit(pageSize)
      .offset(offset)
    return reply.send(success({ list, currentUserId: userId, page, pageSize }))
  })
}

export default privateLetterRoutes
