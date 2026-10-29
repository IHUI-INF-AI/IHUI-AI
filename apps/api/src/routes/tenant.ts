// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { tenants, tenantMembers, tenantQuotas, type Tenant } from '@ihui/database'
import { authenticate } from '../plugins/auth.js'
import { isSystemAdmin } from '../plugins/require-permission.js'
import { checkQuota, clearTenantCache } from '../plugins/tenant.js'
import { success, error } from '../utils/response.js'

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const createTenantSchema = z.object({
  name: z.string().min(1).max(128),
  slug: z.string().min(1).max(128).regex(slugRegex, 'slug 只能包含小写字母、数字和连字符'),
  description: z.string().max(2000).optional(),
  plan: z.enum(['free', 'pro', 'enterprise']).default('free'),
})

const updateTenantSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  description: z.string().max(2000).optional(),
  status: z.number().int().min(0).max(1).optional(),
  plan: z.enum(['free', 'pro', 'enterprise']).optional(),
})

const addMemberSchema = z.object({
  userId: z.uuid(),
  role: z.enum(['admin', 'member']).default('member'),
})

const updateMemberSchema = z.object({
  role: z.enum(['admin', 'member']),
})

const updateQuotaSchema = z.object({
  apiCallsLimit: z.number().int().positive().optional(),
  storageLimitMb: z.number().int().positive().optional(),
  userLimit: z.number().int().positive().optional(),
})

function serializeTenant(t: Tenant) {
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    description: t.description ?? '',
    ownerId: t.ownerId,
    status: t.status,
    plan: t.plan,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }
}

