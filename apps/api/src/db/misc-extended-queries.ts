import { eq, desc, asc } from 'drizzle-orm';
import { db } from './index.js';
import {
  hotWords,
  newsTops,
  newsRecommends,
  type HotWord,
  type NewsTop,
  type NewsRecommend,
} from '@ihui/database';

// =============================================================================
// HotWords - 热搜词
// =============================================================================

export async function findHotWordList(): Promise<HotWord[]> {
  return db
    .select()
    .from(hotWords)
    .orderBy(asc(hotWords.sort), desc(hotWords.createdAt));
}

export interface CreateHotWordInput {
  word: string;
  sort?: number;
  status?: string;
}

export async function createHotWord(data: CreateHotWordInput): Promise<HotWord> {
  const rows = await db
    .insert(hotWords)
    .values({
      word: data.word,
      sort: data.sort,
      status: data.status,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建热搜词失败');
  return row;
}

export interface UpdateHotWordInput {
  word?: string;
  sort?: number;
  status?: string;
}

export async function updateHotWord(
  id: string,
  data: UpdateHotWordInput,
): Promise<HotWord | undefined> {
  const set: Record<string, unknown> = {};
  if (data.word !== undefined) set.word = data.word;
  if (data.sort !== undefined) set.sort = data.sort;
  if (data.status !== undefined) set.status = data.status;
  set.updatedAt = new Date();
  const rows = await db.update(hotWords).set(set).where(eq(hotWords.id, id)).returning();
  return rows[0];
}

export async function deleteHotWord(id: string): Promise<void> {
  await db.delete(hotWords).where(eq(hotWords.id, id));
}

// =============================================================================
// NewsTops - 资讯置顶
// =============================================================================

export async function findNewsTopList(): Promise<NewsTop[]> {
  return db
    .select()
    .from(newsTops)
    .orderBy(asc(newsTops.sort), desc(newsTops.createdAt));
}

/** 按 newsId 查询置顶记录（用于判断是否已置顶）。 */
export async function findNewsTopByNewsId(newsId: string): Promise<NewsTop | undefined> {
  const rows = await db
    .select()
    .from(newsTops)
    .where(eq(newsTops.newsId, newsId))
    .limit(1);
  return rows[0];
}

export interface CreateNewsTopInput {
  newsId: string;
  sort?: number;
}

export async function createNewsTop(data: CreateNewsTopInput): Promise<NewsTop> {
  const rows = await db
    .insert(newsTops)
    .values({
      newsId: data.newsId,
      sort: data.sort,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建资讯置顶失败');
  return row;
}

/** 更新置顶排序（已有置顶记录时调用）。 */
export async function updateNewsTopSort(
  newsId: string,
  sort: number,
): Promise<NewsTop | undefined> {
  const rows = await db
    .update(newsTops)
    .set({ sort })
    .where(eq(newsTops.newsId, newsId))
    .returning();
  return rows[0];
}

export async function deleteNewsTop(newsId: string): Promise<void> {
  await db.delete(newsTops).where(eq(newsTops.newsId, newsId));
}

// =============================================================================
// NewsRecommends - 资讯推荐
// =============================================================================

export async function findNewsRecommendList(): Promise<NewsRecommend[]> {
  return db
    .select()
    .from(newsRecommends)
    .orderBy(asc(newsRecommends.sort), desc(newsRecommends.createdAt));
}

/** 按 newsId 查询推荐记录（用于判断是否已推荐）。 */
export async function findNewsRecommendByNewsId(
  newsId: string,
): Promise<NewsRecommend | undefined> {
  const rows = await db
    .select()
    .from(newsRecommends)
    .where(eq(newsRecommends.newsId, newsId))
    .limit(1);
  return rows[0];
}

export interface CreateNewsRecommendInput {
  newsId: string;
  sort?: number;
}

export async function createNewsRecommend(
  data: CreateNewsRecommendInput,
): Promise<NewsRecommend> {
  const rows = await db
    .insert(newsRecommends)
    .values({
      newsId: data.newsId,
      sort: data.sort,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建资讯推荐失败');
  return row;
}

/** 更新推荐排序（已有推荐记录时调用）。 */
export async function updateNewsRecommendSort(
  newsId: string,
  sort: number,
): Promise<NewsRecommend | undefined> {
  const rows = await db
    .update(newsRecommends)
    .set({ sort })
    .where(eq(newsRecommends.newsId, newsId))
    .returning();
  return rows[0];
}

export async function deleteNewsRecommend(newsId: string): Promise<void> {
  await db.delete(newsRecommends).where(eq(newsRecommends.newsId, newsId));
}
