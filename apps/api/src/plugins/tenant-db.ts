/**
 * 多租户分库路由插件（R74 P2）。
 *
 * 与 tenant-db-isolation.ts 的 schema 隔离互补：
 * - tenant-db-isolation.ts：per-tenant schema（同一 PG 实例，search_path 隔离）
 * - tenant-db.ts：per-tenant DATABASE_URL（物理分库，独立 PG 实例）
 *
 * 工作流：
 * 1. onRequest：从 request.tenantId（由 tenant.ts 解析）或 X-Tenant-ID header 提取租户 ID
 * 2. 调用 getTenantDatabase(tenantId) 获取租户专用或默认 Database
 * 3. 挂载到 request.tenantDB，供路由层使用
 *
 * 关键约束：
 * - 不破坏现有单租户行为：未指定 tenantId 时使用默认 DATABASE_URL
 * - 连接池懒加载：不启动时连接所有租户库
 * - 租户数据库不可达时降级到默认库（由 tenant-router.ts 处理）
 *
 * 路由使用示例：
 *   const db = request.tenantDB ?? server.db  // 优先租户库，fallback 主库
 *   await db.select().from(users)
 */
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import type { Database } from '@ihui/database'
import { getTenantDatabase, setDefaultDatabase } from '@ihui/database'
import { db } from '../db/index.js'
import { normalizeHeaderStrict } from '../utils/http-normalize.js'

const tenantDbPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  // 注入默认 Database（复用 apps/api/src/db 的现有连接池，避免重复创建）
  setDefaultDatabase(db)

  // onRequest：提取 tenantId，挂载 request.tenantDB
  server.addHook('onRequest', async (request: FastifyRequest) => {
    // 优先使用 tenant.ts 插件解析的 request.tenantId
    let tenantId = request.tenantId
    // 兼容：未解析时从 header 提取（如内部服务调用未走 tenant.ts 缓存）
    if (!tenantId) {
      tenantId = normalizeHeaderStrict(request.headers['x-tenant-id']) ?? undefined
    }

    try {
      request.tenantDB = getTenantDatabase(tenantId)
    } catch (err) {
      // 降级到默认库（setDefaultDatabase 未调用等极端情况）
      server.log.warn({ err, tenantId }, '[tenant-db] 获取租户数据库失败，降级到默认库')
      request.tenantDB = db
    }
  })

  // onClose：关闭所有租户专用连接池（默认库由 apps/api 管理，不关闭）
  server.addHook('onClose', async () => {
    const { closeAllTenantDatabases } = await import('@ihui/database')
    await closeAllTenantDatabases()
  })
}

export default fp(tenantDbPlugin, {
  name: 'tenant-db-plugin',
  fastify: '5.x',
})

declare module 'fastify' {
  interface FastifyRequest {
    /** 租户专用 Database（未配置租户库时为默认 DATABASE_URL 的连接）。 */
    tenantDB?: Database
  }
}
