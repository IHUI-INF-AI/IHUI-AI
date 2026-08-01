import type { Database } from './client.js';
export declare const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000000";
/** 验证是否为合法 UUID(简化版,仅检查 8-4-4-4-12 格式) */
export declare function isValidTenantId(id: string): boolean;
/**
 * 在事务内执行 fn,自动设置 app.tenant_id。
 * 事务结束(commit/rollback)后 SET LOCAL 失效。
 *
 * 安全:set_config($1, $2, true) 第三参数 true = local(等同 SET LOCAL),
 * 第一参数固定为 'app.tenant_id'(不可注入),第二参数 tenantId 通过 $2 参数化绑定。
 * 即使 isValidTenantId 校验被绕过,SQL 注入也无法发生。
 */
export declare function withTenant<T>(db: Database, tenantId: string, fn: (tx: Parameters<Parameters<Database['transaction']>[0]>[0]) => Promise<T>): Promise<T>;
export declare function withBypassRls<T>(db: Database, reason: string, fn: (tx: Parameters<Parameters<Database['transaction']>[0]>[0]) => Promise<T>): Promise<T>;
