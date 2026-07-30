/**
 * /api/developer/api-key-groups API Key 分组路由(2026-08-01 立,P0 中转站造血能力批次)。
 *
 * 端点清单:
 * 1. GET    /api-key-groups           — 列我的组(owner 或 member 任一 Key)
 * 2. POST   /api-key-groups           — 建组(ownerId = 当前用户,自动入 owner member)
 * 3. GET    /api-key-groups/:id       — 组详情(组成员可查)
 * 4. PATCH  /api-key-groups/:id       — 改组(仅 owner/admin)
 * 5. DELETE /api-key-groups/:id       — 删组(仅 owner,cascade 删 members + invites)
 * 6. GET    /api-key-groups/:id/members — 组成员用量排行(最近 30d)
 * 7. POST   /api-key-groups/:id/invite — 生成邀请码(8 位大写字母数字,24h 有效)
 * 8. POST   /api-key-groups/:id/recharge — 充值组池(token + cost)
 * 9. POST   /api-key-groups/join      — 凭邀请码加入组
 *
 * 鉴权:所有端点 requireAuth(需登录),操作类端点按角色校验(owner/admin/member)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, desc, inArray } from 'drizzle-orm'
import { db, dbRead } from '../../db/index.js'
import { apiKeyGroups, developerApiKeys } from '@ihui/database'
import { success, error, emptyToUndefined } from '../../utils/response.js'
import { requireAuth } from '../../plugins/require-permission.js'
import {
  createGroup,
  addMember,
  getGroupById,
  getGroupMembers,
  getMemberRole,
  getUserGroupIds,
  getUserApiKeyInGroup,
  createInvite,
  acceptInvite,
  rechargeGroupBalance,
} from '../../services/api-key-group-service.js'

// =============================================================================
// Zod schema
// =============================================================================

const idParamSchema = z.object({ id: z.string().uuid() })

const createGroupBodySchema = z.object({
  name: z.string().min(1, '名称不能为空').max(64),
  description: z.preprocess(emptyToUndefined, z.string().max(500).optional()),
  /** 共享 token 余额(-1 = 无限,默认 0) */
  sharedTokenBalance: z.number().int().default(0),
  /** 共享成本余额(分,-1 = 无限,默认 0) */
  sharedCostBalanceCents: z.number().int().default(0),
  rateLimitQpm: z.number().int().min(1).max(10000).optional(),
  allowedModels: z.array(z.string()).nullable().optional(),
  allowedIps: z.array(z.string()).nullable().optional(),
  /** 建组时作为 owner 加入组的 API Key id(可选,未传则用用户最新 active Key) */
  apiKeyId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
})

const updateGroupBodySchema = z.object({
  name: z.string().min(1).max(64).optional(),
  description: z.preprocess(emptyToUndefined, z.string().max(500).nullable().optional()),
  sharedTokenBalance: z.number().int().optional(),
  sharedCostBalanceCents: z.number().int().optional(),
  rateLimitQpm: z.number().int().min(1).max(10000).optional(),
  allowedModels: z.array(z.string()).nullable().optional(),
  allowedIps: z.array(z.string()).nullable().optional(),
  enabled: z.boolean().optional(),
})

const rechargeBodySchema = z
  .object({
    tokenAmount: z.number().int().optional(),
    costCents: z.number().int().optional(),
  })
  .refine(
    (d) => (d.tokenAmount !== undefined && d.tokenAmount !== 0) || (d.costCents !== undefined && d.costCents !== 0),
    { message: 'tokenAmount 或 costCents 至少填一个且非 0' },
  )

const joinBodySchema = z.object({
  inviteCode: z.string().min(1, '邀请码不能为空').max(16),
  /** 要加入组的 API Key id(必须属于当前用户) */
  apiKeyId: z.string().uuid('API Key id 格式错误'),
})

// =============================================================================
// 路由
// =============================================================================

const developerApiKeyGroupsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAuth)

  // ===== 1. GET /api-key-groups — 列我的组(owner 或 member 任一 Key) =====
  server.get('/api-key-groups', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))
    try {
      const groupIds = await getUserGroupIds(userId)
      if (groupIds.length === 0) return reply.send(success({ list: [] }))

      const myGroups = await dbRead
        .select()
        .from(apiKeyGroups)
        .where(inArray(apiKeyGroups.id, groupIds))
        .orderBy(desc(apiKeyGroups.createdAt))
      return reply.send(success({ list: myGroups }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询分组列表失败'))
    }
  })

  // ===== 2. POST /api-key-groups — 建组(ownerId = 当前用户,自动入 owner member) =====
  server.post('/api-key-groups', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))
    const parsed = createGroupBodySchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    try {
      const d = parsed.data
      const group = await createGroup({
        name: d.name,
        ownerId: userId,
        description: d.description,
        sharedTokenBalance: d.sharedTokenBalance,
        sharedCostBalanceCents: d.sharedCostBalanceCents,
        rateLimitQpm: d.rateLimitQpm,
        allowedModels: d.allowedModels ?? null,
        allowedIps: d.allowedIps ?? null,
      })

      // 自动将 owner 的 API Key 加入组(role='owner')
      let ownerApiKeyId = d.apiKeyId
      if (!ownerApiKeyId) {
        // 未指定则取用户最新 active Key
        const [latestKey] = await dbRead
          .select({ id: developerApiKeys.id })
          .from(developerApiKeys)
          .where(eq(developerApiKeys.userId, userId))
          .orderBy(desc(developerApiKeys.createdAt))
          .limit(1)
        ownerApiKeyId = latestKey?.id
      } else {
        // 校验 apiKeyId 属于当前用户
        const [keyRow] = await dbRead
          .select({ id: developerApiKeys.id })
          .from(developerApiKeys)
          .where(eq(developerApiKeys.id, ownerApiKeyId))
          .limit(1)
        if (!keyRow) return reply.status(400).send(error(400, '指定的 API Key 不存在'))
      }

      if (ownerApiKeyId) {
        await addMember(group.id, ownerApiKeyId, 'owner')
      }

      return reply.status(201).send(success({ group, ownerApiKeyId: ownerApiKeyId ?? null }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '创建分组失败'))
    }
  })

  // ===== 9. POST /api-key-groups/join — 凭邀请码加入组(静态路由,优先于 :id) =====
  server.post('/api-key-groups/join', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))
    const parsed = joinBodySchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    try {
      const d = parsed.data
      // 校验 apiKeyId 属于当前用户
      const [keyRow] = await dbRead
        .select({ id: developerApiKeys.id })
        .from(developerApiKeys)
        .where(eq(developerApiKeys.id, d.apiKeyId))
        .limit(1)
      if (!keyRow) return reply.status(400).send(error(400, 'API Key 不存在'))

      await acceptInvite(d.inviteCode.toUpperCase(), d.apiKeyId)
      return reply.send(success({ joined: true }))
    } catch (e) {
      const msg = (e as Error).message || '加入分组失败'
      if (
        msg.includes('不存在') ||
        msg.includes('已被使用') ||
        msg.includes('已过期') ||
        msg.includes('已在')
      ) {
        return reply.status(400).send(error(400, msg))
      }
      request.log.error(e)
      return reply.status(500).send(error(500, '加入分组失败'))
    }
  })

  // ===== 3. GET /api-key-groups/:id — 组详情(组成员可查) =====
  server.get('/api-key-groups/:id', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))

    try {
      const group = await getGroupById(p.data.id)
      if (!group) return reply.status(404).send(error(404, '分组不存在'))

      // 校验用户在组中(owner 或 member)
      const userApiKeyId = await getUserApiKeyInGroup(userId, p.data.id)
      const isOwner = group.ownerId === userId
      if (!userApiKeyId && !isOwner) {
        return reply.status(403).send(error(403, '无权查看此分组'))
      }

      return reply.send(success({ group }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询分组详情失败'))
    }
  })

  // ===== 4. PATCH /api-key-groups/:id — 改组(仅 owner/admin) =====
  server.patch('/api-key-groups/:id', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const parsed = updateGroupBodySchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    try {
      const group = await getGroupById(p.data.id)
      if (!group) return reply.status(404).send(error(404, '分组不存在'))

      // 校验角色:owner 或 admin
      const userApiKeyId = await getUserApiKeyInGroup(userId, p.data.id)
      const isOwner = group.ownerId === userId
      let role: 'owner' | 'admin' | 'member' | null = isOwner ? 'owner' : null
      if (!role && userApiKeyId) {
        role = await getMemberRole(p.data.id, userApiKeyId)
      }
      if (role !== 'owner' && role !== 'admin') {
        return reply.status(403).send(error(403, '仅 owner 或 admin 可修改分组'))
      }

      const d = parsed.data
      const [updated] = await db
        .update(apiKeyGroups)
        .set({
          ...(d.name !== undefined ? { name: d.name } : {}),
          ...(d.description !== undefined ? { description: d.description } : {}),
          ...(d.sharedTokenBalance !== undefined ? { sharedTokenBalance: d.sharedTokenBalance } : {}),
          ...(d.sharedCostBalanceCents !== undefined ? { sharedCostBalanceCents: d.sharedCostBalanceCents } : {}),
          ...(d.rateLimitQpm !== undefined ? { rateLimitQpm: d.rateLimitQpm } : {}),
          ...(d.allowedModels !== undefined ? { allowedModels: d.allowedModels } : {}),
          ...(d.allowedIps !== undefined ? { allowedIps: d.allowedIps } : {}),
          ...(d.enabled !== undefined ? { enabled: d.enabled } : {}),
          updatedAt: new Date(),
        })
        .where(eq(apiKeyGroups.id, p.data.id))
        .returning()

      return reply.send(success({ group: updated }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '修改分组失败'))
    }
  })

  // ===== 5. DELETE /api-key-groups/:id — 删组(仅 owner,cascade 删 members + invites) =====
  server.delete('/api-key-groups/:id', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))

    try {
      const group = await getGroupById(p.data.id)
      if (!group) return reply.status(404).send(error(404, '分组不存在'))

      // 校验角色:仅 owner
      if (group.ownerId !== userId) {
        return reply.status(403).send(error(403, '仅 owner 可删除分组'))
      }

      await db.delete(apiKeyGroups).where(eq(apiKeyGroups.id, p.data.id))
      return reply.send(success({ deleted: true }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '删除分组失败'))
    }
  })

  // ===== 6. GET /api-key-groups/:id/members — 组成员用量排行(最近 30d) =====
  server.get('/api-key-groups/:id/members', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))

    try {
      const group = await getGroupById(p.data.id)
      if (!group) return reply.status(404).send(error(404, '分组不存在'))

      // 校验用户在组中
      const userApiKeyId = await getUserApiKeyInGroup(userId, p.data.id)
      const isOwner = group.ownerId === userId
      if (!userApiKeyId && !isOwner) {
        return reply.status(403).send(error(403, '无权查看此分组成员'))
      }

      const members = await getGroupMembers(p.data.id)
      // 按用量降序排行
      members.sort((a, b) => b.usedTokens - a.usedTokens)
      return reply.send(success({ members }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询组成员失败'))
    }
  })

  // ===== 7. POST /api-key-groups/:id/invite — 生成邀请码(8 位,24h 有效) =====
  server.post('/api-key-groups/:id/invite', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))

    try {
      const group = await getGroupById(p.data.id)
      if (!group) return reply.status(404).send(error(404, '分组不存在'))

      // 校验角色:owner 或 admin
      const userApiKeyId = await getUserApiKeyInGroup(userId, p.data.id)
      const isOwner = group.ownerId === userId
      let role: 'owner' | 'admin' | 'member' | null = isOwner ? 'owner' : null
      if (!role && userApiKeyId) {
        role = await getMemberRole(p.data.id, userApiKeyId)
      }
      if (role !== 'owner' && role !== 'admin') {
        return reply.status(403).send(error(403, '仅 owner 或 admin 可生成邀请码'))
      }

      const invite = await createInvite(p.data.id, userId)
      return reply.status(201).send(success(invite))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '生成邀请码失败'))
    }
  })

  // ===== 8. POST /api-key-groups/:id/recharge — 充值组池(token + cost) =====
  server.post('/api-key-groups/:id/recharge', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const parsed = rechargeBodySchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    try {
      const group = await getGroupById(p.data.id)
      if (!group) return reply.status(404).send(error(404, '分组不存在'))

      // 校验角色:owner 或 admin
      const userApiKeyId = await getUserApiKeyInGroup(userId, p.data.id)
      const isOwner = group.ownerId === userId
      let role: 'owner' | 'admin' | 'member' | null = isOwner ? 'owner' : null
      if (!role && userApiKeyId) {
        role = await getMemberRole(p.data.id, userApiKeyId)
      }
      if (role !== 'owner' && role !== 'admin') {
        return reply.status(403).send(error(403, '仅 owner 或 admin 可充值组池'))
      }

      const d = parsed.data
      const result = await rechargeGroupBalance(
        p.data.id,
        d.tokenAmount ?? 0,
        d.costCents ?? 0,
      )
      if (!result) return reply.status(404).send(error(404, '分组不存在'))
      return reply.send(success({ balance: result }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '充值组池失败'))
    }
  })
}

export default developerApiKeyGroupsRoutes
