import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../plugins/auth.js';
import {
  findPublicEduSettings,
  findEduSettings,
  findEduSettingById,
  findEduSettingByGroupKey,
  findEduSettingsByGroup,
  createEduSetting,
  updateEduSetting,
  deleteEduSetting,
} from '../db/setting-queries.js';
import { success, error, emptyToUndefined } from '../utils/response.js';

const ADMIN_ROLE_ID = 1;

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

// =============================================================================
// Zod schemas
// =============================================================================

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const listSettingsQuerySchema = paginationSchema.extend({
  group: z.preprocess(emptyToUndefined, z.string().min(1).max(64).optional()),
  key: z.preprocess(emptyToUndefined, z.string().min(1).max(128).optional()),
});

const groupParamSchema = z.object({
  group: z.string().min(1).max(64),
});

const settingTypeSchema = z.enum(['string', 'number', 'boolean', 'json']);

const createSettingBodySchema = z.object({
  group: z.string().min(1).max(64).default('general'),
  key: z.string().min(1).max(128),
  value: z.string().optional(),
  type: settingTypeSchema.default('string'),
  credentials: z.record(z.unknown()).optional(),
  description: z.string().optional(),
  isPublic: z.boolean().default(false),
  sort: z.number().int().min(0).default(0),
  status: z.number().int().min(0).max(1).default(1),
});

const updateSettingBodySchema = z
  .object({
    group: z.string().min(1).max(64).optional(),
    key: z.string().min(1).max(128).optional(),
    value: z.string().nullable().optional(),
    type: settingTypeSchema.optional(),
    credentials: z.record(z.unknown()).optional(),
    description: z.string().nullable().optional(),
    isPublic: z.boolean().optional(),
    sort: z.number().int().min(0).optional(),
    status: z.number().int().min(0).max(1).optional(),
  })
  .refine(
    (d) =>
      d.group !== undefined ||
      d.key !== undefined ||
      d.value !== undefined ||
      d.type !== undefined ||
      d.credentials !== undefined ||
      d.description !== undefined ||
      d.isPublic !== undefined ||
      d.sort !== undefined ||
      d.status !== undefined,
    { message: '至少需提供一个可更新字段' },
  );

const uuidParamSchema = z.object({ id: z.string().uuid('无效的 ID') });

// =============================================================================
// 公开路由(前缀 /api):GET /settings + GET /settings/:group
// =============================================================================

export const settingRoutes: FastifyPluginAsync = async (server) => {
  // GET /settings - 公开配置(无需鉴权)
  server.get(
    '/settings',
    {
      schema: {
        summary: '公开教育平台配置',
        tags: ['setting'],
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
    },
    async (_request, reply) => {
      const list = await findPublicEduSettings();
      return reply.send(success({ list }));
    },
  );

  // GET /settings/:group - 按 group 查询(仅返回 status=1 的配置,公开接口)
  server.get(
    '/settings/:group',
    {
      schema: {
        summary: '按分组查询配置',
        tags: ['setting'],
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const parsed = groupParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const list = await findEduSettingsByGroup(parsed.data.group);
      return reply.send(success({ list }));
    },
  );
};

// =============================================================================
// 管理员路由(前缀 /api/admin,CRUD)
// =============================================================================

export const adminSettingRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAdmin(request, reply))) return;
  });

  // GET /edu-settings - 分页列表(支持 group + key 筛选)
  server.get(
    '/edu-settings',
    {
      schema: {
        summary: '教育设置列表',
        tags: ['setting'],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            group: { type: 'string' },
            key: { type: 'string' },
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
          400: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const parsed = listSettingsQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const { page, pageSize, group, key } = parsed.data;
      const { list, total } = await findEduSettings(page, pageSize, { group, key });
      return reply.send(success({ list, total, page, pageSize }));
    },
  );

  // GET /edu-settings/:id - 详情(含 credentials)
  server.get(
    '/edu-settings/:id',
    {
      schema: {
        summary: '教育设置详情',
        tags: ['setting'],
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
          404: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const parsed = uuidParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const setting = await findEduSettingById(parsed.data.id);
      if (!setting) {
        return reply.status(404).send(error(404, '设置不存在'));
      }
      return reply.send(success({ setting }));
    },
  );

  // POST /edu-settings - 创建
  server.post(
    '/edu-settings',
    {
      schema: {
        summary: '创建教育设置',
        tags: ['setting'],
        body: { type: 'object', additionalProperties: true },
        response: {
          201: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
          409: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const parsed = createSettingBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const existing = await findEduSettingByGroupKey(parsed.data.group, parsed.data.key);
      if (existing) {
        return reply.status(409).send(error(409, '同 group 下 key 已存在'));
      }
      const setting = await createEduSetting({
        ...parsed.data,
        updatedBy: request.userId,
      });
      return reply.status(201).send(success({ setting }));
    },
  );

  // PATCH /edu-settings/:id - 更新
  server.patch(
    '/edu-settings/:id',
    {
      schema: {
        summary: '更新教育设置',
        tags: ['setting'],
        body: { type: 'object', additionalProperties: true },
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
          404: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
          409: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const parsedParams = uuidParamSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return reply.status(400).send(error(400, parsedParams.error.issues[0]?.message ?? '参数错误'));
      }
      const parsedBody = updateSettingBodySchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.status(400).send(error(400, parsedBody.error.issues[0]?.message ?? '参数错误'));
      }
      const existing = await findEduSettingById(parsedParams.data.id);
      if (!existing) {
        return reply.status(404).send(error(404, '设置不存在'));
      }
      // 若 group/key 变更,需校验新组合的唯一性
      const newGroup = parsedBody.data.group ?? existing.group;
      const newKey = parsedBody.data.key ?? existing.key;
      if (newGroup !== existing.group || newKey !== existing.key) {
        const dup = await findEduSettingByGroupKey(newGroup, newKey);
        if (dup && dup.id !== existing.id) {
          return reply.status(409).send(error(409, '同 group 下 key 已存在'));
        }
      }
      const setting = await updateEduSetting(parsedParams.data.id, {
        ...parsedBody.data,
        updatedBy: request.userId,
      });
      return reply.send(success({ setting }));
    },
  );

  // DELETE /edu-settings/:id - 删除
  server.delete(
    '/edu-settings/:id',
    {
      schema: {
        summary: '删除教育设置',
        tags: ['setting'],
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
          404: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const parsedParams = uuidParamSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return reply.status(400).send(error(400, parsedParams.error.issues[0]?.message ?? '参数错误'));
      }
      const existing = await findEduSettingById(parsedParams.data.id);
      if (!existing) {
        return reply.status(404).send(error(404, '设置不存在'));
      }
      await deleteEduSetting(parsedParams.data.id);
      return reply.send(success({ id: parsedParams.data.id, deleted: true }));
    },
  );
};
