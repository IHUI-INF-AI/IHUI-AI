import { eq, and, desc, asc, sql, ilike, inArray } from 'drizzle-orm';
import { db } from './index.js';
import {
  liveCategories,
  liveLecturers,
  liveChannels,
  type LiveCategory,
  type LiveLecturer,
  type LiveChannel,
} from '@ihui/database';

// =============================================================================
// 分类
// =============================================================================

/** 公开查询启用分类列表（status=1）。 */
export async function findPublishedLiveCategories(): Promise<LiveCategory[]> {
  return db
    .select()
    .from(liveCategories)
    .where(eq(liveCategories.status, 1))
    .orderBy(asc(liveCategories.sort), asc(liveCategories.id));
}

/** Admin：查询全部分类。 */
export async function findAllLiveCategories(): Promise<LiveCategory[]> {
  return db
    .select()
    .from(liveCategories)
    .orderBy(asc(liveCategories.sort), asc(liveCategories.id));
}

export async function findLiveCategoryById(id: string): Promise<LiveCategory | undefined> {
  const rows = await db.select().from(liveCategories).where(eq(liveCategories.id, id)).limit(1);
  return rows[0];
}

export interface CreateLiveCategoryInput {
  name: string;
  pid?: string | null;
  sort?: number;
  status?: number;
}

export async function createLiveCategory(data: CreateLiveCategoryInput): Promise<LiveCategory> {
  const rows = await db
    .insert(liveCategories)
    .values({
      name: data.name,
      pid: data.pid,
      sort: data.sort,
      status: data.status,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建直播分类失败');
  return row;
}

export interface UpdateLiveCategoryInput {
  name?: string;
  pid?: string | null;
  sort?: number;
  status?: number;
}

export async function updateLiveCategory(
  id: string,
  data: UpdateLiveCategoryInput,
): Promise<LiveCategory | undefined> {
  const set: Record<string, unknown> = {};
  if (data.name !== undefined) set.name = data.name;
  if (data.pid !== undefined) set.pid = data.pid;
  if (data.sort !== undefined) set.sort = data.sort;
  if (data.status !== undefined) set.status = data.status;
  const rows = await db
    .update(liveCategories)
    .set(set)
    .where(eq(liveCategories.id, id))
    .returning();
  return rows[0];
}

export async function deleteLiveCategory(id: string): Promise<void> {
  await db.delete(liveCategories).where(eq(liveCategories.id, id));
}

// =============================================================================
// 频道
// =============================================================================

export interface FindLiveChannelsOpts {
  page: number;
  pageSize: number;
  search?: string;
  categoryId?: string;
  lecturerId?: string;
  isLive?: boolean;
  status?: number;
  publishedOnly?: boolean;
}

/** 分页查询直播频道，支持按 title 模糊搜索与多条件筛选。 */
export async function findLiveChannels(
  opts: FindLiveChannelsOpts,
): Promise<{ list: LiveChannel[]; total: number; page: number; pageSize: number }> {
  const conds = [];
  if (opts.search) conds.push(ilike(liveChannels.title, `%${opts.search}%`));
  if (opts.categoryId) conds.push(eq(liveChannels.categoryId, opts.categoryId));
  if (opts.lecturerId) conds.push(eq(liveChannels.lecturerId, opts.lecturerId));
  if (opts.isLive !== undefined) conds.push(eq(liveChannels.isLive, opts.isLive));
  if (opts.status !== undefined) conds.push(eq(liveChannels.status, opts.status));
  if (opts.publishedOnly) {
    conds.push(eq(liveChannels.isPublished, true), eq(liveChannels.status, 1));
  }
  const where = and(...conds);

  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(liveChannels)
      .where(where)
      .orderBy(desc(liveChannels.id))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(liveChannels).where(where),
  ]);
  return { list, total: totalRows[0]?.count ?? 0, page: opts.page, pageSize: opts.pageSize };
}

export async function findLiveChannelById(id: string): Promise<LiveChannel | undefined> {
  const rows = await db.select().from(liveChannels).where(eq(liveChannels.id, id)).limit(1);
  return rows[0];
}

/** 批量按 ID 查询启用的频道。 */
export async function findLiveChannelsByIds(ids: string[]): Promise<LiveChannel[]> {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(liveChannels)
    .where(and(inArray(liveChannels.id, ids), eq(liveChannels.status, 1)))
    .orderBy(desc(liveChannels.id));
}

export interface CreateLiveChannelInput {
  title: string;
  coverImage?: string | null;
  intro?: string | null;
  categoryId?: string | null;
  lecturerId?: string | null;
  lecturerName?: string | null;
  pushUrl?: string | null;
  playUrl?: string | null;
  startTime?: Date | null;
  endTime?: Date | null;
  isLive?: boolean;
  isPublished?: boolean;
  sort?: number;
  status?: number;
}

