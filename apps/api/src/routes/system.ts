import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../plugins/auth.js';
import {
  findPublicConfigs,
  findConfigs,
  createConfig,
  updateConfig,
  deleteConfig,
  findConfigById,
  findConfigByKey,
  findIntegrations,
  findIntegrationById,
  findIntegrationByName,
  createIntegration,
  updateIntegration,
  deleteIntegration,
  findApiLogs,
  findSystemEvents,
  findSystemEventById,
  createSystemEvent,
  updateSystemEvent,
  deleteSystemEvent,
  cleanupOldApiLogs,
  getApiLogStats,
} from '../db/system-queries.js';
import { success, error, emptyToUndefined } from '../utils/response.js';

const ADMIN_ROLE_ID = 1;

/** 管理员鉴权：authenticate + requireAdmin，抛出带 statusCode 的错误。 */
async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
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

const listConfigsQuerySchema = paginationSchema.extend({
  category: z.preprocess(
    emptyToUndefined,
    z.enum(['general', 'mail', 'storage', 'security', 'payment', 'ai']).optional(),
  ),
});

const configTypeSchema = z.enum(['string', 'number', 'boolean', 'json']);
const configCategorySchema = z.enum([
  'general',
  'mail',
  'storage',
  'security',
  'payment',
  'ai',
]);

const createConfigBodySchema = z.object({
  key: z.string().min(1).max(128),
  value: z.string(),
  type: configTypeSchema.default('string'),
  category: configCategorySchema.default('general'),
  description: z.string().optional(),
  isPublic: z.boolean().default(false),
});

const updateConfigBodySchema = z
  .object({
    value: z.string().optional(),
    type: configTypeSchema.optional(),
    category: configCategorySchema.optional(),
    description: z.string().nullable().optional(),
    isPublic: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.value !== undefined ||
      d.type !== undefined ||
      d.category !== undefined ||
      d.description !== undefined ||
      d.isPublic !== undefined,
    { message: '至少需提供一个可更新字段' },
  );

const uuidParamSchema = z.object({
  id: z.string().uuid('无效的 ID'),
});

const integrationProviderSchema = z.enum([
  'wechat',
  'alipay',
  'stripe',
  'github',
  'google',
  'apple',
  'email',
  'sms',
]);

const createIntegrationBodySchema = z.object({
  name: z.string().min(1).max(128),
  provider: integrationProviderSchema,
  credentials: z.record(z.unknown()).optional(),
  isEnabled: z.boolean().default(false),
  config: z.record(z.unknown()).optional(),
});

const updateIntegrationBodySchema = z
  .object({
    name: z.string().min(1).max(128).optional(),
    provider: integrationProviderSchema.optional(),
    credentials: z.record(z.unknown()).optional(),
    isEnabled: z.boolean().optional(),
    config: z.record(z.unknown()).optional(),
  })
  .refine(
    (d) =>
      d.name !== undefined ||
      d.provider !== undefined ||
      d.credentials !== undefined ||
      d.isEnabled !== undefined ||
      d.config !== undefined,
    { message: '至少需提供一个可更新字段' },
  );

const listLogsQuerySchema = paginationSchema.extend({
  userId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  statusCode: z.preprocess(emptyToUndefined, z.coerce.number().int().optional()),
  path: z.preprocess(emptyToUndefined, z.string().optional()),
});

const listEventsQuerySchema = paginationSchema.extend({
  type: z.preprocess(
    emptyToUndefined,
    z.enum(['startup', 'shutdown', 'error', 'warning', 'maintenance', 'deploy']).optional(),
  ),
  level: z.preprocess(
    emptyToUndefined,
    z.enum(['info', 'warn', 'error']).optional(),
  ),
});

const createEventBodySchema = z.object({
  type: z.enum(['startup', 'shutdown', 'error', 'warning', 'maintenance', 'deploy']),
  level: z.enum(['info', 'warn', 'error']).default('info'),
  message: z.string().min(1),
  data: z.record(z.unknown()).optional(),
});

const eventIdParamSchema = z.object({
  id: z.string().uuid('无效的事件 ID'),
});

const updateEventBodySchema = z.object({
  type: z.enum(['startup', 'shutdown', 'error', 'warning', 'maintenance', 'deploy']).optional(),
  level: z.enum(['info', 'warn', 'error']).optional(),
  message: z.string().min(1).optional(),
  data: z.record(z.unknown()).optional(),
});

// =============================================================================
// 公开路由：GET /configs
// =============================================================================

export const systemRoutes: FastifyPluginAsync = async (server) => {
  // GET /configs - 公开配置（无需鉴权）
  server.get('/configs', async (_request, reply) => {
    const list = await findPublicConfigs();
    return reply.send(success({ list }));
  });
};

// =============================================================================
// 集成连通性测试辅助
// =============================================================================

type ConnectivityResult = { success: boolean; message: string; latency?: number };

/**
 * 测试集成连通性。
 * 按 provider 执行不同的健康检查,无网络时降级为配置校验。
 */
async function testIntegrationConnectivity(
  provider: string,
  credentials: unknown,
  config: unknown,
): Promise<ConnectivityResult> {
  const start = Date.now();
  try {
    switch (provider) {
      case 'github':
        return await testGithubIntegration(credentials);
      case 'google':
        return await testGoogleIntegration(credentials);
      case 'stripe':
        return await testStripeIntegration(credentials);
      case 'email':
      case 'smtp':
        return await testSmtpIntegration(credentials, config);
      case 'wechat':
        return await testWechatIntegration(credentials);
      case 'alipay':
        return await testAlipayIntegration(credentials);
      default:
        // 未知 provider:只校验 credentials 是否有内容
        return {
          success: Boolean(credentials),
          message: `${provider} 暂不支持连通性测试,仅校验凭证存在`,
          latency: Date.now() - start,
        };
    }
  } catch (e) {
    return {
      success: false,
      message: `${provider} 连通性测试失败: ${(e as Error).message}`,
      latency: Date.now() - start,
    };
  }
}

async function testGithubIntegration(credentials: unknown): Promise<ConnectivityResult> {
  const creds = credentials as { token?: string; apiKey?: string } | null;
  const token = creds?.token || creds?.apiKey;
  if (!token) return { success: false, message: 'GitHub 凭证缺少 token' };

  const res = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(5000),
  });
  if (res.ok) {
    const data = (await res.json()) as { login?: string };
    return { success: true, message: `GitHub 连通成功,用户: ${data.login ?? 'unknown'}` };
  }
  return { success: false, message: `GitHub 认证失败: ${res.status} ${res.statusText}` };
}

