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
 *
 * 2026-07-22 鲁棒性加固:
 * - withTenant 改用 `SELECT set_config('app.tenant_id', $1, true)` 参数化绑定,
 *   替代 `SET LOCAL app.tenant_id = '${tenantId}'` 字符串拼接。
 *   PostgreSQL SET LOCAL 不支持参数绑定,但 set_config() 函数支持。
 *   保留 isValidTenantId UUID 白名单作为深度防御,但不再是唯一防线。
 */
import { sql } from 'drizzle-orm'
import type { Database } from './client.js'

export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000000'

/** 验证是否为合法 UUID(简化版,仅检查 8-4-4-4-12 格式) */
export function isValidTenantId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

/**
 * 在事务内执行 fn,自动设置 app.tenant_id。
 * 事务结束(commit/rollback)后 SET LOCAL 失效。
 *
 * 安全:set_config($1, $2, true) 第三参数 true = local(等同 SET LOCAL),
 * 第一参数固定为 'app.tenant_id'(不可注入),第二参数 tenantId 通过 $2 参数化绑定。
 * 即使 isValidTenantId 校验被绕过,SQL 注入也无法发生。
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
    // set_config(name, value, is_local) — is_local=true 等同 SET LOCAL,事务结束自动失效
    await tx.execute(sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`)
    return fn(tx)
  })
}

/** 系统/迁移任务专用:显式绕过 RLS */
export async function withBypassRls<T>(
  db: Database,
  fn: (tx: Parameters<Parameters<Database['transaction']>[0]>[0]) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.bypass_rls', 'true', true)`)
    return fn(tx)
  })
}
