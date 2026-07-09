import { and, gte, lte, isNotNull, desc, sql, asc } from 'drizzle-orm';
import { db } from './index.js';
import {
  visitLogs,
  type VisitLog,
} from '@ihui/database';

// =============================================================================
// 访问记录写入
// =============================================================================

export interface SaveVisitLogInput {
  userId?: string;
  ip?: string;
  city?: string;
  url?: string;
  referer?: string;
  userAgent?: string;
  sessionId?: string;
  visitDate?: string;
}

/**
 * 保存访问记录。visitDate 缺省取当天 YYYY-MM-DD(取前 10 位)。
 */
export async function saveVisitLog(input: SaveVisitLogInput): Promise<VisitLog> {
  const visitDate =
    (input.visitDate?.slice(0, 10)) || new Date().toISOString().slice(0, 10);
  const rows = await db
    .insert(visitLogs)
    .values({
      userId: input.userId,
      ip: input.ip,
      city: input.city,
      url: input.url,
      referer: input.referer,
      userAgent: input.userAgent,
      sessionId: input.sessionId,
      visitDate,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('保存访问记录失败');
  return row;
}

// =============================================================================
// 访问统计
// =============================================================================

function dateRangeFilter(start?: string, end?: string) {
  const conds = [];
  if (start) conds.push(gte(visitLogs.visitDate, start.slice(0, 10)));
  if (end) conds.push(lte(visitLogs.visitDate, end.slice(0, 10)));
  return conds.length > 0 ? and(...conds) : undefined;
}

export interface VisitSummary {
  pv: number;
  uv: number;
  ipCount: number;
  memberCount: number;
  startTime?: string;
  endTime?: string;
}

/**
 * 访问概览 - PV/UV/IP数/会员数。UV 优先按 session_id 去重, 回退到 ip。
 */
export async function getVisitSummary(
  startTime?: string,
  endTime?: string,
): Promise<VisitSummary> {
  const where = dateRangeFilter(startTime, endTime);
  const [pvRows, uvRows, ipRows, memberRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(visitLogs).where(where),
    db
      .select({
        count: sql<number>`count(distinct coalesce(${visitLogs.sessionId}, ${visitLogs.ip}))::int`,
      })
      .from(visitLogs)
      .where(where),
    db
      .select({ count: sql<number>`count(distinct ${visitLogs.ip})::int` })
      .from(visitLogs)
      .where(where),
    db
      .select({ count: sql<number>`count(distinct ${visitLogs.userId})::int` })
      .from(visitLogs)
      .where(and(where ?? sql`true`, isNotNull(visitLogs.userId))),
  ]);
  return {
    pv: pvRows[0]?.count ?? 0,
    uv: uvRows[0]?.count ?? 0,
    ipCount: ipRows[0]?.count ?? 0,
    memberCount: memberRows[0]?.count ?? 0,
    startTime,
    endTime,
  };
}

export interface DayPvItem {
  visitDate: string;
  pv: number;
}

/**
 * 每日 PV 列表, 按 visit_date 升序。
 */
export async function getDayPvList(
  startTime?: string,
  endTime?: string,
): Promise<DayPvItem[]> {
  const where = and(dateRangeFilter(startTime, endTime), isNotNull(visitLogs.visitDate));
  const rows = await db
    .select({
      visitDate: visitLogs.visitDate,
      pv: sql<number>`count(${visitLogs.id})::int`,
    })
    .from(visitLogs)
    .where(where)
    .groupBy(visitLogs.visitDate)
    .orderBy(asc(visitLogs.visitDate));
  return rows.map((r) => ({ visitDate: r.visitDate ?? '', pv: r.pv }));
}

export interface DayUvItem {
  visitDate: string;
  uv: number;
}

/**
 * 每日 UV 列表, 按 visit_date 升序。UV 按 coalesce(session_id, ip) 去重。
 */
export async function getDayUvList(
  startTime?: string,
  endTime?: string,
): Promise<DayUvItem[]> {
  const where = and(dateRangeFilter(startTime, endTime), isNotNull(visitLogs.visitDate));
  const rows = await db
    .select({
      visitDate: visitLogs.visitDate,
      uv: sql<number>`count(distinct coalesce(${visitLogs.sessionId}, ${visitLogs.ip}))::int`,
    })
    .from(visitLogs)
    .where(where)
    .groupBy(visitLogs.visitDate)
    .orderBy(asc(visitLogs.visitDate));
  return rows.map((r) => ({ visitDate: r.visitDate ?? '', uv: r.uv }));
}

export interface IpCityItem {
  ip: string | null;
  city: string | null;
  pv: number;
  uv: number;
}

export interface FindIpCityOpts {
  startTime?: string;
  endTime?: string;
  page: number;
  pageSize: number;
}

/**
 * IP 城市统计列表(分页), 按 PV 降序。
 */
export async function findIpCityList(
  opts: FindIpCityOpts,
): Promise<{ list: IpCityItem[]; total: number; page: number; pageSize: number }> {
  const where = dateRangeFilter(opts.startTime, opts.endTime);
  const [list, totalRows] = await Promise.all([
    db
      .select({
        ip: visitLogs.ip,
        city: visitLogs.city,
        pv: sql<number>`count(${visitLogs.id})::int`,
        uv: sql<number>`count(distinct coalesce(${visitLogs.sessionId}, ${visitLogs.ip}))::int`,
      })
      .from(visitLogs)
      .where(where)
      .groupBy(visitLogs.ip, visitLogs.city)
      .orderBy(desc(sql`count(${visitLogs.id})`))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({
        count: sql<number>`count(distinct (${visitLogs.ip} || '_' || coalesce(${visitLogs.city}, '')))::int`,
      })
      .from(visitLogs)
      .where(where),
  ]);
  return {
    list: list.map((r) => ({ ip: r.ip, city: r.city, pv: r.pv, uv: r.uv })),
    total: totalRows[0]?.count ?? 0,
    page: opts.page,
    pageSize: opts.pageSize,
  };
}
