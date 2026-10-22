// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { randomBytes } from 'node:crypto'
import { eq, and, ne, gt, desc, asc, sql, inArray } from 'drizzle-orm'
import { db } from './index.js'
import {
  comments,
  circlePosts,
  docs,
  files,
  projects,
  userFollows,
  userFavorites,
  subscriptions,
  tags,
  tagRelations,
  users,
  type Tag,
  type UserFavorite,
  type Subscription,
  type TagRelation,
} from '@ihui/database'

// =============================================================================
// Follows
// =============================================================================

/**
 * 关注用户（幂等）。不允许关注自己。
 */
export async function followUser(followerId: string, followingId: string): Promise<void> {
  if (followerId === followingId) {
    throw Object.assign(new Error('不能关注自己'), { statusCode: 400 })
  }
  await db.insert(userFollows).values({ followerId, followingId }).onConflictDoNothing()
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  await db
    .delete(userFollows)
    .where(and(eq(userFollows.followerId, followerId), eq(userFollows.followingId, followingId)))
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const rows = await db
    .select({ id: userFollows.id })
    .from(userFollows)
    .where(and(eq(userFollows.followerId, followerId), eq(userFollows.followingId, followingId)))
    .limit(1)
  return rows.length > 0
}

/** 检查是否互相关注（双向关注）。 */
export async function isMutualFollowing(userIdA: string, userIdB: string): Promise<boolean> {
  const aFollowsB = await isFollowing(userIdA, userIdB)
  if (!aFollowsB) return false
  const bFollowsA = await isFollowing(userIdB, userIdA)
  return bFollowsA
}

export interface FollowListItem {
  id: string
  userId: string
  nickname: string | null
  avatar: string | null
  createdAt: Date
}

interface PageOpts {
  page: number
  pageSize: number
}

