import type { FastifyInstance, FastifyPluginAsync, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

/**
 * 业务漏斗与自定义业务指标插件。
 *
 * 指标（Prometheus 文本格式，暴露于 /business-metrics）：
 * 1. 转化漏斗（counter）：注册 → 激活 → 付费
 *    - business_funnel_total{stage="register|activate|paid",channel}
 * 2. API 调用成功率与延迟（histogram，Grafana 用 histogram_quantile 算分位数）：
 *    - business_api_call_duration_ms_bucket{route,status,le}
 *    - business_api_call_total{route,status}
 * 3. 自定义业务指标：
 *    - business_orders_total{type,status}
 *    - business_payments_total{channel,status}
 *    - business_ai_calls_total{vendor,model}
 *    - business_ai_tokens_total{vendor,type="prompt|completion"}
 *    - business_ai_cost_usd_total{vendor}
 *
 * 路由通过 server.recordFunnel / recordApiCall / recordOrder / recordPayment / recordAiCall 上报。
 */

type FunnelStage = 'register' | 'activate' | 'paid';

interface BusinessMetrics {
  funnel: Map<string, number>; // key: stage|channel
  apiCallTotal: Map<string, number>; // key: route|status
  apiDurationBuckets: Map<string, number>; // key: route|status|le
  apiDurationSum: Map<string, number>;
  apiDurationCount: Map<string, number>;
  orders: Map<string, number>; // key: type|status
  payments: Map<string, number>; // key: channel|status
  aiCalls: Map<string, number>; // key: vendor|model
  aiTokens: Map<string, number>; // key: vendor|type
  aiCost: Map<string, number>; // key: vendor
}

const LATENCY_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000] as const;

function counterInc(map: Map<string, number>, key: string, by = 1): void {
  map.set(key, (map.get(key) ?? 0) + by);
}

function observeHistogram(
  metrics: BusinessMetrics,
  baseKey: string,
  valueMs: number,
): void {
  counterInc(metrics.apiDurationCount, baseKey);
  metrics.apiDurationSum.set(baseKey, (metrics.apiDurationSum.get(baseKey) ?? 0) + valueMs);
  for (const le of LATENCY_BUCKETS) {
    if (valueMs <= le) {
      counterInc(metrics.apiDurationBuckets, `${baseKey}|le=${le}`);
    }
  }
  counterInc(metrics.apiDurationBuckets, `${baseKey}|le=+Inf`);
}

const businessMetricsPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  const m: BusinessMetrics = {
    funnel: new Map(),
    apiCallTotal: new Map(),
    apiDurationBuckets: new Map(),
    apiDurationSum: new Map(),
    apiDurationCount: new Map(),
    orders: new Map(),
    payments: new Map(),
    aiCalls: new Map(),
    aiTokens: new Map(),
    aiCost: new Map(),
  };

  // 自动采集 API 调用成功率与延迟（按路由+状态码）
  server.addHook('onResponse', async (request, reply: FastifyReply) => {
    const url = request.url.split('?')[0] ?? '';
    if (!url.startsWith('/api/')) return;
    if (url === '/api/health' || url === '/api/metrics' || url === '/api/business-metrics') return;
    const route = request.routeOptions?.url ?? url;
    const key = `${route}|${reply.statusCode}`;
    counterInc(m.apiCallTotal, key);
    observeHistogram(m, key, Math.round(reply.elapsedTime));
  });

  // 业务上报装饰器
  server.decorate('recordFunnel', (stage: FunnelStage, channel = 'default') => {
    counterInc(m.funnel, `${stage}|${channel}`);
  });
  server.decorate('recordOrder', (type: string, status: string) => {
    counterInc(m.orders, `${type}|${status}`);
  });
  server.decorate('recordPayment', (channel: string, status: string) => {
    counterInc(m.payments, `${channel}|${status}`);
  });
  server.decorate('recordAiCall', (vendor: string, model: string, tokens: number, costUsd: number) => {
    counterInc(m.aiCalls, `${vendor}|${model}`);
    counterInc(m.aiTokens, `${vendor}|prompt`, tokens);
    m.aiCost.set(vendor, (m.aiCost.get(vendor) ?? 0) + costUsd);
  });

  server.get('/business-metrics', async (_request, reply: FastifyReply) => {
    const lines: string[] = [];

    // 1. 漏斗
    lines.push('# HELP business_funnel_total Business conversion funnel counter');
    lines.push('# TYPE business_funnel_total counter');
    for (const [k, v] of m.funnel) {
      const [stage, channel] = k.split('|');
      lines.push(`business_funnel_total{stage="${stage}",channel="${channel}"} ${v}`);
    }

    // 2. API 调用成功率
    lines.push('# HELP business_api_call_total Business API calls by route and status');
    lines.push('# TYPE business_api_call_total counter');
    for (const [k, v] of m.apiCallTotal) {
      const [route, status] = k.split('|');
      lines.push(`business_api_call_total{route="${route}",status="${status}"} ${v}`);
    }

    // API 延迟直方图
    lines.push('# HELP business_api_call_duration_ms Business API call latency in ms');
    lines.push('# TYPE business_api_call_duration_ms histogram');
    for (const [k, v] of m.apiDurationBuckets) {
      const [base, le] = k.split('|le=');
      const [route, status] = (base ?? '').split('|');
      lines.push(`business_api_call_duration_ms_bucket{route="${route}",status="${status}",le="${le}"} ${v}`);
    }
    for (const [k, v] of m.apiDurationSum) {
      const [route, status] = k.split('|');
      lines.push(`business_api_call_duration_ms_sum{route="${route}",status="${status}"} ${v.toFixed(2)}`);
    }
    for (const [k, v] of m.apiDurationCount) {
      const [route, status] = k.split('|');
      lines.push(`business_api_call_duration_ms_count{route="${route}",status="${status}"} ${v}`);
    }

    // 3. 自定义业务指标
    lines.push('# HELP business_orders_total Business orders counter');
    lines.push('# TYPE business_orders_total counter');
    for (const [k, v] of m.orders) {
      const [type, status] = k.split('|');
      lines.push(`business_orders_total{type="${type}",status="${status}"} ${v}`);
    }

    lines.push('# HELP business_payments_total Business payments counter');
    lines.push('# TYPE business_payments_total counter');
    for (const [k, v] of m.payments) {
      const [channel, status] = k.split('|');
      lines.push(`business_payments_total{channel="${channel}",status="${status}"} ${v}`);
    }

    lines.push('# HELP business_ai_calls_total AI model invocation counter');
    lines.push('# TYPE business_ai_calls_total counter');
    for (const [k, v] of m.aiCalls) {
      const [vendor, model] = k.split('|');
      lines.push(`business_ai_calls_total{vendor="${vendor}",model="${model}"} ${v}`);
    }

    lines.push('# HELP business_ai_tokens_total AI token consumption counter');
    lines.push('# TYPE business_ai_tokens_total counter');
    for (const [k, v] of m.aiTokens) {
      const [vendor, type] = k.split('|');
      lines.push(`business_ai_tokens_total{vendor="${vendor}",type="${type}"} ${v}`);
    }

    lines.push('# HELP business_ai_cost_usd_total AI cost in USD counter');
    lines.push('# TYPE business_ai_cost_usd_total counter');
    for (const [vendor, v] of m.aiCost) {
      lines.push(`business_ai_cost_usd_total{vendor="${vendor}"} ${v.toFixed(6)}`);
    }

    reply.type('text/plain').send(lines.join('\n'));
  });
};

export default fp(businessMetricsPlugin, {
  name: 'business-metrics-plugin',
  fastify: '5.x',
});

declare module 'fastify' {
  interface FastifyInstance {
    /** 上报转化漏斗事件（register → activate → paid）。 */
    recordFunnel: (stage: FunnelStage, channel?: string) => void;
    /** 上报订单事件。 */
    recordOrder: (type: string, status: string) => void;
    /** 上报支付事件。 */
    recordPayment: (channel: string, status: string) => void;
    /** 上报 AI 调用事件（含 token 与成本）。 */
    recordAiCall: (vendor: string, model: string, tokens: number, costUsd: number) => void;
  }
}
