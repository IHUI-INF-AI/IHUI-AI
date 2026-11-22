// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import { requireAuth, requireAdmin } from '../../plugins/require-permission.js'
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
  isKeyOwnedBy,
  rechargeGroupBalance,
} from '../../services/api-key-group-service.js'

// =============================================================================
// Zod schema
// =============================================================================

const idParamSchema = z.object({ id: z.uuid() })

const createGroupBodySchema = z.object({
  name: z.string().min(1, '名称不能为空').max(64),
  description: z.transform(emptyToUndefined).pipe(z.string().max(500).optional()),
  // 2026-10-31 安全强化第 10 批 R10：**建组不再接受客户端自报余额**。
  //
  // 此前 `sharedTokenBalance: z.number().int().default(0)` 原样入库，而计费侧
  // `relay-billing-service.ts` 把 `-1 && -1` 判为"无限额度直接放行" ⇒ 任意用户
  // 建组时传 -1/-1 就得到无限免费调用（组池优先于个人余额）。这不是"参数没校验"，
  // 是把计价权交给了客户端。
  //
  // 组池余额只有两个合法来源：① 管理员充值（本文件 /recharge，admin-only）；
  // ② 未来的支付回调（届时在服务端按订单金额入账）。建组一律 0 起步。
  rateLimitQpm: z.number().int().min(1).max(10000).optional(),
  allowedModels: z.array(z.string()).nullable().optional(),
  allowedIps: z.array(z.string()).nullable().optional(),
  /** 建组时作为 owner 加入组的 API Key id(可选,未传则用用户最新 active Key) */
  apiKeyId: z.transform(emptyToUndefined).pipe(z.uuid().optional()),
})

const updateGroupBodySchema = z.object({
  name: z.string().min(1).max(64).optional(),
  description: z.transform(emptyToUndefined).pipe(z.string().max(500).nullable().optional()),
  // 余额字段刻意不在可改清单里（同 create 的理由）：改余额必须走 /recharge 且 admin-only。
  rateLimitQpm: z.number().int().min(1).max(10000).optional(),
  allowedModels: z.array(z.string()).nullable().optional(),
  allowedIps: z.array(z.string()).nullable().optional(),
  enabled: z.boolean().optional(),
})

const rechargeBodySchema = z
  .object({
    // 2026-10-31 安全强化第 10 批 R10：**必须为正**。此前只判"非 0"，负数可以"充值"
    // 把组池打成负值，而 -1 在计费侧是"无限额度"的哨兵值 ⇒ `tokenAmount: -1` 一次
    // 就把组池变成无限。上限 1e12 防整数溢出与误操作。
    tokenAmount: z.number().int().min(1).max(1_000_000_000_000).optional(),
    costCents: z.number().int().min(1).max(1_000_000_000_000).optional(),
  })
  .refine((d) => d.tokenAmount !== undefined || d.costCents !== undefined, {
    message: 'tokenAmount 或 costCents 至少填一个',
  })

const joinBodySchema = z.object({
  inviteCode: z.string().min(1, '邀请码不能为空').max(16),
  /** 要加入组的 API Key id(必须属于当前用户) */
  apiKeyId: z.uuid({ error: 'API Key id 格式错误' }),
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
        // 建组一律 0 起步（schema 已不接受这两个字段，这里显式写死，防后来者顺手接回）
        sharedTokenBalance: 0,
        sharedCostBalanceCents: 0,
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
      } else if (!(await isKeyOwnedBy(ownerApiKeyId, userId))) {
        // 2026-10-27 越权修正:这一段注释自称「校验 apiKeyId 属于当前用户」,但查询里
        // 只有 eq(id, ownerApiKeyId) —— 证明的是"这行存在",不是"这行是你的"。任意登录
        // 用户可把受害者 Key 以 role='owner' 写进自己的组,此后该 Key 的计费/限流/可用
        // 模型口径全部由攻击者的组决定(relay-billing-service.getKeyGroup)。
        // 状态码与文案维持"不存在"原样,不新增可用于探测 Key 存续的响应差分。
        return reply.status(400).send(error(400, '指定的 API Key 不存在'))
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
      // 2026-10-27 越权修正:同建组那一段,归属判据走 service 单源 isKeyOwnedBy。
      // 原写法可让攻击者用自己账号的邀请码把他人 Key 拉进组;叠加 acceptInvite 的
      // onConflictDoNothing + 单组唯一索引 ⇒ 先占位即可让受害者自己的 Key 再也加不进任何组。
      if (!(await isKeyOwnedBy(d.apiKeyId, userId))) {
        return reply.status(400).send(error(400, 'API Key 不存在'))
      }

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

      const removed = await db
        .delete(apiKeyGroups)
        .where(eq(apiKeyGroups.id, p.data.id))
        .returning({ id: apiKeyGroups.id })
      return reply.send(success({ deleted: removed.length > 0 }))
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
  //
  // 2026-10-31 安全强化第 10 批 R10：**改 admin-only**。
  //
  // 此前只要"是组 owner/admin"就能调用，而 `rechargeGroupBalance` 是纯加数字、
  // 不扣任何资金来源（无支付单、无个人余额划转）。任意用户 → 建组 → 给自己
  // recharge 任意额度 → 无限免费调用中转站。这是完整的经济面击穿，不是参数问题。
  //
  // 前端实测无任何"充值组池"消费点（grep sharedTokenBalance 在 apps/web 与 packages
  // 下零命中），说明它从来就没有产品链路，只有 API 后门。改 admin-only 不破坏功能。
  // 将来接支付时：由支付回调在服务端按订单金额入账，仍不应回到用户自助改数字。
  server.post(
    '/api-key-groups/:id/recharge',
    { preHandler: requireAdmin },
    async (request, reply) => {
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

        const d = parsed.data
        const result = await rechargeGroupBalance(p.data.id, d.tokenAmount ?? 0, d.costCents ?? 0)
        if (!result) return reply.status(404).send(error(404, '分组不存在'))
        return reply.send(success({ balance: result }))
      } catch (e) {
        request.log.error(e)
        return reply.status(500).send(error(500, '充值组池失败'))
      }
    },
  )
}

export default developerApiKeyGroupsRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
