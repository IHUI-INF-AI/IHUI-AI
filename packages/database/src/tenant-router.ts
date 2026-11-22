// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 多租户分库路由（R74 P2）。
 *
 * 与 tenant-db-isolation.ts 的 schema 隔离不同，本模块实现真正的"分库"：
 * 每个租户可有独立的 PostgreSQL 实例（独立 DATABASE_URL），实现物理隔离。
 *
 * 设计：
 * - 连接池 Map<tenantId, Database>，懒加载，首次访问时创建。
 * - LRU 上限(默认 32 个租户,env TENANT_CACHE_MAX_ENTRIES 可调):超限淘汰最久未访问的租户池。
 * - 租户数据库 URL 从 env 读取：TENANT_${TENANT_ID}_DATABASE_URL（tenantId 归一化为大写下划线）。
 * - 未配置租户专用 URL 时，fallback 到默认 Database（保持现有单租户行为）。
 * - 每个租户连接池 max=TENANT_POOL_MAX（env 可调，默认 10）；默认池由调用方配置。
 * - 租户缓存条目数 × 单池 max 受 TENANT_TOTAL_CONNECTION_BUDGET 约束（DB-41）。
 * - 租户数据库不可达时（创建失败）降级到默认库 + console.warn。
 *
 * 用法：
 *   import { setDefaultDatabase, getTenantDatabase } from '@ihui/database'
 *   setDefaultDatabase(db)  // 注入 apps/api/src/db 的默认 db
 *   const tenantDb = getTenantDatabase(request.tenantId)  // 返回租户专用或默认 db
 *
 * 注：postgres-js 连接是懒加载的，创建客户端时不会立即连接。
 * 连接失败会在首次查询时抛出，由调用方处理。
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema/index.js'
import type { Database } from './client.js'
import { buildPoolOptions } from './pool-options.js'

/** 读取正整数 env；缺省/非法回落到 fallback。 */
function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name])
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback
}

/**
 * 每个租户连接池上限（env TENANT_POOL_MAX 可调，默认 10）。
 *
 * DB-41:不再把「每租 10」写死 —— 租户池 max 必须与全局预算一起核算。
 */
const TENANT_POOL_MAX = readPositiveIntEnv('TENANT_POOL_MAX', 10)

/**
 * 租户池全局连接预算（env TENANT_TOTAL_CONNECTION_BUDGET 可调，默认 320）。
 *
 * 口径：`租户缓存条目数 × 单池 max ≤ 预算`。预算本身必须与主池、读副本、
 * 受控出口池一起落在 PostgreSQL max_connections 的可用额度内（见
 * docs/PERFORMANCE.md §4.3）——本模块只保证自己这一份不超。
 */
const TENANT_CONNECTION_BUDGET = readPositiveIntEnv('TENANT_TOTAL_CONNECTION_BUDGET', 320)

/**
 * 租户连接缓存上限（LRU）。
 *
 * 根治连接池无界增长:每个租户条目持有一个 max=TENANT_POOL_MAX 的 postgres 连接池,
 * 租户数无限增长会同时耗尽数据库连接数与内存。超过上限时淘汰最久未访问
 * 的租户条目并关闭其连接池(postgres 的 end() 默认等待在途查询完成,
 * 不会截断进行中的请求);该租户下次访问会重新懒加载建池。
 * 可通过环境变量 TENANT_CACHE_MAX_ENTRIES 覆盖,最终再按全局预算收敛:
 * 条目数 = min(TENANT_CACHE_MAX_ENTRIES, floor(预算 / 单池 max))，至少 1。
 */
const TENANT_CACHE_MAX = (() => {
  const raw = readPositiveIntEnv('TENANT_CACHE_MAX_ENTRIES', 32)
  const byBudget = Math.floor(TENANT_CONNECTION_BUDGET / TENANT_POOL_MAX)
  return Math.max(1, Math.min(raw, byBudget))
})()

/** 租户连接池条目：drizzle 实例 + 底层 postgres 客户端（用于关闭）。 */
interface TenantPoolEntry {
  db: Database
  client: postgres.Sql
}

/** 租户连接池：tenantId → { db, client }，懒加载。 */
const tenantDbPool = new Map<string, TenantPoolEntry>()

/** 默认 Database（由调用方注入，未注入时抛错）。 */
let defaultDb: Database | null = null

/**
 * 注入默认 Database（fallback 用）。
 * 由 apps/api 在启动时调用，传入现有的 db 实例（复用连接池，避免重复创建）。
 */
export function setDefaultDatabase(db: Database): void {
  defaultDb = db
}

/**
 * 将 tenantId 归一化为合法环境变量名片段（大写 + 下划线）。
 * 例：'acme-corp' → 'ACME_CORP'，UUID 也适用。
 */
function normalizeTenantIdForEnv(tenantId: string): string {
  return tenantId.replace(/[^A-Z0-9_]/gi, '_').toUpperCase()
}

