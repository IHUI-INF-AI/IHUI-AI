import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate, checkAuth } from '../plugins/auth.js';
import {
  createInvitationCode,
  findInvitationCodesByUser,
  findInvitationByCode,
  findInviteesByUser,
  findActivities,
  findActivityBySlug,
  findActivityById,
  joinActivity,
  leaveActivity,
  findActivityParticipants,
  createActivity,
  updateActivity,
  deleteActivity,
  createCoupon,
  findCoupons,
  verifyCoupon,
} from '../db/promotion-queries.js';
import { success, error } from '../utils/response.js';

const ADMIN_ROLE_ID = 1;
const ACTIVITY_STATUS = ['draft', 'published', 'ended'] as const;
const COUPON_TYPE = ['fixed', 'percent'] as const;

// =============================================================================
// Zod schemas
// =============================================================================

const createInvitationSchema = z.object({
  rewardInviter: z.number().int().min(0).optional(),
  rewardInvitee: z.number().int().min(0).optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

const codeParamSchema = z.object({
  code: z.string().min(1, '邀请码不能为空').max(32),
});

const slugParamSchema = z.object({
  slug: z.string().min(1).max(128),
});

const idParamSchema = z.object({
  id: z.string().uuid('无效的 ID'),
});

const listParticipantsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const createActivitySchema = z.object({
  title: z.string().min(1).max(128),
  slug: z.string().min(1).max(128).regex(/^[a-z0-9-]+$/i, 'slug 只能包含字母、数字和连字符'),
  description: z.string().optional(),
  banner: z.string().url().max(512).optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  status: z.enum(ACTIVITY_STATUS).optional(),
  rules: z.unknown().optional(),
}).refine((d) => d.endAt > d.startAt, { message: 'endAt 必须晚于 startAt', path: ['endAt'] });

const updateActivitySchema = z.object({
  title: z.string().min(1).max(128).optional(),
  description: z.string().optional(),
  banner: z.string().url().max(512).optional(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().optional(),
  status: z.enum(ACTIVITY_STATUS).optional(),
  rules: z.unknown().optional(),
}).refine(
  (d) => !(d.startAt && d.endAt) || d.endAt > d.startAt,
  { message: 'endAt 必须晚于 startAt', path: ['endAt'] },
);

const listCouponsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const createCouponSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(128),
  type: z.enum(COUPON_TYPE),
  value: z.number().int().min(0),
  minAmount: z.number().int().min(0).optional(),
  maxUses: z.number().int().min(0).nullable().optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  isActive: z.boolean().optional(),
}).refine((d) => d.endsAt > d.startsAt, { message: 'endsAt 必须晚于 startsAt', path: ['endsAt'] });

const verifyCouponSchema = z.object({
  code: z.string().min(1).max(32),
  amount: z.number().int().min(0),
});

// =============================================================================
// 公开 + 用户认证路由（前缀 /api）
// =============================================================================

export const promotionRoutes: FastifyPluginAsync = async (server) => {
  // POST /invitations - 需登录：生成邀请码
  server.post('/invitations', {
    schema: {
      summary: '生成邀请码',
      tags: ['promotions'],
      body: {
        type: 'object',
        properties: {
          rewardInviter: { type: 'integer', minimum: 0, description: '邀请人奖励积分(可选)' },
          rewardInvitee: { type: 'integer', minimum: 0, description: '被邀请人奖励积分(可选)' },
          expiresInDays: { type: 'integer', minimum: 1, maximum: 365, description: '有效天数(可选)' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            code: { type: 'number' },
            message: { type: 'string' },
            data: { type: 'object', additionalProperties: true },
          },
        },
        400: {
          type: 'object',
          properties: { code: { type: 'number' }, message: { type: 'string' } },
        },
        401: {
          type: 'object',
          properties: { code: { type: 'number' }, message: { type: 'string' } },
        },
      },
    },
  }, async (request, reply) => {
    if (!(await checkAuth(request, reply))) return;
    const userId = request.userId!;

    const parsed = createInvitationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }

    const invitation = await createInvitationCode({
      inviterId: userId,
      rewardInviter: parsed.data.rewardInviter,
      rewardInvitee: parsed.data.rewardInvitee,
      expiresInDays: parsed.data.expiresInDays,
    });
    return reply.status(201).send(success({ invitation }));
  });

  // GET /invitations - 需登录：当前用户的邀请码列表
  server.get('/invitations', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return;
    const userId = request.userId!;
    const list = await findInvitationCodesByUser(userId);
    return reply.send(success({ list }));
  });

  // GET /invitations/invitees - 需登录：当前用户邀请的用户列表
  server.get('/invitations/invitees', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return;
    const userId = request.userId!;
    const list = await findInviteesByUser(userId);
    return reply.send(success({ list }));
  });

  // POST /invitations/:code/verify - 公开：验证邀请码
  server.post('/invitations/:code/verify', async (request, reply) => {
    const parsed = codeParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const invitation = await findInvitationByCode(parsed.data.code);
    if (!invitation) {
      return reply.status(404).send(error(404, '邀请码不存在'));
    }

    let valid = true;
    let reason: string | null = null;
    if (invitation.status !== 'unused') {
      valid = false;
      reason = `邀请码状态为 ${invitation.status}`;
    } else if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      valid = false;
      reason = '邀请码已过期';
    }

    return reply.send(
      success({
        valid,
        reason,
        rewardInviter: invitation.rewardInviter,
        rewardInvitee: invitation.rewardInvitee,
      }),
    );
  });

  // GET /activities - 公开：活动列表（只返回 published 且在有效期内）
  server.get('/activities', {
    schema: {
      summary: '活动列表',
      tags: ['promotions'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1, description: '页码(默认 1)' },
          pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20, description: '每页数量(1-100,默认 20)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number' },
            message: { type: 'string' },
            data: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
  }, async (_request, reply) => {
    const list = await findActivities();
    return reply.send(success({ list }));
  });

  // GET /activities/:slug - 公开：活动详情
  server.get('/activities/:slug', async (request, reply) => {
    const parsed = slugParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const activity = await findActivityBySlug(parsed.data.slug);
    if (!activity) {
      return reply.status(404).send(error(404, '活动不存在'));
    }
    return reply.send(success({ activity }));
  });

  // POST /activities/:id/join - 需登录：参与活动
  server.post('/activities/:id/join', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return;
    const userId = request.userId!;

    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }

    const activity = await findActivityById(parsed.data.id);
    if (!activity) {
      return reply.status(404).send(error(404, '活动不存在'));
    }
    const now = new Date();
    if (activity.status !== 'published' || now < activity.startAt || now > activity.endAt) {
      return reply.status(400).send(error(400, '活动不在可参与状态'));
    }

    const participant = await joinActivity(activity.id, userId);
    if (!participant) {
      return reply.status(409).send(error(409, '已参与该活动'));
    }
    return reply.status(201).send(success({ participant }));
  });

  // DELETE /activities/:id/join - 需登录：取消参与
  server.delete('/activities/:id/join', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return;
    const userId = request.userId!;

    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }

    const ok = await leaveActivity(parsed.data.id, userId);
    if (!ok) {
      return reply.status(404).send(error(404, '未参与该活动'));
    }
    return reply.send(success({ ok: true }));
  });

  // GET /activities/:id/participants - 需登录：活动参与者列表（分页，admin 可查全部）
  server.get('/activities/:id/participants', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return;
    const roleId = request.jwtPayload?.roleId ?? 0;

    const idParsed = idParamSchema.safeParse(request.params);
    const qParsed = listParticipantsQuerySchema.safeParse(request.query);
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'));
    }
    if (!qParsed.success) {
      return reply.status(400).send(error(400, qParsed.error.issues[0]?.message ?? '参数错误'));
    }

    const activity = await findActivityById(idParsed.data.id);
    if (!activity) {
      return reply.status(404).send(error(404, '活动不存在'));
    }
    // 非 admin 只能查看 published 且在有效期内的活动
    const now = new Date();
    if (
      roleId < ADMIN_ROLE_ID &&
      (activity.status !== 'published' || now < activity.startAt || now > activity.endAt)
    ) {
      return reply.status(403).send(error(403, '无权查看该活动参与者'));
    }

    const { page, pageSize } = qParsed.data;
    const { list, total } = await findActivityParticipants(activity.id, page, pageSize);
    return reply.send(success({ list, total, page, pageSize }));
  });

  // POST /coupons/verify - 需登录：验证优惠券码（返回折扣金额）
  server.post('/coupons/verify', {
    schema: {
      summary: '验证优惠券码',
      tags: ['promotions'],
      body: {
        type: 'object',
        properties: {
          code: { type: 'string', description: '优惠券码' },
          amount: { type: 'number', description: '订单金额' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number' },
            message: { type: 'string' },
            data: { type: 'object', additionalProperties: true },
          },
        },
        400: {
          type: 'object',
          properties: { code: { type: 'number' }, message: { type: 'string' } },
        },
        401: {
          type: 'object',
          properties: { code: { type: 'number' }, message: { type: 'string' } },
        },
      },
    },
  }, async (request, reply) => {
    if (!(await checkAuth(request, reply))) return;

    const parsed = verifyCouponSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }

    const result = await verifyCoupon(parsed.data.code, parsed.data.amount);
    if (!result.valid) {
      return reply.send(success({ valid: false, reason: result.reason, discountAmount: 0 }));
    }
    return reply.send(
      success({
        valid: true,
        coupon: result.coupon,
        discountAmount: result.discountAmount,
        finalAmount: Math.max(0, parsed.data.amount - result.discountAmount),
      }),
    );
  });
};

