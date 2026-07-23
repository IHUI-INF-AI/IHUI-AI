/**
 * SM-2 间隔重复算法(Spaced Repetition System SuperMemo 2)。
 *
 * 用于错题本/复习调度,基于学生回忆质量(quality 0-5)计算下次复习间隔。
 *
 * 核心参数:
 * - easeFactor: 难度因子,初始 2.5,最低 1.3,最高 5.0,越高表示越容易记住
 * - interval: 复习间隔(天),repetition=0 → 1,repetition=1 → 6,否则 interval * easeFactor
 * - repetition: 成功重复次数,quality<3 时重置为 0
 * - quality: 回忆质量 0-5
 *   - 0-2: 完全忘记(重置 repetition 与 interval)
 *   - 3: 勉强回忆(延迟增加但不重置)
 *   - 4-5: 轻松回忆(正常推进)
 *
 * easeFactor 更新公式:
 *   EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
 *   若 EF' < 1.3,则 EF' = 1.3;若 EF' > 5.0,则 EF' = 5.0
 *
 * 纯算法模块,无副作用,不依赖 database / fastify / drizzle。
 */

/** SM-2 调度状态(持久化到错题记录)。 */
export interface SM2State {
  easeFactor: number
  interval: number
  repetition: number
}

/** SM-2 单次复习后的计算结果。 */
export interface SM2Result extends SM2State {
  nextReviewDate: Date
  quality: number
}

/** easeFactor 下限/上限常量。 */
export const SM2_EASE_FACTOR_MIN = 1.3
export const SM2_EASE_FACTOR_MAX = 5.0
/** easeFactor 初始默认值。 */
export const SM2_EASE_FACTOR_DEFAULT = 2.5

/**
 * 根据当前状态与回忆质量计算下一次复习调度。
 *
 * @param state 当前 SM-2 状态(easeFactor / interval / repetition)
 * @param quality 本次回忆质量,0-5 整数
 * @param now 当前时间(用于计算 nextReviewDate),默认 new Date()
 * @returns 新的 SM-2 状态 + nextReviewDate + quality
 * @throws {Error} quality 不在 0-5 范围内
 */
export function sm2Calculate(
  state: SM2State,
  quality: number,
  now: Date = new Date(),
): SM2Result {
  if (quality < 0 || quality > 5) {
    throw new Error(`quality must be 0-5, got ${quality}`)
  }

  let { easeFactor, interval, repetition } = state

  // easeFactor 输入保护:超出 [1.3, 5.0] 时回正
  if (easeFactor < SM2_EASE_FACTOR_MIN) easeFactor = SM2_EASE_FACTOR_DEFAULT
  if (easeFactor > SM2_EASE_FACTOR_MAX) easeFactor = SM2_EASE_FACTOR_MAX

  if (quality < 3) {
    // 回忆失败:重置重复次数与间隔
    repetition = 0
    interval = 1
  } else {
    // 回忆成功:推进间隔
    if (repetition === 0) {
      interval = 1
    } else if (repetition === 1) {
      interval = 6
    } else {
      interval = Math.round(interval * easeFactor)
    }
    repetition += 1
  }

  // 更新 easeFactor:EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  const delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
  easeFactor = easeFactor + delta
  if (easeFactor < SM2_EASE_FACTOR_MIN) easeFactor = SM2_EASE_FACTOR_MIN
  if (easeFactor > SM2_EASE_FACTOR_MAX) easeFactor = SM2_EASE_FACTOR_MAX

  // 计算下次复习日期 = now + interval 天
  const nextReviewDate = new Date(now)
  nextReviewDate.setDate(nextReviewDate.getDate() + interval)

  return {
    easeFactor: Math.round(easeFactor * 100) / 100, // 保留 2 位小数
    interval,
    repetition,
    nextReviewDate,
    quality,
  }
}

/**
 * 创建初始 SM-2 状态(新错题首次入库时使用)。
 * easeFactor=2.5,interval=0,repetition=0。
 */
export function createInitialSM2State(): SM2State {
  return {
    easeFactor: SM2_EASE_FACTOR_DEFAULT,
    interval: 0,
    repetition: 0,
  }
}

/**
 * 获取今日待复习的截止日期阈值(用于查询 dueDate <= now)。
 * 直接返回 now,调用方据此做 `where(lte(nextReviewDate, threshold))`。
 */
export function getDueDateThreshold(now: Date = new Date()): Date {
  return now
}
