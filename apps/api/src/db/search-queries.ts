import { eq, and, or, ilike, desc, sql, gt } from 'drizzle-orm';
import { db } from './index.js';
import {
  users,
  projects,
  files,
  orders,
  auditLogs,
  searchHistory,
  type AuditLog,
  type SearchHistory,
} from '@ihui/database';

// =============================================================================
// 全局搜索
// =============================================================================

export type SearchType = 'user' | 'project' | 'file' | 'all';

export interface SearchUserRow {
  id: string;
  nickname: string | null;
  email: string | null;
  phone: string | null;
  avatar: string | null;
}

export interface SearchProjectRow {
  id: string;
  name: string;
  description: string | null;
  status: number;
  fileCount: number;
  updatedAt: Date;
}

export interface SearchFileRow {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  projectId: string;
  createdAt: Date;
  projectName: string | null;
}

export interface GlobalSearchResult {
  users: SearchUserRow[];
  projects: SearchProjectRow[];
  files: SearchFileRow[];
  total: number;
}

/**
 * 用户搜索：优先使用 tsvector 全文搜索（search_vector 覆盖 nickname+email），
 * phone 未进入全文索引，仍用 ilike 兜底。
 * search_vector 列由 0010 migration 创建，Drizzle schema 中未声明，
 * 若 migration 未执行则查询报错，catch 后降级为全 ilike。
 */
async function searchUsers(q: string, like: string, limit: number): Promise<SearchUserRow[]> {
  const cols = {
    id: users.id,
    nickname: users.nickname,
    email: users.email,
    phone: users.phone,
    avatar: users.avatar,
  };
  try {
    return (await db
      .select(cols)
      .from(users)
      .where(
        or(
          sql`search_vector @@ plainto_tsquery('pg_catalog.simple', ${q})`,
          ilike(users.phone, like),
        ),
      )
      .limit(limit)) as SearchUserRow[];
  } catch {
    return (await db
      .select(cols)
      .from(users)
      .where(
        or(
          ilike(users.nickname, like),
          ilike(users.email, like),
          ilike(users.phone, like),
        ),
      )
      .limit(limit)) as SearchUserRow[];
  }
}

/**
 * 项目搜索：优先 tsvector 全文搜索（name+description），降级 ilike。
 * 仅查询当前用户拥有的项目。
 */
async function searchProjects(
  userId: string,
  q: string,
  like: string,
  limit: number,
): Promise<SearchProjectRow[]> {
  const cols = {
    id: projects.id,
    name: projects.name,
    description: projects.description,
    status: projects.status,
    fileCount: sql<number>`(
      SELECT COUNT(*)::int FROM ${files} WHERE ${files.projectId} = ${projects.id}
    )`,
    updatedAt: projects.updatedAt,
  };
  try {
    return (await db
      .select(cols)
      .from(projects)
      .where(
        and(
          eq(projects.userId, userId),
          sql`search_vector @@ plainto_tsquery('pg_catalog.simple', ${q})`,
        ),
      )
      .limit(limit)) as SearchProjectRow[];
  } catch {
    return (await db
      .select(cols)
      .from(projects)
      .where(
        and(
          eq(projects.userId, userId),
          or(ilike(projects.name, like), ilike(projects.description, like)),
        ),
      )
      .limit(limit)) as SearchProjectRow[];
  }
}

/**
 * 文件搜索：优先 tsvector 全文搜索（name），降级 ilike。
 * 仅查询当前用户拥有的项目下的文件。
 */
async function searchFiles(
  userId: string,
  q: string,
  like: string,
  limit: number,
): Promise<SearchFileRow[]> {
  const cols = {
    id: files.id,
    name: files.name,
    mimeType: files.mimeType,
    size: files.size,
    projectId: files.projectId,
    createdAt: files.createdAt,
    projectName: projects.name,
  };
  try {
    return (await db
      .select(cols)
      .from(files)
      .innerJoin(projects, eq(files.projectId, projects.id))
      .where(
        and(
          eq(projects.userId, userId),
          sql`"files".search_vector @@ plainto_tsquery('pg_catalog.simple', ${q})`,
        ),
      )
      .limit(limit)) as SearchFileRow[];
  } catch {
    return (await db
      .select(cols)
      .from(files)
      .innerJoin(projects, eq(files.projectId, projects.id))
      .where(and(eq(projects.userId, userId), ilike(files.name, like)))
      .limit(limit)) as SearchFileRow[];
  }
}

/**
 * 全局搜索：跨表聚合查询。
 * - users：全量用户公开信息（昵称/邮箱/手机号）
 * - projects/files：仅限当前用户拥有的项目及其文件
 * 优先使用 GIN 全文索引（search_vector @@ plainto_tsquery），
 * 若 migration 未执行则自动降级为 ilike 模糊匹配。
 * 按需根据 type 执行对应查询，结果合并返回。
 */
