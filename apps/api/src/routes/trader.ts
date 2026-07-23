import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { traders } from '@ihui/database'
import { requireAuth } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'

// =============================================================================
// Zod schemas
// =============================================================================

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const applySchema = z.object({
  commissionRate: z.number().int().min(0).max(100).optional(),
  specialties: z.array(z.string()).default([]),
  intro: z.string().max(500).optional(),
})

const updateTraderSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'banned']).optional(),
  commissionRate: z.number().int().min(0).max(100).optional(),
  specialties: z.array(z.string()).max(100).optional(),
  intro: z.string().max(500).optional(),
  performance: z.record(z.string(), z.unknown()).optional(),
})

// =============================================================================
// 路由
// =============================================================================

const traderRoutes: FastifyPluginAsync = async (server) => {
  // GET / — 交易员列表（公开，仅返回已通过审核的）
  server.get('/', async (_request, reply) => {
    const list = await db
      .select({
        id: traders.id,
        userId: traders.userId,
        commissionRate: traders.commissionRate,
        performance: traders.performance,
        specialties: traders.specialties,
        intro: traders.intro,
        createdAt: traders.createdAt,
      })
      .from(traders)
      .where(eq(traders.status, 'approved'))
      .orderBy(desc(traders.createdAt))
    return reply.send(success({ list }))
  })

  // GET /:id — 交易员详情（公开）
  server.get('/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [trader] = await db.select().from(traders).where(eq(traders.id, parsed.data.id)).limit(1)
    if (!trader) return reply.status(404).send(error(404, '交易员不存在'))
    return reply.send(success({ trader }))
  })

  // POST /apply — 申请成为交易员（需登录）
  server.post('/apply', { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.userId!
    const parsed = applySchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    // 检查是否已申请
    const [existing] = await db.select().from(traders).where(eq(traders.userId, userId)).limit(1)
    if (existing) {
      return reply.status(409).send(error(409, '您已提交过交易员申请'))
    }
    const [trader] = await db
      .insert(traders)
      .values({
        userId,
        status: 'pending',
        commissionRate: parsed.data.commissionRate ?? 0,
        specialties: parsed.data.specialties,
        intro: parsed.data.intro,
      })
      .returning()
    return reply.status(201).send(success({ trader }))
  })

  // PATCH /:id — 更新交易员信息（admin 可改状态/佣金，本人可改简介）
  server.patch('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.userId!
    const roleId = request.jwtPayload?.roleId ?? 0
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateTraderSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [existing] = await db
      .select()
      .from(traders)
      .where(eq(traders.id, idParsed.data.id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '交易员不存在'))

    // 非管理员仅能修改自己的简介/专长，不能改状态/佣金
    const isAdmin = roleId >= 1
    if (!isAdmin && existing.userId !== userId) {
      return reply.status(403).send(error(403, '无权修改此交易员信息'))
    }
    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    if (parsed.data.intro !== undefined) updateData.intro = parsed.data.intro
    if (parsed.data.specialties !== undefined) updateData.specialties = parsed.data.specialties
    if (isAdmin) {
      if (parsed.data.status !== undefined) updateData.status = parsed.data.status
      if (parsed.data.commissionRate !== undefined)
        updateData.commissionRate = parsed.data.commissionRate
      if (parsed.data.performance !== undefined) updateData.performance = parsed.data.performance
    }

    const [updated] = await db
      .update(traders)
      .set(updateData)
      .where(eq(traders.id, idParsed.data.id))
      .returning()
    return reply.send(success({ trader: updated }))
  })
}

export default traderRoutes