/**
 * 从 env 读取租户专用数据库 URL。
 * 格式：TENANT_${TENANT_ID}_DATABASE_URL（tenantId 归一化）。
 * 未来可扩展为从 tenants 表的 dbUrl 字段读取（当前 schema 无此字段）。
 */
function getTenantDbUrl(tenantId: string): string | null {
  const normalized = normalizeTenantIdForEnv(tenantId)
  const envKey = `TENANT_${normalized}_DATABASE_URL`
  const url = process.env[envKey]
  return url || null
}

/**
 * 根据租户 ID 返回对应的数据库连接。
 *
 * - 已在池中：直接返回。
 * - 配置了 TENANT_${TENANT_ID}_DATABASE_URL：创建新连接（max=10），存入池，返回。
 * - 未配置租户专用 URL：fallback 到默认 Database。
 * - 创建失败：console.warn + 降级到默认 Database。
 *
 * 未调用 setDefaultDatabase() 且无租户专用 URL 时抛错。
 */
export function getTenantDatabase(tenantId: string | null | undefined): Database {
  // 无 tenantId：直接返回默认库
  if (!tenantId) {
    if (!defaultDb) {
      throw new Error('[tenant-router] 默认 Database 未注入，请先调用 setDefaultDatabase()')
    }
    return defaultDb
  }

  // 池命中(删除再插入,把该租户刷新为 LRU 最新)
  const cached = tenantDbPool.get(tenantId)
  if (cached) {
    tenantDbPool.delete(tenantId)
    tenantDbPool.set(tenantId, cached)
    return cached.db
  }

  // 查找租户专用 URL
  const tenantUrl = getTenantDbUrl(tenantId)
  if (!tenantUrl) {
    // 未配置租户专用 URL：fallback 到默认库（保持现有行为）
    if (!defaultDb) {
      throw new Error('[tenant-router] 默认 Database 未注入，请先调用 setDefaultDatabase()')
    }
    return defaultDb
  }

  // 创建租户专用连接池
  try {
    // DB-29:租户池与主池同口径(四道超时护栏),不再只给 max。
    const client = postgres(tenantUrl, buildPoolOptions({ max: TENANT_POOL_MAX }))
    const db = drizzle(client, { schema })
    evictLeastRecentlyUsed()
    tenantDbPool.set(tenantId, { db, client })
    return db
  } catch (err) {
    // 创建失败（如无效 URL）：降级到默认库 + 警告
    console.warn(
      `[tenant-router] 租户 ${tenantId} 数据库创建失败，降级到默认库:`,
      (err as Error).message,
    )
    if (!defaultDb) {
      throw new Error('[tenant-router] 默认 Database 未注入，请先调用 setDefaultDatabase()')
    }
    return defaultDb
  }
}

/**
 * 超过缓存上限时淘汰最久未访问的租户条目并关闭其连接池。
 * Map 的插入序即 LRU 序(命中时删除重插刷新),首个 key 即最旧。
 * 关闭异步进行(end() 等待在途查询),不阻塞当前请求路径。
 */
function evictLeastRecentlyUsed(): void {
  while (tenantDbPool.size >= TENANT_CACHE_MAX && tenantDbPool.size > 0) {
    const [oldestId, oldest] = tenantDbPool.entries().next().value!
    tenantDbPool.delete(oldestId)
    void oldest.client.end().catch(() => {})
    console.warn(
      `[tenant-router] 租户连接缓存达上限(${TENANT_CACHE_MAX}),已淘汰最久未访问的租户 ${oldestId} 并关闭其连接池`,
    )
  }
}

/** 获取当前已缓存的租户连接数量（监控用）。 */
export function getTenantPoolSize(): number {
  return tenantDbPool.size
}

/**
 * 租户池容量配置快照（监控/测试用）。
 * cacheMax 已按 `min(TENANT_CACHE_MAX_ENTRIES, floor(预算/单池 max))` 收敛。
 */
export function getTenantPoolConfig(): {
  poolMax: number
  connectionBudget: number
  cacheMax: number
} {
  return {
    poolMax: TENANT_POOL_MAX,
    connectionBudget: TENANT_CONNECTION_BUDGET,
    cacheMax: TENANT_CACHE_MAX,
  }
}

/** 列出已缓存的租户 ID（监控/调试用）。 */
export function listTenantIds(): string[] {
  return Array.from(tenantDbPool.keys())
}

/**
 * 关闭所有租户专用连接池（进程退出时调用）。
 * 不关闭默认 Database（由调用方管理）。
 */
export async function closeAllTenantDatabases(): Promise<void> {
  const closePromises: Promise<unknown>[] = []
  for (const [tenantId, entry] of tenantDbPool) {
    closePromises.push(entry.client.end().catch(() => {}))
    tenantDbPool.delete(tenantId)
  }
  await Promise.allSettled(closePromises)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
