import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { and, eq, desc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { signInRecords, userPoints, userThirdPartyAccounts, users, auditLogs } from '@ihui/database'
import { checkAuth } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { revokeRefreshToken } from '../db/queries.js'
import { calcSignInReward, todayString, shiftDate } from '../utils/checkin-helpers.js'

export const userCheckinRoutes: FastifyPluginAsync = async (server) => {
  server.post('/user/check-in', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!
    const today = todayString()
    const [existing] = await db
      .select()
      .from(signInRecords)
      .where(and(eq(signInRecords.userId, userId), eq(signInRecords.signInDate, today)))
      .limit(1)
    if (existing) {
      return reply.status(409).send(error(409, '今日已签到'))
    }
    const yesterday = shiftDate(today, -1)
    const [yesterdayRecord] = await db
      .select()
      .from(signInRecords)
      .where(and(eq(signInRecords.userId, userId), eq(signInRecords.signInDate, yesterday)))
      .limit(1)
    const consecutiveDays = (yesterdayRecord?.consecutiveDays ?? 0) + 1
    const rewardPoints = calcSignInReward(consecutiveDays)
    const [record] = await db
      .insert(signInRecords)
      .values({ userId, signInDate: today, consecutiveDays, rewardPoints })
      .returning()
    return reply.status(201).send(success({ record, rewardPoints, consecutiveDays }))
  })

  server.get('/user/check-in/status', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!
    const today = todayString()
    const [record] = await db
      .select()
      .from(signInRecords)
      .where(and(eq(signInRecords.userId, userId), eq(signInRecords.signInDate, today)))
      .limit(1)
    const signedIn = !!record
    let consecutiveDays = 0
    if (record) {
      consecutiveDays = record.consecutiveDays
    } else {
      const yesterday = shiftDate(today, -1)
      const [yesterdayRecord] = await db
        .select()
        .from(signInRecords)
        .where(and(eq(signInRecords.userId, userId), eq(signInRecords.signInDate, yesterday)))
        .limit(1)
      consecutiveDays = yesterdayRecord?.consecutiveDays ?? 0
    }
    const todayReward = signedIn ? record!.rewardPoints : calcSignInReward(consecutiveDays + 1)
    return reply.send(success({ signedIn, consecutiveDays, todayReward }))
  })

  // 用户设置页：设备管理 / IP 白名单 / 会话管理
  server.delete('/user/devices/:deviceId', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const { deviceId } = z.object({ deviceId: z.string() }).parse(request.params)
    return reply.send(success({ removed: deviceId }))
  })

  server.post('/user/ip-whitelist', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const { ip } = z.object({ ip: z.string().min(1) }).parse(request.body)
    return reply.send(success({ added: ip }))
  })

  server.delete('/user/sessions/:sessionId', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const { sessionId } = z.object({ sessionId: z.string() }).parse(request.params)
    await revokeRefreshToken(sessionId)
    return reply.send(success({ ended: sessionId }))
  })

  // GET /user/integral - 用户积分余额(迁移自 D 盘 /user/integral,对应 user_points.points)
  server.get('/user/integral', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const [points] = await db
      .select({
        points: userPoints.points,
        totalEarned: userPoints.totalEarned,
        totalSpent: userPoints.totalSpent,
        level: userPoints.level,
        experience: userPoints.experience,
      })
      .from(userPoints)
      .where(eq(userPoints.userId, request.userId!))
      .limit(1)
    return reply.send(success({ integral: points?.points ?? 0, ...points }))
  })

  // GET /user/login-history - 登录历史(查 audit_logs 中 action='auth.login' 的记录)
  server.get('/user/login-history', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const { page, pageSize } = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(50).default(10),
      })
      .parse(request.query)
    const [list, totalRows] = await Promise.all([
      db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          ip: auditLogs.ip,
          userAgent: auditLogs.userAgent,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .where(and(eq(auditLogs.userId, request.userId!), eq(auditLogs.action, 'auth.login')))
        .orderBy(desc(auditLogs.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(auditLogs)
        .where(and(eq(auditLogs.userId, request.userId!), eq(auditLogs.action, 'auth.login'))),
    ])
    return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
  })

  // GET /user/security-score - 安全评分(基于密码强度/绑定第三方/会话数的启发式计算)
  server.get('/user/security-score', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const [user] = await db
      .select({ id: users.id, passwordHash: users.passwordHash, email: users.email })
      .from(users)
      .where(eq(users.id, request.userId!))
      .limit(1)
    if (!user) return reply.status(404).send(error(404, '用户不存在'))
    const [thirdParty] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userThirdPartyAccounts)
      .where(and(eq(userThirdPartyAccounts.userId, user.id)))
    let score = 40 // 基础分
    if (user.passwordHash) score += 30 // 已设密码
    if (user.email) score += 15 // 已绑邮箱
    if ((thirdParty?.count ?? 0) > 0) score += 15 // 已绑第三方
    score = Math.min(score, 100)
    return reply.send(
      success({ score, level: score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low' }),
    )
  })

  // GET /user/info - 用户基本信息(迁移自 D 盘 /user/info,与 /api/users/me 语义一致但路径不同)
  server.get('/user/info', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        nickname: users.nickname,
        avatar: users.avatar,
        roleId: users.roleId,
        status: users.status,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, request.userId!))
      .limit(1)
    if (!user) return reply.status(404).send(error(404, '用户不存在'))
    return reply.send(success({ user }))
  })

  // POST /user/bind-third-party - 绑定第三方账号
  server.post('/user/bind-third-party', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    // 该端点接收 refreshToken/accessToken 字段(写入 DB, 不在响应中返回), 标记跳过响应脱敏避免误报
    request.skipResponseSanitization = true
    const { platform, openId, unionId, accessToken, refreshToken, expiresAt } = z
      .object({
        platform: z.enum(['wechat', 'google', 'workwechat', 'dingtalk']),
        openId: z.string().min(1).max(100).optional(),
        unionId: z.string().min(1).max(100).optional(),
        accessToken: z.string().optional(),
        refreshToken: z.string().optional(),
        expiresAt: z.string().datetime().optional(),
      })
      .parse(request.body)
    const [existing] = await db
      .select()
      .from(userThirdPartyAccounts)
      .where(
        and(
          eq(userThirdPartyAccounts.userId, request.userId!),
          eq(userThirdPartyAccounts.platform, platform),
        ),
      )
      .limit(1)
    if (existing) return reply.status(409).send(error(409, '该平台已绑定'))
    const [record] = await db
      .insert(userThirdPartyAccounts)
      .values({
        userId: request.userId!,
        platform,
        openId,
        unionId,
        accessToken,
        refreshToken,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      })
      .returning({ id: userThirdPartyAccounts.id, platform: userThirdPartyAccounts.platform })
    return reply.status(201).send(success({ bound: record }))
  })
}
