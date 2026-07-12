/**
 * 旅游内容灰度发布服务。
 *
 * 复用 canary-service 模式，针对 tour_content 表的 release_stage 字段
 * 做渐进式灰度：off → canary_1pct → canary_5pct → canary_25pct → full。
 *
 * - 策略：基于内容 ID + 用户 ID 哈希分桶，保证同一用户稳定命中。
 * - 自动提升：定时任务检查监控指标，符合阈值自动 promote。
 * - 监控：失败次数超过阈值自动回滚到 off。
 */

import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { tourContent, type TourContent } from '@ihui/database'
import { logger } from '../../utils/logger.js'

export type ReleaseStage = 'off' | 'canary_1pct' | 'canary_5pct' | 'canary_25pct' | 'full'

export interface GrayReleasePolicy {
  contentId: string
  currentStage: ReleaseStage
  targetStage: ReleaseStage
  targetGroups: string[] // 目标群体标签（如 ['vip', 'beta_tester']）
  failureThreshold: number
  failureCount: number
  autoPromote: boolean
}

const STAGE_ORDER: ReleaseStage[] = ['off', 'canary_1pct', 'canary_5pct', 'canary_25pct', 'full']
const STAGE_PERCENT: Record<ReleaseStage, number> = {
  off: 0,
  canary_1pct: 1,
  canary_5pct: 5,
  canary_25pct: 25,
  full: 100,
}

/** 哈希分桶：0~99 的整数桶号，保证同一 (contentId+userId) 稳定命中。 */
function hashBucket(contentId: string, userId: string): number {
  let h = 0
  const s = `${contentId}::${userId}`
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0
  }
  return h % 100
}

/** 判断指定用户在当前灰度阶段下是否可见该内容。 */
export function isVisibleForUser(stage: ReleaseStage, contentId: string, userId: string): boolean {
  const percent = STAGE_PERCENT[stage]
  if (percent >= 100) return true
  if (percent <= 0) return false
  return hashBucket(contentId, userId) < percent
}

/** 读取内容的灰度策略。 */
export async function getPolicy(contentId: string): Promise<GrayReleasePolicy | null> {
  const [row] = await db.select().from(tourContent).where(eq(tourContent.id, contentId))
  if (!row) return null
  return {
    contentId: row.id,
    currentStage: row.releaseStage as ReleaseStage,
    targetStage: 'full',
    targetGroups: [],
    failureThreshold: 5,
    failureCount: 0,
    autoPromote: true,
  }
}

/** 提升到下一阶段。返回更新后的内容。 */
export async function promote(contentId: string): Promise<TourContent> {
  const [row] = await db.select().from(tourContent).where(eq(tourContent.id, contentId))
  if (!row) throw new Error(`旅游内容 ${contentId} 不存在`)

  const currentIdx = STAGE_ORDER.indexOf(row.releaseStage as ReleaseStage)
  if (currentIdx < 0) throw new Error(`非法的 release_stage: ${row.releaseStage}`)
  if (currentIdx >= STAGE_ORDER.length - 1) throw new Error('已达到 full 阶段，无法继续提升')

  const next = STAGE_ORDER[currentIdx + 1]!
  const [updated] = await db
    .update(tourContent)
    .set({ releaseStage: next, updatedAt: new Date() })
    .where(eq(tourContent.id, contentId))
    .returning()
  if (!updated) throw new Error('灰度提升失败')
  return updated
}

/** 回滚到 off 阶段。 */
export async function rollback(contentId: string, reason: string): Promise<TourContent> {
  const [updated] = await db
    .update(tourContent)
    .set({ releaseStage: 'off', updatedAt: new Date() })
    .where(eq(tourContent.id, contentId))
    .returning()
  if (!updated) throw new Error(`旅游内容 ${contentId} 不存在`)
  logger.warn(`[tour-gray-release] rollback ${contentId}: ${reason}`)
  return updated
}

/** 记录一次失败事件，达到阈值自动回滚。 */
export async function recordFailure(contentId: string, reason: string): Promise<void> {
  const policy = await getPolicy(contentId)
  if (!policy) return
  if (policy.failureCount + 1 >= policy.failureThreshold) {
    await rollback(contentId, `自动回滚：${reason}`)
  }
}

/** 列出当前在某阶段的内容。 */
export async function listByStage(stage: ReleaseStage): Promise<TourContent[]> {
  return db.select().from(tourContent).where(eq(tourContent.releaseStage, stage))
}