/** 我关注的用户列表（join users 取昵称/头像）。 */
export async function findFollowing(
  opts: PageOpts & { userId: string },
): Promise<{ list: FollowListItem[]; total: number }> {
  const where = eq(userFollows.followerId, opts.userId)
  const [list, totalRows] = await Promise.all([
    db
      .select({
        id: userFollows.id,
        userId: userFollows.followingId,
        nickname: users.nickname,
        avatar: users.avatar,
        createdAt: userFollows.createdAt,
      })
      .from(userFollows)
      .innerJoin(users, eq(users.id, userFollows.followingId))
      .where(where)
      .orderBy(desc(userFollows.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(userFollows)
      .where(where),
  ])
  return { list, total: Number(totalRows[0]?.count ?? 0) }
}

/** 关注我的用户列表。 */
export async function findFollowers(
  opts: PageOpts & { userId: string },
): Promise<{ list: FollowListItem[]; total: number }> {
  const where = eq(userFollows.followingId, opts.userId)
  const [list, totalRows] = await Promise.all([
    db
      .select({
        id: userFollows.id,
        userId: userFollows.followerId,
        nickname: users.nickname,
        avatar: users.avatar,
        createdAt: userFollows.createdAt,
      })
      .from(userFollows)
      .innerJoin(users, eq(users.id, userFollows.followerId))
      .where(where)
      .orderBy(desc(userFollows.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(userFollows)
      .where(where),
  ])
  return { list, total: Number(totalRows[0]?.count ?? 0) }
}

/** 统计用户关注了多少人。 */
export async function countFollowing(userId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(userFollows)
    .where(eq(userFollows.followerId, userId))
  return Number(rows[0]?.count ?? 0)
}

/** 统计用户有多少粉丝。 */
export async function countFollowers(userId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(userFollows)
    .where(eq(userFollows.followingId, userId))
  return Number(rows[0]?.count ?? 0)
}

/** 推荐用户候选(圈子广场「推荐关注」副榜)。 */
export interface RecommendedUserItem {
  id: string
  nickname: string | null
  avatar: string | null
  bio: string | null
  followerCount: number
}

/**
 * 相关性最高的用户候选(粉丝数口径),分页。
 *
 * 状态过滤用的是 users.status 现列(0=禁用 1=正常 3=注销,见 schema/users.ts),
 * 只推 status=1 ⇒ 禁用与注销账号不进推荐位。
 *
 * 排序必须确定性:ORDER BY RANDOM() 会让同一页每次刷新换一批、翻页出现重复/漏项。
 * 口径 = 粉丝数倒序 + (同人多号无歧义的)users.id 升序兜底 tie-break。
 */
export async function findRecommendedUsers(
  opts: PageOpts & { excludeUserId?: string },
): Promise<{ list: RecommendedUserItem[]; total: number }> {
  const conds = [eq(users.status, 1)]
  if (opts.excludeUserId) conds.push(ne(users.id, opts.excludeUserId))
  const where = and(...conds)
  const followerCount = sql<number>`(SELECT COUNT(*)::int FROM ${userFollows} uf WHERE uf.following_id = ${users.id})`
  const [list, totalRows] = await Promise.all([
    db
      .select({
        id: users.id,
        nickname: users.nickname,
        avatar: users.avatar,
        bio: users.bio,
        followerCount,
      })
      .from(users)
      .where(where)
      .orderBy(desc(followerCount), asc(users.id))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(users)
      .where(where),
  ])
  return {
    list: list.map((row) => ({ ...row, followerCount: Number(row.followerCount) })),
    total: Number(totalRows[0]?.count ?? 0),
  }
}

/**
 * 在一批候选用户里,取「follower 已关注」的那些 id。
 * 一次 inArray 查询,不逐行 isFollowing(N 候选 = N 次查询)。
 */
export async function findFollowingIds(
  followerId: string,
  targetIds: readonly string[],
): Promise<string[]> {
  if (targetIds.length === 0) return []
  const rows = await db
    .select({ id: userFollows.followingId })
    .from(userFollows)
    .where(
      and(eq(userFollows.followerId, followerId), inArray(userFollows.followingId, [...targetIds])),
    )
  return rows.map((row) => row.id)
}

// =============================================================================
// Favorites
// =============================================================================

export async function addFavorite(input: {
  userId: string
  resourceType: string
  resourceId: string
}): Promise<void> {
  await db
    .insert(userFavorites)
    .values({
      userId: input.userId,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
    })
    .onConflictDoNothing()
}

export async function removeFavorite(input: {
  userId: string
  resourceType: string
  resourceId: string
}): Promise<void> {
  await db
    .delete(userFavorites)
    .where(
      and(
        eq(userFavorites.userId, input.userId),
        eq(userFavorites.resourceType, input.resourceType),
        eq(userFavorites.resourceId, input.resourceId),
      ),
    )
}

export async function isFavorited(input: {
  userId: string
  resourceType: string
  resourceId: string
}): Promise<boolean> {
  const rows = await db
    .select({ id: userFavorites.id })
    .from(userFavorites)
    .where(
      and(
        eq(userFavorites.userId, input.userId),
        eq(userFavorites.resourceType, input.resourceType),
        eq(userFavorites.resourceId, input.resourceId),
      ),
    )
    .limit(1)
  return rows.length > 0
}

/** 收藏列表条目(含关联资源标题) */
export interface FavoriteWithTitle extends UserFavorite {
  title?: string
}

/** 按资源类型批量取标题:project/file/doc/post/comment → name/title/content。 */
async function resolveTitles(favorites: UserFavorite[]): Promise<Map<string, string>> {
  const byType = new Map<string, string[]>()
  for (const f of favorites) {
    const arr = byType.get(f.resourceType) ?? []
    arr.push(f.resourceId)
    byType.set(f.resourceType, arr)
  }
  const titleById = new Map<string, string>()
  for (const [type, ids] of byType) {
    if (ids.length === 0) continue
    try {
      if (type === 'project') {
        const rows = await db
          .select({ id: projects.id, name: projects.name })
          .from(projects)
          .where(inArray(projects.id, ids as never))
        for (const r of rows) titleById.set(`project:${r.id}`, r.name)
      } else if (type === 'file') {
        const rows = await db
          .select({ id: files.id, name: files.name })
          .from(files)
          .where(inArray(files.id, ids as never))
        for (const r of rows) titleById.set(`file:${r.id}`, r.name)
      } else if (type === 'doc') {
        const rows = await db
          .select({ id: docs.id, title: docs.title })
          .from(docs)
          .where(inArray(docs.id, ids as never))
        for (const r of rows) titleById.set(`doc:${r.id}`, r.title)
      } else if (type === 'post') {
        const rows = await db
          .select({ id: circlePosts.id, title: circlePosts.title })
          .from(circlePosts)
          .where(inArray(circlePosts.id, ids as never))
        for (const r of rows) titleById.set(`post:${r.id}`, r.title)
      } else if (type === 'comment') {
        const rows = await db
          .select({ id: comments.id, content: comments.content })
          .from(comments)
          .where(inArray(comments.id, ids as never))
        for (const r of rows) titleById.set(`comment:${r.id}`, r.content)
      }
    } catch {
      // 单类资源查询失败不影响其余类型
    }
  }
  return titleById
}

export async function findFavorites(
  opts: PageOpts & { userId: string; resourceType?: string },
): Promise<{ list: FavoriteWithTitle[]; total: number }> {
  const conds = [eq(userFavorites.userId, opts.userId)]
  if (opts.resourceType) conds.push(eq(userFavorites.resourceType, opts.resourceType))
  const where = and(...conds)
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(userFavorites)
      .where(where)
      .orderBy(desc(userFavorites.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(userFavorites)
      .where(where),
  ])
  const titles = await resolveTitles(list)
  const enriched: FavoriteWithTitle[] = list.map((f) => ({
    ...f,
    title: titles.get(`${f.resourceType}:${f.resourceId}`),
  }))
  return { list: enriched, total: Number(totalRows[0]?.count ?? 0) }
}

/** 统计用户收藏的资源总数。 */
export async function countFavorites(userId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(userFavorites)
    .where(eq(userFavorites.userId, userId))
  return Number(rows[0]?.count ?? 0)
}

// =============================================================================
// Subscriptions
// =============================================================================

export async function subscribe(input: {
  userId: string
  targetType: string
  targetId: string
}): Promise<void> {
  await db
    .insert(subscriptions)
    .values({
      userId: input.userId,
      targetType: input.targetType,
      targetId: input.targetId,
    })
    .onConflictDoNothing()
}

export async function unsubscribe(input: {
  userId: string
  targetType: string
  targetId: string
}): Promise<void> {
  await db
    .delete(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, input.userId),
        eq(subscriptions.targetType, input.targetType),
        eq(subscriptions.targetId, input.targetId),
      ),
    )
}

export async function findSubscriptions(
  opts: PageOpts & { userId: string; targetType?: string },
): Promise<{ list: Subscription[]; total: number }> {
  const conds = [eq(subscriptions.userId, opts.userId)]
  if (opts.targetType) conds.push(eq(subscriptions.targetType, opts.targetType))
  const where = and(...conds)
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(subscriptions)
      .where(where)
      .orderBy(desc(subscriptions.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(subscriptions)
      .where(where),
  ])
  return { list, total: Number(totalRows[0]?.count ?? 0) }
}

/**
 * 当前用户是否已订阅某目标(2026-10-23 立,供 /circles/topic/:tid/follow 判翻转前态)。
 * 与 subscribe/unsubscribe 同表同判据(user_id + target_type + target_id 联合唯一),
 * 形状对齐既有的 isFavorited / isFollowing ⇒ 不另立一套"订阅关系读法"。
 */
export async function isSubscribed(input: {
  userId: string
  targetType: string
  targetId: string
}): Promise<boolean> {
  const rows = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, input.userId),
        eq(subscriptions.targetType, input.targetType),
        eq(subscriptions.targetId, input.targetId),
      ),
    )
    .limit(1)
  return rows.length > 0
}

