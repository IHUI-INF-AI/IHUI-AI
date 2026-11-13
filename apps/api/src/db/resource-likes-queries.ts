// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from './index.js'
import { resourceLikes, type ResourceLike } from '@ihui/database'

/**
 * 幂等点赞(F-598)：已点赞时不重复写入，也绝不删除既有记录。
 * 并发双击/超时重试时 onConflictDoNothing 命中的冲突只说明「此前或并发请求已点赞」，
 * 仍返回 liked=true；原先冲突分支的 DELETE 会把对方刚插入的行删掉，
 * 导致两次点赞最终变成「未点赞」。取消点赞只能走 unlikeResource。
 */
export async function likeResource(
  resourceType: string,
  resourceId: string,
  userId: string,
): Promise<{ liked: boolean }> {
  await db
    .insert(resourceLikes)
    .values({ resourceType, resourceId, userId })
    .onConflictDoNothing({
      target: [resourceLikes.resourceType, resourceLikes.resourceId, resourceLikes.userId],
    })
    .returning()

  // 插入成功 = 刚点赞；唯一键冲突 = 早已点赞。两种情况的最终状态都是「已点赞」。
  return { liked: true }
}

/**
 * 幂等取消点赞：记录不存在时同样返回 liked=false，重复调用不报错、不产生副作用。
 */
export async function unlikeResource(
  resourceType: string,
  resourceId: string,
  userId: string,
): Promise<{ liked: boolean }> {
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

/**
 * 批量查询资源点赞数。
 * 替代旧架构 getLikeCountList,按 resourceType 筛选 + resourceIds 批量聚合。
 * 返回 Map<resourceId, count> 便于调用方 O(1) 查找。
 */
export async function findLikeCounts(
  resourceType: string,
  resourceIds: string[],
): Promise<Map<string, number>> {
  if (resourceIds.length === 0) return new Map()
  const rows = await db
    .select({
      resourceId: resourceLikes.resourceId,
      count: sql<number>`count(*)::int`,
    })
    .from(resourceLikes)
    .where(
      and(
        eq(resourceLikes.resourceType, resourceType),
        sql`${resourceLikes.resourceId} = ANY(${resourceIds})`,
      ),
    )
    .groupBy(resourceLikes.resourceId)
  return new Map(rows.map((r) => [r.resourceId, r.count]))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
