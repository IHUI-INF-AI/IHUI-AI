import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from './index.js';
import {
  lessons,
  lessonSignUps,
  examPapers,
  examRecords,
  circlePosts,
  announcements,
  helpArticles,
  users,
  statisticsSnapshots,
  type StatisticsSnapshot,
} from '@ihui/database';

// =============================================================================
// 聚合统计查询
// =============================================================================

export interface LearnStatistics {
  lessonTotal: number;
  lessonPublished: number;
  signupTotal: number;
  viewSum: number;
}

/**
 * 学习统计：课程数/已发布课程/报名数/总浏览量。
 */
export async function getLearnStatistics(): Promise<LearnStatistics> {
  const [totalRows, pubRows, signupRows, viewRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(lessons),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(lessons)
      .where(and(eq(lessons.isPublished, true), eq(lessons.status, 1))),
    db.select({ count: sql<number>`count(*)::int` }).from(lessonSignUps),
    db
      .select({ sum: sql<number>`coalesce(sum(${lessons.viewCount}), 0)::int` })
      .from(lessons)
      .where(eq(lessons.status, 1)),
  ]);
  return {
    lessonTotal: totalRows[0]?.count ?? 0,
    lessonPublished: pubRows[0]?.count ?? 0,
    signupTotal: signupRows[0]?.count ?? 0,
    viewSum: viewRows[0]?.sum ?? 0,
  };
}

export interface ExamStatistics {
  examTotal: number;
  examPublished: number;
  recordTotal: number;
  passTotal: number;
  passRate: number;
}

/**
 * 考试统计：试卷数/已发布试卷/答题记录数/通过数/通过率。
 */
export async function getExamStatistics(): Promise<ExamStatistics> {
  const [totalRows, pubRows, recordRows, passRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(examPapers),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(examPapers)
      .where(and(eq(examPapers.isPublished, true), eq(examPapers.status, 1))),
    db.select({ count: sql<number>`count(*)::int` }).from(examRecords),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(examRecords)
      .where(eq(examRecords.isPassed, true)),
  ]);
  const recordTotal = recordRows[0]?.count ?? 0;
  const passTotal = passRows[0]?.count ?? 0;
  return {
    examTotal: totalRows[0]?.count ?? 0,
    examPublished: pubRows[0]?.count ?? 0,
    recordTotal,
    passTotal,
    passRate: recordTotal > 0 ? Math.round((passTotal / recordTotal) * 10000) / 10000 : 0,
  };
}

export interface ContentStatistics {
  memberTotal: number;
  postTotal: number;
  announcementTotal: number;
  articleTotal: number;
}

/**
 * 内容统计：用户数/圈子帖子数/公告数/帮助文章数。
 */
export async function getContentStatistics(): Promise<ContentStatistics> {
  const [memberRows, postRows, announcementRows, articleRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(users),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(circlePosts)
      .where(eq(circlePosts.status, 1)),
    db.select({ count: sql<number>`count(*)::int` }).from(announcements),
    db.select({ count: sql<number>`count(*)::int` }).from(helpArticles),
  ]);
  return {
    memberTotal: memberRows[0]?.count ?? 0,
    postTotal: postRows[0]?.count ?? 0,
    announcementTotal: announcementRows[0]?.count ?? 0,
    articleTotal: articleRows[0]?.count ?? 0,
  };
}

export interface OverviewStatistics {
  memberTotal: number;
  lessonTotal: number;
  examTotal: number;
  signupTotal: number;
  examRecordTotal: number;
  postTotal: number;
  announcementTotal: number;
  articleTotal: number;
}

/**
 * 总览统计：聚合各业务模块核心指标。
 */
export async function getOverviewStatistics(): Promise<OverviewStatistics> {
  const [memberRows, lessonRows, examRows, signupRows, examRecordRows, postRows, announcementRows, articleRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(users),
    db.select({ count: sql<number>`count(*)::int` }).from(lessons),
    db.select({ count: sql<number>`count(*)::int` }).from(examPapers),
    db.select({ count: sql<number>`count(*)::int` }).from(lessonSignUps),
    db.select({ count: sql<number>`count(*)::int` }).from(examRecords),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(circlePosts)
      .where(eq(circlePosts.status, 1)),
    db.select({ count: sql<number>`count(*)::int` }).from(announcements),
    db.select({ count: sql<number>`count(*)::int` }).from(helpArticles),
  ]);
  return {
    memberTotal: memberRows[0]?.count ?? 0,
    lessonTotal: lessonRows[0]?.count ?? 0,
    examTotal: examRows[0]?.count ?? 0,
    signupTotal: signupRows[0]?.count ?? 0,
    examRecordTotal: examRecordRows[0]?.count ?? 0,
    postTotal: postRows[0]?.count ?? 0,
    announcementTotal: announcementRows[0]?.count ?? 0,
    articleTotal: articleRows[0]?.count ?? 0,
  };
}

// =============================================================================
// 快照管理
// =============================================================================

export interface FindSnapshotsOpts {
  type?: string;
  page: number;
  pageSize: number;
}

/**
 * 快照列表(分页)，按 createdAt 降序。
 */
export async function findStatisticsSnapshots(
  opts: FindSnapshotsOpts,
): Promise<{ list: StatisticsSnapshot[]; total: number; page: number; pageSize: number }> {
  const where = opts.type ? eq(statisticsSnapshots.type, opts.type) : undefined;
  const [list, countRows] = await Promise.all([
    db
      .select()
      .from(statisticsSnapshots)
      .where(where)
      .orderBy(desc(statisticsSnapshots.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(statisticsSnapshots).where(where),
  ]);
  return { list, total: countRows[0]?.count ?? 0, page: opts.page, pageSize: opts.pageSize };
}

export async function findStatisticsSnapshotById(
  id: string,
): Promise<StatisticsSnapshot | undefined> {
  const rows = await db
    .select()
    .from(statisticsSnapshots)
    .where(eq(statisticsSnapshots.id, id))
    .limit(1);
  return rows[0];
}

export interface CreateSnapshotInput {
  type: string;
  data: Record<string, unknown>;
  createdBy?: string;
}

/**
 * 创建统计快照。
 */
export async function createStatisticsSnapshot(
  data: CreateSnapshotInput,
): Promise<StatisticsSnapshot> {
  const rows = await db
    .insert(statisticsSnapshots)
    .values({
      type: data.type,
      data: data.data,
      createdBy: data.createdBy,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建统计快照失败');
  return row;
}

export async function deleteStatisticsSnapshot(id: string): Promise<void> {
  await db.delete(statisticsSnapshots).where(eq(statisticsSnapshots.id, id));
}
