import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { tenants, tenantMembers, tenantQuotas, type Tenant } from '@ihui/database';
import { authenticate } from '../plugins/auth.js';
import { checkQuota, clearTenantCache } from '../plugins/tenant.js';
import { success, error } from '../utils/response.js';

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const createTenantSchema = z.object({
  name: z.string().min(1).max(128),
  slug: z.string().min(1).max(128).regex(slugRegex, 'slug 只能包含小写字母、数字和连字符'),
  description: z.string().max(2000).optional(),
  plan: z.enum(['free', 'pro', 'enterprise']).default('free'),
});

const updateTenantSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  description: z.string().max(2000).optional(),
  status: z.number().int().min(0).max(1).optional(),
  plan: z.enum(['free', 'pro', 'enterprise']).optional(),
});

const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['admin', 'member']).default('member'),
});

const updateMemberSchema = z.object({
  role: z.enum(['admin', 'member']),
});

const updateQuotaSchema = z.object({
  apiCallsLimit: z.number().int().positive().optional(),
  storageLimitMb: z.number().int().positive().optional(),
  userLimit: z.number().int().positive().optional(),
});

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
  };
}

/** 租户管理路由：CRUD + 成员管理 + 配额管理。 */
export const tenantRoutes: FastifyPluginAsync = async (server) => {
  // 创建租户（任何已认证用户可创建，自动成为 owner）
  server.post('/', { preHandler: authenticate }, async (request, reply) => {
    const parsed = createTenantSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      return;
    }
    const { name, slug, description, plan } = parsed.data;
    const userId = request.userId!;

    const [existing] = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
    if (existing) {
      reply.status(409).send(error(409, 'slug 已被占用'));
      return;
    }

    const [tenant] = await db
      .insert(tenants)
      .values({ name, slug, description, ownerId: userId, plan })
      .returning();
    if (!tenant) {
      reply.status(500).send(error(500, '创建租户失败'));
      return;
    }
    // 创建者自动成为 owner 成员
    await db.insert(tenantMembers).values({ tenantId: tenant.id, userId, role: 'owner' });
    // 初始化配额
    const defaults = plan === 'enterprise'
      ? { apiCallsLimit: 10_000_000, storageLimitMb: 102_400, userLimit: 500 }
      : plan === 'pro'
        ? { apiCallsLimit: 1_000_000, storageLimitMb: 51_200, userLimit: 200 }
        : { apiCallsLimit: 100_000, storageLimitMb: 10_240, userLimit: 50 };
    await db.insert(tenantQuotas).values({ tenantId: tenant.id, ...defaults });
    clearTenantCache();
    reply.status(201).send(success(serializeTenant(tenant)));
  });

  // 列出当前用户所属的租户
  server.get('/', { preHandler: authenticate }, async (request) => {
    const userId = request.userId!;
    const rows = await db
      .select({ tenant: tenants, role: tenantMembers.role })
      .from(tenants)
      .innerJoin(tenantMembers, eq(tenantMembers.tenantId, tenants.id))
      .where(eq(tenantMembers.userId, userId));
    return success(
      rows.map((r) => ({ ...serializeTenant(r.tenant), role: r.role })),
    );
  });

  // 获取租户详情
  server.get('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
    if (!tenant) {
      reply.status(404).send(error(404, '租户不存在'));
      return;
    }
    return success(serializeTenant(tenant));
  });

  // 更新租户
  server.patch('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateTenantSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      return;
    }
    const [tenant] = await db
      .update(tenants)
      .set(parsed.data)
      .where(eq(tenants.id, id))
      .returning();
    if (!tenant) {
      reply.status(404).send(error(404, '租户不存在'));
      return;
    }
    clearTenantCache();
    return success(serializeTenant(tenant));
  });

  // 删除租户（仅 owner）
  server.delete('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.userId!;
    const [member] = await db
      .select()
      .from(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, id), eq(tenantMembers.userId, userId)))
      .limit(1);
    if (!member || member.role !== 'owner') {
      reply.status(403).send(error(403, '仅租户所有者可删除'));
      return;
    }
    await db.delete(tenants).where(eq(tenants.id, id));
    clearTenantCache();
    return success({ deleted: true });
  });

  // ---- 成员管理 ----

  // 列出租户成员
  server.get('/:id/members', { preHandler: authenticate }, async (request) => {
    const { id } = request.params as { id: string };
    const rows = await db
      .select({ member: tenantMembers })
      .from(tenantMembers)
      .where(eq(tenantMembers.tenantId, id));
    return success(
      rows.map((r) => ({
        id: r.member.id,
        userId: r.member.userId,
        role: r.member.role,
        joinedAt: r.member.joinedAt,
      })),
    );
  });

  // 添加成员
  server.post('/:id/members', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = addMemberSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      return;
    }
    await checkQuota(id, 'users', 1);
    const { userId, role } = parsed.data;
    try {
      const [member] = await db
        .insert(tenantMembers)
        .values({ tenantId: id, userId, role })
        .returning();
      if (!member) {
        reply.status(500).send(error(500, '插入成员失败'));
        return;
      }
      return success({ id: member.id, tenantId: member.tenantId, userId: member.userId, role: member.role });
    } catch {
      reply.status(409).send(error(409, '用户已是租户成员'));
    }
  });

  // 更新成员角色
  server.patch('/:id/members/:userId', { preHandler: authenticate }, async (request, reply) => {
    const { id, userId } = request.params as { id: string; userId: string };
    const parsed = updateMemberSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      return;
    }
    const [member] = await db
      .update(tenantMembers)
      .set({ role: parsed.data.role })
      .where(and(eq(tenantMembers.tenantId, id), eq(tenantMembers.userId, userId)))
      .returning();
    if (!member) {
      reply.status(404).send(error(404, '成员不存在'));
      return;
    }
    return success({ id: member.id, role: member.role });
  });

  // 移除成员
  server.delete('/:id/members/:userId', { preHandler: authenticate }, async (request) => {
    const { id, userId } = request.params as { id: string; userId: string };
    await db
      .delete(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, id), eq(tenantMembers.userId, userId)));
    return success({ removed: true });
  });

  // ---- 配额管理 ----

  // 获取租户配额
  server.get('/:id/quota', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [quota] = await db.select().from(tenantQuotas).where(eq(tenantQuotas.tenantId, id)).limit(1);
    if (!quota) {
      reply.status(404).send(error(404, '配额记录不存在'));
      return;
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
    });
  });

  // 更新租户配额（管理员）
  server.patch('/:id/quota', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateQuotaSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      return;
    }
    const [quota] = await db
      .update(tenantQuotas)
      .set(parsed.data)
      .where(eq(tenantQuotas.tenantId, id))
      .returning();
    if (!quota) {
      reply.status(404).send(error(404, '配额记录不存在'));
      return;
    }
    return success({ apiCallsLimit: quota.apiCallsLimit, storageLimitMb: quota.storageLimitMb, userLimit: quota.userLimit });
  });
};
