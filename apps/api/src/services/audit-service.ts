/**
 * 审计逻辑服务（业务级）。
 * 与 plugins/audit.ts（HTTP 中间件自动记录）区分：
 *   本服务提供业务级审计规则、多维度查询、统计聚合、过期清理。
 *   plugins/audit.ts 仅在 onResponse 钩子中自动落库写操作。
 */

import { eq, and, desc, sql, gte, lte, lt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { auditLogs, type AuditLog } from '@ihui/database';

export interface AuditLogInput {
  userId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: unknown;
  ip?: string;
  userAgent?: string;
}

export interface AuditLogQuery {
  userId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

export interface AuditLogStats {
  total: number;
  byAction: Record<string, number>;
  byResourceType: Record<string, number>;
}

/**
 * 记录业务审计日志（便捷函数）。
 * 失败时静默（审计写入不影响主业务），由调用方决定是否捕获。
 */
export async function logAction(input: AuditLogInput): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: input.userId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      details: input.details,
      ip: input.ip,
      userAgent: input.userAgent,
    });
  } catch (e) {
    console.error('[audit-service] logAction failed:', (e as Error).message);
  }
}

/**
 * 多维度查询审计日志（支持日期范围、资源ID 筛选）。
 */
export async function getLogs(
  query: AuditLogQuery,
): Promise<{ list: AuditLog[]; total: number; page: number; pageSize: number }> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const conds = [];
  if (query.userId) conds.push(eq(auditLogs.userId, query.userId));
  if (query.action) conds.push(eq(auditLogs.action, query.action));
  if (query.resourceType) conds.push(eq(auditLogs.resourceType, query.resourceType));
  if (query.resourceId) conds.push(eq(auditLogs.resourceId, query.resourceId));
  if (query.startDate) conds.push(gte(auditLogs.createdAt, query.startDate));
  if (query.endDate) conds.push(lte(auditLogs.createdAt, query.endDate));
  const where = conds.length ? and(...conds) : undefined;

  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(auditLogs).where(where),
  ]);
  return { list, total: totalRows[0]?.count ?? 0, page, pageSize };
}

/**
 * 审计日志统计：总数、按操作类型分组、按资源类型分组。
 */
export async function getLogStats(
  startDate?: Date,
  endDate?: Date,
): Promise<AuditLogStats> {
  const conds = [];
  if (startDate) conds.push(gte(auditLogs.createdAt, startDate));
  if (endDate) conds.push(lte(auditLogs.createdAt, endDate));
  const where = conds.length ? and(...conds) : undefined;

  const totalRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(where);
  const total = totalRows[0]?.count ?? 0;

  const byActionRows = await db
    .select({ action: auditLogs.action, count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(where)
    .groupBy(auditLogs.action);
  const byAction: Record<string, number> = {};
  for (const r of byActionRows) byAction[r.action] = r.count;

  const byTypeRows = await db
    .select({ type: auditLogs.resourceType, count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(where)
    .groupBy(auditLogs.resourceType);
  const byResourceType: Record<string, number> = {};
  for (const r of byTypeRows) {
    if (r.type) byResourceType[r.type] = r.count;
  }

  return { total, byAction, byResourceType };
}

/**
 * 删除指定天数之前的旧审计日志。
 * @returns 删除的记录数
 */
export async function deleteOldLogs(days = 90): Promise<number> {
  const cutoff = new Date(Date.now() - days * 86400_000);
  const rows = await db
    .delete(auditLogs)
    .where(lt(auditLogs.createdAt, cutoff))
    .returning({ id: auditLogs.id });
  return rows.length;
}
