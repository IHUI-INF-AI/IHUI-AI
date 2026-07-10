import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

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

const n1DetectorPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  server.addHook('onRequest', async (request: FastifyRequest) => {
    requestQueryCounts.set(request.id, 0);
  });

  server.addHook('onResponse', async (request: FastifyRequest) => {
    const count = requestQueryCounts.get(request.id) ?? 0;
    if (count > N1_QUERY_THRESHOLD) {
      server.log.warn(
        { requestId: request.id, method: request.method, url: request.url, queryCount: count },
        'potential N+1 query detected',
      );
    }
    requestQueryCounts.delete(request.id);
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
  });
};

export const n1Detector = fp(n1DetectorPlugin, {
  name: 'n1-detector',
  fastify: '5.x',
});
