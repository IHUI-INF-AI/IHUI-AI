import { eq, and, desc } from 'drizzle-orm'
import { db } from './index.js'
import { resourceLikes, type ResourceLike } from '@ihui/database'

/**
 * 切换点赞/收藏状态：若不存在则插入（liked=true），若已存在则删除（liked=false）。
 * 利用 onConflictDoNothing 保证并发安全。
 */
export async function toggleLike(
  resourceType: string,
  resourceId: string,
  userId: string,
): Promise<{ liked: boolean }> {
  const inserted = await db
    .insert(resourceLikes)
    .values({ resourceType, resourceId, userId })
    .onConflictDoNothing({
      target: [resourceLikes.resourceType, resourceLikes.resourceId, resourceLikes.userId],
    })
    .returning()

  if (inserted.length > 0) {
    return { liked: true }
  }

  await db
    .delete(resourceLikes)
    .where(
      and(
        eq(resourceLikes.resourceType, resourceType),
        eq(resourceLikes.resourceId, resourceId),
        eq(resourceLikes.userId, userId),
      ),
    )

  return { liked: false }
}

/**
 * 查询用户的点赞/收藏列表，可选按 resourceType 过滤，按创建时间倒序。
 */
export async function findLikesByUser(
  userId: string,
  resourceType?: string,
): Promise<ResourceLike[]> {
  const conds = [eq(resourceLikes.userId, userId)]
  if (resourceType) conds.push(eq(resourceLikes.resourceType, resourceType))
  return db
    .select()
    .from(resourceLikes)
    .where(and(...conds))
    .orderBy(desc(resourceLikes.createdAt))
}
