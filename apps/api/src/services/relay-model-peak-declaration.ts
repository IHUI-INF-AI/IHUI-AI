// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `/v1/models` 的峰谷价宣告判据(2026-11-17 立)。
 *
 * 对标 qoder2api-hub:它在 `GET /v1/models` 里直接宣告模型的分时价档。
 * 本仓的价档真相源是 `peak-pricing-service` 的 `listPublicPeakWindows()`(已用于模型广场),
 * 这里只做**选取与整流**,不复算任何数值(§0.6 单一真相源)。
 *
 * 三条纪律:
 * - 宣告的是**时段乘子**不是绝对价格(绝对价目在计费侧,错误代价太高,不在这里出现)。
 * - 规则 `modelId` 为空 = 适用全部模型;专属规则排在通用规则前面(客户端先看专属)。
 * - 一条都不命中 ⇒ 返回 null,**整键省略**;绝不返回空数组假装"没有峰谷价"。
 */
import { normalizeModelId } from '@ihui/shared'
import { UTC8_OFFSET_MS, getUtc8WeekdayAndMinute, matchPeakRule } from './peak-pricing-service.js'

/** 输入面与 `listPublicPeakWindows()` 的条目同形(只取需要的字段)。 */
export interface PeakWindowSource {
  ruleName: string
  modelId: string | null
  daysOfWeek: number[]
  startMinute: number
  endMinute: number
  multiplier: number
}

/** 对外宣告的窗口(snake_case,与 /v1/models 其余字段同风格)。 */
export interface DeclaredPeakWindow {
  rule_name: string
  days_of_week: number[]
  start_minute: number
  end_minute: number
  multiplier: number
  timezone: 'UTC+8'
  /**
   * 此刻是否落在本窗口内(2026-11-17 补,对齐 qoder2api 的 `off_peak_active_now`:
   * 它把"现在是不是谷时"随价档一起交付,客户端不必自己再算一遍时区与跨天窗口)。
   *
   * 判据不在这里复算 —— 直接复用 `peak-pricing-service` 的 `matchPeakRule`(§0.6 单一真相源),
   * 因此跨天窗口(如 23:00-07:00)、空 daysOfWeek(每天)、0 长度时段(全天)三档语义与计费侧逐字一致。
   * 逐窗口给而不是整块给,是因为同一模型的专属/通用规则时段不同,"谷时"对每条规则各是一个答案。
   */
  active_now: boolean
}

/** 单模型最多宣告几条:规则再多也不把目录撑爆。 */
export const PEAK_WINDOWS_LIMIT = 5

/** 下一个价档切换点(对外宣告用)。 */
export interface PeakSwitchPoint {
  /** 切换发生的时刻(ISO 8601,UTC)。客户端按本地时区展示。 */
  at: string
  /** 切换之后的生效倍率(1 = 原价)。 */
  multiplier: number
  /** 切换之后命中的规则名;原价为 null。 */
  rule_name: string | null
  /** 切换之前的生效倍率(客户端据此判断是涨价还是降价)。 */
  from_multiplier: number
}

/** 向后扫几天:相邻两次切换最多隔 7 天(星期周期),8 天足够覆盖。 */
const SWITCH_SCAN_DAYS = 8

/**
 * 解析"下一次价档切换时刻"(2026-11-17 立)。
 *
 * 为什么客户端要这个:窗口清单 + `active_now` 只回答"现在什么价";错峰调度与定时提醒
 * 还要"什么时候变价"。让每个客户端各自展开星期与跨天窗口去算,既重复又容易算错 ——
 * 这里用与计费侧**同一个** `matchPeakRule` 采样判定,给出唯一权威切换点。
 *
 * 判法(不是猜边界):切换只能发生在分钟边界上,而可能翻转的分钟只有三类 ——
 * UTC+8 当日 0 点(星期切换)、各窗口的 startMinute、各窗口的 endMinute。
 * 对这些候选逐个比较"本分钟"与"上一分钟"的生效倍率,不同即为切换点,取最早一个。
 *
 * 生效倍率的口径与入参顺序一致(调用方给的是 priority 降序子集),取**首个命中**那条 ——
 * 与 `resolvePeakMultiplier` 的取法一致。
 *
 * 边界真相仍归 `matchPeakRule`:跨天窗口(23:00-07:00)不会延续到次日的早间分钟
 * (那时星期已变),故换日 0 点必须被采样,这条语义与计费侧逐字一致。
 */
