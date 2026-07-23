/**
 * 开发者平台(从 frontend-stub-other-routes.ts 拆分)。
 * /developer/keys, /developer/subscription, /developer/team(9 个)
 * /subscriptions/cancel, /subscriptions/renew(2 个)
 * /teams/:id/invitations/:id 删除(1 个)
 * 注:真实 /developer/api-keys 已在 developer.ts 实现,此处兼容路径接入同一张表
 */
import type { FastifyPluginAsync } from 'fastify'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { eq, and, desc } from 'drizzle-orm'
import { success, error } from '../../utils/response.js'
import { db, dbRead } from '../../db/index.js'
import {
  developerSubscriptions,
  developerPricing,
  teamMembers,
  teamInvitations,
} from '@ihui/database'
import { isValidApiKeyPermission } from '@ihui/types'
import * as apiKeysService from '../../services/developer-api-keys-service.js'
import { parseIdParam } from './_shared.js'

export const developerRoutes: FastifyPluginAsync = async (server) => {
  // POST /developer/keys — 创建 API 密钥(兼容路径)
  server.post('/developer/keys', async (request, reply) => {
    const body = z
      .object({
        name: z.string().min(1).max(100),
        permissions: z
          .array(z.string())
          .refine((arr) => arr.every(isValidApiKeyPermission), '包含非法权限点')
          .default([]),
        rateLimit: z.number().int().min(1).max(10000).optional(),
      })
      .safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const { apiKey, secret } = await apiKeysService.createKey(request.userId!, {
      name: body.data.name,
      permissions: body.data.permissions,
      rateLimit: body.data.rateLimit,
    })
    request.skipResponseSanitization = true
    return reply.status(201).send(success({ apiKey, secret }))
  })

  // DELETE /developer/keys/:id — 删除 API 密钥
  server.delete('/developer/keys/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const ok = await apiKeysService.deleteKey(id, request.userId!)
    if (!ok) return reply.status(404).send(error(404, 'API 密钥不存在或无权操作'))
    return reply.send(success({ ok: true }))
  })

  // POST /developer/keys/:id/reset — 重置密钥 secret
  server.post('/developer/keys/:id/reset', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const result = await apiKeysService.rotateSecret(id, request.userId!)
    if (!result) return reply.status(404).send(error(404, 'API 密钥不存在或无权操作'))
    request.skipResponseSanitization = true
    return reply.status(201).send(success({ apiKey: result.apiKey, secret: result.secret }))
  })

  // POST /developer/subscription — 开通开发者订阅
  server.post('/developer/subscription', async (request, reply) => {
    const body = z
      .object({
        pricingId: z.string().uuid('无效的套餐 ID'),
        period: z.enum(['monthly', 'yearly']).optional(),
      })
      .safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const [pricing] = await dbRead
      .select()
      .from(developerPricing)
      .where(and(eq(developerPricing.id, body.data.pricingId), eq(developerPricing.status, 1)))
      .limit(1)
    if (!pricing) return reply.status(404).send(error(404, '开发者套餐不存在或已下架'))
    const period = body.data.period ?? pricing.period ?? 'monthly'
    const days = period === 'yearly' ? 365 : 30
    const now = new Date()
    const [sub] = await db
      .insert(developerSubscriptions)
      .values({
        userId: request.userId!,
        pricingId: pricing.id,
        period,
        startTime: now,
        endTime: new Date(now.getTime() + days * 86400_000),
        status: 1,
      })
      .returning()
    return reply.status(201).send(success({ subscription: sub }))
  })

  // POST /developer/subscription/renew — 续费
  server.post('/developer/subscription/renew', async (request, reply) => {
    const body = z
      .object({ period: z.enum(['monthly', 'yearly']).optional() })
      .safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await dbRead
      .select()
      .from(developerSubscriptions)
      .where(
        and(
          eq(developerSubscriptions.userId, request.userId!),
          eq(developerSubscriptions.status, 1),
        ),
      )
      .orderBy(desc(developerSubscriptions.createdAt))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '无生效中的订阅'))
    const period = body.data.period ?? existing.period ?? 'monthly'
    const days = period === 'yearly' ? 365 : 30
    const baseTime = existing.endTime > new Date() ? existing.endTime : new Date()
    const [renewed] = await db
      .update(developerSubscriptions)
      .set({ endTime: new Date(baseTime.getTime() + days * 86400_000), updatedAt: new Date() })
      .where(eq(developerSubscriptions.id, existing.id))
      .returning()
    return reply.status(201).send(success({ subscription: renewed }))
  })

  // POST /developer/subscription/upgrade — 升级套餐
  server.post('/developer/subscription/upgrade', async (request, reply) => {
    const body = z.object({ pricingId: z.string().uuid('无效的套餐 ID') }).safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const [pricing] = await dbRead
      .select()
      .from(developerPricing)
      .where(and(eq(developerPricing.id, body.data.pricingId), eq(developerPricing.status, 1)))
      .limit(1)
    if (!pricing) return reply.status(404).send(error(404, '目标套餐不存在'))
    const [existing] = await dbRead
      .select()
      .from(developerSubscriptions)
      .where(
        and(
          eq(developerSubscriptions.userId, request.userId!),
          eq(developerSubscriptions.status, 1),
        ),
      )
      .orderBy(desc(developerSubscriptions.createdAt))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '无生效中的订阅'))
    const [upgraded] = await db
      .update(developerSubscriptions)
      .set({ pricingId: pricing.id, updatedAt: new Date() })
      .where(eq(developerSubscriptions.id, existing.id))
      .returning()
    return reply.status(201).send(success({ subscription: upgraded }))
  })

  // POST /developer/team/invite — 邀请成员加入团队
  server.post('/developer/team/invite', async (request, reply) => {
    const body = z
      .object({
        teamId: z.string().uuid(),
        inviteeId: z.string().uuid().optional(),
        email: z.string().email().optional(),
      })
      .safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    if (!body.data.inviteeId && !body.data.email)
      return reply.status(400).send(error(400, 'inviteeId 或 email 必填一个'))
    const [member] = await dbRead
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, body.data.teamId), eq(teamMembers.userId, request.userId!)))
      .limit(1)
    if (!member) return reply.status(403).send(error(403, '无权邀请,仅团队成员可邀请'))
    const [invitation] = await db
      .insert(teamInvitations)
      .values({
        teamId: body.data.teamId,
        inviterId: request.userId!,
        inviteeId: body.data.inviteeId ?? null,
        email: body.data.email ?? null,
        token: randomUUID().replace(/-/g, ''),
        status: 'pending',
        expiresAt: new Date(Date.now() + 7 * 86400_000),
      })
      .returning()
    return reply.status(201).send(success({ invitation }))
  })

  // PUT /developer/team/:id — 更新成员角色
  server.put('/developer/team/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const body = z
      .object({
        role: z.enum(['owner', 'admin', 'member']),
        teamId: z.string().uuid(),
      })
      .safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const [updated] = await db
      .update(teamMembers)
      .set({ role: body.data.role })
      .where(and(eq(teamMembers.id, id), eq(teamMembers.teamId, body.data.teamId)))
      .returning()
    if (!updated) return reply.status(404).send(error(404, '团队成员不存在'))
    return reply.send(success({ member: updated }))
  })

  // DELETE /developer/team/:id — 移除团队成员
  server.delete('/developer/team/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const [deleted] = await db.delete(teamMembers).where(eq(teamMembers.id, id)).returning()
    if (!deleted) return reply.status(404).send(error(404, '团队成员不存在'))
    return reply.send(success({ ok: true }))
  })

  // POST /subscriptions/cancel — 取消订阅(developerSubscriptions status=0)
  server.post('/subscriptions/cancel', async (request, reply) => {
    const [existing] = await dbRead
      .select()
      .from(developerSubscriptions)
      .where(
        and(
          eq(developerSubscriptions.userId, request.userId!),
          eq(developerSubscriptions.status, 1),
        ),
      )
      .orderBy(desc(developerSubscriptions.createdAt))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '无生效中的订阅'))
    const [cancelled] = await db
      .update(developerSubscriptions)
      .set({ status: 0, updatedAt: new Date() })
      .where(eq(developerSubscriptions.id, existing.id))
      .returning()
    return reply.status(201).send(success({ subscription: cancelled }))
  })

  // POST /subscriptions/renew — 续费订阅
  server.post('/subscriptions/renew', async (request, reply) => {
    const body = z
      .object({ period: z.enum(['monthly', 'yearly']).optional() })
      .safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await dbRead
      .select()
      .from(developerSubscriptions)
      .where(eq(developerSubscriptions.userId, request.userId!))
      .orderBy(desc(developerSubscriptions.createdAt))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '无订阅记录'))
    const period = body.data.period ?? existing.period ?? 'monthly'
    const days = period === 'yearly' ? 365 : 30
    const baseTime = existing.endTime > new Date() ? existing.endTime : new Date()
    const [renewed] = await db
      .update(developerSubscriptions)
      .set({
        endTime: new Date(baseTime.getTime() + days * 86400_000),
        status: 1,
        updatedAt: new Date(),
      })
      .where(eq(developerSubscriptions.id, existing.id))
      .returning()
    return reply.status(201).send(success({ subscription: renewed }))
  })

  // DELETE /teams/:id/invitations/:id — 删除团队邀请
  server.delete('/teams/:id/invitations/:id', async (request, reply) => {
    // 注:Fastify 路径参数同名时只取最后一个,这里用 params 解析两个 id
    const params = z.object({ id: z.string().uuid() }).parse(request.params)
    // 由于路径中两个 :id 同名,Fastify 只保留最后一个(邀请 id)
    // 这里用邀请 id 删除
    const [deleted] = await db
      .delete(teamInvitations)
      .where(eq(teamInvitations.id, params.id))
      .returning()
    if (!deleted) return reply.status(404).send(error(404, '邀请不存在'))
    return reply.send(success({ deleted: true }))
  })
}
