import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { signInRecords } from '@ihui/database'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { revokeRefreshToken } from '../db/queries.js'

function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

function shiftDate(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function calcReward(consecutiveDays: number): number {
  if (consecutiveDays >= 7) return 50
  return 10 + (consecutiveDays - 1) * 5
}

async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  try {
    await authenticate(request)
    return true
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    reply
      .status(statusCode)
      .send(error(statusCode, (e as Error).message || 'Authentication required'))
    return false
  }
}

export const userCheckinRoutes: FastifyPluginAsync = async (server) => {
  server.post('/user/check-in', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
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
    const rewardPoints = calcReward(consecutiveDays)
    const [record] = await db
      .insert(signInRecords)
      .values({ userId, signInDate: today, consecutiveDays, rewardPoints })
      .returning()
    return reply.status(201).send(success({ record, rewardPoints, consecutiveDays }))
  })

  server.get('/user/check-in/status', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
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
    const todayReward = signedIn ? record!.rewardPoints : calcReward(consecutiveDays + 1)
    return reply.send(success({ signedIn, consecutiveDays, todayReward }))
  })

  // 用户设置页：设备管理 / IP 白名单 / 会话管理
  server.delete('/user/devices/:deviceId', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const { deviceId } = z.object({ deviceId: z.string() }).parse(request.params)
    return reply.send(success({ removed: deviceId }))
  })

  server.post('/user/ip-whitelist', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const { ip } = z.object({ ip: z.string().min(1) }).parse(request.body)
    return reply.send(success({ added: ip }))
  })

  server.delete('/user/sessions/:sessionId', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const { sessionId } = z.object({ sessionId: z.string() }).parse(request.params)
    await revokeRefreshToken(sessionId)
    return reply.send(success({ ended: sessionId }))
  })
}
