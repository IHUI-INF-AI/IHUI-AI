import { eq, and, isNull, desc, asc, sql } from 'drizzle-orm';
import { db } from './index.js';
import {
  comments,
  commentLikes,
  feedbacks,
  type Comment,
  type Feedback,
} from '@ihui/database';

// =============================================================================
// Comments
// =============================================================================

export interface CommentWithMeta extends Comment {
  repliesCount: number;
  likeCount: number;
  likedByMe: boolean;
}

interface ListCommentsOpts {
  resourceType: string;
  resourceId: string;
  parentId?: string | null;
  page: number;
  pageSize: number;
  currentUserId?: string;
}

/**
 * 查询评论列表（顶级或某父的子评论），带 repliesCount / likeCount / likedByMe 元数据。
 * - parentId 未传：返回顶级评论（parent_id IS NULL）。
 * - parentId 传值：返回该评论的直接回复。
 * 通过相关子查询取计数，避免 N+1。
 */
export async function findComments(
  opts: ListCommentsOpts,
): Promise<{ list: CommentWithMeta[]; total: number }> {
  const baseConds = [
    eq(comments.resourceType, opts.resourceType),
    eq(comments.resourceId, opts.resourceId),
  ];
  // parentId 为非空字符串：按父评论过滤；为 null/undefined：返回顶级评论
  const parentIdCond = opts.parentId
    ? eq(comments.parentId, opts.parentId)
    : isNull(comments.parentId);
  baseConds.push(parentIdCond);
  const where = and(...baseConds);

  const likedByMeExpr = opts.currentUserId
    ? sql<boolean>`EXISTS (SELECT 1 FROM comment_likes cl WHERE cl.comment_id = ${comments.id} AND cl.user_id = ${opts.currentUserId})`
    : sql<boolean>`false`;

  const [list, totalRows] = await Promise.all([
    db
      .select({
        id: comments.id,
        userId: comments.userId,
        resourceType: comments.resourceType,
        resourceId: comments.resourceId,
        parentId: comments.parentId,
        content: comments.content,
        mentions: comments.mentions,
        isDeleted: comments.isDeleted,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        repliesCount: sql<number>`(SELECT COUNT(*) FROM comments c2 WHERE c2.parent_id = ${comments.id})`.as('replies_count'),
        likeCount: sql<number>`(SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = ${comments.id})`.as('like_count'),
        likedByMe: likedByMeExpr.as('liked_by_me'),
      })
      .from(comments)
      .where(where)
      .orderBy(desc(comments.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ count: sql<number>`COUNT(*)` }).from(comments).where(where),
  ]);

  return { list, total: Number(totalRows[0]?.count ?? 0) };
}

