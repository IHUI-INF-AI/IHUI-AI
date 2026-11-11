// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 多租户分库路由插件（R74 P2）。
 *
 * 与 tenant-db-isolation.ts 的 schema 隔离互补：
 * - tenant-db-isolation.ts：per-tenant schema（同一 PG 实例，search_path 隔离）
 * - tenant-db.ts：per-tenant DATABASE_URL（物理分库，独立 PG 实例）
 *
 * 工作流：
 * 1. onRequest：只读 request.tenantId（tenant.ts 校验存在性与状态后写入的租户主键）
 * 2. 调用 getTenantDatabase(tenantId) 获取租户专用或默认 Database
 * 3. 挂载到 request.tenantDB，供路由层使用
 *
 * 关键约束：
 * - 不读 x-tenant-id。未校验的头不得把查询导向任意租户库
 * - 未指定 tenantId 时使用默认 DATABASE_URL
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

const tenantDbPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  // 注入默认 Database（复用 apps/api/src/db 的现有连接池，避免重复创建）
  setDefaultDatabase(db)

  // onRequest：只挂载已校验的 tenantId。裸 header 不得在 tenantId 缺失时退化成租户库路由。
  server.addHook('onRequest', async (request: FastifyRequest) => {
    const tenantId = request.tenantId

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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
