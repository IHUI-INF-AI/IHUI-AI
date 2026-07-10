import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requirePermission } from '../plugins/require-permission.js';
import { success, error } from '../utils/response.js';
import {
  listCanaryConfigs,
  getCanaryConfig,
  createCanary,
  promoteCanary,
  rollbackCanary,
  recordFailure,
  resetCanary,
  getAuditLog,
  getCanaryPercentage,
} from '../services/canary-service.js';

// =============================================================================
// Zod schemas
// =============================================================================

const createSchema = z.object({
  name: z.string().min(1).max(100),
  targetStage: z.enum(['full']).default('full'),
  failureThreshold: z.number().int().min(1).max(100).default(5),
  cooldownMinutes: z.number().int().min(1).max(1440).default(30),
});

const rollbackSchema = z.object({ reason: z.string().min(1).max(500) });
const failureSchema = z.object({ reason: z.string().min(1).max(500) });
const nameParamSchema = z.object({ name: z.string().min(1).max(100) });

// =============================================================================
// 辅助：将 service 抛出的 Error 转为 400 响应
// =============================================================================

async function handleServiceCall<T>(
  reply: FastifyReply,
  fn: () => Promise<T>,
): Promise<FastifyReply> {
  try {
    const result = await fn();
    return reply.send(success(result));
  } catch (e) {
    const message = (e as Error).message || '操作失败';
    return reply.status(400).send(error(400, message));
  }
}

// =============================================================================
// 路由
// =============================================================================

const canaryRoutes: FastifyPluginAsync = async (server) => {
  // 统一鉴权：所有 canary 路由均需 canary:manage 权限
  server.addHook('preHandler', requirePermission('canary:manage'));

  // GET /configs - 列出所有 canary 配置
  server.get('/configs', async (_request, reply) => {
    const list = await listCanaryConfigs();
    return reply.send(success({ list }));
  });

  // GET /configs/:name - 获取单个 canary 配置详情
  server.get('/configs/:name', async (request, reply) => {
    const parsed = nameParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const config = await getCanaryConfig(parsed.data.name);
    if (!config) {
      return reply.status(404).send(error(404, `canary config "${parsed.data.name}" not found`));
    }
    return reply.send(success(config));
  });

  // POST /configs - 创建 canary 配置
  server.post('/configs', async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    return handleServiceCall(reply, () =>
      createCanary(parsed.data.name, parsed.data.targetStage, parsed.data.failureThreshold, parsed.data.cooldownMinutes),
    );
  });

  // POST /configs/:name/promote - 提升到下一阶段
  server.post('/configs/:name/promote', async (request, reply) => {
    const parsed = nameParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    return handleServiceCall(reply, () => promoteCanary(parsed.data.name));
  });

  // POST /configs/:name/rollback - 回滚到 off
  server.post('/configs/:name/rollback', async (request, reply) => {
    const parsedParams = nameParamSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.status(400).send(error(400, parsedParams.error.issues[0]?.message ?? '参数错误'));
    }
    const parsedBody = rollbackSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.status(400).send(error(400, parsedBody.error.issues[0]?.message ?? '参数错误'));
    }
    return handleServiceCall(reply, () => rollbackCanary(parsedParams.data.name, parsedBody.data.reason));
  });

  // POST /configs/:name/failure - 记录失败（达到阈值自动回滚）
  server.post('/configs/:name/failure', async (request, reply) => {
    const parsedParams = nameParamSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.status(400).send(error(400, parsedParams.error.issues[0]?.message ?? '参数错误'));
    }
    const parsedBody = failureSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.status(400).send(error(400, parsedBody.error.issues[0]?.message ?? '参数错误'));
    }
    return handleServiceCall(reply, () => recordFailure(parsedParams.data.name, parsedBody.data.reason));
  });

  // POST /configs/:name/reset - 重置 canary
  server.post('/configs/:name/reset', async (request, reply) => {
    const parsed = nameParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    return handleServiceCall(reply, () => resetCanary(parsed.data.name));
  });

  // GET /audit - 审计日志（可选按 configName 筛选）
  server.get('/audit', async (request: FastifyRequest, reply) => {
    const { configName } = request.query as { configName?: string };
    const list = await getAuditLog(configName);
    return reply.send(success({ list }));
  });

  // GET /traffic/:name - 当前流量百分比
  server.get('/traffic/:name', async (request, reply) => {
    const parsed = nameParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const config = await getCanaryConfig(parsed.data.name);
    if (!config) {
      return reply.status(404).send(error(404, `canary config "${parsed.data.name}" not found`));
    }
    return reply.send(
      success({
        name: parsed.data.name,
        stage: config.currentStage,
        percentage: getCanaryPercentage(config.currentStage),
      }),
    );
  });
};

export default canaryRoutes;
