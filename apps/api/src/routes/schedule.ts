import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../plugins/auth.js';
import {
  findScheduleTasks,
  findScheduleTaskById,
  createScheduleTask,
  updateScheduleTask,
  deleteScheduleTask,
  setScheduleTaskEnabled,
  runScheduleTaskNow,
  findScheduleLogs,
  findScheduleLogById,
} from '../db/schedule-queries.js';
import { success, error, emptyToUndefined } from '../utils/response.js';

const ADMIN_ROLE_ID = 1;

// =============================================================================
// Zod schemas
// =============================================================================

const uuidParamSchema = z.object({ id: z.string().uuid('无效的 ID') });

const listTasksQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  enabled: z.preprocess(emptyToUndefined, z.coerce.boolean().optional()),
  name: z.preprocess(emptyToUndefined, z.string().min(1).max(200).optional()),
});

const listLogsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  taskId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  status: z.preprocess(emptyToUndefined, z.string().min(1).max(20).optional()),
});

const createTaskSchema = z.object({
  name: z.string().min(1, '任务名称不能为空').max(200),
  cronExpression: z.string().min(1, 'Cron 表达式不能为空').max(100),
  description: z.string().nullable().optional(),
  targetService: z.string().max(100).nullable().optional(),
  targetMethod: z.string().max(100).nullable().optional(),
  parameters: z.string().nullable().optional(),
  priority: z.number().int().min(1).max(10).optional(),
  maxRetryCount: z.number().int().min(0).optional(),
  timeout: z.number().int().min(1).optional(),
  enabled: z.boolean().optional(),
});

const updateTaskSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  cronExpression: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
  targetService: z.string().max(100).nullable().optional(),
  targetMethod: z.string().max(100).nullable().optional(),
  parameters: z.string().nullable().optional(),
  priority: z.number().int().min(1).max(10).optional(),
  maxRetryCount: z.number().int().min(0).optional(),
  timeout: z.number().int().min(1).optional(),
  enabled: z.boolean().optional(),
});

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
// 公共路由（前缀 /api，需登录，只读）
// =============================================================================