/**
 * 某目标被多少用户订阅(话题「关注数」口径)。
 * 与 countFollowers / countFavorites 同为 COUNT(*) 实算,不是累加计数器 ⇒ 不会与明细漂移。
 */
export async function countSubscribers(targetType: string, targetId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(subscriptions)
    .where(and(eq(subscriptions.targetType, targetType), eq(subscriptions.targetId, targetId)))
  return Number(rows[0]?.count ?? 0)
}

// =============================================================================
// Tags
// =============================================================================

function slugify(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  // 2026-07-21 安全审计加固:用 CSPRNG 替换 Math.random 生成 tag 兜底 slug
  // 风险:可预测 tag slug → 攻击者猜测他人私有 tag → 越权访问
  return base || `tag-${randomBytes(8).toString('hex')}`
}

export async function createTag(input: {
  name: string
  description?: string
  color?: string
  createdBy?: string
}): Promise<Tag> {
  const rows = await db
    .insert(tags)
    .values({
      name: input.name,
      slug: slugify(input.name),
      description: input.description ?? null,
      color: input.color ?? null,
      createdBy: input.createdBy ?? null,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建标签失败')
  return row
}

/** 标签列表（按 usage_count 倒序，name 正序）。 */
export async function findTags(limit = 100): Promise<Tag[]> {
  return db.select().from(tags).orderBy(desc(tags.usageCount), asc(tags.name)).limit(limit)
}

/**
 * 热话题榜候选(圈子广场「热话题」副榜,2026-10-23 立)。
 *
 * 话题身份 = tags 行:本仓唯一"可命名 + 可计数"的社区话题实体。`circle_dynamic` 没有 name
 * 列(在册的 GET /api/circles/topic/list 返的就是它),`t_dynamic` 同形 ⇒ 从它们出榜就得
 * 现造 name/count,故不取。
 * 只给 usage_count > 0 的行:usage_count 由 attach(+1)/detach(-1) 维护(见 schema 头注),
 * 为 0 即"没人关联过",放进"热门"是噪声不是读数。
 * 排序与 findTags 同档(usage_count 倒序、同名次按 name 升序 ⇒ 分页稳定)。
 */
export async function findHotTags(opts: PageOpts): Promise<{ list: Tag[]; total: number }> {
  const where = gt(tags.usageCount, 0)
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(tags)
      .where(where)
      .orderBy(desc(tags.usageCount), asc(tags.name))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tags)
      .where(where),
  ])
  return { list, total: Number(totalRows[0]?.count ?? 0) }
}

