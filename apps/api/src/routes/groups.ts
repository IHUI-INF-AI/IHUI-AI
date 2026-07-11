import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { userGroups, userGroupMembers } from '@ihui/database'
import { requireAuth } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'

// =============================================================================
// Zod schemas
// =============================================================================

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const memberParamSchema = z.object({
  id: z.string().uuid('无效的组 ID'),
  userId: z.string().uuid('无效的用户 ID'),
})

const listQuerySchema = z.object({
  type: z.preprocess(emptyToUndefined, z.string().max(32).optional()),
})

const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.string().max(32).optional(),
  description: z.string().max(2000).optional(),
})

const updateGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.string().max(32).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['active', 'disabled']).optional(),
})

const addMemberSchema = z.object({
  userId: z.string().uuid('无效的用户 ID'),
  role: z.string().max(32).optional(),
})

// =============================================================================
// 路由
// =============================================================================

const groupsRoutes: FastifyPluginAsync = async (server) => {
  // 统一鉴权：所有用户组端点需登录
  server.addHook('preHandler', requireAuth)

  // GET / — 用户组列表（支持 type 筛选）
  server.get('/', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const conditions = [eq(userGroups.status, 'active')]
    if (parsed.data.type) conditions.push(eq(userGroups.type, parsed.data.type))
    const list = await db
      .select()
      .from(userGroups)
      .where(and(...conditions))
      .orderBy(desc(userGroups.createdAt))
    return reply.send(success({ list }))
  })

  // POST / — 创建用户组
  server.post('/', async (request, reply) => {
    const userId = request.userId!
    const parsed = createGroupSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [group] = await db
      .insert(userGroups)
      .values({
        name: parsed.data.name,
        type: parsed.data.type ?? 'custom',
        description: parsed.data.description,
        ownerId: userId,
      })
      .returning()
    if (!group) return reply.status(500).send(error(500, '创建用户组失败'))
    // 创建者自动成为 admin 成员
    await db.insert(userGroupMembers).values({
      groupId: group.id,
      userId,
      role: 'admin',
    })
    await db.update(userGroups).set({ memberCount: 1 }).where(eq(userGroups.id, group.id))
    return reply.status(201).send(success({ group }))
  })

  // PATCH /:id — 更新用户组（仅组所有者或 admin）
  server.patch('/:id', async (request, reply) => {
    const userId = request.userId!
    const roleId = request.jwtPayload?.roleId ?? 0
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateGroupSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [existing] = await db
      .select()
      .from(userGroups)
      .where(eq(userGroups.id, idParsed.data.id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '用户组不存在'))
    if (roleId < 1 && existing.ownerId !== userId) {
      return reply.status(403).send(error(403, '无权修改此用户组'))
    }
    const [updated] = await db
      .update(userGroups)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(userGroups.id, idParsed.data.id))
      .returning()
    return reply.send(success({ group: updated }))
  })

  // DELETE /:id — 删除用户组（仅组所有者或 admin）
  server.delete('/:id', async (request, reply) => {
    const userId = request.userId!
    const roleId = request.jwtPayload?.roleId ?? 0
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [existing] = await db
      .select()
      .from(userGroups)
      .where(eq(userGroups.id, parsed.data.id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '用户组不存在'))
    if (roleId < 1 && existing.ownerId !== userId) {
      return reply.status(403).send(error(403, '无权删除此用户组'))
    }
    await db.delete(userGroups).where(eq(userGroups.id, parsed.data.id))
    return reply.send(success({ ok: true }))
  })

  // POST /:id/members — 添加成员
  server.post('/:id/members', async (request, reply) => {
    const userId = request.userId!
    const roleId = request.jwtPayload?.roleId ?? 0
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = addMemberSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    // 校验组是否存在及权限
    const [group] = await db
      .select()
      .from(userGroups)
      .where(eq(userGroups.id, idParsed.data.id))
      .limit(1)
    if (!group) return reply.status(404).send(error(404, '用户组不存在'))
    if (roleId < 1 && group.ownerId !== userId) {
      return reply.status(403).send(error(403, '无权添加成员'))
    }
    // 幂等：已是成员则更新角色
    const [existingMember] = await db
      .select()
      .from(userGroupMembers)
      .where(
        and(
          eq(userGroupMembers.groupId, idParsed.data.id),
          eq(userGroupMembers.userId, parsed.data.userId),
        ),
      )
      .limit(1)
    if (existingMember) {
      const [updated] = await db
        .update(userGroupMembers)
        .set({ role: parsed.data.role ?? existingMember.role })
        .where(eq(userGroupMembers.id, existingMember.id))
        .returning()
      return reply.send(success({ member: updated }))
    }
    const [member] = await db
      .insert(userGroupMembers)
      .values({
        groupId: idParsed.data.id,
        userId: parsed.data.userId,
        role: parsed.data.role ?? 'member',
      })
      .returning()
    // 成员数 +1
    await db
      .update(userGroups)
      .set({ memberCount: sql`${userGroups.memberCount} + 1` })
      .where(eq(userGroups.id, idParsed.data.id))
    return reply.status(201).send(success({ member }))
  })

  // DELETE /:id/members/:userId — 移除成员
  server.delete('/:id/members/:userId', async (request, reply) => {
    const currentUserId = request.userId!
    const roleId = request.jwtPayload?.roleId ?? 0
    const parsed = memberParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    // 校验组是否存在及权限（管理员或组所有者或本人退出）
    const [group] = await db
      .select()
      .from(userGroups)
      .where(eq(userGroups.id, parsed.data.id))
      .limit(1)
    if (!group) return reply.status(404).send(error(404, '用户组不存在'))
    if (roleId < 1 && group.ownerId !== currentUserId && currentUserId !== parsed.data.userId) {
      return reply.status(403).send(error(403, '无权移除成员'))
    }
    const [deleted] = await db
      .delete(userGroupMembers)
      .where(
        and(
          eq(userGroupMembers.groupId, parsed.data.id),
          eq(userGroupMembers.userId, parsed.data.userId),
        ),
      )
      .returning()
    if (!deleted) return reply.status(404).send(error(404, '成员不存在'))
    // 成员数 -1（不低于 0）
    await db
      .update(userGroups)
      .set({ memberCount: sql`GREATEST(${userGroups.memberCount} - 1, 0)` })
      .where(eq(userGroups.id, parsed.data.id))
    return reply.send(success({ ok: true }))
  })
}

export default groupsRoutes
