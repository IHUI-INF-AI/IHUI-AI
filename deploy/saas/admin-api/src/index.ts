/**
 * IHUI-AI SaaS Admin API
 *
 * 端口: 8081(仅 localhost,不暴露公网)
 * 鉴权: X-Admin-API-Key + X-Admin-User(白名单)
 * 审计: 所有管理操作写入 JSON Lines 到 admin-api-audit.log(P1-2.2)
 * 端点: 见 ./routes/customers.ts + ./routes/auth.ts + ./routes/certificates.ts
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { appendFile } from 'node:fs/promises';
import { z } from 'zod';
import { config, AUDIT_LOG_PATH } from './config.js';
import { authRoutes } from './routes/auth.js';
import { customerRoutes } from './routes/customers.js';
import { certificateRoutes } from './routes/certificates.js';

const app = Fastify({
  logger: {
    level: config.LOG_LEVEL,
    transport: config.NODE_ENV === 'development' ? {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss.l' },
    } : undefined,
  },
  // 不暴露给公网:仅 localhost 监听
  // (docker compose 端口映射到 127.0.0.1:8081:8081)
});

// CORS(仅允许本地管理 UI)
await app.register(cors, {
  origin: config.CORS_ORIGIN,
  credentials: true,
});

// 健康检查(免鉴权)
app.get('/admin/api/health', async () => ({
  status: 'ok',
  service: 'ihui-saas-admin-api',
  version: '1.0.0',
  uptime: process.uptime(),
}));

// P1-2.2: 审计日志 hook — 记录所有管理操作到 JSON Lines
app.addHook('onResponse', async (request, reply) => {
  // 跳过健康检查(高频 + 无鉴权)
  if (request.url === '/admin/api/health') return;
  if (!config.ENABLE_AUDIT_LOG) return;

  const line =
    JSON.stringify({
      ts: new Date().toISOString(),
      method: request.method,
      url: request.url,
      status: reply.statusCode,
      durationMs: reply.elapsedTime?.toFixed(1) ?? '0',
      adminUser: (request as { adminUser?: string }).adminUser ?? null,
      remoteIp: request.ip,
    }) + '\n';

  // 审计失败不能阻断主请求
  try {
    await appendFile(AUDIT_LOG_PATH, line, 'utf8');
  } catch (err) {
    request.log.warn({ err }, 'audit log write failed');
  }
});

// 鉴权路由(/admin/api/auth/*)
await app.register(authRoutes);

// 客户管理路由(/admin/api/customers/*)— 全部需要 X-Admin-API-Key
await app.register(customerRoutes);

// 证书管理路由(/admin/api/certificates/*)— P1-2.2c 扫描 Traefik acme.json
await app.register(certificateRoutes);

// 错误处理
app.setErrorHandler((error, request, reply) => {
  const err = error as Error & { statusCode?: number; validation?: unknown };
  request.log.error({ err }, 'Request error');
  if (err.validation) {
    return reply.status(400).send({
      error: 'ValidationError',
      message: err.message,
      details: err.validation,
    });
  }
  return reply.status(err.statusCode ?? 500).send({
    error: err.name ?? 'InternalError',
    message: err.message,
  });
});

// 启动
try {
  const address = await app.listen({
    host: config.HOST,
    port: config.PORT,
  });
  app.log.info(`🛡️  IHUI-AI SaaS Admin API listening at ${address}`);
  app.log.info(`   Local: http://${config.HOST}:${config.PORT}/admin/api/health`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
