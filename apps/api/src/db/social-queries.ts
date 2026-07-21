import { randomBytes } from 'node:crypto'
import { eq, and, desc, asc, sql } from 'drizzle-orm'
import { db } from './index.js'
import {
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

export async function findFavorites(
  opts: PageOpts & { userId: string; resourceType?: string },
): Promise<{ list: UserFavorite[]; total: number }> {
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
  return { list, total: Number(totalRows[0]?.count ?? 0) }
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