// =============================================================================
// 管理员路由（前缀 /api/admin）
// =============================================================================

export const adminPromotionRoutes: FastifyPluginAsync = async (server) => {
  // 统一 admin 鉴权
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request);
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401;
      const message = (e as Error).message || 'Authentication required';
      return reply.status(statusCode).send(error(statusCode, message));
    }
    const roleId = request.jwtPayload?.roleId ?? 0;
    if (roleId < ADMIN_ROLE_ID) {
      return reply.status(403).send(error(403, '需要管理员权限'));
    }
  });

  // POST /activities - 创建活动
  server.post('/activities', async (request, reply) => {
    const parsed = createActivitySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }

    try {
      const activity = await createActivity({
        title: parsed.data.title,
        slug: parsed.data.slug,
        description: parsed.data.description,
        banner: parsed.data.banner,
        startAt: parsed.data.startAt,
        endAt: parsed.data.endAt,
        status: parsed.data.status,
        rules: parsed.data.rules,
      });
      return reply.status(201).send(success({ activity }));
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('unique') || msg.includes('duplicate')) {
        return reply.status(409).send(error(409, 'slug 已存在'));
      }
      throw e;
    }
  });

  // PATCH /activities/:id - 更新活动
  server.patch('/activities/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params);
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const parsed = updateActivitySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }

    const existing = await findActivityById(idParsed.data.id);
    if (!existing) {
      return reply.status(404).send(error(404, '活动不存在'));
    }

    const activity = await updateActivity(idParsed.data.id, {
      title: parsed.data.title,
      description: parsed.data.description,
      banner: parsed.data.banner,
      startAt: parsed.data.startAt,
      endAt: parsed.data.endAt,
      status: parsed.data.status,
      rules: parsed.data.rules,
    });
    return reply.send(success({ activity }));
  });

  // DELETE /activities/:id - 删除活动
  server.delete('/activities/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }

    const existing = await findActivityById(parsed.data.id);
    if (!existing) {
      return reply.status(404).send(error(404, '活动不存在'));
    }
    await deleteActivity(parsed.data.id);
    return reply.send(success({ ok: true }));
  });

  // POST /coupons - 创建优惠券
  server.post('/coupons', async (request, reply) => {
    const parsed = createCouponSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }

    try {
      const coupon = await createCoupon({
        code: parsed.data.code,
        name: parsed.data.name,
        type: parsed.data.type,
        value: parsed.data.value,
        minAmount: parsed.data.minAmount,
        maxUses: parsed.data.maxUses ?? null,
        startsAt: parsed.data.startsAt,
        endsAt: parsed.data.endsAt,
        isActive: parsed.data.isActive,
      });
      return reply.status(201).send(success({ coupon }));
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('unique') || msg.includes('duplicate')) {
        return reply.status(409).send(error(409, '优惠券码已存在'));
      }
      throw e;
    }
  });

  // GET /coupons - 优惠券列表
  server.get('/coupons', {
    schema: {
      summary: '优惠券列表',
      tags: ['promotions'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1, description: '页码(默认 1)' },
          pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20, description: '每页数量(1-100,默认 20)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number' },
            message: { type: 'string' },
            data: { type: 'object', additionalProperties: true },
          },
        },
        400: {
          type: 'object',
          properties: { code: { type: 'number' }, message: { type: 'string' } },
        },
        401: {
          type: 'object',
          properties: { code: { type: 'number' }, message: { type: 'string' } },
        },
        403: {
          type: 'object',
          properties: { code: { type: 'number' }, message: { type: 'string' } },
        },
      },
    },
  }, async (request, reply) => {
    const parsed = listCouponsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { page, pageSize } = parsed.data;
    const { list, total } = await findCoupons(page, pageSize);
    return reply.send(success({ list, total, page, pageSize }));
  });
};