export const scheduleRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAuth(request, reply))) return;
  });

  // GET /schedule/tasks - 任务列表
  server.get('/schedule/tasks', {
    schema: {
      summary: '定时任务列表',
      tags: ['schedule'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          enabled: { type: 'boolean', description: '启用状态筛选' },
          name: { type: 'string', description: '任务名称模糊搜索' },
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
  }, async (request, reply) => {
    const parsed = listTasksQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const result = await findScheduleTasks(parsed.data);
    return reply.send(success(result));
  });

  // GET /schedule/tasks/:id - 任务详情
  server.get('/schedule/tasks/:id', {
    schema: {
      summary: '任务详情',
      tags: ['schedule'],
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
  }, async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const task = await findScheduleTaskById(parsed.data.id);
    if (!task) {
      return reply.status(404).send(error(404, '任务不存在'));
    }
    return reply.send(success({ task }));
  });

  // GET /schedule/logs - 日志列表
  server.get('/schedule/logs', {
    schema: {
      summary: '任务执行日志列表',
      tags: ['schedule'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          taskId: { type: 'string', format: 'uuid', description: '任务ID筛选' },
          status: { type: 'string', description: '状态筛选: running/success/failed/timeout' },
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
  }, async (request, reply) => {
    const parsed = listLogsQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const result = await findScheduleLogs(parsed.data);
    return reply.send(success(result));
  });

  // GET /schedule/logs/:id - 日志详情
  server.get('/schedule/logs/:id', {
    schema: {
      summary: '日志详情',
      tags: ['schedule'],
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
  }, async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const log = await findScheduleLogById(parsed.data.id);
    if (!log) {
      return reply.status(404).send(error(404, '日志不存在'));
    }
    return reply.send(success({ log }));
  });
};

// =============================================================================
// 管理员路由（前缀 /api/admin）
// =============================================================================

export const adminScheduleRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAdmin(request, reply))) return;
  });

  // POST /schedule/tasks - 创建任务
  server.post('/schedule/tasks', {
    schema: {
      summary: '创建定时任务',
      tags: ['schedule'],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '任务名称' },
          cronExpression: { type: 'string', description: 'Cron 表达式' },
          description: { type: 'string', description: '任务描述' },
          targetService: { type: 'string', description: '目标服务' },
          targetMethod: { type: 'string', description: '目标方法' },
          parameters: { type: 'string', description: '任务参数(JSON)' },
          priority: { type: 'integer', minimum: 1, maximum: 10, description: '优先级1-10' },
          maxRetryCount: { type: 'integer', minimum: 0, description: '最大重试次数' },
          timeout: { type: 'integer', minimum: 1, description: '超时时间(秒)' },
          enabled: { type: 'boolean', description: '是否启用' },
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
        400: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const parsed = createTaskSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const task = await createScheduleTask(parsed.data);
    return reply.status(201).send(success({ task }));
  });

  // PUT /schedule/tasks/:id - 更新任务
  server.put('/schedule/tasks/:id', {
    schema: {
      summary: '更新定时任务',
      tags: ['schedule'],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          cronExpression: { type: 'string' },
          description: { type: 'string' },
          targetService: { type: 'string' },
          targetMethod: { type: 'string' },
          parameters: { type: 'string' },
          priority: { type: 'integer', minimum: 1, maximum: 10 },
          maxRetryCount: { type: 'integer', minimum: 0 },
          timeout: { type: 'integer', minimum: 1 },
          enabled: { type: 'boolean' },
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
        404: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const idParsed = uuidParamSchema.safeParse(request.params);
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const parsed = updateTaskSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findScheduleTaskById(idParsed.data.id);
    if (!existing) {
      return reply.status(404).send(error(404, '任务不存在'));
    }
    const task = await updateScheduleTask(idParsed.data.id, parsed.data);
    return reply.send(success({ task }));
  });

  // DELETE /schedule/tasks/:id - 删除任务
  server.delete('/schedule/tasks/:id', {
    schema: {
      summary: '删除定时任务',
      tags: ['schedule'],
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
  }, async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findScheduleTaskById(parsed.data.id);
    if (!existing) {
      return reply.status(404).send(error(404, '任务不存在'));
    }
    await deleteScheduleTask(parsed.data.id);
    return reply.send(success({ id: parsed.data.id, deleted: true }));
  });

  // PUT /schedule/tasks/:id/enable - 启用任务
  server.put('/schedule/tasks/:id/enable', {
    schema: {
      summary: '启用任务',
      tags: ['schedule'],
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
  }, async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findScheduleTaskById(parsed.data.id);
    if (!existing) {
      return reply.status(404).send(error(404, '任务不存在'));
    }
    const task = await setScheduleTaskEnabled(parsed.data.id, true);
    return reply.send(success({ id: task?.id, enabled: task?.enabled }));
  });

  // PUT /schedule/tasks/:id/disable - 禁用任务
  server.put('/schedule/tasks/:id/disable', {
    schema: {
      summary: '禁用任务',
      tags: ['schedule'],
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
  }, async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findScheduleTaskById(parsed.data.id);
    if (!existing) {
      return reply.status(404).send(error(404, '任务不存在'));
    }
    const task = await setScheduleTaskEnabled(parsed.data.id, false);
    return reply.send(success({ id: task?.id, enabled: task?.enabled }));
  });

  // PUT /schedule/tasks/:id/run - 立即执行任务
  server.put('/schedule/tasks/:id/run', {
    schema: {
      summary: '立即执行任务',
      tags: ['schedule'],
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
  }, async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const result = await runScheduleTaskNow(parsed.data.id);
    if (!result) {
      return reply.status(404).send(error(404, '任务不存在'));
    }
    return reply.send(success({ id: result.task.id, logId: result.log.id, status: 'running' }));
  });
};