export async function globalSearch(
  userId: string,
  query: string,
  type: SearchType,
  limit: number,
): Promise<GlobalSearchResult> {
  const like = `%${query}%`;
  const result: GlobalSearchResult = { users: [], projects: [], files: [], total: 0 };

  const tasks: Promise<void>[] = [];

  if (type === 'user' || type === 'all') {
    tasks.push(
      (async () => {
        result.users = await searchUsers(query, like, limit);
      })(),
    );
  }

  if (type === 'project' || type === 'all') {
    tasks.push(
      (async () => {
        result.projects = await searchProjects(userId, query, like, limit);
      })(),
    );
  }

  if (type === 'file' || type === 'all') {
    tasks.push(
      (async () => {
        result.files = await searchFiles(userId, query, like, limit);
      })(),
    );
  }

  await Promise.all(tasks);
  result.total = result.users.length + result.projects.length + result.files.length;
  return result;
}

// =============================================================================
// 搜索历史
// =============================================================================

export async function findSearchHistory(
  userId: string,
  limit: number,
): Promise<SearchHistory[]> {
  return db
    .select()
    .from(searchHistory)
    .where(eq(searchHistory.userId, userId))
    .orderBy(desc(searchHistory.createdAt))
    .limit(limit);
}

export async function addSearchHistory(input: {
  userId: string;
  query: string;
  filters?: unknown;
  resultsCount: number;
}): Promise<void> {
  await db.insert(searchHistory).values({
    userId: input.userId,
    query: input.query,
    filters: input.filters,
    resultsCount: input.resultsCount,
  });
}

export async function clearSearchHistory(userId: string): Promise<number> {
  const rows = await db
    .delete(searchHistory)
    .where(eq(searchHistory.userId, userId))
    .returning();
  return rows.length;
}

export async function deleteSearchHistory(
  id: string,
  userId: string,
): Promise<SearchHistory | undefined> {
  const rows = await db
    .delete(searchHistory)
    .where(and(eq(searchHistory.id, id), eq(searchHistory.userId, userId)))
    .returning();
  return rows[0];
}

// =============================================================================
// 审计日志
// =============================================================================

export async function addAuditLog(input: {
  userId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: unknown;
  ip?: string;
  userAgent?: string;
}): Promise<void> {
  await db.insert(auditLogs).values({
    userId: input.userId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    details: input.details,
    ip: input.ip,
    userAgent: input.userAgent,
  });
}

export async function findAuditLogs(
  page: number,
  pageSize: number,
  opts: { userId?: string; action?: string; resourceType?: string },
): Promise<{ list: AuditLog[]; total: number }> {
  const conds = [];
  if (opts.userId) conds.push(eq(auditLogs.userId, opts.userId));
  if (opts.action) conds.push(eq(auditLogs.action, opts.action));
  if (opts.resourceType) conds.push(eq(auditLogs.resourceType, opts.resourceType));
  const where = conds.length > 0 ? and(...conds) : undefined;

  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`COUNT(*)` }).from(auditLogs).where(where),
  ]);

  return { list, total: Number(totalRows[0]?.count ?? 0) };
}

// =============================================================================
// 详细统计
// =============================================================================

export interface DetailedStats {
  userGrowthTrend: { date: string; count: number }[];
  projectDistribution: { status: number; count: number }[];
  fileTypeDistribution: { mimeType: string; count: number }[];
  orderStats: { total: number; paid: number; pending: number; totalRevenue: number };
}

/**
 * 详细统计：用户增长趋势（近 14 天）/ 项目状态分布 / 文件类型分布 / 订单统计。
 */
export async function getDetailedStats(): Promise<DetailedStats> {
  const dateExpr = sql<string>`TO_CHAR(${users.createdAt}, 'YYYY-MM-DD')`;

  const [userGrowth, projectDist, fileTypes, orderTotal, orderPaid, orderPending] =
    await Promise.all([
      db
        .select({ date: dateExpr, count: sql<number>`COUNT(*)::int` })
        .from(users)
        .where(gt(users.createdAt, sql`NOW() - INTERVAL '14 days'`))
        .groupBy(dateExpr)
        .orderBy(dateExpr),
      db
        .select({ status: projects.status, count: sql<number>`COUNT(*)::int` })
        .from(projects)
        .groupBy(projects.status),
      db
        .select({ mimeType: files.mimeType, count: sql<number>`COUNT(*)::int` })
        .from(files)
        .groupBy(files.mimeType),
      db.select({ total: sql<number>`COUNT(*)::int` }).from(orders),
      db
        .select({
          count: sql<number>`COUNT(*)::int`,
          revenue: sql<number>`COALESCE(SUM(${orders.amount}), 0)::int`,
        })
        .from(orders)
        .where(eq(orders.status, 'paid')),
      db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(orders)
        .where(eq(orders.status, 'pending')),
    ]);

  return {
    userGrowthTrend: userGrowth.map((r) => ({ date: r.date, count: Number(r.count) })),
    projectDistribution: projectDist.map((r) => ({
      status: Number(r.status ?? 0),
      count: Number(r.count),
    })),
    fileTypeDistribution: fileTypes.map((r) => ({
      mimeType: r.mimeType,
      count: Number(r.count),
    })),
    orderStats: {
      total: Number(orderTotal[0]?.total ?? 0),
      paid: Number(orderPaid[0]?.count ?? 0),
      pending: Number(orderPending[0]?.count ?? 0),
      totalRevenue: Number(orderPaid[0]?.revenue ?? 0),
    },
  };
}