export async function createComment(input: {
  userId: string;
  resourceType: string;
  resourceId: string;
  parentId?: string | null;
  content: string;
  mentions?: string[] | null;
}): Promise<Comment> {
  const rows = await db
    .insert(comments)
    .values({
      userId: input.userId,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      parentId: input.parentId ?? null,
      content: input.content,
      mentions: input.mentions ?? null,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建评论失败');
  return row;
}

export async function findCommentById(
  id: string,
  currentUserId?: string,
): Promise<CommentWithMeta | undefined> {
  const likedByMeExpr = currentUserId
    ? sql<boolean>`EXISTS (SELECT 1 FROM comment_likes cl WHERE cl.comment_id = ${comments.id} AND cl.user_id = ${currentUserId})`
    : sql<boolean>`false`;
  const rows = await db
    .select({
      id: comments.id,
      userId: comments.userId,
      resourceType: comments.resourceType,
      resourceId: comments.resourceId,
      parentId: comments.parentId,
      content: comments.content,
      mentions: comments.mentions,
      isDeleted: comments.isDeleted,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      repliesCount: sql<number>`(SELECT COUNT(*) FROM comments c2 WHERE c2.parent_id = ${comments.id})`.as('replies_count'),
      likeCount: sql<number>`(SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = ${comments.id})`.as('like_count'),
      likedByMe: likedByMeExpr.as('liked_by_me'),
    })
    .from(comments)
    .where(eq(comments.id, id))
    .limit(1);
  return rows[0];
}

/**
 * 编辑评论内容（仅本人，且未软删除）。返回更新后的行。
 */
export async function updateComment(
  id: string,
  userId: string,
  content: string,
): Promise<Comment | undefined> {
  const rows = await db
    .update(comments)
    .set({ content, updatedAt: new Date() })
    .where(and(eq(comments.id, id), eq(comments.userId, userId), eq(comments.isDeleted, false)))
    .returning();
  return rows[0];
}

/**
 * 软删除评论：is_deleted=true 且 content 替换为"已删除"。
 * 调用方负责权限校验（本人或 admin）。
 */
export async function softDeleteComment(id: string): Promise<Comment | undefined> {
  const rows = await db
    .update(comments)
    .set({ isDeleted: true, content: '已删除', updatedAt: new Date() })
    .where(and(eq(comments.id, id), eq(comments.isDeleted, false)))
    .returning();
  return rows[0];
}

// =============================================================================
// Comment Likes
// =============================================================================

/**
 * 点赞（幂等）。利用 (comment_id, user_id) 联合唯一约束，冲突时忽略。
 */
export async function likeComment(commentId: string, userId: string): Promise<void> {
  await db
    .insert(commentLikes)
    .values({ commentId, userId })
    .onConflictDoNothing();
}

export async function unlikeComment(commentId: string, userId: string): Promise<void> {
  await db
    .delete(commentLikes)
    .where(and(eq(commentLikes.commentId, commentId), eq(commentLikes.userId, userId)));
}

/**
 * 获取某评论的回复列表（分页，时间正序），同样带元数据。
 */
export async function findReplies(
  parentId: string,
  opts: { page: number; pageSize: number; currentUserId?: string },
): Promise<{ list: CommentWithMeta[]; total: number }> {
  const where = eq(comments.parentId, parentId);
  const likedByMeExpr = opts.currentUserId
    ? sql<boolean>`EXISTS (SELECT 1 FROM comment_likes cl WHERE cl.comment_id = ${comments.id} AND cl.user_id = ${opts.currentUserId})`
    : sql<boolean>`false`;

  const [list, totalRows] = await Promise.all([
    db
      .select({
        id: comments.id,
        userId: comments.userId,
        resourceType: comments.resourceType,
        resourceId: comments.resourceId,
        parentId: comments.parentId,
        content: comments.content,
        mentions: comments.mentions,
        isDeleted: comments.isDeleted,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        repliesCount: sql<number>`(SELECT COUNT(*) FROM comments c2 WHERE c2.parent_id = ${comments.id})`.as('replies_count'),
        likeCount: sql<number>`(SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = ${comments.id})`.as('like_count'),
        likedByMe: likedByMeExpr.as('liked_by_me'),
      })
      .from(comments)
      .where(where)
      .orderBy(asc(comments.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ count: sql<number>`COUNT(*)` }).from(comments).where(where),
  ]);

  return { list, total: Number(totalRows[0]?.count ?? 0) };
}

// =============================================================================
// Feedbacks
// =============================================================================

export async function createFeedback(input: {
  userId: string;
  type: string;
  title: string;
  content: string;
  contact?: string | null;
}): Promise<Feedback> {
  const rows = await db
    .insert(feedbacks)
    .values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      content: input.content,
      contact: input.contact ?? null,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建反馈失败');
  return row;
}

export async function findFeedbacksByUser(
  userId: string,
  page: number,
  pageSize: number,
): Promise<{ list: Feedback[]; total: number }> {
  const where = eq(feedbacks.userId, userId);
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(feedbacks)
      .where(where)
      .orderBy(desc(feedbacks.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`COUNT(*)` }).from(feedbacks).where(where),
  ]);
  return { list, total: Number(totalRows[0]?.count ?? 0) };
}

export async function findFeedbackById(id: string): Promise<Feedback | undefined> {
  const rows = await db.select().from(feedbacks).where(eq(feedbacks.id, id)).limit(1);
  return rows[0];
}

export async function findAllFeedbacksForAdmin(
  page: number,
  pageSize: number,
  opts: { type?: string; status?: string },
): Promise<{ list: Feedback[]; total: number }> {
  const conds = [];
  if (opts.type) conds.push(eq(feedbacks.type, opts.type));
  if (opts.status) conds.push(eq(feedbacks.status, opts.status));
  const where = conds.length > 0 ? and(...conds) : undefined;

  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(feedbacks)
      .where(where)
      .orderBy(desc(feedbacks.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`COUNT(*)` }).from(feedbacks).where(where),
  ]);
  return { list, total: Number(totalRows[0]?.count ?? 0) };
}

export async function updateFeedback(
  id: string,
  patch: { status?: string; priority?: string; adminReply?: string | null },
): Promise<Feedback | undefined> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.status !== undefined) set.status = patch.status;
  if (patch.priority !== undefined) set.priority = patch.priority;
  if (patch.adminReply !== undefined) set.adminReply = patch.adminReply;
  const rows = await db.update(feedbacks).set(set).where(eq(feedbacks.id, id)).returning();
  return rows[0];
}