async function testGoogleIntegration(credentials: unknown): Promise<ConnectivityResult> {
  const creds = credentials as { clientId?: string; clientSecret?: string } | null;
  if (!creds?.clientId) return { success: false, message: 'Google 凭证缺少 clientId' };

  // Google OAuth discovery 端点
  const res = await fetch('https://accounts.google.com/.well-known/openid-configuration', {
    signal: AbortSignal.timeout(5000),
  });
  if (res.ok) {
    return { success: true, message: 'Google OpenID 配置可达,clientId 已配置' };
  }
  return { success: false, message: `Google 配置端点不可达: ${res.status}` };
}

async function testStripeIntegration(credentials: unknown): Promise<ConnectivityResult> {
  const creds = credentials as { secretKey?: string; publishableKey?: string } | null;
  const key = creds?.secretKey;
  if (!key) return { success: false, message: 'Stripe 凭证缺少 secretKey' };

  // Stripe Balance API(轻量级验证)
  const res = await fetch('https://api.stripe.com/v1/balance', {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(5000),
  });
  if (res.ok) {
    return { success: true, message: 'Stripe 连通成功,API 密钥有效' };
  }
  return { success: false, message: `Stripe 认证失败: ${res.status} ${res.statusText}` };
}

async function testSmtpIntegration(
  credentials: unknown,
  config: unknown,
): Promise<ConnectivityResult> {
  const creds = credentials as { user?: string; pass?: string } | null;
  const cfg = config as { host?: string; port?: number } | null;
  if (!cfg?.host) return { success: false, message: 'SMTP 配置缺少 host' };

  // SMTP 测试需要 nodemailer,未安装时只校验配置
  try {
    // @ts-expect-error - nodemailer 为可选依赖,未安装时降级为配置校验
    const nodemailer = await import('nodemailer').catch(() => null);
    if (!nodemailer) {
      // 降级:只校验配置完整性
      const hasAuth = !creds?.user || !creds?.pass ? false : true;
      return {
        success: Boolean(cfg.host) && Boolean(cfg.port),
        message: `SMTP 配置已校验(host=${cfg.host}, port=${cfg.port}, auth=${hasAuth ? '已配置' : '未配置'})`,
      };
    }
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port ?? 587,
      secure: (cfg.port ?? 587) === 465,
      auth: creds?.user ? { user: creds.user, pass: creds.pass } : undefined,
    });
    await transporter.verify();
    return { success: true, message: `SMTP 连通成功(${cfg.host}:${cfg.port ?? 587})` };
  } catch (e) {
    return { success: false, message: `SMTP 连通失败: ${(e as Error).message}` };
  }
}

