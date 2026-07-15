/**
 * 多租户 RLS 上下文工具。
 *
 * 用法:
 *   const db = createDb(...)
 *   await withTenant(db, tenantId, async (tx) => {
 *     // 在这个事务内,所有 SELECT/INSERT/UPDATE/DELETE 都会被 RLS 策略过滤
 *     return await tx.select().from(users)
 *   })
 *
 * 设计:
 * - 每次请求用 SET LOCAL 设置 app.tenant_id,事务结束自动失效。
 * - 系统/迁移任务用 withBypassRls(db, fn) 显式绕过 RLS。
 * - 配合 migration 0066_rls_tenant_isolation.sql 启用行级安全。
 * - 默认租户 UUID(单租户模式):'00000000-0000-0000-0000-000000000000'
 */
import type { Database } from './client.js'

export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000000'

/** 验证是否为合法 UUID(简化版,仅检查 8-4-4-4-12 格式) */
export function isValidTenantId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

/**
 * 在事务内执行 fn,自动设置 app.tenant_id。
 * 事务结束(commit/rollback)后 SET LOCAL 失效。
 */
export async function withTenant<T>(
  db: Database,
  tenantId: string,
  fn: (tx: Parameters<Parameters<Database['transaction']>[0]>[0]) => Promise<T>,
): Promise<T> {
  if (!isValidTenantId(tenantId)) {
    throw new Error(`[rls] invalid tenant id: ${tenantId}`)
  }
  return db.transaction(async (tx) => {
    await tx.execute(`SET LOCAL app.tenant_id = '${tenantId}'`)
    return fn(tx)
  })
}

/** 系统/迁移任务专用:显式绕过 RLS */
export async function withBypassRls<T>(
  db: Database,
  fn: (tx: Parameters<Parameters<Database['transaction']>[0]>[0]) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(`SET LOCAL app.bypass_rls = 'true'`)
    return fn(tx)
  })
}