/** 租户管理路由：CRUD + 成员管理 + 配额管理。 */
export const tenantRoutes: FastifyPluginAsync = async (server) => {
  const idParam = z.object({ id: z.string() })
  const memberIdParam = z.object({ id: z.string(), userId: z.string() })

  /**
   * 租户成员资格 + 角色校验(2026-10-27 安全加固,P0)。
   *
   * 原实现:除 POST / 之外**全部只挂 authenticate** —— 任意登录用户拿着一个租户 UUID 就能
   * 改租户名/套餐(PATCH /:id,plan 直接改 enterprise 等于免费升级配额)、把任意人(含自己)
   * 以 admin 塞进任意租户、提权任意成员、改任意租户配额、踢掉任意成员、读成员名单。
   * 也就是说多租户隔离在 API 层完全不存在。
   *
   * 判定口径:成员表里必须有一行 (tenantId, userId);角色按 owner > admin > member 排序。
   * 非成员与"租户不存在"同形返回 404 —— 不给外部拿 403/404 差异枚举租户 ID 的信号。
   */
  const TENANT_ROLE_RANK: Record<string, number> = { owner: 3, admin: 2, member: 1 }
  async function guardTenantAccess(
    request: FastifyRequest,
    reply: FastifyReply,
    tenantId: string,
    minRole: 'member' | 'admin' = 'member',
  ): Promise<boolean> {
    const userId = request.userId
    if (!userId) {
      reply.status(401).send(error(401, '未登录'))
      return false
    }
    // 平台管理员旁路:后台运维需要跨租户查看/处置(混合闸门的标准写法见
    // require-permission 的 isSystemAdmin 注释 —— 属主分支留在调用处,特权读数走集中封装)。
    if (isSystemAdmin(request, { includeInternalChannel: false })) return true
    const [row] = await db
      .select({ role: tenantMembers.role })
      .from(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.userId, userId)))
      .limit(1)
    if (!row) {
      reply.status(404).send(error(404, '租户不存在'))
      return false
    }
    if ((TENANT_ROLE_RANK[row.role] ?? 0) < (TENANT_ROLE_RANK[minRole] ?? 0)) {
      reply.status(403).send(error(403, '需要租户管理员权限'))
      return false
    }
    return true
  }

  // 创建租户（任何已认证用户可创建，自动成为 owner）
  server.post('/', { preHandler: authenticate }, async (request, reply) => {
    const parsed = createTenantSchema.safeParse(request.body)
    if (!parsed.success) {
      reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      return
    }
    const { name, slug, description, plan } = parsed.data
    const userId = request.userId!

    const [existing] = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1)
    if (existing) {
      reply.status(409).send(error(409, 'slug 已被占用'))
      return
    }

    const [tenant] = await db
      .insert(tenants)
      .values({ name, slug, description, ownerId: userId, plan })
      .returning()
    if (!tenant) {
      reply.status(500).send(error(500, '创建租户失败'))
      return
    }
    // 创建者自动成为 owner 成员
    await db.insert(tenantMembers).values({ tenantId: tenant.id, userId, role: 'owner' })
    // 初始化配额
    const defaults =
      plan === 'enterprise'
        ? { apiCallsLimit: 10_000_000, storageLimitMb: 102_400, userLimit: 500 }
        : plan === 'pro'
          ? { apiCallsLimit: 1_000_000, storageLimitMb: 51_200, userLimit: 200 }
          : { apiCallsLimit: 100_000, storageLimitMb: 10_240, userLimit: 50 }
    await db.insert(tenantQuotas).values({ tenantId: tenant.id, ...defaults })
    clearTenantCache()
    reply.status(201).send(success(serializeTenant(tenant)))
  })

  // 列出当前用户所属的租户
  server.get('/', { preHandler: authenticate }, async (request) => {
    const userId = request.userId!
    const rows = await db
      .select({ tenant: tenants, role: tenantMembers.role })
      .from(tenants)
      .innerJoin(tenantMembers, eq(tenantMembers.tenantId, tenants.id))
      .where(eq(tenantMembers.userId, userId))
    return success(rows.map((r) => ({ ...serializeTenant(r.tenant), role: r.role })))
  })

  // 获取租户详情(仅成员)
  server.get('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = idParam.parse(request.params)
    if (!(await guardTenantAccess(request, reply, id))) return
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1)
    if (!tenant) {
      reply.status(404).send(error(404, '租户不存在'))
      return
    }
    return success(serializeTenant(tenant))
  })

  // 更新租户(仅租户管理员/所有者)
  server.patch('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = idParam.parse(request.params)
    if (!(await guardTenantAccess(request, reply, id, 'admin'))) return
    const parsed = updateTenantSchema.safeParse(request.body)
    if (!parsed.success) {
      reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      return
    }
    const [tenant] = await db.update(tenants).set(parsed.data).where(eq(tenants.id, id)).returning()
    if (!tenant) {
      reply.status(404).send(error(404, '租户不存在'))
      return
    }
    clearTenantCache()
    return success(serializeTenant(tenant))
  })

  // 删除租户（仅 owner）
  server.delete('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = idParam.parse(request.params)
    const userId = request.userId!
    const [member] = await db
      .select()
      .from(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, id), eq(tenantMembers.userId, userId)))
      .limit(1)
    if (!member || member.role !== 'owner') {
      reply.status(403).send(error(403, '仅租户所有者可删除'))
      return
    }
    const removed = await db.delete(tenants).where(eq(tenants.id, id)).returning({ id: tenants.id })
    clearTenantCache()
    return success({ deleted: removed.length > 0 })
  })

  // ---- 成员管理 ----

  // 列出租户成员(仅成员)
  server.get('/:id/members', { preHandler: authenticate }, async (request, reply) => {
    const { id } = idParam.parse(request.params)
    if (!(await guardTenantAccess(request, reply, id))) return
    const rows = await db
      .select({ member: tenantMembers })
      .from(tenantMembers)
      .where(eq(tenantMembers.tenantId, id))
    return success(
      rows.map((r) => ({
        id: r.member.id,
        userId: r.member.userId,
        role: r.member.role,
        joinedAt: r.member.joinedAt,
      })),
    )
  })

  // 添加成员(仅租户管理员/所有者)
  server.post('/:id/members', { preHandler: authenticate }, async (request, reply) => {
    const { id } = idParam.parse(request.params)
    if (!(await guardTenantAccess(request, reply, id, 'admin'))) return
    const parsed = addMemberSchema.safeParse(request.body)
    if (!parsed.success) {
      reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      return
    }
    await checkQuota(id, 'users', 1)
    const { userId, role } = parsed.data
    try {
      const [member] = await db
        .insert(tenantMembers)
        .values({ tenantId: id, userId, role })
        .returning()
      if (!member) {
        reply.status(500).send(error(500, '插入成员失败'))
        return
      }
      return success({
        id: member.id,
        tenantId: member.tenantId,
        userId: member.userId,
        role: member.role,
      })
    } catch {
      reply.status(409).send(error(409, '用户已是租户成员'))
    }
  })

  // 更新成员角色(仅租户管理员/所有者)
  server.patch('/:id/members/:userId', { preHandler: authenticate }, async (request, reply) => {
    const { id, userId } = memberIdParam.parse(request.params)
    if (!(await guardTenantAccess(request, reply, id, 'admin'))) return
    const parsed = updateMemberSchema.safeParse(request.body)
    if (!parsed.success) {
      reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      return
    }
    const [member] = await db
      .update(tenantMembers)
      .set({ role: parsed.data.role })
      .where(and(eq(tenantMembers.tenantId, id), eq(tenantMembers.userId, userId)))
      .returning()
    if (!member) {
      reply.status(404).send(error(404, '成员不存在'))
      return
    }
    return success({ id: member.id, role: member.role })
  })

  // 移除成员(仅租户管理员/所有者)
  server.delete('/:id/members/:userId', { preHandler: authenticate }, async (request, reply) => {
    const { id, userId } = memberIdParam.parse(request.params)
    if (!(await guardTenantAccess(request, reply, id, 'admin'))) return
    // 第二十八批(布尔 ack 族):where 带 tenantId+userId 双过滤,成员不存在时
    // 0 行命中与移除成功在响应上原本同形;确认一律由 .returning 的命中集合派生。
    const removed = await db
      .delete(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, id), eq(tenantMembers.userId, userId)))
      .returning({ id: tenantMembers.id })
    return success({ removed: removed.length > 0 })
  })

  // ---- 配额管理 ----

  // 获取租户配额(仅成员)
  server.get('/:id/quota', { preHandler: authenticate }, async (request, reply) => {
    const { id } = idParam.parse(request.params)
    if (!(await guardTenantAccess(request, reply, id))) return
    const [quota] = await db
      .select()
      .from(tenantQuotas)
      .where(eq(tenantQuotas.tenantId, id))
      .limit(1)
    if (!quota) {
      reply.status(404).send(error(404, '配额记录不存在'))
      return
    }
    return success({
      apiCallsLimit: quota.apiCallsLimit,
      apiCallsUsed: quota.apiCallsUsed,
      storageLimitMb: quota.storageLimitMb,
      storageUsedMb: quota.storageUsedMb,
      userLimit: quota.userLimit,
      userCount: quota.userCount,
      periodStart: quota.periodStart,
      periodEnd: quota.periodEnd,
    })
  })

  // 更新租户配额(仅租户管理员/所有者)
  server.patch('/:id/quota', { preHandler: authenticate }, async (request, reply) => {
    const { id } = idParam.parse(request.params)
    if (!(await guardTenantAccess(request, reply, id, 'admin'))) return
    const parsed = updateQuotaSchema.safeParse(request.body)
    if (!parsed.success) {
      reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      return
    }
    const [quota] = await db
      .update(tenantQuotas)
      .set(parsed.data)
      .where(eq(tenantQuotas.tenantId, id))
      .returning()
    if (!quota) {
      reply.status(404).send(error(404, '配额记录不存在'))
      return
    }
    return success({
      apiCallsLimit: quota.apiCallsLimit,
      storageLimitMb: quota.storageLimitMb,
      userLimit: quota.userLimit,
    })
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
