import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

/**
 * 请求指标收集插件。
 * 收集:请求计数、响应时间直方图、状态码分布。
 * 暴露 /metrics 端点(Prometheus 文本格式)。
 */
const metricsPluginInner: FastifyPluginAsync = async (server: FastifyInstance) => {
  const metrics = {
    requestsTotal: 0,
    requestsByMethod: new Map<string, number>(),
    requestsByRoute: new Map<string, number>(),
    requestsByStatus: new Map<number, number>(),
    responseTimeSum: 0,
    responseTimeCount: 0,
    responseTimeBuckets: {
      '<10ms': 0, '<50ms': 0, '<100ms': 0, '<500ms': 0, '<1s': 0, '<5s': 0, '>=5s': 0,
    },
    uptime: process.uptime(),
    startTime: Date.now(),
  };

  // 请求开始时记录
  server.addHook('onRequest', async () => {
    metrics.requestsTotal++;
  });

  // 响应结束时记录
  server.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const elapsed = reply.elapsedTime; // 毫秒
    metrics.responseTimeSum += elapsed;
    metrics.responseTimeCount++;

    // 方法统计
    const method = request.method;
    metrics.requestsByMethod.set(method, (metrics.requestsByMethod.get(method) ?? 0) + 1);

    // 路由统计(用 request.routeOptions?.url 或 request.url)
    const route = request.routeOptions?.url ?? request.url;
    metrics.requestsByRoute.set(route, (metrics.requestsByRoute.get(route) ?? 0) + 1);

    // 状态码统计
    const status = reply.statusCode;
    metrics.requestsByStatus.set(status, (metrics.requestsByStatus.get(status) ?? 0) + 1);

    // 响应时间桶
    if (elapsed < 10) metrics.responseTimeBuckets['<10ms']++;
    else if (elapsed < 50) metrics.responseTimeBuckets['<50ms']++;
    else if (elapsed < 100) metrics.responseTimeBuckets['<100ms']++;
    else if (elapsed < 500) metrics.responseTimeBuckets['<500ms']++;
    else if (elapsed < 1000) metrics.responseTimeBuckets['<1s']++;
    else if (elapsed < 5000) metrics.responseTimeBuckets['<5s']++;
    else metrics.responseTimeBuckets['>=5s']++;
  });

  // /metrics 端点(Prometheus 格式)
  server.get('/metrics', async (_request, reply) => {
    const lines: string[] = [];

    // 请求总数
    lines.push('# HELP http_requests_total Total HTTP requests');
    lines.push('# TYPE http_requests_total counter');
    lines.push(`http_requests_total ${metrics.requestsTotal}`);

    // 按方法
    lines.push('# HELP http_requests_by_method HTTP requests by method');
    lines.push('# TYPE http_requests_by_method counter');
    for (const [method, count] of metrics.requestsByMethod) {
      lines.push(`http_requests_by_method{method="${method}"} ${count}`);
    }

    // 按状态码
    lines.push('# HELP http_requests_by_status HTTP requests by status code');
    lines.push('# TYPE http_requests_by_status counter');
    for (const [status, count] of metrics.requestsByStatus) {
      lines.push(`http_requests_by_status{status="${status}"} ${count}`);
    }

    // 响应时间
    lines.push('# HELP http_response_time_ms Response time in milliseconds');
    lines.push('# TYPE http_response_time_ms summary');
    const avgTime = metrics.responseTimeCount > 0 ? metrics.responseTimeSum / metrics.responseTimeCount : 0;
    lines.push(`http_response_time_ms_sum ${metrics.responseTimeSum.toFixed(2)}`);
    lines.push(`http_response_time_ms_count ${metrics.responseTimeCount}`);
    lines.push(`http_response_time_ms_avg ${avgTime.toFixed(2)}`);

    // 响应时间桶
    lines.push('# HELP http_response_time_bucket Response time buckets');
    lines.push('# TYPE http_response_time_bucket histogram');
    for (const [bucket, count] of Object.entries(metrics.responseTimeBuckets)) {
      lines.push(`http_response_time_bucket{le="${bucket}"} ${count}`);
    }

    // 运行时间
    lines.push('# HELP process_uptime_seconds Process uptime in seconds');
    lines.push('# TYPE process_uptime_seconds gauge');
    lines.push(`process_uptime_seconds ${process.uptime().toFixed(2)}`);

    reply.type('text/plain').send(lines.join('\n'));
  });

  // 暴露 metrics 对象供健康检查使用
  server.decorate('metrics', metrics);
};

export const metricsPlugin = fp(metricsPluginInner, {
  name: 'metrics-plugin',
  fastify: '5.x',
});

// 类型声明
declare module 'fastify' {
  interface FastifyInstance {
    metrics: {
      requestsTotal: number;
      requestsByMethod: Map<string, number>;
      requestsByRoute: Map<string, number>;
      requestsByStatus: Map<number, number>;
      responseTimeSum: number;
      responseTimeCount: number;
      responseTimeBuckets: Record<string, number>;
      uptime: number;
      startTime: number;
    };
  }
}
