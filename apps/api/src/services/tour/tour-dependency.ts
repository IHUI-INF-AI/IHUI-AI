/**
 * 旅游依赖管理服务。
 *
 * 管理旅游内容之间的依赖关系（requires / suggests / conflicts）：
 * - 上线前检查：所有 requires 依赖必须已 published。
 * - 下线检查：被其他已上线内容 requires 的，不可下线（除非强制）。
 * - 冲突检测：互斥关系不能同时上线。
 */

import { and, eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { tourContent, tourDependencies, type TourDependency } from '@ihui/database'

export type RelationType = 'requires' | 'suggests' | 'conflicts'

export interface DependencyCheckResult {
  ok: boolean
  blocking: Array<{ contentId: string; reason: string }>
  warnings: string[]
}

/** 添加依赖关系（同对去重）。 */
export async function addDependency(params: {
  contentId: string
  dependsOnId: string
  relationType?: RelationType
  note?: string
}): Promise<TourDependency> {
  if (params.contentId === params.dependsOnId) {
    throw new Error('不能依赖自身')
  }
  const [row] = await db
    .insert(tourDependencies)
    .values({
      contentId: params.contentId,
      dependsOnId: params.dependsOnId,
      relationType: params.relationType ?? 'requires',
      note: params.note,
    })
    .onConflictDoNothing()
    .returning()
  if (!row) {
    const [existing] = await db
      .select()
      .from(tourDependencies)
      .where(
        and(
          eq(tourDependencies.contentId, params.contentId),
          eq(tourDependencies.dependsOnId, params.dependsOnId),
        ),
      )
    if (!existing) throw new Error('依赖关系创建失败')
    return existing
  }
  return row
}

/** 移除依赖关系。 */
export async function removeDependency(contentId: string, dependsOnId: string): Promise<void> {
  await db
    .delete(tourDependencies)
    .where(
      and(eq(tourDependencies.contentId, contentId), eq(tourDependencies.dependsOnId, dependsOnId)),
    )
}

/** 列出某内容的所有依赖。 */
export async function listDependencies(contentId: string): Promise<TourDependency[]> {
  return db.select().from(tourDependencies).where(eq(tourDependencies.contentId, contentId))
}

/** 列出依赖某内容的所有"反向依赖"。 */
export async function listDependents(contentId: string): Promise<TourDependency[]> {
  return db.select().from(tourDependencies).where(eq(tourDependencies.dependsOnId, contentId))
}

/** 上线前检查：requires 依赖必须已 published，conflicts 依赖不能同时 published。 */
export async function checkPublishReadiness(contentId: string): Promise<DependencyCheckResult> {
  const result: DependencyCheckResult = { ok: true, blocking: [], warnings: [] }
  const deps = await listDependencies(contentId)

  for (const dep of deps) {
    const [target] = await db.select().from(tourContent).where(eq(tourContent.id, dep.dependsOnId))
    if (!target) {
      result.blocking.push({ contentId: dep.dependsOnId, reason: '依赖内容不存在' })
      continue
    }
    if (dep.relationType === 'requires' && target.status !== 'published') {
      result.blocking.push({
        contentId: dep.dependsOnId,
        reason: `requires 依赖未发布（当前状态：${target.status}）`,
      })
    }
    if (dep.relationType === 'conflicts' && target.status === 'published') {
      result.blocking.push({
        contentId: dep.dependsOnId,
        reason: '互斥内容已上线，不可同时发布',
      })
    }
    if (dep.relationType === 'suggests' && target.status !== 'published') {
      result.warnings.push(`建议依赖 ${dep.dependsOnId} 未发布`)
    }
  }

  result.ok = result.blocking.length === 0
  return result
}

/** 下线前检查：被其他已上线内容 requires 的，不允许下线。 */
export async function checkOfflineReadiness(contentId: string): Promise<DependencyCheckResult> {
  const result: DependencyCheckResult = { ok: true, blocking: [], warnings: [] }
  const dependents = await listDependents(contentId)

  for (const dep of dependents) {
    if (dep.relationType !== 'requires') continue
    const [dependent] = await db.select().from(tourContent).where(eq(tourContent.id, dep.contentId))
    if (dependent?.status === 'published') {
      result.blocking.push({
        contentId: dep.contentId,
        reason: '被已上线内容依赖，不可下线',
      })
    }
  }
  result.ok = result.blocking.length === 0
  return result
}
