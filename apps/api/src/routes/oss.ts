import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../plugins/auth.js';
import {
  findOssDrivers,
  findOssDriverById,
  findOssDriverByName,
  createOssDriver,
  updateOssDriver,
  deleteOssDriver,
  findDefaultOssDriver,
} from '../db/oss-queries.js';
import { success, error, emptyToUndefined } from '../utils/response.js';

const ADMIN_ROLE_ID = 1;

// =============================================================================
// 鉴权辅助
// =============================================================================

async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  try {
    await authenticate(request);
    return true;
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401;
    const message = (e as Error).message || 'Authentication required';
    reply.status(statusCode).send(error(statusCode, message));
    return false;
  }
}

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

const ossDriverTypeSchema = z.enum([
  'local',
  'aliyun-oss',
  'tencent-cos',
  'qiniu',
  's3',
  'minio',
]);

const uuidParamSchema = z.object({ id: z.string().uuid('无效的 ID') });

const listDriversQuerySchema = z.object({
  driver: z.preprocess(emptyToUndefined, ossDriverTypeSchema.optional()),
});

const createDriverBodySchema = z.object({
  name: z.string().min(1).max(128),
  driver: ossDriverTypeSchema,
  credentials: z.record(z.unknown()).optional(),
  config: z.record(z.unknown()).optional(),
  isEnabled: z.boolean().default(false),
  isDefault: z.boolean().default(false),
  sort: z.number().int().min(0).default(0),
  description: z.string().optional(),
});

const updateDriverBodySchema = z
  .object({
    name: z.string().min(1).max(128).optional(),
    driver: ossDriverTypeSchema.optional(),
    credentials: z.record(z.unknown()).optional(),
    config: z.record(z.unknown()).optional(),
    isEnabled: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    sort: z.number().int().min(0).optional(),
    description: z.string().nullable().optional(),
  })
  .refine(
    (d) =>
      d.name !== undefined ||
      d.driver !== undefined ||
      d.credentials !== undefined ||
      d.config !== undefined ||
      d.isEnabled !== undefined ||
      d.isDefault !== undefined ||
      d.sort !== undefined ||
      d.description !== undefined,
    { message: '至少需提供一个可更新字段' },
  );

// 上传代理 schema(简化:校验驱动是否存在,实际上传走 files.ts)
const uploadProxyBodySchema = z.object({
  driverId: z.string().uuid().optional(),
  filename: z.string().min(1),
  size: z.number().int().min(0),
});

// =============================================================================
// 公共路由(前缀 /api,需登录):查询可用驱动 + 上传/下载代理
// =============================================================================

export const ossRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAuth(request, reply))) return;
  });

  // GET /oss/drivers - 启用中的驱动列表(不返回 credentials)
  server.get(
    '/oss/drivers',
    {
      schema: {
        summary: '可用存储驱动列表',
        tags: ['oss'],
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
      const list = await findOssDrivers();
      // 公共接口仅返回启用的驱动
      const enabled = list.filter((d) => d.isEnabled);
      return reply.send(success({ list: enabled }));
    },
  );

  // POST /oss/upload - 上传代理(简化:校验驱动配置后返回上传地址,实际上传走 files.ts)
  server.post(
    '/oss/upload',
    {
      schema: {
        summary: '上传代理(预校验驱动)',
        tags: ['oss'],
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
        },
      },
    },
    async (request, reply) => {
      const parsed = uploadProxyBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const { driverId, filename, size } = parsed.data;
      // 选定驱动:显式传入 > 默认驱动
      const driver = driverId
        ? await findOssDriverById(driverId)
        : await findDefaultOssDriver();
      if (!driver || !driver.isEnabled) {
        return reply.status(400).send(error(400, '无可用的存储驱动'));
      }
      return reply.send(
        success({
          driverId: driver.id,
          driver: driver.driver,
          filename,
          size,
          // 实际写入由 files.ts 完成,这里仅返回驱动信息
          message: `驱动 ${driver.name} 已就绪,请通过 /files 接口完成上传`,
        }),
      );
    },
  );

  // GET /oss/download/:id - 下载代理(简化:返回驱动信息,实际下载由 files.ts 处理)
  server.get(
    '/oss/download/:id',
    {
      schema: {
        summary: '下载代理(返回驱动信息)',
        tags: ['oss'],
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
      const driver = await findOssDriverById(parsed.data.id);
      if (!driver) {
        return reply.status(404).send(error(404, '驱动不存在'));
      }
      return reply.send(
        success({
          driverId: driver.id,
          driver: driver.driver,
          config: driver.config,
          message: '请通过 /files 接口完成下载',
        }),
      );
    },
  );
};

