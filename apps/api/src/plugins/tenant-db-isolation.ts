// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import { AsyncLocalStorage } from 'node:async_hooks'
import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'

// 租户上下文（AsyncLocalStorage 等价于 Python ContextVar）
interface TenantContext {
  tenantId: string | null
  schema: string
}

const tenantALS = new AsyncLocalStorage<TenantContext>()

// LRU 缓存：租户 ID → schema 名（避免重复查询）
const schemaCache = new Map<string, string>()
const MAX_CACHE_SIZE = 1000

// 合法 schema 名正则（小写字母/下划线开头，后跟小写字母/数字/下划线）
const SCHEMA_NAME_RE = /^[a-z_][a-z0-9_]*$/

// 合法租户标识：仅小写字母/数字/连字符（UUID 与 slug 子集）。
// 旧实现用 `.replace(/[^a-zA-Z0-9_]/g,'_').toLowerCase()` 把 `a-b` 与 `a_b` 归一成同一个
// schema；新口径把连字符单射映射为下划线，因此下划线/大写/点/冒号一律拒绝（fail-closed 400）。
// UUID 例外：大小写不敏感地把 16 进制部分统一为小写，同一租户的不同大小写写法仍映射同一 schema。
// 长度上限 56：`tenant_` 前缀 7 + 56 = 63，正好是 PostgreSQL identifier 上限。
const TENANT_ID_RE = /^[a-z0-9-]{1,56}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function getTenantSchema(tenantId: string): string {
  // 从缓存获取
  const cached = schemaCache.get(tenantId)
  if (cached) return cached

  const canonical = UUID_RE.test(tenantId) ? tenantId.toLowerCase() : tenantId
  if (!TENANT_ID_RE.test(canonical)) {
    const err = new Error(`Invalid tenant id: ${tenantId}`) as Error & { statusCode: number }
    err.statusCode = 400
    throw err
  }

  // 连字符 → 下划线；下划线在入参中已被拒绝，映射因此无碰撞。
  const schema = `tenant_${canonical.replace(/-/g, '_')}`
  // 防御性校验：最终 schema 必须匹配合法 identifier 正则，否则拒绝（防止 sql.raw(schema) 注入）
  if (!SCHEMA_NAME_RE.test(schema)) {
    const err = new Error(`Invalid tenant schema: ${schema}`) as Error & { statusCode: number }
    err.statusCode = 400
    throw err
  }

  // LRU 淘汰
  if (schemaCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = schemaCache.keys().next().value
    if (oldestKey) schemaCache.delete(oldestKey)
  }
  schemaCache.set(tenantId, schema)
  return schema
}

/** 租户事务句柄：SET LOCAL 与业务查询必须共用同一条连接。 */
type TenantTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** 在租户事务中执行操作（事务内设置 search_path） */
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: TenantTx) => Promise<T>,
): Promise<T> {
  const schema = getTenantSchema(tenantId)
  return tenantALS.run({ tenantId, schema }, () =>
    db.transaction(async (tx) => {
      // SET LOCAL 只在事务内生效（事务外只发 warning）。必须在**同一事务句柄**上设置，
      // 业务回调也必须用该 tx：否则查询会落到池里的另一条连接，search_path 仍是默认值。
      await tx.execute(sql`SET LOCAL search_path TO ${sql.raw(schema)}, public`)
      return fn(tx)
    }),
  )
}

/** 获取当前租户上下文 */
export function getCurrentTenant(): TenantContext | undefined {
  return tenantALS.getStore()
}

const tenantDbIsolationPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  // 只承接 tenant.ts 已校验的 request.tenantId。不读 x-tenant-id，也不在这里发 SET LOCAL：
  // 请求生命周期不在事务里，事务外的 SET LOCAL 不生效，会把「已经隔离」变成空操作。
  // search_path 只允许 withTenant 在同一事务句柄上设置。
  server.addHook('onRequest', async (request: FastifyRequest) => {
    const tenantId = request.tenantId
    if (!tenantId) return
    request.tenantDbContext = { tenantId, schema: getTenantSchema(tenantId) }
  })

  server.decorate('withTenant', withTenant)
  server.decorate('getCurrentTenant', getCurrentTenant)
}

export const tenantDbIsolation = fp(tenantDbIsolationPlugin, {
  name: 'tenant-db-isolation',
  fastify: '5.x',
})

declare module 'fastify' {
  interface FastifyInstance {
    withTenant: typeof withTenant
    getCurrentTenant: typeof getCurrentTenant
  }
  interface FastifyRequest {
    tenantDbContext?: TenantContext
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
