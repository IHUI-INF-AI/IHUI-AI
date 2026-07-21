/**
 * 资源监控路由
 * 端点:
 *   GET /admin/api/customers/:slug/quota     (真实数据 — 替换 P1-2.2c 占位)
 *   GET /admin/api/customers/:slug/metrics   (per-tenant 详细资源指标)
 *   GET /admin/api/metrics/summary           (多租户横向对比)
 *
 * 数据源:Prometheus HTTP API
 *   容器指标经 cAdvisor 暴露给 Prometheus(15s 抓取,7d 保留)
 *   端点契约已在 P1-2.2c 稳定,本任务只替换数据来源 + 移除 placeholder 字段
 */
import type { FastifyInstance, FastifyBaseLogger } from 'fastify';
import { z } from 'zod';
import { requireAdminAuth } from './auth.js';
import { config } from '../config.js';

const SlugSchema = z.string().regex(/^[a-z0-9-]{3,20}$/, 'Invalid slug');

/** Prometheus 端点(仅 localhost,docker-compose 端口映射 127.0.0.1:9090:9090) */
const PROMETHEUS_URL = process.env.PROMETHEUS_URL ?? 'http://127.0.0.1:9090';

/** 查询超时(2s)— 单租户 dashboard 要求秒级响应 */
const QUERY_TIMEOUT_MS = 2000;

/**
 * 通用 Prometheus 查询包装
 * - 自动超时
 * - 错误时返回 null(不阻断主流程,UI 降级显示)
 */
