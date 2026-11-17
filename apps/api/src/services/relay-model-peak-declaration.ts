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
}

/** 单模型最多宣告几条:规则再多也不把目录撑爆。 */
export const PEAK_WINDOWS_LIMIT = 5

/**
 * 为单个模型挑出要宣告的窗口。
 *
 * 排序 = 专属规则(modelId 命中)优先 → 通用规则(modelId 为空)在后;同级保持入参顺序。
 * 返回 null 表示"这个模型没有可宣告的窗口"(调用方整键省略)。
 */
export function pickPeakWindowsForModel(
  windows: readonly PeakWindowSource[],
  modelId: string,
  limit: number = PEAK_WINDOWS_LIMIT,
): DeclaredPeakWindow[] | null {
  const target = normalizeModelId(modelId)
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
    })
  }

  return picked.length > 0 ? picked : null
}

/** 测试出口(判据只在本文件实现)。 */
export const __test__ = { pickPeakWindowsForModel }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