export async function findTagBySlug(slug: string): Promise<Tag | undefined> {
  const rows = await db.select().from(tags).where(eq(tags.slug, slug)).limit(1)
  return rows[0]
}

export async function findTagById(id: string): Promise<Tag | undefined> {
  const rows = await db.select().from(tags).where(eq(tags.id, id)).limit(1)
  return rows[0]
}

/** 更新标签(name 变化时重算 slug)。 */
export async function updateTag(
  id: string,
  patch: { name?: string; description?: string | null; color?: string | null },
): Promise<Tag | undefined> {
  const set: Record<string, unknown> = {}
  if (patch.name !== undefined) {
    set.name = patch.name
    set.slug = slugify(patch.name)
  }
  if (patch.description !== undefined) set.description = patch.description
  if (patch.color !== undefined) set.color = patch.color
  if (Object.keys(set).length === 0) {
    return findTagById(id)
  }
  const rows = await db.update(tags).set(set).where(eq(tags.id, id)).returning()
  return rows[0]
}

/** 删除标签(级联删除 tag_relations,由外键 ON DELETE CASCADE 保证)。 */
export async function deleteTag(id: string): Promise<Tag | undefined> {
  const rows = await db.delete(tags).where(eq(tags.id, id)).returning()
  return rows[0]
}

/**
 * 关联标签到资源（幂等）。首次关联时 usage_count +1。
 * @returns 是否实际新增了关联（已存在则返回 false）。
 */
export async function attachTag(input: {
  tagId: string
  resourceType: string
  resourceId: string
  createdBy: string
}): Promise<boolean> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .insert(tagRelations)
      .values({
        tagId: input.tagId,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        createdBy: input.createdBy,
      })
      .onConflictDoNothing()
      .returning()
    if (rows.length > 0) {
      await tx
        .update(tags)
        .set({ usageCount: sql`${tags.usageCount} + 1` })
        .where(eq(tags.id, input.tagId))
      return true
    }
    return false
  })
}

/**
 * 移除标签关联（幂等）。实际删除时 usage_count -1（不低于 0）。
 * @returns 是否实际删除了关联。
 */
export async function detachTag(input: {
  tagId: string
  resourceType: string
  resourceId: string
}): Promise<boolean> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .delete(tagRelations)
      .where(
        and(
          eq(tagRelations.tagId, input.tagId),
          eq(tagRelations.resourceType, input.resourceType),
          eq(tagRelations.resourceId, input.resourceId),
        ),
      )
      .returning()
    if (rows.length > 0) {
      await tx
        .update(tags)
        .set({ usageCount: sql`GREATEST(${tags.usageCount} - 1, 0)` })
        .where(eq(tags.id, input.tagId))
      return true
    }
    return false
  })
}

/**
 * 查询某个目标资源（resourceType + resourceId）绑定的所有标签。
 */
export async function findTagsByTarget(resourceType: string, resourceId: string): Promise<Tag[]> {
  return db
    .select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
      description: tags.description,
      color: tags.color,
      usageCount: tags.usageCount,
      createdBy: tags.createdBy,
      createdAt: tags.createdAt,
    })
    .from(tagRelations)
    .innerJoin(tags, eq(tagRelations.tagId, tags.id))
    .where(
      and(eq(tagRelations.resourceType, resourceType), eq(tagRelations.resourceId, resourceId)),
    )
    .orderBy(desc(tags.createdAt))
}

export async function findTagResources(
  opts: PageOpts & { tagId: string },
): Promise<{ list: TagRelation[]; total: number }> {
  const where = eq(tagRelations.tagId, opts.tagId)
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(tagRelations)
      .where(where)
      .orderBy(desc(tagRelations.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tagRelations)
      .where(where),
  ])
  return { list, total: Number(totalRows[0]?.count ?? 0) }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