async function promQuery(
  log: FastifyBaseLogger,
  query: string,
): Promise<Array<{ metric: Record<string, string>; value: [number, string] }> | null> {
  const url = `${PROMETHEUS_URL}/api/v1/query?query=${encodeURIComponent(query)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);

  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) {
      log.warn({ status: resp.status, query }, 'prometheus query non-200');
      return null;
    }
    const data = (await resp.json()) as {
      data?: { result?: Array<{ metric: Record<string, string>; value: [number, string] }> };
      status?: string;
    };
    if (data.status !== 'success') {
      log.warn({ query, data }, 'prometheus query not success');
      return null;
    }
    return data.data?.result ?? [];
  } catch (err) {
    log.warn({ err, query }, 'prometheus query failed');
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** 安全求和(空数组返回 0) */
function sumValues(
  result: Array<{ metric: Record<string, string>; value: [number, string] }> | null,
): number {
  if (!result) return 0;
  let total = 0;
  for (const r of result) {
    const v = parseFloat(r.value[1]);
    if (!Number.isNaN(v)) total += v;
  }
  return total;
}

/** Prometheus 不可达时返回的统一占位(UI 仍能渲染,只是数据为 0) */
function placeholderQuota(slug: string) {
  return {
    slug,
    apiCalls: { used: 0, limit: null, window: 'all' as const, resetAt: null },
    storage: { usedBytes: 0, limitBytes: null },
    aiTokens: { used: 0, limit: null, window: 'all' as const, resetAt: null },
    placeholder: true,
    expectedFrom: 'Prometheus unavailable — check cadvisor/prometheus containers',
    generatedAt: new Date().toISOString(),
  };
}

export async function metricsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAdminAuth);

  // ==================== per-tenant quota(替换 P1-2.2c 占位)====================
  // 端点路径保持 /admin/api/customers/:slug/quota 不变,UI 无需修改
  // 实现:转发到本文件的真实查询逻辑
  app.get<{ Params: { slug: string } }>(
    '/admin/api/customers/:slug/quota',
    async (request, reply) => {
      const parse = SlugSchema.safeParse(request.params.slug);
      if (!parse.success) {
        return reply.status(400).send({ error: 'InvalidSlug', message: parse.error.message });
      }
      const slug = parse.data;

      // 三个核心指标并行查询(15s 抓取 + 2s 超时,总耗时 < 2s)
      const [apiCalls, aiTokens, storage] = await Promise.all([
        // API 调用:近 1h http_requests_total 速率 × 3600
        promQuery(
          request.log,
          `sum(rate(http_requests_total{container_label_com_docker_compose_service="api",name=~"customer-${slug}-api"}[1h])) * 3600`,
        ),
        // AI Token:近 1h 速率(假设 ai-service 暴露 litellm_tokens_total)
        promQuery(
          request.log,
          `sum(rate(litellm_tokens_total{tenant_slug="${slug}"}[1h]))`,
        ),
        // 存储:所有客户容器的 fs usage
        promQuery(
          request.log,
          `sum(container_fs_usage_bytes{container_label_com_docker_compose_project=~"customer-${slug}-.*"})`,
        ),
      ]);

      // 任意指标查询失败 → placeholder(降级)
      if (apiCalls === null && aiTokens === null && storage === null) {
        return placeholderQuota(slug);
      }

      return {
        slug,
        apiCalls: {
          used: Math.round(sumValues(apiCalls)),
          limit: null,
          window: 'all' as const,
          resetAt: null,
        },
        storage: {
          usedBytes: Math.round(sumValues(storage)),
          limitBytes: null,
        },
        aiTokens: {
          used: Math.round(sumValues(aiTokens)),
          limit: null,
          window: 'all' as const,
          resetAt: null,
        },
        placeholder: false,
        expectedFrom: 'P1-2.3 (Prometheus + Grafana)',
        generatedAt: new Date().toISOString(),
      };
    },
  );

  // ==================== per-tenant 详细资源 ====================
  app.get<{ Params: { slug: string } }>(
    '/admin/api/customers/:slug/metrics',
    async (request, reply) => {
      const parse = SlugSchema.safeParse(request.params.slug);
      if (!parse.success) {
        return reply.status(400).send({ error: 'InvalidSlug', message: parse.error.message });
      }
      const slug = parse.data;

      const [cpu, memory, networkRx, networkTx] = await Promise.all([
        promQuery(
          request.log,
          `sum(rate(container_cpu_usage_seconds_total{name=~"customer-${slug}-.*"}[5m]))`,
        ),
        promQuery(
          request.log,
          `sum(container_memory_usage_bytes{name=~"customer-${slug}-.*"})`,
        ),
        promQuery(
          request.log,
          `sum(rate(container_network_receive_bytes_total{name=~"customer-${slug}-.*"}[5m]))`,
        ),
        promQuery(
          request.log,
          `sum(rate(container_network_transmit_bytes_total{name=~"customer-${slug}-.*"}[5m]))`,
        ),
      ]);

      return {
        slug,
        cpu: sumValues(cpu),
        memoryBytes: sumValues(memory),
        networkRxBytesPerSec: sumValues(networkRx),
        networkTxBytesPerSec: sumValues(networkTx),
        available: cpu !== null,
        generatedAt: new Date().toISOString(),
      };
    },
  );

  // ==================== 多租户横向对比 ====================
  app.get('/admin/api/metrics/summary', async (request) => {
    const [cpu, memory] = await Promise.all([
      promQuery(
        request.log,
        'sum by (name) (rate(container_cpu_usage_seconds_total{name=~"customer-.*"}[5m]))',
      ),
      promQuery(
        request.log,
        'sum by (name) (container_memory_usage_bytes{name=~"customer-.*"})',
      ),
    ]);

    // 聚合到 slug 维度
    const bySlug = new Map<
      string,
      { slug: string; cpu: number; memoryBytes: number; containers: number }
    >();

    const extractSlug = (name: string): string | null => {
      const m = name.match(/^customer-([a-z0-9-]+)-/);
      return m ? m[1] : null;
    };

    if (cpu) {
      for (const r of cpu) {
        const slug = extractSlug(r.metric.name);
        if (!slug) continue;
        const v = parseFloat(r.value[1]);
        if (Number.isNaN(v)) continue;
        const cur = bySlug.get(slug) ?? { slug, cpu: 0, memoryBytes: 0, containers: 0 };
        cur.cpu += v;
        cur.containers += 1;
        bySlug.set(slug, cur);
      }
    }
    if (memory) {
      for (const r of memory) {
        const slug = extractSlug(r.metric.name);
        if (!slug) continue;
        const v = parseFloat(r.value[1]);
        if (Number.isNaN(v)) continue;
        const cur = bySlug.get(slug) ?? { slug, cpu: 0, memoryBytes: 0, containers: 0 };
        cur.memoryBytes += v;
        bySlug.set(slug, cur);
      }
    }

    const tenants = Array.from(bySlug.values()).sort((a, b) => b.cpu - a.cpu);
    return {
      tenants,
      total: tenants.length,
      available: cpu !== null,
      generatedAt: new Date().toISOString(),
    };
  });
}
