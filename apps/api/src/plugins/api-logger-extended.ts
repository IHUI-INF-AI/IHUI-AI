import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { randomUUID } from 'node:crypto';
import { sanitizeData, buildSensitiveKeySet } from './response-sanitizer.js';

/**
 * ELK 结构化日志管线插件（扩展版）。
 *
 * 与 api-logger.ts（落库 api_logs）互补：本插件面向 ELK 采集的 stdout 结构化 JSON：
 * - 请求 ID 追踪：从 X-Request-Id 头透传，缺失则生成 UUID，回写响应头供下游串联
 * - 结构化字段：requestId / method / path / status / duration / userId / ip / apiVersion
 * - 敏感字段脱敏：复用 response-sanitizer 规则，对可选的请求体快照做脱敏后输出
 * - 4xx/5xx 全量记录，2xx 按 ELK_LOG_SAMPLE_RATE 采样（默认 10%）
 *
 * 配置：ELK_LOG_ENABLED=true 启用，ELK_LOG_SAMPLE_RATE 采样率（0~1，默认 0.1）
 */

const REQUEST_ID_HEADER = 'x-request-id';

const apiLoggerExtendedPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  const enabled = process.env.ELK_LOG_ENABLED === 'true';
  if (!enabled) return;

  const sampleRate = Number(process.env.ELK_LOG_SAMPLE_RATE ?? '0.1');
  const sensitiveKeys = buildSensitiveKeySet();

  // 注入/透传请求 ID
  server.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const incoming = request.headers[REQUEST_ID_HEADER];
    const id = typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();
    request.requestId = id;
    reply.header('X-Request-Id', id);
  });

  // 响应结束时输出结构化日志
  server.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const url = request.url.split('?')[0] ?? '';
    if (url === '/api/health' || url === '/api/metrics' || url === '/api/business-metrics') return;

    const status = reply.statusCode;
    // 2xx 采样，4xx/5xx 全量
    if (status < 400 && Math.random() > sampleRate) return;

    const userId = request.userId ?? request.jwtPayload?.userId;
    const payload = {
      msg: 'api_request',
      requestId: request.requestId,
      method: request.method,
      path: url.slice(0, 512),
      status,
      durationMs: Math.round(reply.elapsedTime),
      userId: userId ?? null,
      ip: request.ip,
      apiVersion: request.apiVersion ?? null,
      userAgent: request.headers['user-agent']?.slice(0, 256),
    };

    if (status >= 500) {
      request.log.error(sanitizeData(payload, sensitiveKeys), 'api_request_error');
    } else if (status >= 400) {
      request.log.warn(sanitizeData(payload, sensitiveKeys), 'api_request_warn');
    } else {
      request.log.info(sanitizeData(payload, sensitiveKeys), 'api_request');
    }
  });
};

export default fp(apiLoggerExtendedPlugin, {
  name: 'api-logger-extended-plugin',
  fastify: '5.x',
});

declare module 'fastify' {
  interface FastifyRequest {
    /** 请求 ID，用于跨服务/ELK 日志串联。 */
    requestId?: string;
  }
}