// =============================================================================
// 管理员路由(前缀 /api/admin,驱动 CRUD)
// =============================================================================

export const adminOssRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAdmin(request, reply))) return;
  });

  // GET /oss/drivers - 全部驱动列表(支持 driver 筛选)
  server.get(
    '/oss/drivers',
    {
      schema: {
        summary: '存储驱动列表(管理)',
        tags: ['oss'],
        querystring: {
          type: 'object',
          properties: {
            driver: { type: 'string', enum: ['local', 'aliyun-oss', 'tencent-cos', 'qiniu', 's3', 'minio'] },
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
      const parsed = listDriversQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const list = await findOssDrivers(parsed.data.driver);
      return reply.send(success({ list }));
    },
  );

  // GET /oss/drivers/:id - 驱动详情(含 credentials)
  server.get(
    '/oss/drivers/:id',
    {
      schema: {
        summary: '驱动详情',
        tags: ['oss'],
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
      const driver = await findOssDriverById(parsed.data.id);
      if (!driver) {
        return reply.status(404).send(error(404, '驱动不存在'));
      }
      return reply.send(success({ driver }));
    },
  );

  // POST /oss/drivers - 创建驱动
  server.post(
    '/oss/drivers',
    {
      schema: {
        summary: '创建存储驱动',
        tags: ['oss'],
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
      const parsed = createDriverBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const existing = await findOssDriverByName(parsed.data.name);
      if (existing) {
        return reply.status(409).send(error(409, '驱动 name 已存在'));
      }
      const driver = await createOssDriver({
        ...parsed.data,
        updatedBy: request.userId,
      });
      return reply.status(201).send(success({ driver }));
    },
  );

  // PATCH /oss/drivers/:id - 更新驱动
  server.patch(
    '/oss/drivers/:id',
    {
      schema: {
        summary: '更新存储驱动',
        tags: ['oss'],
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
        },
      },
    },
    async (request, reply) => {
      const parsedParams = uuidParamSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return reply.status(400).send(error(400, parsedParams.error.issues[0]?.message ?? '参数错误'));
      }
      const parsedBody = updateDriverBodySchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.status(400).send(error(400, parsedBody.error.issues[0]?.message ?? '参数错误'));
      }
      const existing = await findOssDriverById(parsedParams.data.id);
      if (!existing) {
        return reply.status(404).send(error(404, '驱动不存在'));
      }
      const driver = await updateOssDriver(parsedParams.data.id, {
        ...parsedBody.data,
        updatedBy: request.userId,
      });
      return reply.send(success({ driver }));
    },
  );

  // DELETE /oss/drivers/:id - 删除驱动
  server.delete(
    '/oss/drivers/:id',
    {
      schema: {
        summary: '删除存储驱动',
        tags: ['oss'],
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
      const existing = await findOssDriverById(parsedParams.data.id);
      if (!existing) {
        return reply.status(404).send(error(404, '驱动不存在'));
      }
      await deleteOssDriver(parsedParams.data.id);
      return reply.send(success({ id: parsedParams.data.id, deleted: true }));
    },
  );
};
