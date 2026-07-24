import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { sqlEventBus } from '../db/sql-event-bus.js';

const N1_QUERY_THRESHOLD = parseInt(process.env.N1_QUERY_THRESHOLD ?? '20', 10);

declare module 'fastify' {
  interface FastifyInstance {
    n1Detector: {
      /** 记录一次 SQL 查询（在 drizzle logger 中调用） */
      recordQuery(requestId: string): void;
      /** 获取当前请求的查询计数 */
      getQueryCount(requestId: string): number;
    };
  }
}

const requestQueryCounts = new Map<string, number>();

/**
 * N+1 查询检测插件。
 *
 * 通过订阅 sqlEventBus 自动统计每个请求的 SQL 查询次数,
 * 无需在各业务代码手动调用 recordQuery()。
 * requestId 由 api-logger-extended onRequest 经 ALS(enterContext)注入,
 * 订阅回调自动获取,无需手动传参。
 */
const n1DetectorPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  // 订阅 SQL 事件,自动 recordQuery(requestId 由 ALS 注入)
  const unsubscribe = sqlEventBus.on((event) => {
    if (event.requestId) {
      const current = requestQueryCounts.get(event.requestId) ?? 0;
      requestQueryCounts.set(event.requestId, current + 1);
    }
  });

  server.addHook('onRequest', async (request: FastifyRequest) => {
    // api-logger-extended 先注册,onRequest 已设置 request.requestId
    // 用 requestId ?? request.id 兜底,确保 key 与订阅回调一致
    requestQueryCounts.set(request.requestId ?? request.id, 0);
  });

  server.addHook('onResponse', async (request: FastifyRequest) => {
    const key = request.requestId ?? request.id;
    const count = requestQueryCounts.get(key) ?? 0;
    if (count > N1_QUERY_THRESHOLD) {
      server.log.warn(
        { requestId: key, method: request.method, url: request.url, queryCount: count },
        'potential N+1 query detected',
      );
    }
    requestQueryCounts.delete(key);
  });

  server.decorate('n1Detector', {
    recordQuery(requestId: string) {
      const current = requestQueryCounts.get(requestId) ?? 0;
      requestQueryCounts.set(requestId, current + 1);
    },
    getQueryCount(requestId: string) {
      return requestQueryCounts.get(requestId) ?? 0;
    },
  });

  server.addHook('onClose', async () => {
    requestQueryCounts.clear();
    unsubscribe();
  });
};

export const n1Detector = fp(n1DetectorPlugin, {
  name: 'n1-detector',
  fastify: '5.x',
});
