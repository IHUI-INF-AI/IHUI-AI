import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../plugins/auth.js';
import {
  saveVisitLog,
  getVisitSummary,
  getDayPvList,
  getDayUvList,
  findIpCityList,
} from '../db/visit-tracking-queries.js';
import { success, error, emptyToUndefined } from '../utils/response.js';

const ADMIN_ROLE_ID = 1;

// =============================================================================
// Zod schemas
// =============================================================================

// 兼容 {data: {...}} 与平铺结构
const saveVisitLogSchema = z
  .object({
    data: z.object({
      userId: z.string().uuid().optional(),
      ip: z.string().max(64).optional(),
      city: z.string().max(100).optional(),
      url: z.string().max(512).optional(),
      referer: z.string().max(512).optional(),
      userAgent: z.string().max(512).optional(),
      sessionId: z.string().max(128).optional(),
      visitDate: z.string().max(10).optional(),
    }).optional(),
    userId: z.string().uuid().optional(),
    ip: z.string().max(64).optional(),
    city: z.string().max(100).optional(),
    url: z.string().max(512).optional(),
    referer: z.string().max(512).optional(),
    userAgent: z.string().max(512).optional(),
    sessionId: z.string().max(128).optional(),
    visitDate: z.string().max(10).optional(),
  })
  .transform((v) => (v.data ? v.data : v));

const dateRangeQuery = z.object({
  startTime: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  endTime: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
});

const ipCityQuery = z.object({
  startTime: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  endTime: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// =============================================================================
// 鉴权辅助
// =============================================================================

async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  try {
    await authenticate(request);
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401;
    const message = (e as Error).message || 'Authentication required';
    reply.status(statusCode).send(error(statusCode, message));
    return false;
  }
  const roleId = request.jwtPayload?.roleId ?? 0;
  if (roleId < ADMIN_ROLE_ID) {
    reply.status(403).send(error(403, '需要管理员权限'));
    return false;
  }
  return true;
}

const dataObjSchema = {
  type: 'object',
  properties: {
    code: { type: 'number' },
    message: { type: 'string' },
    data: { type: 'object', additionalProperties: true },
  },
} as const;

const dateRangeProps = {
  startTime: { type: 'string', description: '开始时间 YYYY-MM-DD' },
  endTime: { type: 'string', description: '结束时间 YYYY-MM-DD' },
} as const;

// =============================================================================
// 公共路由（前缀 /api，无需登录，仅保存访问记录）
// =============================================================================

export const visitTrackingRoutes: FastifyPluginAsync = async (server) => {
  // POST /visit-tracking/visit-log - 保存访问记录(访客可不登录)
  server.post('/visit-tracking/visit-log', {
    schema: {
      summary: '保存访问记录',
      tags: ['visit-tracking'],
      body: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            description: '访问记录数据(可选, 缺省则取平铺字段)',
            properties: {
              userId: { type: 'string', format: 'uuid' },
              ip: { type: 'string' },
              city: { type: 'string' },
              url: { type: 'string' },
              referer: { type: 'string' },
              userAgent: { type: 'string' },
              sessionId: { type: 'string' },
              visitDate: { type: 'string', description: 'YYYY-MM-DD' },
            },
          },
          userId: { type: 'string', format: 'uuid' },
          ip: { type: 'string' },
          city: { type: 'string' },
          url: { type: 'string' },
          referer: { type: 'string' },
          userAgent: { type: 'string' },
          sessionId: { type: 'string' },
          visitDate: { type: 'string' },
        },
      },
      response: {
        200: dataObjSchema,
        400: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const parsed = saveVisitLogSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const visitLog = await saveVisitLog(parsed.data);
    return reply.send(success({ visitLog }));
  });
};

// =============================================================================
// 管理员路由（前缀 /api/admin，访问统计）
// =============================================================================

export const adminVisitTrackingRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAdmin(request, reply))) return;
  });

  // GET /visit-tracking/summary - 访问概览
  server.get('/visit-tracking/summary', {
    schema: {
      summary: '访问概览',
      tags: ['visit-tracking'],
      querystring: { type: 'object', properties: dateRangeProps },
      response: { 200: dataObjSchema, 400: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } } },
    },
  }, async (request, reply) => {
    const parsed = dateRangeQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const summary = await getVisitSummary(parsed.data.startTime, parsed.data.endTime);
    return reply.send(success({ summary }));
  });

  // GET /visit-tracking/day/pv/list - 每日 PV 列表
  server.get('/visit-tracking/day/pv/list', {
    schema: {
      summary: '每日 PV 列表',
      tags: ['visit-tracking'],
      querystring: { type: 'object', properties: dateRangeProps },
      response: { 200: dataObjSchema, 400: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } } },
    },
  }, async (request, reply) => {
    const parsed = dateRangeQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const list = await getDayPvList(parsed.data.startTime, parsed.data.endTime);
    return reply.send(success({ list }));
  });

  // GET /visit-tracking/day/uv/list - 每日 UV 列表
  server.get('/visit-tracking/day/uv/list', {
    schema: {
      summary: '每日 UV 列表',
      tags: ['visit-tracking'],
      querystring: { type: 'object', properties: dateRangeProps },
      response: { 200: dataObjSchema, 400: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } } },
    },
  }, async (request, reply) => {
    const parsed = dateRangeQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const list = await getDayUvList(parsed.data.startTime, parsed.data.endTime);
    return reply.send(success({ list }));
  });

  // GET /visit-tracking/ip-city/summary/list - IP 城市统计列表
  server.get('/visit-tracking/ip-city/summary/list', {
    schema: {
      summary: 'IP 城市统计列表',
      tags: ['visit-tracking'],
      querystring: {
        type: 'object',
        properties: {
          ...dateRangeProps,
          page: { type: 'integer', minimum: 1, default: 1 },
          pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
      },
      response: { 200: dataObjSchema, 400: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } } },
    },
  }, async (request, reply) => {
    const parsed = ipCityQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const result = await findIpCityList({
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });
    return reply.send(success(result));
  });
};
