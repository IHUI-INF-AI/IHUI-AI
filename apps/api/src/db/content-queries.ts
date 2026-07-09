import { eq, and, desc, asc, sql, or, isNull, gt } from 'drizzle-orm';
import { db } from './index.js';
import {
  announcements,
  helpArticles,
  helpCategories,
  docs,
  announcementReads,
  type Announcement,
  type HelpArticle,
  type HelpCategory,
  type Doc,
} from '@ihui/database';

// =============================================================================
// Announcements
// =============================================================================

/**
 * 公开查询公告列表：仅已发布、未过期，置顶在前、published_at 在后。
 */
export async function findAnnouncements(): Promise<Announcement[]> {
  const now = new Date();
  return db
    .select()
    .from(announcements)
    .where(
      and(
        eq(announcements.isPublished, true),
        or(isNull(announcements.expiresAt), gt(announcements.expiresAt, now)),
      ),
    )
    .orderBy(desc(announcements.isPinned), desc(announcements.publishedAt));
}

export async function findAnnouncementById(id: string): Promise<Announcement | undefined> {
  const rows = await db
    .select()
    .from(announcements)
    .where(eq(announcements.id, id))
    .limit(1);
  return rows[0];
}

export interface CreateAnnouncementInput {
  title: string;
  content: string;
  type?: string;
  isPinned?: boolean;
  isPublished?: boolean;
  publishedAt?: Date | null;
  expiresAt?: Date | null;
  createdBy?: string;
}

export async function createAnnouncement(data: CreateAnnouncementInput): Promise<Announcement> {
  const isPublished = data.isPublished ?? false;
  const rows = await db
    .insert(announcements)
    .values({
      title: data.title,
      content: data.content,
      type: data.type,
      isPinned: data.isPinned,
      isPublished,
      publishedAt: data.publishedAt ?? (isPublished ? new Date() : null),
      expiresAt: data.expiresAt,
      createdBy: data.createdBy,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建公告失败');
  return row;
}

export interface UpdateAnnouncementInput {
  title?: string;
  content?: string;
  type?: string;
  isPinned?: boolean;
  isPublished?: boolean;
  publishedAt?: Date | null;
  expiresAt?: Date | null;
}

export async function updateAnnouncement(
  id: string,
  data: UpdateAnnouncementInput,
): Promise<Announcement | undefined> {
  // 发布切换：从未发布变为发布时自动填充 publishedAt
  const setPublishedAt =
    data.isPublished === true
      ? { publishedAt: data.publishedAt ?? new Date() }
      : data.publishedAt !== undefined
        ? { publishedAt: data.publishedAt }
        : {};

  const rows = await db
    .update(announcements)
    .set({
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.content !== undefined ? { content: data.content } : {}),
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.isPinned !== undefined ? { isPinned: data.isPinned } : {}),
      ...(data.isPublished !== undefined ? { isPublished: data.isPublished } : {}),
      ...setPublishedAt,
      ...(data.expiresAt !== undefined ? { expiresAt: data.expiresAt } : {}),
      updatedAt: new Date(),
    })
    .where(eq(announcements.id, id))
    .returning();
  return rows[0];
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await db.delete(announcements).where(eq(announcements.id, id));
}

// =============================================================================
// Help Categories
// =============================================================================

export async function findHelpCategories(): Promise<HelpCategory[]> {
  return db
    .select()
    .from(helpCategories)
    .orderBy(asc(helpCategories.sortOrder), asc(helpCategories.createdAt));
}

export async function findHelpCategoryById(id: string): Promise<HelpCategory | undefined> {
  const rows = await db
    .select()
    .from(helpCategories)
    .where(eq(helpCategories.id, id))
    .limit(1);
  return rows[0];
}

export async function findHelpCategoryBySlug(slug: string): Promise<HelpCategory | undefined> {
  const rows = await db
    .select()
    .from(helpCategories)
    .where(eq(helpCategories.slug, slug))
    .limit(1);
  return rows[0];
}

export interface CreateHelpCategoryInput {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  sortOrder?: number;
}

