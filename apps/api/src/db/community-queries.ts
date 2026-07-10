import { eq, and, desc, asc, sql, ilike, or } from 'drizzle-orm'
import { db, dbRead } from './index.js'
import {
  circles,
  circlePosts,
  asks,
  askAnswers,
  users,
  type Circle,
  type CirclePost,
  type Ask,
  type AskAnswer,
} from '@ihui/database'

// =============================================================================
// Circles
// =============================================================================

interface ListCirclesOpts {
  page: number
  pageSize: number
  search?: string
}

/**
 * 圈子列表(仅已发布)，支持按 name/description 模糊搜索，按 postCount→createdAt 排序。
 */
export async function findCircles(
  opts: ListCirclesOpts,
): Promise<{ list: Circle[]; total: number }> {
  const conds = [eq(circles.isPublished, true)]
  if (opts.search) {
    const kw = `%${opts.search}%`
    conds.push(or(ilike(circles.name, kw), ilike(circles.description, kw))!)
  }
  const where = and(...conds)

  const [list, totalRows] = await Promise.all([
    dbRead
      .select()
      .from(circles)
      .where(where)
      .orderBy(desc(circles.postCount), desc(circles.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    dbRead
      .select({ count: sql<number>`COUNT(*)` })
      .from(circles)
      .where(where),
  ])

  return { list, total: Number(totalRows[0]?.count ?? 0) }
}

export async function findCircleById(id: string): Promise<Circle | undefined> {
  const rows = await dbRead.select().from(circles).where(eq(circles.id, id)).limit(1)
  return rows[0]
}

export async function findCircleBySlug(slug: string): Promise<Circle | undefined> {
  const rows = await dbRead.select().from(circles).where(eq(circles.slug, slug)).limit(1)
  return rows[0]
}

/**
 * 根据 id 或 slug 查询圈子。优先按 UUID 查找，再按 slug 查找。
 */
export async function findCircleByIdOrSlug(idOrSlug: string): Promise<Circle | undefined> {
  // UUID 格式：直接按 id 查
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (uuidRe.test(idOrSlug)) {
    return findCircleById(idOrSlug)
  }
  return findCircleBySlug(idOrSlug)
}

/** 管理员删除圈子（硬删除）。 */
export async function deleteCircle(id: string): Promise<void> {
  await db.delete(circles).where(eq(circles.id, id))
}

/** 管理员更新圈子显示状态。 */
export async function updateCircleShowStatus(
  id: string,
  isPublished: boolean,
): Promise<Circle | undefined> {
  const rows = await db
    .update(circles)
    .set({ isPublished, updatedAt: new Date() })
    .where(eq(circles.id, id))
    .returning()
  return rows[0]
}

// =============================================================================
// Circle Posts
// =============================================================================

interface ListCirclePostsOpts {
  page: number
  pageSize: number
}

/**
 * 圈子帖子列表(仅 status=1 正常)，置顶在前，创建时间倒序。
 */
export async function findCirclePosts(
  circleId: string,
  opts: ListCirclePostsOpts,
): Promise<{ list: (CirclePost & { authorName: string | null })[]; total: number }> {
  const where = and(eq(circlePosts.circleId, circleId), eq(circlePosts.status, 1))
  const cols = {
    id: circlePosts.id,
    circleId: circlePosts.circleId,
    userId: circlePosts.userId,
    title: circlePosts.title,
    content: circlePosts.content,
    images: circlePosts.images,
    viewCount: circlePosts.viewCount,
    likeCount: circlePosts.likeCount,
    replyCount: circlePosts.replyCount,
    isPinned: circlePosts.isPinned,
    status: circlePosts.status,
    createdAt: circlePosts.createdAt,
    updatedAt: circlePosts.updatedAt,
    authorName: users.nickname,
  }
  const [list, totalRows] = await Promise.all([
    dbRead
      .select(cols)
      .from(circlePosts)
      .leftJoin(users, eq(users.id, circlePosts.userId))
      .where(where)
      .orderBy(desc(circlePosts.isPinned), desc(circlePosts.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    dbRead
      .select({ count: sql<number>`COUNT(*)` })
      .from(circlePosts)
      .where(where),
  ])
  return { list, total: Number(totalRows[0]?.count ?? 0) }
}

export async function findPostById(id: string): Promise<CirclePost | undefined> {
  const rows = await dbRead.select().from(circlePosts).where(eq(circlePosts.id, id)).limit(1)
  return rows[0]
}

export interface CreatePostInput {
  title: string
  content: string
  images?: string[] | null
}

export async function createPost(
  circleId: string,
  userId: string,
  data: CreatePostInput,
): Promise<CirclePost> {
  const rows = await db
    .insert(circlePosts)
    .values({
      circleId,
      userId,
      title: data.title,
      content: data.content,
      images: data.images ?? null,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建帖子失败')
  // 冗余计数 +1
  await db
    .update(circles)
    .set({ postCount: sql`${circles.postCount} + 1`, updatedAt: new Date() })
    .where(eq(circles.id, circleId))
  return row
}

export interface UpdatePostInput {
  title?: string
  content?: string
  images?: string[] | null
}

/**
 * 编辑帖子(仅本人)。返回更新后的行；若不存在或非本人则返回 undefined。
 */
export async function updatePost(
  id: string,
  userId: string,
  data: UpdatePostInput,
): Promise<CirclePost | undefined> {
  const set: Record<string, unknown> = { updatedAt: new Date() }
  if (data.title !== undefined) set.title = data.title
  if (data.content !== undefined) set.content = data.content
  if (data.images !== undefined) set.images = data.images
  const rows = await db
    .update(circlePosts)
    .set(set)
    .where(and(eq(circlePosts.id, id), eq(circlePosts.userId, userId)))
    .returning()
  return rows[0]
}

/**
 * 删除帖子(硬删除,仅本人)。返回是否删除成功。
 */
export async function deletePost(id: string, userId: string): Promise<boolean> {
  // 先查出帖子，用于回写圈子计数
  const existing = await findPostById(id)
  if (!existing || existing.userId !== userId) return false
  const rows = await db
    .delete(circlePosts)
    .where(and(eq(circlePosts.id, id), eq(circlePosts.userId, userId)))
    .returning({ id: circlePosts.id })
  if (rows.length > 0 && existing.circleId) {
    await db
      .update(circles)
      .set({ postCount: sql`GREATEST(${circles.postCount} - 1, 0)`, updatedAt: new Date() })
      .where(eq(circles.id, existing.circleId))
  }
  return rows.length > 0
}

// =============================================================================
// Asks
// =============================================================================

interface ListAsksOpts {
  page: number
  pageSize: number
  search?: string
  resolved?: boolean
}

/**
 * 问答列表(仅 status=1 正常)，支持按 title/content 模糊搜索与 resolved 筛选。
 */
export async function findAsks(
  opts: ListAsksOpts,
): Promise<{ list: (Ask & { authorName: string | null })[]; total: number }> {
  const conds = [eq(asks.status, 1)]
  if (opts.search) {
    const kw = `%${opts.search}%`
    conds.push(or(ilike(asks.title, kw), ilike(asks.content, kw))!)
  }
  if (opts.resolved !== undefined) {
    conds.push(eq(asks.isResolved, opts.resolved))
  }
  const where = and(...conds)
  const cols = {
    id: asks.id,
    userId: asks.userId,
    title: asks.title,
    content: asks.content,
    tags: asks.tags,
    viewCount: asks.viewCount,
    answerCount: asks.answerCount,
    likeCount: asks.likeCount,
    isResolved: asks.isResolved,
    status: asks.status,
    createdAt: asks.createdAt,
    updatedAt: asks.updatedAt,
    authorName: users.nickname,
  }

  const [list, totalRows] = await Promise.all([
    dbRead
      .select(cols)
      .from(asks)
      .leftJoin(users, eq(users.id, asks.userId))
      .where(where)
      .orderBy(desc(asks.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    dbRead
      .select({ count: sql<number>`COUNT(*)` })
      .from(asks)
      .where(where),
  ])
  return { list, total: Number(totalRows[0]?.count ?? 0) }
}

export async function findAskById(
  id: string,
): Promise<(Ask & { authorName: string | null }) | undefined> {
  const cols = {
    id: asks.id,
    userId: asks.userId,
    title: asks.title,
    content: asks.content,
    tags: asks.tags,
    viewCount: asks.viewCount,
    answerCount: asks.answerCount,
    likeCount: asks.likeCount,
    isResolved: asks.isResolved,
    status: asks.status,
    createdAt: asks.createdAt,
    updatedAt: asks.updatedAt,
    authorName: users.nickname,
  }
  const rows = await dbRead
    .select(cols)
    .from(asks)
    .leftJoin(users, eq(users.id, asks.userId))
    .where(eq(asks.id, id))
    .limit(1)
  return rows[0]
}

export interface CreateAskInput {
  title: string
  content: string
  tags?: string[] | null
}

export async function createAsk(userId: string, data: CreateAskInput): Promise<Ask> {
  const rows = await db
    .insert(asks)
    .values({
      userId,
      title: data.title,
      content: data.content,
      tags: data.tags ?? null,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建问答失败')
  return row
}

export interface UpdateAskInput {
  title?: string
  content?: string
  tags?: string[] | null
}

/**
 * 编辑问题(仅本人)。返回更新后的行；若不存在或非本人则返回 undefined。
 */
export async function updateAsk(
  id: string,
  userId: string,
  data: UpdateAskInput,
): Promise<Ask | undefined> {
  const set: Record<string, unknown> = { updatedAt: new Date() }
  if (data.title !== undefined) set.title = data.title
  if (data.content !== undefined) set.content = data.content
  if (data.tags !== undefined) set.tags = data.tags
  const rows = await db
    .update(asks)
    .set(set)
    .where(and(eq(asks.id, id), eq(asks.userId, userId)))
    .returning()
  return rows[0]
}

/**
 * 删除问题(硬删除,仅本人)。返回是否删除成功。
 */
export async function deleteAsk(id: string, userId: string): Promise<boolean> {
  const rows = await db
    .delete(asks)
    .where(and(eq(asks.id, id), eq(asks.userId, userId)))
    .returning({ id: asks.id })
  return rows.length > 0
}

// =============================================================================
// Ask Answers
// =============================================================================

interface ListAskAnswersOpts {
  page: number
  pageSize: number
}

/**
 * 问答回答列表(仅 status=1 正常)，被采纳答案置顶，其余按点赞数→创建时间排序。
 */
export async function findAskAnswers(
  askId: string,
  opts: ListAskAnswersOpts,
): Promise<{ list: (AskAnswer & { authorName: string | null })[]; total: number }> {
  const where = and(eq(askAnswers.askId, askId), eq(askAnswers.status, 1))
  const cols = {
    id: askAnswers.id,
    askId: askAnswers.askId,
    userId: askAnswers.userId,
    content: askAnswers.content,
    likeCount: askAnswers.likeCount,
    isAccepted: askAnswers.isAccepted,
    status: askAnswers.status,
    createdAt: askAnswers.createdAt,
    authorName: users.nickname,
  }
  const [list, totalRows] = await Promise.all([
    dbRead
      .select(cols)
      .from(askAnswers)
      .leftJoin(users, eq(users.id, askAnswers.userId))
      .where(where)
      .orderBy(desc(askAnswers.isAccepted), desc(askAnswers.likeCount), asc(askAnswers.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    dbRead
      .select({ count: sql<number>`COUNT(*)` })
      .from(askAnswers)
      .where(where),
  ])
  return { list, total: Number(totalRows[0]?.count ?? 0) }
}

export async function findAnswerById(id: string): Promise<AskAnswer | undefined> {
  const rows = await dbRead.select().from(askAnswers).where(eq(askAnswers.id, id)).limit(1)
  return rows[0]
}

export async function createAnswer(
  askId: string,
  userId: string,
  content: string,
): Promise<AskAnswer> {
  const rows = await db.insert(askAnswers).values({ askId, userId, content }).returning()
  const row = rows[0]
  if (!row) throw new Error('创建回答失败')
  // 冗余计数 +1
  await db
    .update(asks)
    .set({ answerCount: sql`${asks.answerCount} + 1`, updatedAt: new Date() })
    .where(eq(asks.id, askId))
  return row
}

/**
 * 采纳答案(仅提问者可操作)。
 * - 校验 answer 存在且 answer.askId 对应的 ask.userId === 操作者
 * - 清除同 ask 下其它答案的 isAccepted，再置当前答案为 accepted
 * - 标记 ask.isResolved = true
 * 返回更新后的答案；若权限不足或不存在返回 undefined。
 */
export async function acceptAnswer(
  answerId: string,
  userId: string,
): Promise<AskAnswer | undefined> {
  const answer = await findAnswerById(answerId)
  if (!answer) return undefined
  const ask = await findAskById(answer.askId)
  if (!ask || ask.userId !== userId) return undefined

  // 清除同 ask 下其它答案的 accepted
  await db
    .update(askAnswers)
    .set({ isAccepted: false })
    .where(and(eq(askAnswers.askId, ask.id), eq(askAnswers.isAccepted, true)))

  // 置当前答案为 accepted
  const rows = await db
    .update(askAnswers)
    .set({ isAccepted: true })
    .where(eq(askAnswers.id, answerId))
    .returning()

  // 标记问题已解决
  await db.update(asks).set({ isResolved: true, updatedAt: new Date() }).where(eq(asks.id, ask.id))

  return rows[0]
}