export async function createLiveChannel(data: CreateLiveChannelInput): Promise<LiveChannel> {
  const rows = await db
    .insert(liveChannels)
    .values({
      title: data.title,
      coverImage: data.coverImage,
      intro: data.intro,
      categoryId: data.categoryId,
      lecturerId: data.lecturerId,
      lecturerName: data.lecturerName,
      pushUrl: data.pushUrl,
      playUrl: data.playUrl,
      startTime: data.startTime,
      endTime: data.endTime,
      isLive: data.isLive,
      isPublished: data.isPublished,
      sort: data.sort,
      status: data.status,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建直播频道失败');
  return row;
}

export interface UpdateLiveChannelInput {
  title?: string;
  coverImage?: string | null;
  intro?: string | null;
  categoryId?: string | null;
  lecturerId?: string | null;
  lecturerName?: string | null;
  pushUrl?: string | null;
  playUrl?: string | null;
  startTime?: Date | null;
  endTime?: Date | null;
  isLive?: boolean;
  isPublished?: boolean;
  sort?: number;
  status?: number;
}

export async function updateLiveChannel(
  id: string,
  data: UpdateLiveChannelInput,
): Promise<LiveChannel | undefined> {
  const set: Record<string, unknown> = {};
  if (data.title !== undefined) set.title = data.title;
  if (data.coverImage !== undefined) set.coverImage = data.coverImage;
  if (data.intro !== undefined) set.intro = data.intro;
  if (data.categoryId !== undefined) set.categoryId = data.categoryId;
  if (data.lecturerId !== undefined) set.lecturerId = data.lecturerId;
  if (data.lecturerName !== undefined) set.lecturerName = data.lecturerName;
  if (data.pushUrl !== undefined) set.pushUrl = data.pushUrl;
  if (data.playUrl !== undefined) set.playUrl = data.playUrl;
  if (data.startTime !== undefined) set.startTime = data.startTime;
  if (data.endTime !== undefined) set.endTime = data.endTime;
  if (data.isLive !== undefined) set.isLive = data.isLive;
  if (data.isPublished !== undefined) set.isPublished = data.isPublished;
  if (data.sort !== undefined) set.sort = data.sort;
  if (data.status !== undefined) set.status = data.status;
  const rows = await db
    .update(liveChannels)
    .set(set)
    .where(eq(liveChannels.id, id))
    .returning();
  return rows[0];
}

export async function deleteLiveChannel(id: string): Promise<void> {
  await db.delete(liveChannels).where(eq(liveChannels.id, id));
}

/** 增加频道浏览数。 */
export async function incrementLiveViewCount(id: string): Promise<void> {
  await db
    .update(liveChannels)
    .set({ viewCount: sql<number>`${liveChannels.viewCount} + 1` })
    .where(eq(liveChannels.id, id));
}

// =============================================================================
// 讲师
// =============================================================================

export interface FindLecturersOpts {
  page: number;
  pageSize: number;
  name?: string;
  status?: number;
}

/** 分页查询讲师，支持 name 模糊搜索。 */
export async function findLecturers(
  opts: FindLecturersOpts,
): Promise<{ list: LiveLecturer[]; total: number; page: number; pageSize: number }> {
  const conds = [];
  if (opts.name) conds.push(ilike(liveLecturers.name, `%${opts.name}%`));
  if (opts.status !== undefined) conds.push(eq(liveLecturers.status, opts.status));
  const where = and(...conds);

  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(liveLecturers)
      .where(where)
      .orderBy(asc(liveLecturers.sort), desc(liveLecturers.id))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(liveLecturers).where(where),
  ]);
  return { list, total: totalRows[0]?.count ?? 0, page: opts.page, pageSize: opts.pageSize };
}

export async function findLecturerById(id: string): Promise<LiveLecturer | undefined> {
  const rows = await db.select().from(liveLecturers).where(eq(liveLecturers.id, id)).limit(1);
  return rows[0];
}

export interface CreateLecturerInput {
  name: string;
  avatar?: string | null;
  title?: string | null;
  intro?: string | null;
  sort?: number;
  status?: number;
}

export async function createLecturer(data: CreateLecturerInput): Promise<LiveLecturer> {
  const rows = await db
    .insert(liveLecturers)
    .values({
      name: data.name,
      avatar: data.avatar,
      title: data.title,
      intro: data.intro,
      sort: data.sort,
      status: data.status,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建讲师失败');
  return row;
}

export interface UpdateLecturerInput {
  name?: string;
  avatar?: string | null;
  title?: string | null;
  intro?: string | null;
  sort?: number;
  status?: number;
}

export async function updateLecturer(
  id: string,
  data: UpdateLecturerInput,
): Promise<LiveLecturer | undefined> {
  const set: Record<string, unknown> = {};
  if (data.name !== undefined) set.name = data.name;
  if (data.avatar !== undefined) set.avatar = data.avatar;
  if (data.title !== undefined) set.title = data.title;
  if (data.intro !== undefined) set.intro = data.intro;
  if (data.sort !== undefined) set.sort = data.sort;
  if (data.status !== undefined) set.status = data.status;
  const rows = await db
    .update(liveLecturers)
    .set(set)
    .where(eq(liveLecturers.id, id))
    .returning();
  return rows[0];
}

export async function deleteLecturer(id: string): Promise<void> {
  await db.delete(liveLecturers).where(eq(liveLecturers.id, id));
}

// =============================================================================
// 统计
// =============================================================================

export interface LiveStatistics {
  total: number;
  living: number;
  published: number;
  viewSum: number;
}

/** 直播统计：频道总数/正在直播数/已发布数/总浏览数。 */
export async function getLiveStatistics(): Promise<LiveStatistics> {
  const [totalRows, livingRows, publishedRows, viewRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(liveChannels),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(liveChannels)
      .where(and(eq(liveChannels.isLive, true), eq(liveChannels.status, 1))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(liveChannels)
      .where(and(eq(liveChannels.isPublished, true), eq(liveChannels.status, 1))),
    db
      .select({ sum: sql<number>`coalesce(sum(${liveChannels.viewCount}), 0)::int` })
      .from(liveChannels)
      .where(eq(liveChannels.status, 1)),
  ]);
  return {
    total: totalRows[0]?.count ?? 0,
    living: livingRows[0]?.count ?? 0,
    published: publishedRows[0]?.count ?? 0,
    viewSum: viewRows[0]?.sum ?? 0,
  };
}