async function testWechatIntegration(credentials: unknown): Promise<ConnectivityResult> {
  const creds = credentials as { appId?: string; appSecret?: string } | null;
  if (!creds?.appId || !creds?.appSecret) {
    return { success: false, message: '微信凭证缺少 appId 或 appSecret' };
  }
  // 微信 access_token 接口
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${creds.appId}&secret=${creds.appSecret}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (res.ok) {
    const data = (await res.json()) as { errcode?: number; errmsg?: string; access_token?: string };
    if (data.access_token) {
      return { success: true, message: '微信连通成功,access_token 已获取' };
    }
    return { success: false, message: `微信认证失败: ${data.errcode} ${data.errmsg}` };
  }
  return { success: false, message: `微信接口不可达: ${res.status}` };
}

async function testAlipayIntegration(credentials: unknown): Promise<ConnectivityResult> {
  const creds = credentials as { appId?: string; privateKey?: string } | null;
  if (!creds?.appId || !creds?.privateKey) {
    return { success: false, message: '支付宝凭证缺少 appId 或 privateKey' };
  }
  // 支付宝没有简单的健康检查接口,只校验凭证完整性
  return {
    success: true,
    message: `支付宝凭证已校验(appId=${creds.appId.slice(0, 8)}..., privateKey 已配置)`,
  };
}

// =============================================================================
// 管理员路由：/admin/configs /admin/integrations /admin/logs /admin/events
// =============================================================================

