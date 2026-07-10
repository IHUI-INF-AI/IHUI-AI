import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { trace, type Tracer, type Span, SpanStatusCode, type Attributes } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

/**
 * OpenTelemetry 分布式追踪插件。
 *
 * - 自动 instrument：Fastify / HTTP / ioredis(Redis) / pg(PostgreSQL) 等，
 *   由 @opentelemetry/auto-instrumentations-node 提供（getNodeAutoInstrumentations）。
 * - 通过 OTLP/HTTP 导出到 otel-collector（默认 http://otel-collector:4318/v1/traces）。
 * - 用 @opentelemetry/api 的全局 tracer 装饰 server.otel.tracer，供业务代码创建子 span。
 * - onRequest 将 userId 注入当前活跃 span 属性，实现用户级追踪串联。
 *
 * 配置（环境变量）：
 * - OTEL_ENABLED=true 启用（默认关闭，避免无 collector 时报错）
 * - OTEL_EXPORTER_OTLP_ENDPOINT OTLP 端点（默认 http://otel-collector:4318）
 * - OTEL_SERVICE_NAME 服务名（默认 ihui-api）
 *
 * 注：自动 instrument 在模块加载后 patch 仍生效（包裹已加载模块的导出）；
 * 如需对启动期代码也追踪，可在 index.ts 顶部 buildServer 之前调用 initOtel()。
 */

interface OtelDecorators {
  tracer: Tracer;
  sdk: NodeSDK | null;
}

let startedSdk: NodeSDK | null = null;

/** 初始化并启动 OTel SDK（幂等）。供 index.ts 提前调用或由插件内部调用。 */
export function initOtel(): NodeSDK | null {
  if (startedSdk) return startedSdk;
  if (process.env.OTEL_ENABLED !== 'true') return null;

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://otel-collector:4318';
  const serviceName = process.env.OTEL_SERVICE_NAME ?? 'ihui-api';

  const traceExporter = new OTLPTraceExporter({ url: `${endpoint}/v1/traces` });

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: '1.0.0',
    }),
    traceExporter,
    // 自动 instrument：http / fastify / ioredis / pg / dns / net / fs 等
    instrumentations: getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false }, // fs 噪声过大
    }),
  });

  sdk.start();
  startedSdk = sdk;
  return sdk;
}

const otelPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  const sdk = initOtel();
  const tracer = trace.getTracer('ihui-api');

  // 将 userId 注入当前活跃 span，实现用户级追踪串联
  server.addHook('onRequest', async (request: FastifyRequest) => {
    const span = trace.getActiveSpan();
    if (!span) return;
    const attrs: Attributes = {
      'http.request.method': request.method,
      'http.route': request.url.split('?')[0] ?? request.url,
    };
    const userId = request.userId ?? request.jwtPayload?.userId;
    if (userId) attrs['enduser.id'] = userId;
    span.setAttributes(attrs);
  });

  // 请求出错时标记 span 状态
  server.addHook('onError', async (request: FastifyRequest, _error) => {
    const span = trace.getActiveSpan();
    if (span) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: request.routeOptions?.url ?? request.url });
    }
  });

  // 进程退出时优雅关闭 SDK，确保 span flush
  server.addHook('onClose', async () => {
    if (startedSdk) {
      await startedSdk.shutdown().catch(() => {});
      startedSdk = null;
    }
  });

  server.decorate('otel', { tracer, sdk } satisfies OtelDecorators);
};

export default fp(otelPlugin, {
  name: 'otel-plugin',
  fastify: '5.x',
});

declare module 'fastify' {
  interface FastifyInstance {
    /** OpenTelemetry 装饰器：tracer 供业务代码创建子 span，sdk 可用于手动 shutdown。 */
    otel: OtelDecorators;
  }
}

export type { Span };
