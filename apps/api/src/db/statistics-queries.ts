import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';
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
  eduMessages,
  liveChannels,
  userPoints,
  resources,
  visitLogs,
  eduMembers,
  type StatisticsSnapshot,
  type VisitLog,
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

// =============================================================================
// 扩展统计（消息 / 直播 / 积分 / 资源 / 用户中心 / 访问明细）
// =============================================================================

export interface MessageStatistics {
  total: number;
  unread: number;
}

/** 消息统计：消息总数 + 未读数。 */
export async function getMessageStatistics(): Promise<MessageStatistics> {
  const [totalRows, unreadRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(eduMessages),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(eduMessages)
      .where(eq(eduMessages.isRead, false)),
  ]);
  return {
    total: totalRows[0]?.count ?? 0,
    unread: unreadRows[0]?.count ?? 0,
  };
}

export interface LiveStatistics {
  total: number;
  living: number;
  published: number;
}

/** 直播统计：频道总数 + 正在直播数 + 已发布数。 */
export async function getLiveStatistics(): Promise<LiveStatistics> {
  const [totalRows, liveRows, pubRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(liveChannels),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(liveChannels)
      .where(eq(liveChannels.isLive, true)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(liveChannels)
      .where(eq(liveChannels.isPublished, true)),
  ]);
  return {
    total: totalRows[0]?.count ?? 0,
    living: liveRows[0]?.count ?? 0,
    published: pubRows[0]?.count ?? 0,
  };
}

export interface PointStatistics {
  userCount: number;
  totalPoints: number;
  totalEarned: number;
  totalSpent: number;
}

/** 积分统计：有积分记录的用户数 + 积分总和 + 累计获得 + 累计消费。 */
export async function getPointStatistics(): Promise<PointStatistics> {
  const rows = await db
    .select({
      userCount: sql<number>`count(*)::int`,
      totalPoints: sql<number>`coalesce(sum(${userPoints.points}), 0)::int`,
      totalEarned: sql<number>`coalesce(sum(${userPoints.totalEarned}), 0)::int`,
      totalSpent: sql<number>`coalesce(sum(${userPoints.totalSpent}), 0)::int`,
    })
    .from(userPoints);
  return {
    userCount: rows[0]?.userCount ?? 0,
    totalPoints: rows[0]?.totalPoints ?? 0,
    totalEarned: rows[0]?.totalEarned ?? 0,
    totalSpent: rows[0]?.totalSpent ?? 0,
  };
}

export interface ResourceStatistics {
  total: number;
  published: number;
  viewSum: number;
  downloadSum: number;
}

/** 资源统计：资源总数 + 已发布数 + 总浏览量 + 总下载量。 */
export async function getResourceStatistics(): Promise<ResourceStatistics> {
  const rows = await db
    .select({
      total: sql<number>`count(*)::int`,
      published: sql<number>`count(*) filter (where ${resources.isPublished} = true)::int`,
      viewSum: sql<number>`coalesce(sum(${resources.viewCount}), 0)::int`,
      downloadSum: sql<number>`coalesce(sum(${resources.downloadCount}), 0)::int`,
    })
    .from(resources);
  return {
    total: rows[0]?.total ?? 0,
    published: rows[0]?.published ?? 0,
    viewSum: rows[0]?.viewSum ?? 0,
    downloadSum: rows[0]?.downloadSum ?? 0,
  };
}

export interface UserCenterStatistics {
  userTotal: number;
  memberTotal: number;
  vipTotal: number;
  normalTotal: number;
  disabledTotal: number;
}

/** 用户中心统计：平台用户数 + 教育会员数 + VIP 数 + 普通用户数 + 禁用用户数。 */
export async function getUserCenterStatistics(): Promise<UserCenterStatistics> {
  const [userRows, memberRows, vipRows, normalRows, disabledRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(users),
    db.select({ count: sql<number>`count(*)::int` }).from(eduMembers),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.isVip, 1)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.isVip, 0)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.status, 0)),
  ]);
  return {
    userTotal: userRows[0]?.count ?? 0,
    memberTotal: memberRows[0]?.count ?? 0,
    vipTotal: vipRows[0]?.count ?? 0,
    normalTotal: normalRows[0]?.count ?? 0,
    disabledTotal: disabledRows[0]?.count ?? 0,
  };
}

export interface FindVisitLogsOpts {
  page: number;
  pageSize: number;
  startTime?: string;
  endTime?: string;
}

/** 访问明细列表（分页），按创建时间降序。 */
export async function findVisitLogList(
  opts: FindVisitLogsOpts,
): Promise<{ list: VisitLog[]; total: number; page: number; pageSize: number }> {
  const conds = [];
  if (opts.startTime) conds.push(gte(visitLogs.visitDate, opts.startTime.slice(0, 10)));
  if (opts.endTime) conds.push(lte(visitLogs.visitDate, opts.endTime.slice(0, 10)));
  const where = conds.length > 0 ? and(...conds) : undefined;
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(visitLogs)
      .where(where)
      .orderBy(desc(visitLogs.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(visitLogs).where(where),
  ]);
  return { list, total: totalRows[0]?.count ?? 0, page: opts.page, pageSize: opts.pageSize };
}
