import { and, eq, desc, sql } from 'drizzle-orm';
import { db } from './index.js';
import {
  behaviorWatchRecords,
  type BehaviorWatchRecord,
} from '@ihui/database';

// =============================================================================
// 浏览记录
// =============================================================================

export interface RecordWatchInput {
  userId: string;
  topicId: string;
  topicType: string;
  topicTitle?: string;
  watchDuration?: number;
  lastPosition?: number;
}

/**
 * 记录/更新浏览。同一用户对同一目标已有记录则累加时长并更新位置。
 * 返回 { id, updated }。
 */
export async function recordWatch(
  input: RecordWatchInput,
): Promise<{ id: string; updated: boolean }> {
  const watchDuration = input.watchDuration ?? 0;
  const lastPosition = input.lastPosition ?? 0;
  const existing = await db
    .select()
    .from(behaviorWatchRecords)
    .where(
      and(
        eq(behaviorWatchRecords.userId, input.userId),
        eq(behaviorWatchRecords.topicId, input.topicId),
        eq(behaviorWatchRecords.topicType, input.topicType),
      ),
    )
    .limit(1);

  const row = existing[0];
  if (row) {
    await db
      .update(behaviorWatchRecords)
      .set({
        watchDuration: (row.watchDuration ?? 0) + watchDuration,
        lastPosition,
        ...(input.topicTitle ? { topicTitle: input.topicTitle } : {}),
        updatedAt: new Date(),
      })
      .where(eq(behaviorWatchRecords.id, row.id));
    return { id: row.id, updated: true };
  }

  const rows = await db
    .insert(behaviorWatchRecords)
    .values({
      userId: input.userId,
      topicId: input.topicId,
      topicType: input.topicType,
      topicTitle: input.topicTitle,
      watchDuration,
      lastPosition,
    })
    .returning();
  const created = rows[0];
  if (!created) throw new Error('记录浏览失败');
  return { id: created.id, updated: false };
}

/**
 * 浏览计数 - 统计指定目标的浏览次数(浏览记录条数)。
 */
export async function getWatchCount(
  topicId: string,
  topicType: string,
): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(behaviorWatchRecords)
    .where(
      and(
        eq(behaviorWatchRecords.topicId, topicId),
        eq(behaviorWatchRecords.topicType, topicType),
      ),
    );
  return rows[0]?.count ?? 0;
}

export interface FindWatchListOpts {
  userId: string;
  topicType?: string;
  page: number;
  pageSize: number;
}

/**
 * 我的浏览记录列表(分页), 按 id 降序。
 */
export async function findWatchList(
  opts: FindWatchListOpts,
): Promise<{ list: BehaviorWatchRecord[]; total: number; page: number; pageSize: number }> {
  const where = opts.topicType
    ? and(
        eq(behaviorWatchRecords.userId, opts.userId),
        eq(behaviorWatchRecords.topicType, opts.topicType),
      )
    : eq(behaviorWatchRecords.userId, opts.userId);
  const [list, countRows] = await Promise.all([
    db
      .select()
      .from(behaviorWatchRecords)
      .where(where)
      .orderBy(desc(behaviorWatchRecords.id))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(behaviorWatchRecords).where(where),
  ]);
  return { list, total: countRows[0]?.count ?? 0, page: opts.page, pageSize: opts.pageSize };
}

/**
 * 删除浏览记录。可选传入 userId 校验归属。返回是否删除。
 */
export async function deleteWatch(
  id: string,
  userId?: string,
): Promise<boolean> {
  const where = userId
    ? and(eq(behaviorWatchRecords.id, id), eq(behaviorWatchRecords.userId, userId))
    : eq(behaviorWatchRecords.id, id);
  const rows = await db.delete(behaviorWatchRecords).where(where).returning();
  return rows.length > 0;
}

/**
 * 清空指定用户的浏览记录。返回删除条数。
 */
export async function clearAllWatch(userId: string): Promise<number> {
  const rows = await db
    .delete(behaviorWatchRecords)
    .where(eq(behaviorWatchRecords.userId, userId))
    .returning();
  return rows.length;
}

// =============================================================================
// 管理端统计
// =============================================================================

export interface BehaviorStatistics {
  watchTotal: number;
  userTotal: number;
}

/**
 * 行为统计 - 浏览记录总数与去重用户数。
 */
export async function getBehaviorStatistics(): Promise<BehaviorStatistics> {
  const [totalRows, userRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(behaviorWatchRecords),
    db
      .select({ count: sql<number>`count(distinct ${behaviorWatchRecords.userId})::int` })
      .from(behaviorWatchRecords),
  ]);
  return {
    watchTotal: totalRows[0]?.count ?? 0,
    userTotal: userRows[0]?.count ?? 0,
  };
}

export interface FindAllWatchOpts {
  topicType?: string;
  page: number;
  pageSize: number;
}

/**
 * 管理端浏览记录列表(全量分页), 按 id 降序。
 */
export async function findAllWatchList(
  opts: FindAllWatchOpts,
): Promise<{ list: BehaviorWatchRecord[]; total: number; page: number; pageSize: number }> {
  const where = opts.topicType
    ? eq(behaviorWatchRecords.topicType, opts.topicType)
    : undefined;
  const [list, countRows] = await Promise.all([
    db
      .select()
      .from(behaviorWatchRecords)
      .where(where)
      .orderBy(desc(behaviorWatchRecords.id))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(behaviorWatchRecords).where(where),
  ]);
  return { list, total: countRows[0]?.count ?? 0, page: opts.page, pageSize: opts.pageSize };
}
