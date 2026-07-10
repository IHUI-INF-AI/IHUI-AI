import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { AsyncLocalStorage } from 'node:async_hooks';
import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';

// 租户上下文（AsyncLocalStorage 等价于 Python ContextVar）
interface TenantContext {
  tenantId: string | null;
  schema: string;
}

const tenantALS = new AsyncLocalStorage<TenantContext>();

// LRU 缓存：租户 ID → schema 名（避免重复查询）
const schemaCache = new Map<string, string>();
const MAX_CACHE_SIZE = 1000;

function getTenantSchema(tenantId: string): string {
  // 从缓存获取
  const cached = schemaCache.get(tenantId);
  if (cached) return cached;

  // 生成 schema 名（tenant_id 转换为合法 schema 名）
  const schema = `tenant_${tenantId.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 50)}`;

  // LRU 淘汰
  if (schemaCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = schemaCache.keys().next().value;
    if (oldestKey) schemaCache.delete(oldestKey);
  }
  schemaCache.set(tenantId, schema);
  return schema;
}

/** 在租户上下文中执行操作（自动设置 search_path） */
export async function withTenant<T>(
  tenantId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const schema = getTenantSchema(tenantId);
  return tenantALS.run({ tenantId, schema }, async () => {
    // 设置 search_path
    await db.execute(sql`SET LOCAL search_path TO ${sql.raw(schema)}, public`);
    try {
      return await fn();
    } finally {
      // 恢复 search_path
      await db.execute(sql`SET LOCAL search_path TO public`);
    }
  });
}

/** 获取当前租户上下文 */
export function getCurrentTenant(): TenantContext | undefined {
  return tenantALS.getStore();
}

const tenantDbIsolationPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  // onRequest: 从 header 获取 tenant_id，设置上下文
  server.addHook('onRequest', async (request: FastifyRequest) => {
    const tenantId = request.headers['x-tenant-id'] as string | undefined;
    if (tenantId) {
      request.tenantDbContext = { tenantId, schema: getTenantSchema(tenantId) };
    }
  });

  server.decorate('withTenant', withTenant);
  server.decorate('getCurrentTenant', getCurrentTenant);
};

export const tenantDbIsolation = fp(tenantDbIsolationPlugin, {
  name: 'tenant-db-isolation',
  fastify: '5.x',
});

declare module 'fastify' {
  interface FastifyInstance {
    withTenant: typeof withTenant;
    getCurrentTenant: typeof getCurrentTenant;
  }
  interface FastifyRequest {
    tenantDbContext?: TenantContext;
  }
}