export const adminSystemRoutes: FastifyPluginAsync = async (server) => {
  // 统一 admin 鉴权：preHandler 对全部 admin 路由生效
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const ok = await requireAdmin(request, reply);
    if (!ok) return; // 已通过 requireAdmin 写入错误响应
  });

  // ---------------------------------------------------------------------------
  // 系统配置
  // ---------------------------------------------------------------------------

  // GET /configs - 所有配置（分页，支持 category 筛选）
  server.get('/configs', async (request, reply) => {
    const parsed = listConfigsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { page, pageSize, category } = parsed.data;
    const { list, total } = await findConfigs(page, pageSize, category);
    return reply.send(success({ list, total, page, pageSize }));
  });

  // POST /configs - 创建配置
  server.post('/configs', async (request, reply) => {
    const parsed = createConfigBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findConfigByKey(parsed.data.key);
    if (existing) {
      return reply.status(409).send(error(409, '配置 key 已存在'));
    }
    const config = await createConfig({
      ...parsed.data,
      updatedBy: request.userId,
    });
    return reply.status(201).send(success({ config }));
  });

  // PATCH /configs/:id - 更新配置
  server.patch('/configs/:id', async (request, reply) => {
    const parsedParams = uuidParamSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.status(400).send(error(400, parsedParams.error.issues[0]?.message ?? '参数错误'));
    }
    const parsedBody = updateConfigBodySchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.status(400).send(error(400, parsedBody.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findConfigById(parsedParams.data.id);
    if (!existing) {
      return reply.status(404).send(error(404, '配置不存在'));
    }
    const config = await updateConfig(parsedParams.data.id, {
      ...parsedBody.data,
      updatedBy: request.userId,
    });
    return reply.send(success({ config }));
  });

  // DELETE /configs/:id - 删除配置
  server.delete('/configs/:id', async (request, reply) => {
    const parsedParams = uuidParamSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.status(400).send(error(400, parsedParams.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findConfigById(parsedParams.data.id);
    if (!existing) {
      return reply.status(404).send(error(404, '配置不存在'));
    }
    await deleteConfig(parsedParams.data.id);
    return reply.send(success({ id: parsedParams.data.id }));
  });

  // ---------------------------------------------------------------------------
  // 集成配置
  // ---------------------------------------------------------------------------

  // GET /integrations - 集成列表（不返回 credentials 明文）
  server.get('/integrations', async (_request, reply) => {
    const list = await findIntegrations();
    return reply.send(success({ list }));
  });

  // POST /integrations - 创建集成
  server.post('/integrations', async (request, reply) => {
    const parsed = createIntegrationBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findIntegrationByName(parsed.data.name);
    if (existing) {
      return reply.status(409).send(error(409, '集成 name 已存在'));
    }
    const integration = await createIntegration(parsed.data);
    return reply.status(201).send(success({ integration }));
  });

  // PATCH /integrations/:id - 更新集成
  server.patch('/integrations/:id', async (request, reply) => {
    const parsedParams = uuidParamSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.status(400).send(error(400, parsedParams.error.issues[0]?.message ?? '参数错误'));
    }
    const parsedBody = updateIntegrationBodySchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.status(400).send(error(400, parsedBody.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findIntegrationById(parsedParams.data.id);
    if (!existing) {
      return reply.status(404).send(error(404, '集成不存在'));
    }
    const integration = await updateIntegration(parsedParams.data.id, parsedBody.data);
    return reply.send(success({ integration }));
  });

  // DELETE /integrations/:id - 删除集成
  server.delete('/integrations/:id', async (request, reply) => {
    const parsedParams = uuidParamSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.status(400).send(error(400, parsedParams.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findIntegrationById(parsedParams.data.id);
    if (!existing) {
      return reply.status(404).send(error(404, '集成不存在'));
    }
    await deleteIntegration(parsedParams.data.id);
    return reply.send(success({ id: parsedParams.data.id }));
  });

  // POST /integrations/:id/test - 测试集成连通性
  server.post('/integrations/:id/test', async (request, reply) => {
    const parsedParams = uuidParamSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.status(400).send(error(400, parsedParams.error.issues[0]?.message ?? '参数错误'));
    }
    const integration = await findIntegrationById(parsedParams.data.id);
    if (!integration) {
      return reply.status(404).send(error(404, '集成不存在'));
    }
    if (!integration.isEnabled) {
      return reply.send(
        success({ success: false, message: `集成 ${integration.name} 未启用` }),
      );
    }
    // 真实连通性测试
    const result = await testIntegrationConnectivity(
      integration.provider,
      integration.credentials,
      integration.config,
    );
    return reply.send(success(result));
  });

  // ---------------------------------------------------------------------------
  // API 日志
  // ---------------------------------------------------------------------------

  // GET /logs - API 日志（分页，支持 userId/statusCode/path 筛选）
  server.get('/logs', async (request, reply) => {
    const parsed = listLogsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { page, pageSize, userId, statusCode, path } = parsed.data;
    const { list, total } = await findApiLogs(page, pageSize, { userId, statusCode, path });
    return reply.send(success({ list, total, page, pageSize }));
  });

  // POST /logs/cleanup - 清理旧日志（保留 N 天）
  server.post('/logs/cleanup', async (request, reply) => {
    const body = z
      .object({ days: z.number().int().min(1).max(365).default(30) })
      .safeParse(request.body ?? {});
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'));
    }
    const deletedCount = await cleanupOldApiLogs(body.data.days);
    return reply.send(success({ deletedCount, days: body.data.days }));
  });

  // GET /logs/stats - 日志统计（最近 N 天）
  server.get('/logs/stats', async (request, reply) => {
    const query = z
      .object({ days: z.coerce.number().int().min(1).max(90).default(7) })
      .safeParse(request.query);
    if (!query.success) {
      return reply.status(400).send(error(400, query.error.issues[0]?.message ?? '参数错误'));
    }
    const stats = await getApiLogStats(query.data.days);
    return reply.send(success(stats));
  });

  // ---------------------------------------------------------------------------
  // 系统事件
  // ---------------------------------------------------------------------------

  // GET /events - 系统事件（分页，支持 type/level 筛选）
  server.get('/events', async (request, reply) => {
    const parsed = listEventsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { page, pageSize, type, level } = parsed.data;
    const { list, total } = await findSystemEvents(page, pageSize, { type, level });
    return reply.send(success({ list, total, page, pageSize }));
  });

  // POST /events - 手动创建系统事件
  server.post('/events', async (request, reply) => {
    const parsed = createEventBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const event = await createSystemEvent(parsed.data);
    return reply.status(201).send(success({ event }));
  });

  // PATCH /events/:id - 更新系统事件
  server.patch('/events/:id', async (request, reply) => {
    const paramParsed = eventIdParamSchema.safeParse(request.params);
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, paramParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const bodyParsed = updateEventBodySchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return reply.status(400).send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findSystemEventById(paramParsed.data.id);
    if (!existing) return reply.status(404).send(error(404, '事件不存在'));
    const event = await updateSystemEvent(paramParsed.data.id, bodyParsed.data);
    return reply.send(success({ event }));
  });

  // DELETE /events/:id - 删除系统事件
  server.delete('/events/:id', async (request, reply) => {
    const paramParsed = eventIdParamSchema.safeParse(request.params);
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, paramParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findSystemEventById(paramParsed.data.id);
    if (!existing) return reply.status(404).send(error(404, '事件不存在'));
    await deleteSystemEvent(paramParsed.data.id);
    return reply.send(success({ id: paramParsed.data.id, deleted: true }));
  });
};