export async function createHelpCategory(data: CreateHelpCategoryInput): Promise<HelpCategory> {
  const rows = await db
    .insert(helpCategories)
    .values({
      name: data.name,
      slug: data.slug,
      description: data.description,
      icon: data.icon,
      sortOrder: data.sortOrder,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建帮助分类失败');
  return row;
}

export interface UpdateHelpCategoryInput {
  name?: string;
  slug?: string;
  description?: string | null;
  icon?: string | null;
  sortOrder?: number;
}

export async function updateHelpCategory(
  id: string,
  data: UpdateHelpCategoryInput,
): Promise<HelpCategory | undefined> {
  const rows = await db
    .update(helpCategories)
    .set({
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.slug !== undefined ? { slug: data.slug } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.icon !== undefined ? { icon: data.icon } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
    })
    .where(eq(helpCategories.id, id))
    .returning();
  return rows[0];
}

export async function deleteHelpCategory(id: string): Promise<void> {
  await db.delete(helpCategories).where(eq(helpCategories.id, id));
}

// =============================================================================
// Help Articles
// =============================================================================

export async function findHelpArticles(category?: string): Promise<HelpArticle[]> {
  const where = category ? eq(helpArticles.category, category) : undefined;
  return db
    .select()
    .from(helpArticles)
    .where(where)
    .orderBy(asc(helpArticles.sortOrder), desc(helpArticles.createdAt));
}

export async function findHelpArticleBySlug(slug: string): Promise<HelpArticle | undefined> {
  const rows = await db
    .select()
    .from(helpArticles)
    .where(eq(helpArticles.slug, slug))
    .limit(1);
  return rows[0];
}

export async function findHelpArticleById(id: string): Promise<HelpArticle | undefined> {
  const rows = await db
    .select()
    .from(helpArticles)
    .where(eq(helpArticles.id, id))
    .limit(1);
  return rows[0];
}

export interface CreateHelpArticleInput {
  category?: string;
  title: string;
  slug: string;
  content: string;
  sortOrder?: number;
  isPublished?: boolean;
}

export async function createHelpArticle(data: CreateHelpArticleInput): Promise<HelpArticle> {
  const rows = await db
    .insert(helpArticles)
    .values({
      category: data.category,
      title: data.title,
      slug: data.slug,
      content: data.content,
      sortOrder: data.sortOrder,
      isPublished: data.isPublished,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建帮助文章失败');
  return row;
}

export interface UpdateHelpArticleInput {
  category?: string;
  title?: string;
  slug?: string;
  content?: string;
  sortOrder?: number;
  isPublished?: boolean;
}

export async function updateHelpArticle(
  id: string,
  data: UpdateHelpArticleInput,
): Promise<HelpArticle | undefined> {
  const rows = await db
    .update(helpArticles)
    .set({
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.slug !== undefined ? { slug: data.slug } : {}),
      ...(data.content !== undefined ? { content: data.content } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      ...(data.isPublished !== undefined ? { isPublished: data.isPublished } : {}),
      updatedAt: new Date(),
    })
    .where(eq(helpArticles.id, id))
    .returning();
  return rows[0];
}

export async function deleteHelpArticle(id: string): Promise<void> {
  await db.delete(helpArticles).where(eq(helpArticles.id, id));
}

export async function incrementHelpArticleView(id: string): Promise<void> {
  await db
    .update(helpArticles)
    .set({ viewCount: sql<number>`${helpArticles.viewCount} + 1` })
    .where(eq(helpArticles.id, id));
}

/**
 * 查询帮助文章的上一篇/下一篇（同分类、已发布，排序与列表一致）。
 * 返回 { prev?, next? }，仅含 slug + title。
 */
export async function findHelpArticleNeighbors(
  current: HelpArticle,
): Promise<{ prev?: { slug: string; title: string }; next?: { slug: string; title: string } }> {
  const list = await db
    .select({ slug: helpArticles.slug, title: helpArticles.title, id: helpArticles.id })
    .from(helpArticles)
    .where(and(eq(helpArticles.category, current.category), eq(helpArticles.isPublished, true)))
    .orderBy(asc(helpArticles.sortOrder), desc(helpArticles.createdAt));
  const idx = list.findIndex((r) => r.id === current.id);
  if (idx === -1) return {};
  const prevItem = idx > 0 ? list[idx - 1] : undefined;
  const nextItem = idx < list.length - 1 ? list[idx + 1] : undefined;
  const prev = prevItem ? { slug: prevItem.slug, title: prevItem.title } : undefined;
  const next = nextItem ? { slug: nextItem.slug, title: nextItem.title } : undefined;
  return { prev, next };
}

/**
 * 查询帮助分类名称：按 slug 匹配 helpCategories，未匹配则返回 null。
 */
export async function findHelpCategoryNameBySlug(slug: string): Promise<string | null> {
  const rows = await db
    .select({ name: helpCategories.name })
    .from(helpCategories)
    .where(eq(helpCategories.slug, slug))
    .limit(1);
  return rows[0]?.name ?? null;
}

// =============================================================================
// Docs
// =============================================================================

/**
 * 公开查询文档列表：仅 published，支持 category 筛选。
 */
export async function findDocs(category?: string): Promise<Doc[]> {
  const conds = [eq(docs.status, 'published')];
  if (category) conds.push(eq(docs.category, category));
  return db
    .select()
    .from(docs)
    .where(and(...conds))
    .orderBy(asc(docs.sortOrder), desc(docs.createdAt));
}

/** 管理端:列出全部文档(含未发布),可选分类筛选 */
export async function findAllDocs(category?: string): Promise<Doc[]> {
  const where = category ? eq(docs.category, category) : undefined;
  return db
    .select()
    .from(docs)
    .where(where)
    .orderBy(asc(docs.sortOrder), desc(docs.createdAt));
}

export async function findDocBySlug(slug: string): Promise<Doc | undefined> {
  const rows = await db.select().from(docs).where(eq(docs.slug, slug)).limit(1);
  return rows[0];
}

export async function findDocById(id: string): Promise<Doc | undefined> {
  const rows = await db.select().from(docs).where(eq(docs.id, id)).limit(1);
  return rows[0];
}

export interface CreateDocInput {
  category?: string;
  title: string;
  slug: string;
  content: string;
  authorId?: string;
  status?: string;
  sortOrder?: number;
}

export async function createDoc(data: CreateDocInput): Promise<Doc> {
  const rows = await db
    .insert(docs)
    .values({
      category: data.category,
      title: data.title,
      slug: data.slug,
      content: data.content,
      authorId: data.authorId,
      status: data.status,
      sortOrder: data.sortOrder,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建文档失败');
  return row;
}

export interface UpdateDocInput {
  category?: string;
  title?: string;
  slug?: string;
  content?: string;
  status?: string;
  sortOrder?: number;
}

export async function updateDoc(id: string, data: UpdateDocInput): Promise<Doc | undefined> {
  const rows = await db
    .update(docs)
    .set({
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.slug !== undefined ? { slug: data.slug } : {}),
      ...(data.content !== undefined ? { content: data.content } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      updatedAt: new Date(),
    })
    .where(eq(docs.id, id))
    .returning();
  return rows[0];
}

export async function deleteDoc(id: string): Promise<void> {
  await db.delete(docs).where(eq(docs.id, id));
}

export async function incrementDocView(id: string): Promise<void> {
  await db
    .update(docs)
    .set({ viewCount: sql<number>`${docs.viewCount} + 1` })
    .where(eq(docs.id, id));
}

/**
 * 查询文档的上一篇/下一篇（同分类、已发布，排序与列表一致）。
 * 返回 { prev?, next? }，仅含 slug + title。
 */
export async function findDocNeighbors(
  current: Doc,
): Promise<{ prev?: { slug: string; title: string }; next?: { slug: string; title: string } }> {
  const list = await db
    .select({ slug: docs.slug, title: docs.title, id: docs.id })
    .from(docs)
    .where(and(eq(docs.category, current.category), eq(docs.status, 'published')))
    .orderBy(asc(docs.sortOrder), desc(docs.createdAt));
  const idx = list.findIndex((r) => r.id === current.id);
  if (idx === -1) return {};
  const prevItem = idx > 0 ? list[idx - 1] : undefined;
  const nextItem = idx < list.length - 1 ? list[idx + 1] : undefined;
  const prev = prevItem ? { slug: prevItem.slug, title: prevItem.title } : undefined;
  const next = nextItem ? { slug: nextItem.slug, title: nextItem.title } : undefined;
  return { prev, next };
}

// =============================================================================
// Announcement Reads (已读持久化)
// =============================================================================

/** 标记公告为已读（幂等：已存在则直接返回）。 */
export async function markAnnouncementRead(userId: string, announcementId: string): Promise<void> {
  await db
    .insert(announcementReads)
    .values({ userId, announcementId })
    .onConflictDoNothing();
}

/** 查询用户已读的公告 ID 集合（用于未读红点计算）。 */
export async function findReadAnnouncementIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ announcementId: announcementReads.announcementId })
    .from(announcementReads)
    .where(eq(announcementReads.userId, userId));
  return rows.map((r) => r.announcementId);
}

/** 统计用户未读公告数（已发布公告 - 已读数）。 */
export async function countUnreadAnnouncements(userId: string): Promise<{ total: number; unread: number; unreadIds: string[] }> {
  const now = new Date();
  // 已发布公告
  const published = await db
    .select({ id: announcements.id })
    .from(announcements)
    .where(
      and(
        eq(announcements.isPublished, true),
        or(isNull(announcements.expiresAt), gt(announcements.expiresAt, now)),
      ),
    );
  const publishedIds = published.map((p) => p.id);

  if (publishedIds.length === 0) {
    return { total: 0, unread: 0, unreadIds: [] };
  }

  // 已读 ID
  const readIds = await findReadAnnouncementIds(userId);
  const readSet = new Set(readIds);
  const unreadIds = publishedIds.filter((id) => !readSet.has(id));

  return { total: publishedIds.length, unread: unreadIds.length, unreadIds };
}
