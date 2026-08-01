import type { Database } from './client.js';
/**
 * 注入默认 Database（fallback 用）。
 * 由 apps/api 在启动时调用，传入现有的 db 实例（复用连接池，避免重复创建）。
 */
export declare function setDefaultDatabase(db: Database): void;
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
export declare function getTenantDatabase(tenantId: string | null | undefined): Database;
/** 获取当前已缓存的租户连接数量（监控用）。 */
export declare function getTenantPoolSize(): number;
/** 列出已缓存的租户 ID（监控/调试用）。 */
export declare function listTenantIds(): string[];
/**
 * 关闭所有租户专用连接池（进程退出时调用）。
 * 不关闭默认 Database（由调用方管理）。
 */
export declare function closeAllTenantDatabases(): Promise<void>;
