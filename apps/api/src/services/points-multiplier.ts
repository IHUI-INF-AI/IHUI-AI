// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 积分消耗倍数:api 侧纯接线层(2026-11-23 收敛到共享单一规则源)。
 *
 * 规则表与关键词推断解释器住在 `@ihui/shared` 的 `points-multiplier-rules`
 * (JSON 单一真相源);本文件只保留 DB 覆盖值解析/合并的纯函数,推断委托共享规则,
 * 调用方 import 路径不变。语义边界不变:DB 覆盖优先,null=没配,0=显式免费。
 */
import { IHUI_POINTS_MAP, inferPointsMultiplierFromRules } from '@ihui/shared'

export { IHUI_POINTS_MAP }

/**
 * 把 DB 的 numeric(5,2) 覆盖值解析成有限非负数;空值/坏值返回 null。
 * 单独抽出来是为了让"后台配置值"与"关键词推断"有明确边界:
 * null = 没配,继续走 inferPointsMultiplier;0 = 显式免费,不要被当成没配。
 */
export function parsePointsMultiplierOverride(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** 覆盖值优先;未配置/坏值回落到关键词推断。纯函数,零 IO。 */
export function resolvePointsMultiplierWithOverride(
  modelId: string,
  override?: number | null,
): number {
  const parsed = parsePointsMultiplierOverride(override)
  return parsed === null ? inferPointsMultiplier(modelId) : parsed
}

/** 模型名归一:小写、去首尾空白、去号池后缀 ` [provider]`。 */
export function normalizePointsModelId(modelId: string): string {
  return (modelId || '')
    .trim()
    .toLowerCase()
    .replace(/\s*\[[^\]]*\]\s*$/, '')
}

export interface PointsMultiplierOverrideRow {
  modelId: string
  providerCode?: string | null
  pointsMultiplier: string | number | null
}

/**
 * 由 DB 行构造覆盖表。同一模型多条行时先到先得(调用方按公开优先/更新时间倒序传入),
 * 同时登记裸 model_id 与 `provider/model_id`,兼容公共目录与号池两种命名。
 */
export function buildPointsMultiplierOverrideMap(
  rows: readonly PointsMultiplierOverrideRow[],
): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of rows) {
    const raw = normalizePointsModelId(row.modelId)
    if (!raw) continue
    const value = parsePointsMultiplierOverride(row.pointsMultiplier)
    if (value === null) continue
    const keys = [raw]
    const provider = (row.providerCode || '').trim().toLowerCase()
    if (provider) keys.push(`${provider}/${raw}`)
    const lastSegment = raw.split('/').pop()
    if (lastSegment && lastSegment !== raw) keys.push(lastSegment)
    for (const key of keys) {
      if (!map.has(key)) map.set(key, value)
    }
  }
  return map
}

/** 按模型名查覆盖值;依次试完整名、去号池后缀名、最后一段。 */
export function lookupPointsMultiplierOverride(
  map: ReadonlyMap<string, number>,
  modelId: string,
): number | undefined {
  const normalized = normalizePointsModelId(modelId)
  if (!normalized) return undefined
  const direct = map.get(normalized)
  if (direct !== undefined) return direct
  const lastSegment = normalized.split('/').pop()
  if (lastSegment) {
    const byLast = map.get(lastSegment)
    if (byLast !== undefined) return byLast
  }
  return undefined
}

/**
 * 根据 model_id 推断积分消耗倍数(5 档梯度:0x 免费 / 1x 经济 / 3x 标准 / 10x 高级 / 30x 旗舰)。
 * 委托共享规则源 `inferPointsMultiplierFromRules`,判定顺序与档位与原本地判定体一致。
 */
export function inferPointsMultiplier(modelId: string): number {
  return inferPointsMultiplierFromRules(modelId)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
