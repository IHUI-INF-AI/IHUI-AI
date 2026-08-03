/**
 * /api/admin/user-billing-groups 用户计费分组管理(P0 中转站造血能力批次,2026-08-01 立)。
 *
 * 端点清单:
 * 1. GET    /admin/user-billing-groups              — 分组列表
 * 2. POST   /admin/user-billing-groups              — 建组
 * 3. PATCH  /admin/user-billing-groups/:id          — 改组
 * 4. DELETE /admin/user-billing-groups/:id          — 删组(禁止删除默认组)
 * 5. GET    /admin/user-billing-groups/:id/members  — 组成员列表
 * 6. POST   /admin/user-billing-groups/:id/members  — 加用户到组
 * 7. DELETE /admin/user-billing-groups/:id/members/:userId — 移除用户
 * 8. GET    /admin/user-billing-groups/:id/multipliers — 组模型倍率列表
 * 9. POST   /admin/user-billing-groups/:id/multipliers — 设模型倍率(upsert)
 * 10. DELETE /admin/user-billing-groups/:id/multipliers/:modelId — 删模型倍率
 *
 * 全部 requireAdmin。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import {
  userBillingGroups,
  userBillingGroupMembers,
  userBillingGroupModelMultipliers,
} from '@ihui/database'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success, error } from '../../utils/response.js'
import { idParamSchema } from './_shared.js'

// =============================================================================
// Zod 校验 schema
// =============================================================================

const createGroupSchema = z.object({
  name: z.string().min(1, 'name 不能为空').max(64),
  description: z.string().optional(),
  defaultMultiplier: z.number().min(0).max(9.99).optional(),
  rateLimitQpm: z.number().int().min(0).optional(),
  isDefault: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  enabled: z.boolean().optional(),
})

const updateGroupSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  description: z.string().nullable().optional(),
  defaultMultiplier: z.number().min(0).max(9.99).optional(),
  rateLimitQpm: z.number().int().min(0).optional(),
  isDefault: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  enabled: z.boolean().optional(),
})

const addMemberSchema = z.object({
  userId: z.uuid(),
  assignedReason: z.string().max(128).optional(),
  expiresAt: z.string().optional(),
})

const setMultiplierSchema = z.object({
  modelId: z.string().min(1, 'modelId 不能为空').max(128),
  multiplier: z.number().min(0).max(9.99),
})

/** :id + :userId 复合路径参数 */
const groupIdUserIdParamSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
})

/** :id + :modelId 复合路径参数 */
const groupIdModelIdParamSchema = z.object({
  id: z.uuid(),
  modelId: z.string().min(1).max(128),
})

// =============================================================================
// 路由
// =============================================================================

const userBillingGroupsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // ===== 1. GET /admin/user-billing-groups — 分组列表 =====
  server.get('/admin/user-billing-groups', async (_request, reply) => {
    const list = await db.select().from(userBillingGroups).orderBy(userBillingGroups.sortOrder)
    return reply.send(success({ list, total: list.length }))
  })

  // ===== 2. POST /admin/user-billing-groups — 建组 =====
  server.post('/admin/user-billing-groups', async (request, reply) => {
    const parsed = createGroupSchema.safeParse(request.body ?? {})
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    const { isDefault, ...rest } = parsed.data
    try {
      // 若新建为默认组,先清除其他组的默认标记(保证全表仅 1 个默认组)
      if (isDefault) {
        await db
          .update(userBillingGroups)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(eq(userBillingGroups.isDefault, true))
      }
      const [row] = await db
        .insert(userBillingGroups)
        .values({
          name: rest.name,
          description: rest.description,
          defaultMultiplier: rest.defaultMultiplier?.toFixed(2) ?? '1.00',
          rateLimitQpm: rest.rateLimitQpm ?? 10,
          isDefault: isDefault ?? false,
          sortOrder: rest.sortOrder ?? 0,
          enabled: rest.enabled ?? true,
        })
        .returning()
      return reply.send(success(row))
    } catch (e) {
      request.log.error(e)
      const msg = e instanceof Error ? e.message : '创建失败'
      if (msg.includes('unique') || msg.includes('duplicate')) {
        return reply.status(409).send(error(409, '分组名称已存在'))
      }
      return reply.status(500).send(error(500, msg))
    }
  })

  // ===== 3. PATCH /admin/user-billing-groups/:id — 改组 =====
  server.patch('/admin/user-billing-groups/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))
    const parsed = updateGroupSchema.safeParse(request.body ?? {})
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    if (Object.keys(parsed.data).length === 0)
      return reply.status(400).send(error(400, '至少更新一个字段'))

    const setClause: Record<string, unknown> = { updatedAt: new Date() }
    if (parsed.data.name !== undefined) setClause.name = parsed.data.name
    if (parsed.data.description !== undefined) setClause.description = parsed.data.description
    if (parsed.data.defaultMultiplier !== undefined)
      setClause.defaultMultiplier = parsed.data.defaultMultiplier.toFixed(2)
    if (parsed.data.rateLimitQpm !== undefined) setClause.rateLimitQpm = parsed.data.rateLimitQpm
    if (parsed.data.isDefault !== undefined) setClause.isDefault = parsed.data.isDefault
    if (parsed.data.sortOrder !== undefined) setClause.sortOrder = parsed.data.sortOrder
    if (parsed.data.enabled !== undefined) setClause.enabled = parsed.data.enabled

    // 若设为默认组,先清除其他组的默认标记
    if (parsed.data.isDefault === true) {
      await db
        .update(userBillingGroups)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(
          sql`${userBillingGroups.id} != ${p.data.id} AND ${userBillingGroups.isDefault} = true`,
        )
    }

    const [row] = await db
      .update(userBillingGroups)
      .set(setClause)
      .where(eq(userBillingGroups.id, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '分组不存在'))
    return reply.send(success(row))
  })

  // ===== 4. DELETE /admin/user-billing-groups/:id — 删组(禁止删除默认组) =====
  server.delete('/admin/user-billing-groups/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))

    // 禁止删除系统默认组
    const [existing] = await db
      .select({ isDefault: userBillingGroups.isDefault })
      .from(userBillingGroups)
      .where(eq(userBillingGroups.id, p.data.id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '分组不存在'))
    if (existing.isDefault) return reply.status(400).send(error(400, '禁止删除系统默认组'))

    const [row] = await db
      .delete(userBillingGroups)
      .where(eq(userBillingGroups.id, p.data.id))
      .returning({ id: userBillingGroups.id })
    if (!row) return reply.status(404).send(error(404, '分组不存在'))
    return reply.send(success({ id: row.id }))
  })

  // ===== 5. GET /admin/user-billing-groups/:id/members — 组成员列表 =====
  server.get('/admin/user-billing-groups/:id/members', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))
    const list = await db
      .select()
      .from(userBillingGroupMembers)
      .where(eq(userBillingGroupMembers.groupId, p.data.id))
    return reply.send(success({ list, total: list.length }))
  })

  // ===== 6. POST /admin/user-billing-groups/:id/members — 加用户到组 =====
  server.post('/admin/user-billing-groups/:id/members', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))
    const parsed = addMemberSchema.safeParse(request.body ?? {})
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null
    const [row] = await db
      .insert(userBillingGroupMembers)
      .values({
        userId: parsed.data.userId,
        groupId: p.data.id,
        assignedReason: parsed.data.assignedReason ?? 'manual',
        expiresAt: expiresAt,
      })
      .onConflictDoUpdate({
        target: userBillingGroupMembers.userId,
        set: {
          groupId: p.data.id,
          assignedReason: parsed.data.assignedReason ?? 'manual',
          expiresAt: expiresAt,
          assignedAt: new Date(),
        },
      })
      .returning()
    return reply.send(success(row))
  })

  // ===== 7. DELETE /admin/user-billing-groups/:id/members/:userId — 移除用户 =====
  server.delete('/admin/user-billing-groups/:id/members/:userId', async (request, reply) => {
    const p = groupIdUserIdParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的参数'))
    const [row] = await db
      .delete(userBillingGroupMembers)
      .where(
        and(
          eq(userBillingGroupMembers.groupId, p.data.id),
          eq(userBillingGroupMembers.userId, p.data.userId),
        ),
      )
      .returning({ id: userBillingGroupMembers.id })
    if (!row) return reply.status(404).send(error(404, '成员不存在'))
    return reply.send(success({ id: row.id }))
  })

  // ===== 8. GET /admin/user-billing-groups/:id/multipliers — 组模型倍率列表 =====
  server.get('/admin/user-billing-groups/:id/multipliers', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))
    const list = await db
      .select()
      .from(userBillingGroupModelMultipliers)
      .where(eq(userBillingGroupModelMultipliers.groupId, p.data.id))
    return reply.send(success({ list, total: list.length }))
  })

  // ===== 9. POST /admin/user-billing-groups/:id/multipliers — 设模型倍率(upsert) =====
  server.post('/admin/user-billing-groups/:id/multipliers', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))
    const parsed = setMultiplierSchema.safeParse(request.body ?? {})
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    const [row] = await db
      .insert(userBillingGroupModelMultipliers)
      .values({
        groupId: p.data.id,
        modelId: parsed.data.modelId,
        multiplier: parsed.data.multiplier.toFixed(2),
      })
      .onConflictDoUpdate({
        target: [
          userBillingGroupModelMultipliers.groupId,
          userBillingGroupModelMultipliers.modelId,
        ],
        set: {
          multiplier: parsed.data.multiplier.toFixed(2),
        },
      })
      .returning()
    return reply.send(success(row))
  })

  // ===== 10. DELETE /admin/user-billing-groups/:id/multipliers/:modelId — 删模型倍率 =====
  server.delete('/admin/user-billing-groups/:id/multipliers/:modelId', async (request, reply) => {
    const p = groupIdModelIdParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的参数'))
    const [row] = await db
      .delete(userBillingGroupModelMultipliers)
      .where(
        and(
          eq(userBillingGroupModelMultipliers.groupId, p.data.id),
          eq(userBillingGroupModelMultipliers.modelId, p.data.modelId),
        ),
      )
      .returning({ id: userBillingGroupModelMultipliers.id })
    if (!row) return reply.status(404).send(error(404, '模型倍率不存在'))
    return reply.send(success({ id: row.id }))
  })
}

export default userBillingGroupsRoutes
