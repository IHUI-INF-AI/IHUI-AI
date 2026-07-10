import type { FastifyBaseLogger, FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import {
  buildSensitiveKeySet,
  sanitizeData,
  type SanitizerOptions,
} from './response-sanitizer.js';

const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;
type LogLevel = (typeof LOG_LEVELS)[number];

/**
 * 日志脱敏插件：包装 pino logger，自动脱敏日志中的敏感字段。
 * 与 response-sanitizer 共用脱敏规则。
 *
 * 实现方式：onRequest 阶段用 Proxy 包装 request.log，对各级别方法的入参
 * （mergeObject / message）做递归脱敏后再委托给原 logger 输出。
 */
function wrapLogger(log: FastifyBaseLogger, keys: Set<string>): FastifyBaseLogger {
  return new Proxy(log, {
    get(target, prop, _receiver) {
      if (typeof prop === 'string' && (LOG_LEVELS as readonly string[]).includes(prop)) {
        const level = prop as LogLevel;
        // 转为可变参函数，规避 pino/Fastify logger 复杂重载签名
        const original = (target[level] as (...args: unknown[]) => void).bind(target);
        return (...args: unknown[]) => {
          const masked = args.map((a) => sanitizeData(a, keys));
          return original(...masked);
        };
      }
      if (prop === 'child') {
        const childFn = target.child.bind(target) as (
          ...args: Parameters<FastifyBaseLogger['child']>
        ) => FastifyBaseLogger;
        return (...args: Parameters<FastifyBaseLogger['child']>) =>
          wrapLogger(childFn(...args), keys);
      }
      const val = Reflect.get(target, prop);
      return typeof val === 'function' ? val.bind(target) : val;
    },
  }) as FastifyBaseLogger;
}

const logSanitizerPlugin: FastifyPluginAsync<SanitizerOptions> = async (
  server: FastifyInstance,
  opts: SanitizerOptions,
) => {
  const keys = buildSensitiveKeySet(opts.extraKeys);

  server.addHook('onRequest', async (request: FastifyRequest) => {
    request.log = wrapLogger(request.log, keys);
  });
};

export default fp(logSanitizerPlugin, {
  name: 'log-sanitizer-plugin',
  fastify: '5.x',
});