export function resolveNextPeakSwitch(
  windows: readonly PeakWindowSource[],
  modelId: string,
  at: Date = new Date(),
): PeakSwitchPoint | null {
  if (windows.length === 0) return null

  const effectiveAt = (ms: number): { multiplier: number; ruleName: string | null } => {
    const { weekday, minute } = getUtc8WeekdayAndMinute(new Date(ms))
    for (const w of windows) {
      const hit = matchPeakRule(
        {
          enabled: true,
          modelId: w.modelId,
          daysOfWeek: w.daysOfWeek,
          startMinute: w.startMinute,
          endMinute: w.endMinute,
        },
        modelId,
        weekday,
        minute,
      )
      if (hit) return { multiplier: w.multiplier, ruleName: w.ruleName }
    }
    return { multiplier: 1, ruleName: null }
  }

  const baseMs = at.getTime()
  // UTC+8 当日 0 点对应的 UTC 毫秒(独立算,不复用 getUtc8WeekdayAndMinute 的返回值)
  const dayStartMs =
    Math.floor((baseMs + UTC8_OFFSET_MS) / 86_400_000) * 86_400_000 - UTC8_OFFSET_MS

  let best: PeakSwitchPoint | null = null
  let bestMs = Number.POSITIVE_INFINITY
  for (let d = 0; d <= SWITCH_SCAN_DAYS; d += 1) {
    const dayStart = dayStartMs + d * 86_400_000
    const candidates: number[] = [dayStart]
    for (const w of windows) {
      candidates.push(dayStart + w.startMinute * 60_000, dayStart + w.endMinute * 60_000)
    }
    for (const ms of candidates) {
      // 只取严格晚于 at 的时刻:等于 at 表示"此刻恰在边界",那不是"下一次"
      if (ms <= baseMs || ms >= bestMs) continue
      const after = effectiveAt(ms)
      const before = effectiveAt(ms - 60_000)
      if (after.multiplier === before.multiplier) continue
      bestMs = ms
      best = {
        at: new Date(ms).toISOString(),
        multiplier: after.multiplier,
        rule_name: after.ruleName,
        from_multiplier: before.multiplier,
      }
    }
  }
  return best
}

/**
 * 为单个模型挑出要宣告的窗口。
 *
 * 排序 = 专属规则(modelId 命中)优先 → 通用规则(modelId 为空)在后;同级保持入参顺序。
 * 返回 null 表示"这个模型没有可宣告的窗口"(调用方整键省略)。
 *
 * `at` 只影响 `active_now` 一列;不传即取当前时刻(端点每次请求现算,不缓存进结果)。
 */
export function pickPeakWindowsForModel(
  windows: readonly PeakWindowSource[],
  modelId: string,
  limit: number = PEAK_WINDOWS_LIMIT,
  at: Date = new Date(),
): DeclaredPeakWindow[] | null {
  const target = normalizeModelId(modelId)
  const { weekday, minute } = getUtc8WeekdayAndMinute(at)
  const specific: PeakWindowSource[] = []
  const generic: PeakWindowSource[] = []

  for (const w of windows) {
    if (w.modelId === null || w.modelId === '') {
      generic.push(w)
      continue
    }
    if (normalizeModelId(w.modelId) === target) specific.push(w)
  }

  // 同一条规则若既有专属又有通用重复声明,专属那条已经覆盖,通用那条仍保留(它适用于其他模型,
  // 对当前模型也成立)。去重键 = ruleName + 时段 + 倍率,避免同一规则出现两次。
  const seen = new Set<string>()
  const picked: DeclaredPeakWindow[] = []
  for (const w of [...specific, ...generic]) {
    if (picked.length >= limit) break
    const key = `${w.ruleName}|${w.startMinute}|${w.endMinute}|${w.multiplier}|${w.daysOfWeek.join(',')}`
    if (seen.has(key)) continue
    seen.add(key)
    picked.push({
      rule_name: w.ruleName,
      days_of_week: [...w.daysOfWeek],
      start_minute: w.startMinute,
      end_minute: w.endMinute,
      multiplier: w.multiplier,
      timezone: 'UTC+8',
      // 入参已由 listPublicPeakWindows() 过滤掉停用规则,这里按启用规则判(不另设 enabled 面)。
      active_now: matchPeakRule(
        {
          enabled: true,
          modelId: w.modelId,
          daysOfWeek: w.daysOfWeek,
          startMinute: w.startMinute,
          endMinute: w.endMinute,
        },
        modelId,
        weekday,
        minute,
      ),
    })
  }

  return picked.length > 0 ? picked : null
}

/** 测试出口(判据只在本文件实现)。 */
export const __test__ = { pickPeakWindowsForModel, resolveNextPeakSwitch }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
